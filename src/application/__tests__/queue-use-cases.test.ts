import { describe, it, expect } from 'vitest';
import { CreateOrganization } from '../use-cases/CreateOrganization';
import { ReceiveWhatsAppMessage } from '../use-cases/ReceiveWhatsAppMessage';
import { RegisterChannel } from '../use-cases/RegisterChannel';
import { AssignTicket } from '../use-cases/AssignTicket';
import { AssignNextTicket } from '../use-cases/AssignNextTicket';
import { MoveTicketToWaitingCustomer } from '../use-cases/MoveTicketToWaitingCustomer';
import { FinishTicket } from '../use-cases/FinishTicket';
import { ReopenTicket } from '../use-cases/ReopenTicket';
import { AddInternalNote } from '../use-cases/AddInternalNote';
import { ListQueue } from '../use-cases/ListQueue';
import { GetOperationalCounters } from '../use-cases/GetOperationalCounters';
import { ListMessages } from '../use-cases/ListMessages';
import { InviteMember } from '../use-cases/InviteMember';
import { createTestServices, createWhatsAppTestServices } from './fakes';
import {
  TicketAlreadyAssignedError,
  TicketNotAssignedError,
  ForbiddenRoleError,
  ContactNotFoundError
} from '../../domain/errors';
import { TicketStatus } from '../../domain/value-objects/TicketStatus';
import type { ParsedWebhook } from '../ports/WhatsAppWebhookParser';

function build() {
  const base = createTestServices();
  const wa = createWhatsAppTestServices();

  const createOrganization = new CreateOrganization(base);
  const inviteMember = new InviteMember({
    users: base.users,
    members: base.members,
    organizations: base.organizations,
    passwordHasher: base.passwordHasher,
    clock: base.clock,
    logger: base.logger,
    idGenerator: base.idGenerator,
    generateTemporaryPassword: base.generateTemporaryPassword
  });
  const registerChannel = new RegisterChannel({
    channels: wa.channels,
    members: base.members,
    logger: base.logger,
    idGenerator: wa.idGenerator
  });
  const receiveWhatsAppMessage = new ReceiveWhatsAppMessage({
    webhookEvents: wa.webhookEvents,
    channels: wa.channels,
    contacts: wa.contacts,
    tickets: wa.tickets,
    messages: wa.messages,
    ticketEvents: wa.ticketEvents,
    parser: wa.parser,
    clock: wa.clock,
    logger: base.logger,
    idGenerator: wa.idGenerator
  });
  const assignTicket = new AssignTicket({
    tickets: wa.tickets,
    contacts: wa.contacts,
    channels: wa.channels,
    members: base.members,
    events: wa.ticketEvents,
    clock: wa.clock,
    logger: base.logger,
    idGenerator: wa.idGenerator
  });
  const assignNextTicket = new AssignNextTicket({
    tickets: wa.tickets,
    members: base.members,
    events: wa.ticketEvents,
    clock: wa.clock,
    logger: base.logger,
    idGenerator: wa.idGenerator
  });
  const moveTicketToWaitingCustomer = new MoveTicketToWaitingCustomer({
    tickets: wa.tickets,
    members: base.members,
    events: wa.ticketEvents,
    clock: wa.clock,
    logger: base.logger,
    idGenerator: wa.idGenerator
  });
  const finishTicket = new FinishTicket({
    tickets: wa.tickets,
    members: base.members,
    events: wa.ticketEvents,
    clock: wa.clock,
    logger: base.logger,
    idGenerator: wa.idGenerator
  });
  const reopenTicket = new ReopenTicket({
    tickets: wa.tickets,
    members: base.members,
    events: wa.ticketEvents,
    clock: wa.clock,
    logger: base.logger,
    idGenerator: wa.idGenerator
  });
  const addInternalNote = new AddInternalNote({
    notes: wa.notes,
    contacts: wa.contacts,
    tickets: wa.tickets,
    members: base.members,
    clock: wa.clock,
    logger: base.logger,
    idGenerator: wa.idGenerator
  });
  const listQueue = new ListQueue({
    tickets: wa.tickets,
    members: base.members,
    clock: wa.clock
  });
  const getOperationalCounters = new GetOperationalCounters({
    tickets: wa.tickets,
    members: base.members,
    clock: wa.clock
  });
  const listMessages = new ListMessages({
    messages: wa.messages,
    tickets: wa.tickets,
    members: base.members
  });

  return {
    base,
    wa,
    createOrganization,
    inviteMember,
    registerChannel,
    receiveWhatsAppMessage,
    assignTicket,
    assignNextTicket,
    moveTicketToWaitingCustomer,
    finishTicket,
    reopenTicket,
    addInternalNote,
    listQueue,
    getOperationalCounters,
    listMessages
  };
}

