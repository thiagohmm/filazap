import { WebhookEvent } from '../../domain/entities/WebhookEvent';

export interface WebhookEventRepository {
  save(event: WebhookEvent): Promise<WebhookEvent>;
  findById(id: string): Promise<WebhookEvent | null>;
  findByProviderEventId(providerEventId: string): Promise<WebhookEvent | null>;
}
