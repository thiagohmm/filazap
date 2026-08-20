import { WebhookEvent } from '../../../domain/entities/WebhookEvent';
import { WebhookEventStatus } from '../../../domain/value-objects/WebhookEventStatus';
import type { WebhookEventRepository } from '../../../application/ports/WebhookEventRepository';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

function toDomain(record: {
  id: string;
  organizationId: string | null;
  providerEventId: string | null;
  payload: unknown;
  processingStatus: string;
  attempts: number;
  receivedAt: Date;
  processedAt: Date | null;
  errorMessage: string | null;
}): WebhookEvent {
  return WebhookEvent.restore({
    id: record.id,
    organizationId: record.organizationId,
    providerEventId: record.providerEventId,
    payload: (record.payload ?? {}) as Record<string, unknown>,
    processingStatus: WebhookEventStatus.fromString(record.processingStatus),
    attempts: record.attempts,
    receivedAt: record.receivedAt,
    processedAt: record.processedAt,
    errorMessage: record.errorMessage
  });
}

export class PrismaWebhookEventRepository implements WebhookEventRepository {
  async save(event: WebhookEvent): Promise<WebhookEvent> {
    const data = event.toJSON();
    const record = await prisma.webhookEvent.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        organizationId: data.organizationId,
        providerEventId: data.providerEventId,
        payload: data.payload as unknown as Prisma.InputJsonValue,
        processingStatus: data.processingStatus,
        attempts: data.attempts,
        receivedAt: data.receivedAt,
        processedAt: data.processedAt,
        errorMessage: data.errorMessage
      },
      update: {
        organizationId: data.organizationId,
        providerEventId: data.providerEventId,
        payload: data.payload as unknown as Prisma.InputJsonValue,
        processingStatus: data.processingStatus,
        attempts: data.attempts,
        processedAt: data.processedAt,
        errorMessage: data.errorMessage
      }
    });
    return toDomain(record);
  }

  async findById(id: string): Promise<WebhookEvent | null> {
    const record = await prisma.webhookEvent.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByProviderEventId(
    providerEventId: string
  ): Promise<WebhookEvent | null> {
    const record = await prisma.webhookEvent.findUnique({
      where: { providerEventId }
    });
    return record ? toDomain(record) : null;
  }
}
