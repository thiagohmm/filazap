import { Message } from '../../domain/entities/Message';
import { TicketEvent } from '../../domain/entities/TicketEvent';
import {
  MemberNotFoundError,
  ChannelNotFoundError,
  ChannelNotConfiguredError,
  ContactNotFoundError,
  NoActiveTicketError
} from '../../domain/errors';
import { MessageDirection } from '../../domain/value-objects/MessageDirection';
import { TicketStatus } from '../../domain/value-objects/TicketStatus';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { ContactRepository } from '../ports/ContactRepository';
import type { CredentialCipher } from '../ports/CredentialCipher';
import type { MediaStorage } from '../ports/MediaStorage';
import type { MessageRepository } from '../ports/MessageRepository';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketEventRepository } from '../ports/TicketEventRepository';
import type { SendMessageResult } from '../ports/WhatsAppGateway';
import type { TicketRepository } from '../ports/TicketRepository';
import type { WhatsAppChannelRepository } from '../ports/WhatsAppChannelRepository';
import type { WhatsAppGateway } from '../ports/WhatsAppGateway';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type { SendMessageInput, SendMessageOutput } from '../dto/SendMessageDTO';

export class SendMessage {
  constructor(
    private readonly deps: {
      channels: WhatsAppChannelRepository;
      contacts: ContactRepository;
      tickets: TicketRepository;
      messages: MessageRepository;
      members: OrganizationMemberRepository;
      ticketEvents: TicketEventRepository;
      gateway: WhatsAppGateway;
      mediaStorage: MediaStorage;
      cipher: CredentialCipher;
      clock: Clock;
      logger: AuditLogger;
      idGenerator: () => string;
    }
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canSendMessages(actor);

    const channel = await this.deps.channels.findById(input.channelId);
    if (!channel) {
      throw new ChannelNotFoundError(input.channelId);
    }

    const contact = await this.deps.contacts.findById(input.contactId);
    if (!contact) {
      throw new ContactNotFoundError(input.contactId);
    }

    let ticket = await this.deps.tickets.findActiveByContact(contact.id);
    if (!ticket) {
      throw new NoActiveTicketError();
    }

    const now = this.deps.clock.now();

    if (ticket.status === TicketStatus.WAITING || ticket.status === TicketStatus.RETURNING) {
      const result = await this.deps.tickets.assignTicket(
        ticket.id,
        input.actorUserId,
        now
      );
      if (result.ok) {
        const fromStatus = ticket.status;
        ticket = result.ticket;
        await this.deps.ticketEvents.save(
          TicketEvent.create({
            id: this.deps.idGenerator(),
            organizationId: input.organizationId,
            ticketId: ticket.id,
            actorUserId: input.actorUserId,
            eventType: 'TICKET_ASSIGNED',
            fromStatus,
            toStatus: ticket.status
          })
        );
      } else {
        ticket = (await this.deps.tickets.findById(ticket.id))!;
      }
    }

    const fromStatus = ticket.status;
    ticket.registerFirstResponse(now);
    if (ticket.status === TicketStatus.IN_PROGRESS) {
      ticket.moveToWaitingCustomer(now);
    }
    await this.deps.tickets.save(ticket);

    if (fromStatus !== ticket.status) {
      await this.deps.ticketEvents.save(
        TicketEvent.create({
          id: this.deps.idGenerator(),
          organizationId: input.organizationId,
          ticketId: ticket.id,
          actorUserId: input.actorUserId,
          eventType: 'TICKET_STATUS_CHANGED',
          fromStatus,
          toStatus: ticket.status
        })
      );
    }

    if (!channel.accessTokenEncrypted) {
      throw new ChannelNotConfiguredError(channel.id);
    }
    const accessToken = this.deps.cipher.decrypt(channel.accessTokenEncrypted);

    let result: SendMessageResult;
    const isImage = input.media?.mimeType?.startsWith('image/') ?? false;

    if (input.media) {
      const fileData = await this.deps.mediaStorage.read(input.media.storedPath);
      const uploaded = await this.deps.gateway.uploadMedia({
        channel: { phoneNumberId: channel.phoneNumberId, accessToken },
        data: fileData,
        mimeType: input.media.mimeType,
        filename: input.media.filename
      });

      result = await this.deps.gateway.sendMedia({
        channel: { phoneNumberId: channel.phoneNumberId, accessToken },
        to: contact.phoneE164,
        fileRef: {
          fileId: uploaded.fileId,
          mimeType: input.media.mimeType,
          filename: input.media.filename
        },
        caption: input.media.caption ?? null,
        isImage
      });
    } else {
      result = await this.deps.gateway.sendText({
        channel: { phoneNumberId: channel.phoneNumberId, accessToken },
        to: contact.phoneE164,
        type: 'TEXT',
        body: input.body
      });
    }

    const message = Message.create({
      id: this.deps.idGenerator(),
      organizationId: input.organizationId,
      ticketId: ticket.id,
      contactId: contact.id,
      whatsappMessageId: result.providerMessageId,
      direction: MessageDirection.OUTBOUND,
      type: input.media
        ? isImage
          ? 'IMAGE'
          : 'DOCUMENT'
        : 'TEXT',
      body: input.media?.caption ?? (input.body || null),
      mediaPath: input.media?.storedPath ?? null,
      senderUserId: input.actorUserId,
      providerStatus: 'SENT',
      providerTimestamp: now,
      createdAt: now
    });
    await this.deps.messages.save(message);

    this.deps.logger.log('info', 'message.sent', {
      organizationId: input.organizationId,
      ticketId: ticket.id,
      messageId: message.id,
      actorUserId: input.actorUserId
    });

    return {
      message: {
        id: message.id,
        ticketId: message.ticketId,
        direction: message.direction,
        type: message.type,
        body: message.body,
        mediaPath: message.mediaPath,
        providerStatus: message.providerStatus,
        createdAt: message.createdAt
      }
    };
  }

  private async loadActor(userId: string, organizationId: string): Promise<Actor> {
    const member = await this.deps.members.findByUserAndOrganization(
      userId,
      organizationId
    );
    if (!member) {
      throw new MemberNotFoundError(userId, organizationId);
    }
    return {
      userId,
      role: member.role,
      active: member.active
    };
  }
}