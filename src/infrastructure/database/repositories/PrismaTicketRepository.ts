import { Ticket } from '../../../domain/entities/Ticket';
import { TicketStatus } from '../../../domain/value-objects/TicketStatus';
import type {
  AssignResult,
  OperationalCounters,
  OrganizationMetrics,
  QueueTicket,
  TicketHistoryItem,
  TicketQueueFilter,
  TicketRepository
} from '../../../application/ports/TicketRepository';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

function toDomain(record: {
  id: string;
  organizationId: string;
  channelId: string;
  contactId: string;
  sequenceNumber: number;
  status: string;
  priority: number;
  queueEnteredAt: Date;
  assignedUserId: string | null;
  assignedAt: Date | null;
  firstResponseAt: Date | null;
  waitingCustomerSince: Date | null;
  finishedAt: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): Ticket {
  return Ticket.restore({
    id: record.id,
    organizationId: record.organizationId,
    channelId: record.channelId,
    contactId: record.contactId,
    sequenceNumber: record.sequenceNumber,
    status: record.status,
    priority: record.priority,
    queueEnteredAt: record.queueEnteredAt,
    assignedUserId: record.assignedUserId,
    assignedAt: record.assignedAt,
    firstResponseAt: record.firstResponseAt,
    waitingCustomerSince: record.waitingCustomerSince,
    finishedAt: record.finishedAt,
    lastMessageAt: record.lastMessageAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
}

export class PrismaTicketRepository implements TicketRepository {
  async save(ticket: Ticket): Promise<Ticket> {
    const data = ticket.toJSON();
    const record = await prisma.ticket.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        organizationId: data.organizationId,
        channelId: data.channelId,
        contactId: data.contactId,
        sequenceNumber: data.sequenceNumber,
        status: data.status,
        priority: data.priority,
        queueEnteredAt: data.queueEnteredAt,
        assignedUserId: data.assignedUserId,
        assignedAt: data.assignedAt,
        firstResponseAt: data.firstResponseAt,
        waitingCustomerSince: data.waitingCustomerSince,
        finishedAt: data.finishedAt,
        lastMessageAt: data.lastMessageAt
      },
      update: {
        status: data.status,
        priority: data.priority,
        assignedUserId: data.assignedUserId,
        assignedAt: data.assignedAt,
        firstResponseAt: data.firstResponseAt,
        waitingCustomerSince: data.waitingCustomerSince,
        finishedAt: data.finishedAt,
        lastMessageAt: data.lastMessageAt
      }
    });
    return toDomain(record);
  }

  async findById(id: string): Promise<Ticket | null> {
    const record = await prisma.ticket.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findOpenByContact(contactId: string): Promise<Ticket | null> {
    const record = await prisma.ticket.findFirst({
      where: {
        contactId,
        status: { in: [TicketStatus.WAITING, TicketStatus.RETURNING] }
      },
      orderBy: { createdAt: 'asc' }
    });
    return record ? toDomain(record) : null;
  }

  async findActiveByContact(contactId: string): Promise<Ticket | null> {
    const record = await prisma.ticket.findFirst({
      where: {
        contactId,
        status: { not: TicketStatus.FINISHED }
      },
      orderBy: { createdAt: 'asc' }
    });
    return record ? toDomain(record) : null;
  }

  async nextSequenceNumber(organizationId: string): Promise<number> {
    const result = await prisma.ticket.aggregate({
      where: { organizationId },
      _max: { sequenceNumber: true }
    });
    return (result._max.sequenceNumber ?? 0) + 1;
  }

  async listQueue(filter: TicketQueueFilter): Promise<QueueTicket[]> {
    const where: Prisma.TicketWhereInput = {
      organizationId: filter.organizationId
    };
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.assignedUserId) {
      where.assignedUserId = filter.assignedUserId;
    }

    const records = await prisma.ticket.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { queueEnteredAt: 'asc' }
      ],
      take: filter.limit ?? 100,
      include: {
        contact: { select: { id: true, name: true, phoneE164: true } },
        messages: {
          orderBy: { providerTimestamp: 'desc' },
          take: 1,
          select: { body: true, providerTimestamp: true }
        }
      }
    });

    return records.map((r) => ({
      ticket: toDomain(r),
      contactName: r.contact.name,
      contactPhone: r.contact.phoneE164,
      lastMessageBody: r.messages[0]?.body ?? null,
      lastMessageAt: r.messages[0]?.providerTimestamp ?? null
    }));
  }

  async assignNext(
    organizationId: string,
    userId: string,
    now: Date
  ): Promise<AssignResult> {
    const result = await prisma.$transaction(async (tx) => {
      const candidate = await tx.ticket.findFirst({
        where: {
          organizationId,
          status: { in: [TicketStatus.WAITING, TicketStatus.RETURNING] },
          assignedUserId: null
        },
        orderBy: [{ priority: 'desc' }, { queueEnteredAt: 'asc' }]
      });
      if (!candidate) {
        return { ok: false as const, reason: 'NOT_AVAILABLE' as const };
      }

      const updated = await tx.ticket.updateMany({
        where: {
          id: candidate.id,
          status: { in: [TicketStatus.WAITING, TicketStatus.RETURNING] },
          assignedUserId: null
        },
        data: {
          status: TicketStatus.IN_PROGRESS,
          assignedUserId: userId,
          assignedAt: now,
          updatedAt: now
        }
      });

      if (updated.count === 0) {
        return { ok: false as const, reason: 'ALREADY_ASSIGNED' as const };
      }

      const assigned = await tx.ticket.findUnique({
        where: { id: candidate.id }
      });
      return { ok: true as const, ticket: assigned! };
    });

    return result.ok
      ? { ok: true, ticket: toDomain(result.ticket) }
      : { ok: false, reason: result.reason };
  }

  async assignTicket(
    ticketId: string,
    userId: string,
    now: Date
  ): Promise<AssignResult> {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.updateMany({
        where: {
          id: ticketId,
          status: { in: [TicketStatus.WAITING, TicketStatus.RETURNING] },
          assignedUserId: null
        },
        data: {
          status: TicketStatus.IN_PROGRESS,
          assignedUserId: userId,
          assignedAt: now,
          updatedAt: now
        }
      });

      if (updated.count === 0) {
        return { ok: false as const, reason: 'ALREADY_ASSIGNED' as const };
      }

      const assigned = await tx.ticket.findUnique({ where: { id: ticketId } });
      return { ok: true as const, ticket: assigned! };
    });

    return result.ok
      ? { ok: true, ticket: toDomain(result.ticket) }
      : { ok: false, reason: result.reason };
  }

  async findAssignedOpenByUser(
    organizationId: string,
    userId: string
  ): Promise<Ticket[]> {
    const records = await prisma.ticket.findMany({
      where: {
        organizationId,
        assignedUserId: userId,
        status: { in: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER] }
      },
      orderBy: [{ priority: 'desc' }, { queueEnteredAt: 'asc' }]
    });
    return records.map(toDomain);
  }

  async getOperationalCounters(
    organizationId: string,
    now: Date
  ): Promise<OperationalCounters> {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const [waiting, returning, inProgress, waitingCustomer, finishedToday] =
      await Promise.all([
        prisma.ticket.count({
          where: { organizationId, status: TicketStatus.WAITING }
        }),
        prisma.ticket.count({
          where: { organizationId, status: TicketStatus.RETURNING }
        }),
        prisma.ticket.count({
          where: { organizationId, status: TicketStatus.IN_PROGRESS }
        }),
        prisma.ticket.count({
          where: { organizationId, status: TicketStatus.WAITING_CUSTOMER }
        }),
        prisma.ticket.count({
          where: {
            organizationId,
            status: TicketStatus.FINISHED,
            finishedAt: { gte: dayStart }
          }
        })
      ]);

    const oldest = await prisma.ticket.findFirst({
      where: {
        organizationId,
        status: { in: [TicketStatus.WAITING, TicketStatus.RETURNING] }
      },
      orderBy: [{ priority: 'desc' }, { queueEnteredAt: 'asc' }]
    });

    const avgRows: Array<{ avgSeconds: number | null }> = await prisma.$queryRaw`
      SELECT AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "queueEnteredAt")))::float8 AS "avgSeconds"
      FROM "Ticket"
      WHERE "organizationId" = ${organizationId}
        AND "firstResponseAt" IS NOT NULL
    `;

    const avgFirstResponseSeconds = avgRows[0]?.avgSeconds ?? null;

    return {
      waiting,
      returning,
      inProgress,
      waitingCustomer,
      finishedToday,
      maxWaitSeconds: oldest
        ? Math.max(0, Math.floor((now.getTime() - oldest.queueEnteredAt.getTime()) / 1000))
        : null,
      avgFirstResponseSeconds
    };
  }

  async findByContact(
    organizationId: string,
    contactId: string
  ): Promise<TicketHistoryItem[]> {
    const records = await prisma.ticket.findMany({
      where: { organizationId, contactId },
      orderBy: { queueEnteredAt: 'desc' },
      include: {
        assignedUser: { select: { name: true } }
      }
    });
    return records.map((r) => ({
      ticket: toDomain(r),
      assignedUserName: r.assignedUser?.name ?? null
    }));
  }

  async getMetrics(organizationId: string, _now: Date): Promise<OrganizationMetrics> {
    const finishedRows: Array<{ avgSeconds: number | null; total: number }> =
      await prisma.$queryRaw`
        SELECT
          AVG(EXTRACT(EPOCH FROM ("finishedAt" - "queueEnteredAt")))::float8 AS "avgSeconds",
          COUNT(*)::int AS "total"
        FROM "Ticket"
        WHERE "organizationId" = ${organizationId}
          AND "status" = 'FINISHED'
          AND "finishedAt" IS NOT NULL
      `;
    const avgAttendanceSeconds = finishedRows[0]?.avgSeconds ?? null;
    const totalFinished = finishedRows[0]?.total ?? 0;

    const perAgentRows: Array<{ userId: string; name: string; count: number }> =
      await prisma.$queryRaw`
        SELECT u."id" AS "userId", u."name", COUNT(t."id")::int AS "count"
        FROM "Ticket" t
        JOIN "User" u ON u."id" = t."assignedUserId"
        WHERE t."organizationId" = ${organizationId}
        GROUP BY u."id", u."name"
        ORDER BY "count" DESC
      `;
    const ticketsPerAgent = perAgentRows.map((r) => ({
      userId: r.userId,
      name: r.name,
      count: r.count
    }));

    const returnRows: Array<{
      withTickets: number;
      returning: number;
    }> = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "withTickets",
        COUNT(*) FILTER (WHERE "ticketCount" >= 2)::int AS "returning"
      FROM (
        SELECT "contactId", COUNT(*) AS "ticketCount"
        FROM "Ticket"
        WHERE "organizationId" = ${organizationId}
        GROUP BY "contactId"
      ) counts
    `;
    const withTickets = returnRows[0]?.withTickets ?? 0;
    const returning = returnRows[0]?.returning ?? 0;
    const returnRate =
      withTickets > 0 ? Math.round((returning / withTickets) * 1000) / 10 : null;

    return {
      avgAttendanceSeconds,
      totalFinished,
      ticketsPerAgent,
      returnRate
    };
  }
}