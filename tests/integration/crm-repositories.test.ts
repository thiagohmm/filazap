import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaContactRepository } from '../../src/infrastructure/database/repositories/PrismaContactRepository';
import { PrismaTicketRepository } from '../../src/infrastructure/database/repositories/PrismaTicketRepository';
import { PrismaInternalNoteRepository } from '../../src/infrastructure/database/repositories/PrismaInternalNoteRepository';
import { Contact } from '../../src/domain/entities/Contact';
import { Ticket } from '../../src/domain/entities/Ticket';
import { InternalNote } from '../../src/domain/entities/InternalNote';
import { TicketStatus } from '../../src/domain/value-objects/TicketStatus';
import { PhoneNumberE164 } from '../../src/domain/value-objects/PhoneNumberE164';

const prisma = new PrismaClient();
const contacts = new PrismaContactRepository();
const tickets = new PrismaTicketRepository();
const notes = new PrismaInternalNoteRepository();

const unique = Date.now();
const orgId = `org-crm-${unique}`;
const channelId = `ch-crm-${unique}`;
const agentId = `agent-crm-${unique}`;
const contactMariaId = `crm-maria-${unique}`;
const contactJoaoId = `crm-joao-${unique}`;
const phoneMaria = `+551199999${unique.toString().slice(-4)}0`;
const phoneJoao = `+551199999${unique.toString().slice(-4)}1`;

beforeAll(async () => {
  await prisma.$connect();
  await prisma.organization.create({
    data: {
      id: orgId,
      name: `Empresa CRM ${unique}`,
      slug: `empresa-crm-${unique}`
    }
  });
  await prisma.user.create({
    data: {
      id: agentId,
      email: `agent-crm-${unique}@example.com`,
      name: 'Atendente',
      passwordHash: 'hash'
    }
  });
  await prisma.whatsAppChannel.create({
    data: {
      id: channelId,
      organizationId: orgId,
      phoneNumberId: `pni-crm-${unique}`,
      businessAccountId: `waba-crm-${unique}`,
      displayPhoneNumber: phoneMaria
    }
  });
  const maria = Contact.create({
    id: contactMariaId,
    organizationId: orgId,
    channelId,
    phone: PhoneNumberE164.create(phoneMaria),
    name: 'Maria Silva',
    firstContactAt: new Date('2026-08-01T10:00:00Z'),
    lastContactAt: new Date('2026-08-19T10:00:00Z')
  });
  const joao = Contact.create({
    id: contactJoaoId,
    organizationId: orgId,
    channelId,
    phone: PhoneNumberE164.create(phoneJoao),
    name: 'João',
    firstContactAt: new Date('2026-08-02T10:00:00Z'),
    lastContactAt: new Date('2026-08-18T10:00:00Z')
  });
  await contacts.save(maria);
  await contacts.save(joao);
});

afterAll(async () => {
  await prisma.ticketEvent.deleteMany({ where: { organizationId: orgId } });
  await prisma.internalNote.deleteMany({ where: { organizationId: orgId } });
  await prisma.message.deleteMany({ where: { organizationId: orgId } });
  await prisma.ticket.deleteMany({ where: { organizationId: orgId } });
  await prisma.contact.deleteMany({ where: { organizationId: orgId } });
  await prisma.whatsAppChannel.deleteMany({ where: { organizationId: orgId } });
  await prisma.user.deleteMany({ where: { id: agentId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe('CRM repositories (integração)', () => {
  it('busca contatos por nome e telefone', async () => {
    const byName = await contacts.search(orgId, 'maria');
    expect(byName.map((r) => r.contact.id)).toContain(contactMariaId);

    const byPhone = await contacts.search(orgId, phoneJoao.slice(-4));
    expect(byPhone.map((r) => r.contact.id)).toContain(contactJoaoId);
  });

  it('lista histórico do contato com duração', async () => {
    const t1 = Ticket.create({
      id: `crm-t1-${unique}`,
      organizationId: orgId,
      channelId,
      contactId: contactMariaId,
      sequenceNumber: 1,
      queueEnteredAt: new Date('2026-08-01T10:00:00Z')
    });
    await tickets.save(
      Ticket.restore({
        ...t1.toJSON(),
        status: TicketStatus.FINISHED,
        finishedAt: new Date('2026-08-01T11:30:00Z'),
        assignedUserId: agentId
      })
    );

    const history = await tickets.findByContact(orgId, contactMariaId);
    expect(history).toHaveLength(1);
    expect(history[0].ticket.status).toBe(TicketStatus.FINISHED);
    expect(history[0].assignedUserName).toBe('Atendente');
  });

  it('calcula métricas organizacionais', async () => {
    const t2 = Ticket.create({
      id: `crm-t2-${unique}`,
      organizationId: orgId,
      channelId,
      contactId: contactJoaoId,
      sequenceNumber: 2,
      queueEnteredAt: new Date('2026-08-02T10:00:00Z')
    });
    await tickets.save(
      Ticket.restore({
        ...t2.toJSON(),
        status: TicketStatus.FINISHED,
        finishedAt: new Date('2026-08-02T11:00:00Z'),
        assignedUserId: agentId
      })
    );

    const metrics = await tickets.getMetrics(orgId, new Date());
    expect(metrics.totalFinished).toBe(2);
    expect(metrics.ticketsPerAgent).toHaveLength(1);
    expect(metrics.ticketsPerAgent[0].name).toBe('Atendente');
    expect(metrics.ticketsPerAgent[0].count).toBe(2);
  });

  it('persiste nota interna vinculada ao contato', async () => {
    const note = InternalNote.create({
      id: `crm-note-${unique}`,
      organizationId: orgId,
      contactId: contactMariaId,
      authorUserId: agentId,
      body: 'Nota de teste'
    });
    await notes.save(note);
    const list = await notes.findByContactId(orgId, contactMariaId);
    expect(list.some((n) => n.body === 'Nota de teste')).toBe(true);
  });
});
