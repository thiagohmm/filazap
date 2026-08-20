import { describe, it, expect } from 'vitest';
import { CreateOrganization } from '../use-cases/CreateOrganization';
import { InviteMember } from '../use-cases/InviteMember';
import { RegisterChannel } from '../use-cases/RegisterChannel';
import { ListChannels } from '../use-cases/ListChannels';
import { VerifyWebhook } from '../use-cases/VerifyWebhook';
import { ReceiveWhatsAppMessage } from '../use-cases/ReceiveWhatsAppMessage';
import { SendMessage } from '../use-cases/SendMessage';
import { UpdateChannelCredentials } from '../use-cases/UpdateChannelCredentials';
import {
  createTestServices,
  createWhatsAppTestServices
} from './fakes';
import {
  ChannelAlreadyExistsError,
  ChannelNotConfiguredError,
  ChannelNotFoundError,
  ForbiddenRoleError,
  TicketNotFoundError
} from '../../domain/errors';
import { ChannelStatus } from '../../domain/value-objects/ChannelStatus';
import { Ticket } from '../../domain/entities/Ticket';
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
  const listChannels = new ListChannels({
    channels: wa.channels,
    members: base.members
  });
  const verifyWebhook = new VerifyWebhook({
    channels: wa.channels
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
  const sendMessage = new SendMessage({
    channels: wa.channels,
    contacts: wa.contacts,
    tickets: wa.tickets,
    messages: wa.messages,
    members: base.members,
    ticketEvents: wa.ticketEvents,
    gateway: wa.gateway,
    mediaStorage: wa.mediaStorage,
    cipher: wa.cipher,
    clock: wa.clock,
    logger: base.logger,
    idGenerator: wa.idGenerator
  });
  const updateChannelCredentials = new UpdateChannelCredentials({
    channels: wa.channels,
    members: base.members,
    cipher: wa.cipher,
    logger: base.logger,
    idGenerator: wa.idGenerator,
    clock: wa.clock
  });

  return {
    base,
    wa,
    createOrganization,
    inviteMember,
    registerChannel,
    listChannels,
    verifyWebhook,
    receiveWhatsAppMessage,
    sendMessage,
    updateChannelCredentials
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

async function setupWithChannel() {
  const { services, org } = await setup();
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

function setInbound(
  services: ReturnType<typeof build>,
  messages: Array<{
    id: string;
    from: string;
    timestamp: string;
    body?: string;
  }>,
  statuses: Array<{ id: string; status: string }> = []
) {
  services.wa.parser.result = {
    businessAccountId: 'waba-1',
    phoneNumberId: '123456789',
    messages: messages.map((m) => ({
      whatsappMessageId: m.id,
      from: m.from,
      timestamp: m.timestamp,
      type: 'text',
      body: m.body ?? null
    })),
    statuses: statuses.map((s) => ({
      whatsappMessageId: s.id,
      status: s.status,
      timestamp: '1700000099'
    }))
  } as ParsedWebhook;
}

describe('VerifyWebhook', () => {
  it('valida a verificação com token do canal correto', async () => {
    const { services, org, channel } = await setupWithChannel();
    await services.updateChannelCredentials.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      channelId: channel.id,
      webhookVerifyToken: 'verify-token'
    });

    const out = await services.verifyWebhook.execute({
      mode: 'subscribe',
      verifyToken: 'verify-token',
      challenge: 'challenge123'
    });
    expect(out.valid).toBe(true);
    expect(out.challenge).toBe('challenge123');
  });

  it('rejeita token incorreto', async () => {
    const { services, org, channel } = await setupWithChannel();
    await services.updateChannelCredentials.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      channelId: channel.id,
      webhookVerifyToken: 'verify-token'
    });

    const out = await services.verifyWebhook.execute({
      mode: 'subscribe',
      verifyToken: 'errado',
      challenge: 'challenge123'
    });
    expect(out.valid).toBe(false);
  });
});

describe('RegisterChannel', () => {
  it('OWNER registra um canal conectado', async () => {
    const { services, org } = await setup();
    const out = await services.registerChannel.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      phoneNumberId: '123456789',
      businessAccountId: 'waba-1',
      displayPhoneNumber: '5511999990000'
    });
    expect(out.channel.status).toBe(ChannelStatus.CONNECTED);
    expect(out.channel.phoneNumberId).toBe('123456789');
  });

  it('rejeita phone_number_id duplicado', async () => {
    const { services, org } = await setup();
    await services.registerChannel.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      phoneNumberId: '123456789',
      businessAccountId: 'waba-1',
      displayPhoneNumber: '5511999990000'
    });
    await expect(
      services.registerChannel.execute({
        actorUserId: org.user.id,
        organizationId: org.organizationId,
        phoneNumberId: '123456789',
        businessAccountId: 'waba-2',
        displayPhoneNumber: '5511999990001'
      })
    ).rejects.toBeInstanceOf(ChannelAlreadyExistsError);
  });

  it('lista canais da organização', async () => {
    const { services, org } = await setup();
    await services.registerChannel.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      phoneNumberId: '123456789',
      businessAccountId: 'waba-1',
      displayPhoneNumber: '5511999990000'
    });
    const out = await services.listChannels.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId
    });
    expect(out.channels).toHaveLength(1);
  });

  it('AGENT não pode registrar canal', async () => {
    const { services, org } = await setup();
    await services.inviteMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      email: 'agente@example.com',
      name: 'Agente',
      role: 'AGENT'
    });
    const agentUser = await services.base.users.findByEmail('agente@example.com');
    await expect(
      services.registerChannel.execute({
        actorUserId: agentUser!.id,
        organizationId: org.organizationId,
        phoneNumberId: '999',
        businessAccountId: 'waba-x',
        displayPhoneNumber: '5511999999999'
      })
    ).rejects.toBeInstanceOf(ForbiddenRoleError);
  });
});

