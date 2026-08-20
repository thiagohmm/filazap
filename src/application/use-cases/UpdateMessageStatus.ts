import { Message } from '../../domain/entities/Message';
import { WebhookEvent } from '../../domain/entities/WebhookEvent';
import { WebhookEventStatus } from '../../domain/value-objects/WebhookEventStatus';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { MessageRepository } from '../ports/MessageRepository';
import type { WebhookEventRepository } from '../ports/WebhookEventRepository';
import type { WhatsAppWebhookParser } from '../ports/WhatsAppWebhookParser';
import type {
  UpdateMessageStatusInput,
  UpdateMessageStatusOutput
} from '../dto/UpdateMessageStatusDTO';

export class UpdateMessageStatus {
  constructor(
    private readonly deps: {
      webhookEvents: WebhookEventRepository;
      messages: MessageRepository;
      parser: WhatsAppWebhookParser;
      clock: Clock;
      logger: AuditLogger;
      idGenerator: () => string;
    }
  ) {}

  async execute(input: UpdateMessageStatusInput): Promise<UpdateMessageStatusOutput> {
    const event = WebhookEvent.create({
      id: this.deps.idGenerator(),
      payload: input.payload,
      processingStatus: WebhookEventStatus.PROCESSING,
      receivedAt: this.deps.clock.now()
    });
    await this.deps.webhookEvents.save(event);

    let updated = 0;
    try {
      const parsed = this.deps.parser.parse(input.payload);
      for (const status of parsed.statuses) {
        const message = await this.deps.messages.findByWhatsappMessageId(
          status.whatsappMessageId
        );
        if (!message) continue;
        const updatedMessage = Message.restore({
          ...message.toJSON(),
          providerStatus: status.status
        });
        await this.deps.messages.save(updatedMessage);
        updated += 1;
      }
      event.markProcessed(this.deps.clock.now());
      await this.deps.webhookEvents.save(event);
      return { updated };
    } catch (error) {
      event.markFailed(
        this.deps.clock.now(),
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
      await this.deps.webhookEvents.save(event);
      this.deps.logger.log('error', 'webhook.status_failed', {
        webhookEventId: event.id
      });
      throw error;
    }
  }
}