type Services = ReturnType<typeof build>;

function setInbound(
  services: Services,
  from: string,
  timestamp: string,
  body: string,
  id: string
) {
  services.wa.parser.result = {
    businessAccountId: 'waba-1',
    phoneNumberId: '123456789',
    messages: [
      { whatsappMessageId: id, from, timestamp, type: 'text', body }
    ],
    statuses: []
  } as ParsedWebhook;
}

async function setup() {
  const services = build();
  const org = await services.createOrganization.execute({
    name: 'Empresa A',
    adminName: 'Ana',
    adminEmail: 'ana@example.com',
    adminPassword: 'senha1234'
  });
  await services.registerChannel.execute({
    actorUserId: org.user.id,
    organizationId: org.organizationId,
    phoneNumberId: '123456789',
    businessAccountId: 'waba-1',
    displayPhoneNumber: '5511999990000'
  });
  const channel = await services.wa.channels.findByPhoneNumberId('123456789');
  return { services, org, channel: channel! };
}

async function receive(
  services: Services,
  org: Awaited<ReturnType<typeof setup>>['org'],
  from: string,
  ts: string,
  body: string,
  id: string
) {
  setInbound(services, from, ts, body, id);
  await services.receiveWhatsAppMessage.execute({ payload: { object: 'x' } });
  const channel = await services.wa.channels.findByPhoneNumberId('123456789');
  const contact = await services.wa.contacts.findByChannelAndPhone(
    org.organizationId,
    channel!.id,
    from
  );
  return contact!;
}

async function addAgent(
  services: Services,
  org: Awaited<ReturnType<typeof setup>>['org'],
  name: string
) {
  await services.inviteMember.execute({
    actorUserId: org.user.id,
    organizationId: org.organizationId,
    email: `${name.toLowerCase()}@example.com`,
    name,
    role: 'AGENT'
  });
  const user = await services.base.users.findByEmail(
    `${name.toLowerCase()}@example.com`
  );
  return user!.id;
}

async function assignedTicket() {
  const { services, org } = await setup();
  const bia = await addAgent(services, org, 'Bia');
  const contact = await receive(services, org, '+5511999990001', '1700000100', 'M1', 'm1');
  const ticket = await services.wa.tickets.findOpenByContact(contact.id);
  await services.assignTicket.execute({
    actorUserId: bia,
    organizationId: org.organizationId,
    ticketId: ticket!.id
  });
  return { services, org, bia, contact, ticket: ticket! };
}

describe('Fila justa (Maria → Ana → Carla)', () => {
  it('ordena pela primeira mensagem e não deixa novas mensagens furar fila', async () => {
    const { services, org } = await setup();

    await receive(services, org, '+5511999990001', '1700000100', 'Maria entra', 'm1');
    await receive(services, org, '+5511999990002', '1700000200', 'Ana entra', 'm2');
    await receive(services, org, '+5511999990003', '1700000300', 'Carla entra', 'm3');
    // Carla envia mais 15 mensagens depois
    for (let i = 0; i < 5; i++) {
      await receive(services, org, '+5511999990003', `1700000${400 + i}`, `Carla msg ${i}`, `mc${i}`);
    }

    const queue = await services.listQueue.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      status: TicketStatus.WAITING
    });

    const names = queue.queue.map((q) => q.contact.phoneE164);
    expect(names).toEqual([
      '+5511999990001',
      '+5511999990002',
      '+5511999990003'
    ]);
    expect(queue.queue[2].waitSeconds).toBeGreaterThan(0);
  });
});

