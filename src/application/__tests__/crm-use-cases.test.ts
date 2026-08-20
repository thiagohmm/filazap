import { describe, it, expect } from 'vitest';
import { CreateOrganization } from '../use-cases/CreateOrganization';
import { SearchContacts } from '../use-cases/SearchContacts';
import { GetContactProfile } from '../use-cases/GetContactProfile';
import { ListContactHistory } from '../use-cases/ListContactHistory';
import { GetMetrics } from '../use-cases/GetMetrics';
import { createTestServices, createWhatsAppTestServices } from './fakes';
import { Contact } from '../../domain/entities/Contact';
import { Ticket } from '../../domain/entities/Ticket';
import { InternalNote } from '../../domain/entities/InternalNote';
import { ContactNotFoundError } from '../../domain/errors';
import { TicketStatus } from '../../domain/value-objects/TicketStatus';
import { PhoneNumberE164 } from '../../domain/value-objects/PhoneNumberE164';

function build() {
  const base = createTestServices();
  const wa = createWhatsAppTestServices();

  const createOrganization = new CreateOrganization(base);
  const searchContacts = new SearchContacts({
    contacts: wa.contacts,
    members: base.members
  });
  const getContactProfile = new GetContactProfile({
    contacts: wa.contacts,
    tickets: wa.tickets,
    notes: wa.notes,
    users: base.users,
    members: base.members
  });
  const listContactHistory = new ListContactHistory({
    contacts: wa.contacts,
    tickets: wa.tickets,
    members: base.members
  });
  const getMetrics = new GetMetrics({
    tickets: wa.tickets,
    members: base.members,
    clock: base.clock
  });

  return {
    base,
    wa,
    createOrganization,
    searchContacts,
    getContactProfile,
    listContactHistory,
    getMetrics
  };
}

async function setup() {
  const services = build();
  const org = await services.createOrganization.execute({
    name: 'Empresa A',
    adminName: 'Ana',
    adminEmail: 'ana@example.com',
    adminPassword: 'senha1234'
  });
  return { services, org };
}

function addContact(
  services: ReturnType<typeof build>,
  org: Awaited<ReturnType<typeof setup>>['org'],
  id: string,
  phone: string,
  name: string | null
): Contact {
  const contact = Contact.create({
    id,
    organizationId: org.organizationId,
    channelId: 'ch-1',
    phone: PhoneNumberE164.create(phone),
    name,
    firstContactAt: new Date('2026-08-01T10:00:00Z'),
    lastContactAt: new Date('2026-08-19T10:00:00Z')
  });
  services.wa.contacts.save(contact);
  return contact;
}

function addTicket(
  services: ReturnType<typeof build>,
  org: Awaited<ReturnType<typeof setup>>['org'],
  id: string,
  contactId: string,
  seq: number,
  queueEnteredAt: Date,
  status = TicketStatus.FINISHED
): Ticket {
  const created = Ticket.create({
    id,
    organizationId: org.organizationId,
    channelId: 'ch-1',
    contactId,
    sequenceNumber: seq,
    queueEnteredAt,
    status
  });
  const ticket =
    status === TicketStatus.FINISHED
      ? Ticket.restore({
          ...created.toJSON(),
          finishedAt: new Date(queueEnteredAt.getTime() + 60 * 60 * 1000)
        })
      : created;
  services.wa.tickets.save(ticket);
  return ticket;
}

describe('SearchContacts', () => {
  it('busca por nome e telefone', async () => {
    const { services, org } = await setup();
    addContact(services, org, 'c1', '+5511999990001', 'Maria Silva');
    addContact(services, org, 'c2', '+5511999990002', 'João');

    const byName = await services.searchContacts.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      query: 'maria'
    });
    expect(byName.contacts.map((c) => c.id)).toEqual(['c1']);

    const byPhone = await services.searchContacts.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      query: '0002'
    });
    expect(byPhone.contacts.map((c) => c.id)).toEqual(['c2']);
  });

  it('não busca contatos de outra organização', async () => {
    const { services, org } = await setup();
    const other = await services.createOrganization.execute({
      name: 'Outra',
      adminName: 'Outra',
      adminEmail: 'outra@example.com',
      adminPassword: 'senha1234'
    });
    const otherContact = addContact(services, other, 'c-other', '+5511999990003', 'Maria');
    services.wa.contacts.save(otherContact);

    const out = await services.searchContacts.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      query: 'Maria'
    });
    expect(out.contacts).toHaveLength(0);
  });
});