describe('ReceiveWhatsAppMessage', () => {
  it('cria contato e ticket para telefone desconhecido', async () => {
    const { services, org, channel } = await setupWithChannel();
    setInbound(services, [
      { id: 'wamid.1', from: '+5511999990001', timestamp: '1700000001', body: 'Olá' }
    ]);

    const out = await services.receiveWhatsAppMessage.execute({
      payload: { object: 'x' }
    });

    expect(out.processed).toBe(true);
    expect(out.messagesCount).toBe(1);

    const contact = await services.wa.contacts.findByChannelAndPhone(
      org.organizationId,
      channel.id,
      '+5511999990001'
    );
    expect(contact).not.toBeNull();

    const ticket = await services.wa.tickets.findOpenByContact(contact!.id);
    expect(ticket).not.toBeNull();
    expect(ticket!.status).toBe('WAITING');
    expect(ticket!.queueEnteredAt.getTime()).toBe(1700000001 * 1000);
    const events = await services.wa.ticketEvents.findByTicketId(
      org.organizationId,
      ticket!.id
    );
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('TICKET_OPENED');
  });

  it('mensagens adicionais do mesmo cliente não criam novo ticket nem mudam queue_entered_at', async () => {
    const { services, org, channel } = await setupWithChannel();
    setInbound(services, [
      { id: 'wamid.1', from: '+5511999990001', timestamp: '1700000001', body: 'primeira' }
    ]);
    await services.receiveWhatsAppMessage.execute({ payload: { object: 'x' } });

    const contact = await services.wa.contacts.findByChannelAndPhone(
      org.organizationId,
      channel.id,
      '+5511999990001'
    );
    const ticketBefore = await services.wa.tickets.findOpenByContact(contact!.id);

    setInbound(services, [
      { id: 'wamid.2', from: '+5511999990001', timestamp: '1700000020', body: 'segunda' }
    ]);
    const out = await services.receiveWhatsAppMessage.execute({
      payload: { object: 'x' }
    });

    const msg2 = await services.wa.messages.findByWhatsappMessageId('wamid.2');
    expect(out.messagesCount).toBe(1);
    expect(msg2!.ticketId).toBe(ticketBefore!.id);

    const ticketAfter = await services.wa.tickets.findOpenByContact(contact!.id);
    expect(ticketAfter!.id).toBe(ticketBefore!.id);
    expect(ticketAfter!.queueEnteredAt.getTime()).toBe(1700000001 * 1000);
  });

  it('ignora mensagem repetida (idempotência)', async () => {
    const { services } = await setupWithChannel();
    setInbound(services, [
      { id: 'wamid.1', from: '+5511999990001', timestamp: '1700000001', body: 'Olá' }
    ]);
    await services.receiveWhatsAppMessage.execute({ payload: { object: 'x' } });

    setInbound(services, [
      { id: 'wamid.1', from: '+5511999990001', timestamp: '1700000001', body: 'Olá' }
    ]);
    const out = await services.receiveWhatsAppMessage.execute({
      payload: { object: 'x' }
    });

    expect(out.duplicate).toBe(true);
    expect(out.messagesCount).toBe(0);
  });

  it('atualiza provider_status a partir de statuses', async () => {
    const { services } = await setupWithChannel();
    setInbound(services, [
      { id: 'wamid.1', from: '+5511999990001', timestamp: '1700000001', body: 'Olá' }
    ]);
    await services.receiveWhatsAppMessage.execute({ payload: { object: 'x' } });

    setInbound(services, [], [
      { id: 'wamid.1', status: 'delivered' },
      { id: 'wamid.1', status: 'read' }
    ]);
    const out = await services.receiveWhatsAppMessage.execute({
      payload: { object: 'x' }
    });

    expect(out.statusesCount).toBe(2);
    const msg = await services.wa.messages.findByWhatsappMessageId('wamid.1');
    expect(msg!.providerStatus).toBe('read');
  });
});