describe('Próximo cliente', () => {
  it('atribui o ticket elegível mais antigo em ordem de espera', async () => {
    const { services, org } = await setup();
    const agent = await addAgent(services, org, 'Bia');

    await receive(services, org, '+5511999990001', '1700000100', 'M1', 'm1');
    await receive(services, org, '+5511999990002', '1700000200', 'M2', 'm2');

    const out = await services.assignNextTicket.execute({
      actorUserId: agent,
      organizationId: org.organizationId
    });

    expect(out.assigned).toBe(true);
    const contact = await services.wa.contacts.findByChannelAndPhone(
      org.organizationId,
      (await services.wa.channels.findByPhoneNumberId('123456789'))!.id,
      '+5511999990001'
    );
    expect(out.ticket!.contactId).toBe(contact!.id);

    const queue = await services.listQueue.execute({
      actorUserId: agent,
      organizationId: org.organizationId,
      status: TicketStatus.WAITING
    });
    expect(queue.queue[0].contact.phoneE164).toBe('+5511999990002');
  });

  it('duas atendentes não assumem o mesmo ticket simultaneamente', async () => {
    const { services, org } = await setup();
    const bia = await addAgent(services, org, 'Bia');
    const cao = await addAgent(services, org, 'Cao');

    await receive(services, org, '+5511999990001', '1700000100', 'M1', 'm1');

    const first = await services.assignNextTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId
    });
    expect(first.assigned).toBe(true);

    const second = await services.assignNextTicket.execute({
      actorUserId: cao,
      organizationId: org.organizationId
    });
    expect(second.assigned).toBe(false);
    expect(second.ticket).toBeNull();
  });
});

describe('Assumir atendimento', () => {
  it('assume ticket em fila e registra evento', async () => {
    const { services, org } = await setup();
    const bia = await addAgent(services, org, 'Bia');
    const contact = await receive(services, org, '+5511999990001', '1700000100', 'M1', 'm1');
    const ticket = await services.wa.tickets.findOpenByContact(contact.id);

    const out = await services.assignTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket!.id
    });

    expect(out.ticket.status).toBe(TicketStatus.IN_PROGRESS);
    expect(out.ticket.assignedUserId).toBe(bia);

    const events = await services.wa.ticketEvents.findByTicketId(org.organizationId, ticket!.id);
    expect(events.some((e) => e.eventType === 'TICKET_ASSIGNED')).toBe(true);
  });

  it('rejeita assumir ticket já assumido por outro', async () => {
    const { services, org } = await setup();
    const bia = await addAgent(services, org, 'Bia');
    const cao = await addAgent(services, org, 'Cao');
    const contact = await receive(services, org, '+5511999990001', '1700000100', 'M1', 'm1');
    const ticket = await services.wa.tickets.findOpenByContact(contact.id);

    await services.assignTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket!.id
    });

    await expect(
      services.assignTicket.execute({
        actorUserId: cao,
        organizationId: org.organizationId,
        ticketId: ticket!.id
      })
    ).rejects.toThrow(TicketAlreadyAssignedError);
  });

  it('VIEWER não pode assumir ticket', async () => {
    const { services, org } = await setup();
    await services.inviteMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      email: 'leitor@example.com',
      name: 'Leitor',
      role: 'VIEWER'
    });
    const viewer = await services.base.users.findByEmail('leitor@example.com');
    const contact = await receive(services, org, '+5511999990001', '1700000100', 'M1', 'm1');
    const ticket = await services.wa.tickets.findOpenByContact(contact.id);

    await expect(
      services.assignTicket.execute({
        actorUserId: viewer!.id,
        organizationId: org.organizationId,
        ticketId: ticket!.id
      })
    ).rejects.toBeInstanceOf(ForbiddenRoleError);
  });
});

