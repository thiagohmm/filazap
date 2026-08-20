import { Contact } from '../../domain/entities/Contact';
import { Ticket } from '../../domain/entities/Ticket';
import { Message } from '../../domain/entities/Message';
import { TicketEvent } from '../../domain/entities/TicketEvent';
import { WebhookEvent } from '../../domain/entities/WebhookEvent';
import { ChannelNotFoundError } from '../../domain/errors';
import { PhoneNumberE164 } from '../../domain/value-objects/PhoneNumberE164';
import { MessageDirection } from '../../domain/value-objects/MessageDirection';
import { TicketStatus } from '../../domain/value-objects/TicketStatus';
import { WebhookEventStatus } from '../../domain/value-objects/WebhookEventStatus';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { ContactRepository } from '../ports/ContactRepository';
import type { MessageRepository } from '../ports/MessageRepository';
import type { TicketEventRepository } from '../ports/TicketEventRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import type { WhatsAppChannelRepository } from '../ports/WhatsAppChannelRepository';
import type { WebhookEventRepository } from '../ports/WebhookEventRepository';
import type { WhatsAppWebhookParser } from '../ports/WhatsAppWebhookParser';
import type {
  ReceiveWhatsAppMessageInput,
  ReceiveWhatsAppMessageOutput
} from '../dto/ReceiveWhatsAppMessageDTO';

export class ReceiveWhatsAppMessage {
  constructor(
    private readonly deps: {
      webhookEvents: WebhookEventRepository;
      channels: WhatsAppChannelRepository;
      contacts: ContactRepository;
      tickets: TicketRepository;
      messages: MessageRepository;
      ticketEvents: TicketEventRepository;
      parser: WhatsAppWebhookParser;
      clock: Clock;
      logger: AuditLogger;
      idGenerator: () => string;
    }
  ) {}

  async execute(input: ReceiveWhatsAppMessageInput): Promise<ReceiveWhatsAppMessageOutput> {
    const event = WebhookEvent.create({
      id: this.deps.idGenerator(),
      payload: input.payload,
      processingStatus: WebhookEventStatus.PROCESSING,
      receivedAt: this.deps.clock.now()
    });
    await this.deps.webhookEvents.save(event);

    let duplicate = false;
    let messagesCount = 0;
    let statusesCount = 0;

    try {
      const parsed = this.deps.parser.parse(input.payload);

      for (const message of parsed.messages) {
        const existing = await this.deps.messages.findByWhatsappMessageId(
          message.whatsappMessageId
        );
        if (existing) {
          duplicate = true;
          continue;
        }
        await this.handleInbound(parsed, message);
        messagesCount += 1;
      }

      for (const status of parsed.statuses) {
        const message = await this.deps.messages.findByWhatsappMessageId(
          status.whatsappMessageId
        );
        if (!message) continue;
        const updated = Message.restore({
          ...message.toJSON(),
          providerStatus: status.status
        });
        await this.deps.messages.save(updated);
        statusesCount += 1;
      }

      event.markProcessed(this.deps.clock.now());
      await this.deps.webhookEvents.save(event);

      return { processed: true, duplicate, messagesCount, statusesCount };
    } catch (error) {
      event.markFailed(
        this.deps.clock.now(),
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
      await this.deps.webhookEvents.save(event);
      this.deps.logger.log('error', 'webhook.receive_failed', {
        webhookEventId: event.id,
        error: error instanceof Error ? error.message : 'unknown'
      });
      throw error;
    }
  }

  private async handleInbound(
    parsed: Awaited<ReturnType<WhatsAppWebhookParser['parse']>>,
    message: { whatsappMessageId: string; from: string; timestamp: string; type: string; body: string | null }
  ): Promise<void> {
    const messageTimestamp = new Date(Number(message.timestamp) * 1000);

    const channel = parsed.phoneNumberId
      ? await this.deps.channels.findByPhoneNumberId(parsed.phoneNumberId)
      : null;
    if (!channel) {
      throw new ChannelNotFoundError(parsed.phoneNumberId ?? 'desconhecido');
    }

    const phone = PhoneNumberE164.create(message.from);

    let contact = await this.deps.contacts.findByChannelAndPhone(
      channel.organizationId,
      channel.id,
      phone.e164
    );
    const isNewContact = !contact;
    if (isNewContact) {
      contact = Contact.create({
        id: this.deps.idGenerator(),
        organizationId: channel.organizationId,
        channelId: channel.id,
        phone,
        firstContactAt: messageTimestamp,
        lastContactAt: messageTimestamp
      });
    } else {
      contact = Contact.restore({
        ...contact!.toJSON(),
        lastContactAt: messageTimestamp
      });
    }
    await this.deps.contacts.save(contact);

    let ticket = await this.deps.tickets.findActiveByContact(contact.id);
    if (!ticket) {
      const sequenceNumber = await this.deps.tickets.nextSequenceNumber(
        channel.organizationId
      );
      const createdStatus = isNewContact
        ? TicketStatus.WAITING
        : TicketStatus.RETURNING;
      ticket = Ticket.create({
        id: this.deps.idGenerator(),
        organizationId: channel.organizationId,
        channelId: channel.id,
        contactId: contact.id,
        sequenceNumber,
        queueEnteredAt: messageTimestamp,
        status: createdStatus
      });
      await this.deps.ticketEvents.save(
        TicketEvent.create({
          id: this.deps.idGenerator(),
          organizationId: channel.organizationId,
          ticketId: ticket.id,
          eventType: 'TICKET_OPENED',
          fromStatus: null,
          toStatus: createdStatus,
          createdAt: messageTimestamp
        })
      );
    } else {
      const transitions: Array<{
        from: string;
        to: string;
        apply: (t: Ticket) => void;
      }> = [
        {
          from: TicketStatus.WAITING_CUSTOMER,
          to: TicketStatus.IN_PROGRESS,
          apply: (t) => t.customerReplied(messageTimestamp)
        }
      ];
      const transition = transitions.find((tr) => tr.from === ticket!.status);
      if (transition) {
        const fromStatus = ticket.status;
        transition.apply(ticket);
        await this.deps.ticketEvents.save(
          TicketEvent.create({
            id: this.deps.idGenerator(),
            organizationId: channel.organizationId,
            ticketId: ticket.id,
            eventType: 'TICKET_STATUS_CHANGED',
            fromStatus,
            toStatus: ticket.status,
            createdAt: messageTimestamp
          })
        );
      }
      ticket = Ticket.restore({
        ...ticket.toJSON(),
        lastMessageAt: messageTimestamp
      });
    }
    await this.deps.tickets.save(ticket);

    const record = Message.create({
      id: this.deps.idGenerator(),
      organizationId: channel.organizationId,
      ticketId: ticket.id,
      contactId: contact.id,
      whatsappMessageId: message.whatsappMessageId,
      direction: MessageDirection.INBOUND,
      type: message.type,
      body: message.body,
      providerTimestamp: messageTimestamp,
      createdAt: messageTimestamp
    });
    await this.deps.messages.save(record);
  }
}