describe('SendMessage', () => {
  it('envia texto e registra mensagem de saída', async () => {
    const { services, org, channel } = await setupWithChannel();
    await services.updateChannelCredentials.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      channelId: channel.id,
      accessToken: 'access-token-123',
      appSecret: 'app-secret-123',
      webhookVerifyToken: 'verify-token'
    });
    setInbound(services, [
      { id: 'wamid.1', from: '+5511999990001', timestamp: '1700000001', body: 'Olá' }
    ]);
    await services.receiveWhatsAppMessage.execute({ payload: { object: 'x' } });

    const contact = await services.wa.contacts.findByChannelAndPhone(
      org.organizationId,
      channel.id,
      '+5511999990001'
    );

    const out = await services.sendMessage.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      channelId: channel.id,
      contactId: contact!.id,
      body: 'Resposta'
    });

    expect(out.message.direction).toBe('OUTBOUND');
    expect(out.message.body).toBe('Resposta');
    expect(services.wa.gateway.calls).toHaveLength(1);
    expect(services.wa.gateway.calls[0].command.channel.accessToken).toBe(
      'access-token-123'
    );
  });

  it('lança erro se o canal não tiver credenciais', async () => {
    const { services, org, channel } = await setupWithChannel();
    setInbound(services, [
      { id: 'wamid.1', from: '+5511999990001', timestamp: '1700000001', body: 'Olá' }
    ]);
    await services.receiveWhatsAppMessage.execute({ payload: { object: 'x' } });
    const contact = await services.wa.contacts.findByChannelAndPhone(
      org.organizationId,
      channel.id,
      '+5511999990001'
    );

    await expect(
      services.sendMessage.execute({
        actorUserId: org.user.id,
        organizationId: org.organizationId,
        channelId: channel.id,
        contactId: contact!.id,
        body: 'Resposta'
      })
    ).rejects.toBeInstanceOf(ChannelNotConfiguredError);
  });

  it('lança erro se não houver atendimento aberto', async () => {
    const { services, org, channel } = await setupWithChannel();
    setInbound(services, [
      { id: 'wamid.1', from: '+5511999990001', timestamp: '1700000001', body: 'Olá' }
    ]);
    await services.receiveWhatsAppMessage.execute({ payload: { object: 'x' } });
    const contact = await services.wa.contacts.findByChannelAndPhone(
      org.organizationId,
      channel.id,
      '+5511999990001'
    );

    const ticket = await services.wa.tickets.findOpenByContact(contact!.id);
    await services.wa.tickets.save(
      Ticket.restore({
        ...ticket!.toJSON(),
        status: 'FINISHED',
        finishedAt: new Date('2026-08-19T12:00:00.000Z')
      })
    );

    await expect(
      services.sendMessage.execute({
        actorUserId: org.user.id,
        organizationId: org.organizationId,
        channelId: channel.id,
        contactId: contact!.id,
        body: 'Resposta'
      })
    ).rejects.toBeInstanceOf(TicketNotFoundError);
  });
});

describe('UpdateChannelCredentials', () => {
  it('OWNER configura credenciais e o output não expõe segredos', async () => {
    const { services, org, channel } = await setupWithChannel();
    const out = await services.updateChannelCredentials.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      channelId: channel.id,
      accessToken: 'access-token',
      appSecret: 'app-secret',
      webhookVerifyToken: 'verify-token'
    });

    expect(out.channel.configured).toBe(true);
    expect('accessToken' in out.channel).toBe(false);
    expect('appSecret' in out.channel).toBe(false);

    const stored = await services.wa.channels.findById(channel.id);
    expect(stored?.accessTokenEncrypted).toBe('enc:access-token');
    expect(stored?.appSecretEncrypted).toBe('enc:app-secret');
    expect(stored?.webhookVerifyToken).toBe('verify-token');
  });

  it('AGENT não pode configurar credenciais', async () => {
    const { services, org, channel } = await setupWithChannel();
    await services.inviteMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      email: 'agente@example.com',
      name: 'Agente',
      role: 'AGENT'
    });
    const agentUser = await services.base.users.findByEmail('agente@example.com');
    await expect(
      services.updateChannelCredentials.execute({
        actorUserId: agentUser!.id,
        organizationId: org.organizationId,
        channelId: channel.id,
        accessToken: 'token'
      })
    ).rejects.toBeInstanceOf(ForbiddenRoleError);
  });

  it('não permite configurar canal de outra organização', async () => {
    const { services, org } = await setupWithChannel();
    const other = await services.createOrganization.execute({
      name: 'Outra',
      adminName: 'Outra',
      adminEmail: 'outra@example.com',
      adminPassword: 'senha1234'
    });
    const otherChannel = await services.registerChannel.execute({
      actorUserId: other.user.id,
      organizationId: other.organizationId,
      phoneNumberId: '999',
      businessAccountId: 'waba-other',
      displayPhoneNumber: '5511999999999'
    });
    await expect(
      services.updateChannelCredentials.execute({
        actorUserId: org.user.id,
        organizationId: org.organizationId,
        channelId: otherChannel.channel.id,
        accessToken: 'token'
      })
    ).rejects.toBeInstanceOf(ChannelNotFoundError);
  });
});
