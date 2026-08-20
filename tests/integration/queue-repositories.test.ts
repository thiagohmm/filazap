import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaTicketRepository } from '../../src/infrastructure/database/repositories/PrismaTicketRepository';
import { PrismaInternalNoteRepository } from '../../src/infrastructure/database/repositories/PrismaInternalNoteRepository';
import { PrismaTicketEventRepository } from '../../src/infrastructure/database/repositories/PrismaTicketEventRepository';
import { Ticket } from '../../src/domain/entities/Ticket';
import { InternalNote } from '../../src/domain/entities/InternalNote';
import { TicketEvent } from '../../src/domain/entities/TicketEvent';
import { TicketStatus } from '../../src/domain/value-objects/TicketStatus';

const prisma = new PrismaClient();
const tickets = new PrismaTicketRepository();
const notes = new PrismaInternalNoteRepository();
const events = new PrismaTicketEventRepository();

const unique = Date.now();
const orgId = `org-queue-${unique}`;
const channelId = `ch-queue-${unique}`;
const agentId = `agent-queue-${unique}`;
const contactMariaId = `contact-maria-${unique}`;
const contactAnaId = `contact-ana-${unique}`;
const phoneMaria = `+551199999${unique.toString().slice(-4)}0`;
const phoneAna = `+551199999${unique.toString().slice(-4)}1`;

beforeAll(async () => {
  await prisma.$connect();
  await prisma.organization.create({
    data: { id: orgId, name: `Empresa Queue ${unique}`, slug: `empresa-queue-${unique}` }
  });
  await prisma.user.create({
    data: {
      id: agentId,
      email: `agent-queue-${unique}@example.com`,
      name: 'Agente',
      passwordHash: 'hash'
    }
  });
  await prisma.whatsAppChannel.create({
    data: {
      id: channelId,
      organizationId: orgId,
      phoneNumberId: `pni-queue-${unique}`,
      businessAccountId: `waba-queue-${unique}`,
      displayPhoneNumber: phoneMaria
    }
  });
  await prisma.contact.createMany({
    data: [
      {
        id: contactMariaId,
        organizationId: orgId,
        channelId,
        phoneE164: phoneMaria
      },
      {
        id: contactAnaId,
        organizationId: orgId,
        channelId,
        phoneE164: phoneAna
      }
    ]
  });
});

afterAll(async () => {
  await prisma.ticketEvent.deleteMany({ where: { organizationId: orgId } });
  await prisma.internalNote.deleteMany({ where: { organizationId: orgId } });
  await prisma.ticket.deleteMany({ where: { organizationId: orgId } });
  await prisma.contact.deleteMany({ where: { organizationId: orgId } });
  await prisma.whatsAppChannel.deleteMany({ where: { organizationId: orgId } });
  await prisma.user.deleteMany({ where: { id: agentId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

function makeTicket(id: string, contactId: string, seq: number, queueEnteredAt: Date) {
  return Ticket.create({
    id,
    organizationId: orgId,
    channelId,
    contactId,
    sequenceNumber: seq,
    queueEnteredAt
  });
}

describe('Prisma fila justa (integração)', () => {
  it('ordena por priority desc e queue_entered_at asc mesmo com novas mensagens', async () => {
    await tickets.save(makeTicket('t-maria', contactMariaId, 1, new Date('2026-08-19T14:00:00Z')));
    await tickets.save(makeTicket('t-ana', contactAnaId, 2, new Date('2026-08-19T14:05:00Z')));

    // Ana envia mais mensagens (lastMessageAt muda) — não deve alterar a posição
    await tickets.save(
      Ticket.restore({
        ...(await tickets.findById('t-ana'))!.toJSON(),
        lastMessageAt: new Date('2026-08-19T14:20:00Z')
      })
    );

    const queue = await tickets.listQueue({
      organizationId: orgId,
      status: TicketStatus.WAITING
    });
    expect(queue[0].ticket.id).toBe('t-maria');
    expect(queue[1].ticket.id).toBe('t-ana');
  });

  it('assignNext atribui o mais antigo atomicamente', async () => {
    const first = await tickets.assignNext(orgId, agentId, new Date('2026-08-19T15:00:00Z'));
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.ticket.id).toBe('t-maria');
      expect(first.ticket.status).toBe(TicketStatus.IN_PROGRESS);
      expect(first.ticket.assignedUserId).toBe(agentId);
    }
  });

  it('segunda tentativa de assignNext não atribui o mesmo ticket', async () => {
    const second = await tickets.assignNext(orgId, agentId, new Date('2026-08-19T15:00:05Z'));
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.ticket.id).toBe('t-ana');
    }
    // Não há mais tickets disponíveis
    const third = await tickets.assignNext(orgId, agentId, new Date('2026-08-19T15:00:10Z'));
    expect(third.ok).toBe(false);
  });

  it('assignTicket não assume ticket já atribuído', async () => {
    const again = await tickets.assignTicket('t-ana', agentId, new Date('2026-08-19T15:01:00Z'));
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.reason).toBe('ALREADY_ASSIGNED');
    }
  });

  it('calcula contadores operacionais', async () => {
    const counters = await tickets.getOperationalCounters(
      orgId,
      new Date('2026-08-19T16:00:00Z')
    );
    expect(counters.inProgress).toBe(2);
    expect(counters.waiting).toBe(0);
    expect(counters.maxWaitSeconds).toBeNull();
  });

  it('persiste nota interna e evento de ticket', async () => {
    const note = InternalNote.create({
      id: `note-${unique}`,
      organizationId: orgId,
      contactId: contactMariaId,
      ticketId: 't-maria',
      authorUserId: agentId,
      body: 'Nota interna'
    });
    await notes.save(note);
    expect((await notes.findById(note.id))?.body).toBe('Nota interna');

    const event = TicketEvent.create({
      id: `event-${unique}`,
      organizationId: orgId,
      ticketId: 't-maria',
      actorUserId: agentId,
      eventType: 'TICKET_ASSIGNED',
      fromStatus: TicketStatus.WAITING,
      toStatus: TicketStatus.IN_PROGRESS
    });
    await events.save(event);
    const list = await events.findByTicketId(orgId, 't-maria');
    expect(list.some((e) => e.eventType === 'TICKET_ASSIGNED')).toBe(true);
  });
});