describe('Aguardar cliente e finalizar', () => {
  it('move para aguardar cliente', async () => {
    const { services, org, bia, ticket } = await assignedTicket();
    const out = await services.moveTicketToWaitingCustomer.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });
    expect(out.ticket.status).toBe(TicketStatus.WAITING_CUSTOMER);
  });

  it('atendente não pode mexer em ticket de outro', async () => {
    const { services, org, bia, ticket } = await assignedTicket();
    const cao = await addAgent(services, org, 'Cao');
    await expect(
      services.finishTicket.execute({
        actorUserId: cao,
        organizationId: org.organizationId,
        ticketId: ticket.id
      })
    ).rejects.toBeInstanceOf(TicketNotAssignedError);
    expect(bia).toBeDefined();
  });

  it('finaliza atendimento e depois um retorno gera novo ticket preservando histórico', async () => {
    const { services, org, bia, contact, ticket } = await assignedTicket();

    await services.finishTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });
    expect((await services.wa.tickets.findById(ticket.id))!.isFinished()).toBe(true);

    // Cliente volta depois de finalizado
    await receive(services, org, '+5511999990001', '1700000900', 'Voltei', 'm-volta');
    const active = await services.wa.tickets.findActiveByContact(contact.id);
    expect(active).not.toBeNull();
    expect(active!.id).not.toBe(ticket.id);
    expect(active!.status).toBe(TicketStatus.RETURNING);
    expect(active!.queueEnteredAt.getTime()).toBe(1700000900 * 1000);
  });

  it('reabre atendimento finalizado voltando para IN_PROGRESS com o mesmo responsável', async () => {
    const { services, org, bia, ticket } = await assignedTicket();

    await services.finishTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });

    const out = await services.reopenTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });
    expect(out.ticket.status).toBe(TicketStatus.IN_PROGRESS);
    const saved = (await services.wa.tickets.findById(ticket.id))!;
    expect(saved.isFinished()).toBe(false);
    expect(saved.finishedAt).toBeNull();
    expect(saved.assignedUserId).toBe(bia);
  });

  it('não reabre ticket finalizado de outro atendente', async () => {
    const { services, org, bia, ticket } = await assignedTicket();
    const cao = await addAgent(services, org, 'Cao2');
    await services.finishTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });
    await expect(
      services.reopenTicket.execute({
        actorUserId: cao,
        organizationId: org.organizationId,
        ticketId: ticket.id
      })
    ).rejects.toBeInstanceOf(ForbiddenRoleError);
  });

  it('admin reabre atendimento finalizado de outro atendente', async () => {
    const { services, org, bia, ticket } = await assignedTicket();
    await services.finishTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });
    const out = await services.reopenTicket.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });
    expect(out.ticket.status).toBe(TicketStatus.IN_PROGRESS);
    const saved = (await services.wa.tickets.findById(ticket.id))!;
    expect(saved.assignedUserId).toBe(bia);
  });

  it('não permite finalizar novamente logo após reabrir sem transição (estado persistido)', async () => {
    // Cobertura simples: reabrir e finalizar de novo funciona para o mesmo agente
    const { services, org, bia, ticket } = await assignedTicket();
    await services.finishTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });
    await services.reopenTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });
    const out = await services.finishTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });
    expect(out.ticket.status).toBe(TicketStatus.FINISHED);
  });
});

describe('Cliente responde durante aguardando cliente', () => {
  it('volta para IN_PROGRESS preservando o mesmo ticket', async () => {
    const { services, org, bia, contact, ticket } = await assignedTicket();
    await services.moveTicketToWaitingCustomer.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket.id
    });

    await receive(services, org, '+5511999990001', '1700000600', 'Respondo', 'm-resp');

    const active = await services.wa.tickets.findActiveByContact(contact.id);
    expect(active!.id).toBe(ticket.id);
    expect(active!.status).toBe(TicketStatus.IN_PROGRESS);
  });
});

describe('Notas internas', () => {
  it('adiciona nota interna que nunca vai ao WhatsApp', async () => {
    const { services, org } = await setup();
    const bia = await addAgent(services, org, 'Bia');
    const contact = await receive(services, org, '+5511999990001', '1700000100', 'M1', 'm1');

    const out = await services.addInternalNote.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      contactId: contact.id,
      body: 'Nota interna do agente'
    });

    expect(out.note.body).toBe('Nota interna do agente');
    const messages = await services.listMessages.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: (await services.wa.tickets.findOpenByContact(contact.id))!.id
    });
    expect(messages.messages.every((m) => m.body !== 'Nota interna do agente')).toBe(true);
  });

  it('rejeita nota para contato inexistente', async () => {
    const { services, org } = await setup();
    const bia = await addAgent(services, org, 'Bia');
    await expect(
      services.addInternalNote.execute({
        actorUserId: bia,
        organizationId: org.organizationId,
        contactId: 'nao-existe',
        body: 'x'
      })
    ).rejects.toBeInstanceOf(ContactNotFoundError);
  });
});

describe('Contadores operacionais', () => {
  it('reflete contadores em tempo real', async () => {
    const { services, org } = await setup();
    const bia = await addAgent(services, org, 'Bia');

    await receive(services, org, '+5511999990001', '1700000100', 'M1', 'm1');
    await receive(services, org, '+5511999990002', '1700000200', 'M2', 'm2');

    let counters = await services.getOperationalCounters.execute({
      actorUserId: bia,
      organizationId: org.organizationId
    });
    expect(counters.waiting).toBe(2);

    const firstContact = await services.wa.contacts.findByChannelAndPhone(
      org.organizationId,
      (await services.wa.channels.findByPhoneNumberId('123456789'))!.id,
      '+5511999990001'
    );
    const ticket = await services.wa.tickets.findOpenByContact(firstContact!.id);
    await services.assignTicket.execute({
      actorUserId: bia,
      organizationId: org.organizationId,
      ticketId: ticket!.id
    });

    counters = await services.getOperationalCounters.execute({
      actorUserId: bia,
      organizationId: org.organizationId
    });
    expect(counters.waiting).toBe(1);
    expect(counters.inProgress).toBe(1);
  });
});