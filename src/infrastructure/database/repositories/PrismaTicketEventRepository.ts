import { TicketEvent } from '../../../domain/entities/TicketEvent';
import type { TicketEventRepository } from '../../../application/ports/TicketEventRepository';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

function toPayload(
  value: Record<string, unknown> | null
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  return value
    ? (value as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull;
}

function toDomain(record: {
  id: string;
  organizationId: string;
  ticketId: string;
  actorUserId: string | null;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  payload: unknown;
  createdAt: Date;
}): TicketEvent {
  return TicketEvent.restore({
    id: record.id,
    organizationId: record.organizationId,
    ticketId: record.ticketId,
    actorUserId: record.actorUserId,
    eventType: record.eventType,
    fromStatus: record.fromStatus,
    toStatus: record.toStatus,
    payload: (record.payload ?? null) as Record<string, unknown> | null,
    createdAt: record.createdAt
  });
}

export class PrismaTicketEventRepository implements TicketEventRepository {
  async save(event: TicketEvent): Promise<TicketEvent> {
    const data = event.toJSON();
    const record = await prisma.ticketEvent.create({
      data: {
        id: data.id,
        organizationId: data.organizationId,
        ticketId: data.ticketId,
        actorUserId: data.actorUserId,
        eventType: data.eventType,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        payload: toPayload(data.payload),
        createdAt: data.createdAt
      }
    });
    return toDomain(record);
  }

  async findByTicketId(
    organizationId: string,
    ticketId: string
  ): Promise<TicketEvent[]> {
    const records = await prisma.ticketEvent.findMany({
      where: { organizationId, ticketId },
      orderBy: { createdAt: 'asc' }
    });
    return records.map(toDomain);
  }
}