describe('GetContactProfile', () => {
  it('retorna perfil, total de atendimentos e notas', async () => {
    const { services, org } = await setup();
    addContact(services, org, 'c1', '+5511999990001', 'Maria');
    addTicket(services, org, 't1', 'c1', 1, new Date('2026-08-01T10:00:00Z'));
    addTicket(services, org, 't2', 'c1', 2, new Date('2026-08-05T10:00:00Z'));

    services.wa.notes.save(
      InternalNote.create({
        id: 'n1',
        organizationId: org.organizationId,
        contactId: 'c1',
        authorUserId: org.user.id,
        body: 'Cliente pediu ligação'
      })
    );

    const out = await services.getContactProfile.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      contactId: 'c1'
    });
    expect(out.contact.name).toBe('Maria');
    expect(out.stats.totalTickets).toBe(2);
    expect(out.notes).toHaveLength(1);
    expect(out.notes[0].body).toBe('Cliente pediu ligação');
  });

  it('informa status atual quando há ticket ativo', async () => {
    const { services, org } = await setup();
    addContact(services, org, 'c1', '+5511999990001', 'Maria');
    addTicket(
      services,
      org,
      't1',
      'c1',
      1,
      new Date('2026-08-01T10:00:00Z'),
      TicketStatus.WAITING
    );
    const out = await services.getContactProfile.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      contactId: 'c1'
    });
    expect(out.stats.currentStatus).toBe(TicketStatus.WAITING);
  });

  it('rejeita contato de outra organização', async () => {
    const { services, org } = await setup();
    const other = await services.createOrganization.execute({
      name: 'Outra',
      adminName: 'Outra',
      adminEmail: 'outra@example.com',
      adminPassword: 'senha1234'
    });
    addContact(services, other, 'c-other', '+5511999990003', 'Maria');
    await expect(
      services.getContactProfile.execute({
        actorUserId: org.user.id,
        organizationId: org.organizationId,
        contactId: 'c-other'
      })
    ).rejects.toBeInstanceOf(ContactNotFoundError);
  });
});

describe('ListContactHistory', () => {
  it('lista atendimentos ordenados do mais recente', async () => {
    const { services, org } = await setup();
    addContact(services, org, 'c1', '+5511999990001', 'Maria');
    addTicket(services, org, 't1', 'c1', 1, new Date('2026-08-01T10:00:00Z'));
    addTicket(services, org, 't2', 'c1', 2, new Date('2026-08-05T10:00:00Z'));

    const out = await services.listContactHistory.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      contactId: 'c1'
    });
    expect(out.history).toHaveLength(2);
    expect(out.history[0].sequenceNumber).toBe(2);
    expect(out.history[0].status).toBe(TicketStatus.FINISHED);
  });
});

describe('GetMetrics', () => {
  it('calcula tempo médio, total finalizado e taxa de retorno', async () => {
    const { services, org } = await setup();
    addContact(services, org, 'c1', '+5511999990001', 'Maria');
    addContact(services, org, 'c2', '+5511999990002', 'João');
    addContact(services, org, 'c3', '+5511999990003', 'Ana');

    // Maria tem 2 tickets (retorno), João e Ana têm 1
    addTicket(services, org, 't1', 'c1', 1, new Date('2026-08-01T10:00:00Z'));
    addTicket(services, org, 't2', 'c1', 2, new Date('2026-08-05T10:00:00Z'));
    addTicket(services, org, 't3', 'c2', 3, new Date('2026-08-02T10:00:00Z'));
    addTicket(services, org, 't4', 'c3', 4, new Date('2026-08-03T10:00:00Z'));

    const out = await services.getMetrics.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId
    });
    expect(out.totalFinished).toBe(4);
    // 3 contatos com 1+ tickets, 1 com 2+ => retorno = 1/3 = 33.3%
    expect(out.returnRate).toBe(33.3);
  });
});
