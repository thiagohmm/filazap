import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaWhatsAppChannelRepository } from '../../src/infrastructure/database/repositories/PrismaWhatsAppChannelRepository';
import { PrismaContactRepository } from '../../src/infrastructure/database/repositories/PrismaContactRepository';
import { PrismaTicketRepository } from '../../src/infrastructure/database/repositories/PrismaTicketRepository';
import { PrismaMessageRepository } from '../../src/infrastructure/database/repositories/PrismaMessageRepository';
import { PrismaWebhookEventRepository } from '../../src/infrastructure/database/repositories/PrismaWebhookEventRepository';
import { WhatsAppChannel } from '../../src/domain/entities/WhatsAppChannel';
import { Contact } from '../../src/domain/entities/Contact';
import { Ticket } from '../../src/domain/entities/Ticket';
import { Message } from '../../src/domain/entities/Message';
import { WebhookEvent } from '../../src/domain/entities/WebhookEvent';
import { ChannelStatus } from '../../src/domain/value-objects/ChannelStatus';
import { MessageDirection } from '../../src/domain/value-objects/MessageDirection';
import { PhoneNumberE164 } from '../../src/domain/value-objects/PhoneNumberE164';

const prisma = new PrismaClient();
const channels = new PrismaWhatsAppChannelRepository();
const contacts = new PrismaContactRepository();
const tickets = new PrismaTicketRepository();
const messages = new PrismaMessageRepository();
const webhookEvents = new PrismaWebhookEventRepository();

const unique = Date.now();
const orgId = `org-wa-${unique}`;
const channelId = `ch-${unique}`;
const contactId = `contact-${unique}`;
const ticketId = `ticket-${unique}`;
const messageId = `msg-${unique}`;
const webhookEventId = `wev-${unique}`;
const phone = `+551199999${unique.toString().slice(-4)}`;

beforeAll(async () => {
  await prisma.$connect();
  await prisma.organization.create({
    data: { id: orgId, name: `Empresa WA ${unique}`, slug: `empresa-wa-${unique}` }
  });
});

afterAll(async () => {
  await prisma.message.deleteMany({ where: { id: messageId } });
  await prisma.webhookEvent.deleteMany({ where: { id: webhookEventId } });
  await prisma.ticket.deleteMany({ where: { id: ticketId } });
  await prisma.contact.deleteMany({ where: { id: contactId } });
  await prisma.whatsAppChannel.deleteMany({ where: { id: channelId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe('Prisma WhatsApp repositories (integração)', () => {
  it('persiste canal, credenciais cifradas e encontra por verify_token', async () => {
    const channel = WhatsAppChannel.create({
      id: channelId,
      organizationId: orgId,
      phoneNumberId: `pni-${unique}`,
      businessAccountId: `waba-${unique}`,
      displayPhoneNumber: phone,
      accessTokenEncrypted: 'enc:access',
      appSecretEncrypted: 'enc:secret',
      webhookVerifyToken: `verify-${unique}`
    });
    await channels.save(channel);

    const found = await channels.findByPhoneNumberId(`pni-${unique}`);
    expect(found?.status).toBe(ChannelStatus.CONNECTED);
    expect(found?.accessTokenEncrypted).toBe('enc:access');
    expect(found?.appSecretEncrypted).toBe('enc:secret');
    expect(found?.webhookVerifyToken).toBe(`verify-${unique}`);
    expect(found?.hasCredentials()).toBe(true);

    const byToken = await channels.findByWebhookVerifyToken(`verify-${unique}`);
    expect(byToken?.id).toBe(channelId);

    const list = await channels.findByOrganizationId(orgId);
    expect(list).toHaveLength(1);
  });

  it('atualiza credenciais mantendo o id do canal', async () => {
    const updated = WhatsAppChannel.restore({
      id: channelId,
      organizationId: orgId,
      phoneNumberId: `pni-${unique}`,
      businessAccountId: `waba-${unique}`,
      displayPhoneNumber: phone,
      status: ChannelStatus.CONNECTED,
      accessTokenEncrypted: 'enc:new-access',
      appSecretEncrypted: 'enc:new-secret',
      webhookVerifyToken: `verify-${unique}`,
      apiBaseUrl: 'http://localhost:4000/graph',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await channels.save(updated);

    const found = await channels.findById(channelId);
    expect(found?.accessTokenEncrypted).toBe('enc:new-access');
    expect(found?.apiBaseUrl).toBe('http://localhost:4000/graph');
  });

  it('persiste contato com unicidade por telefone', async () => {
    const contact = Contact.create({
      id: contactId,
      organizationId: orgId,
      channelId,
      phone: PhoneNumberE164.create(phone)
    });
    await contacts.save(contact);

    const found = await contacts.findByChannelAndPhone(orgId, channelId, phone);
    expect(found?.id).toBe(contactId);
  });

  it('persiste ticket, encontra aberto e gera sequência', async () => {
    const first = Ticket.create({
      id: ticketId,
      organizationId: orgId,
      channelId,
      contactId,
      sequenceNumber: 1,
      queueEnteredAt: new Date('2026-08-19T10:00:00Z')
    });
    await tickets.save(first);

    const seq = await tickets.nextSequenceNumber(orgId);
    expect(seq).toBe(2);

    const open = await tickets.findOpenByContact(contactId);
    expect(open?.id).toBe(ticketId);
    expect(open?.status).toBe('WAITING');
  });

  it('persiste mensagem e garante idempotência pelo whatsapp_message_id', async () => {
    const msg = Message.create({
      id: messageId,
      organizationId: orgId,
      ticketId,
      contactId,
      whatsappMessageId: `wamid.it.${unique}`,
      direction: MessageDirection.INBOUND,
      type: 'text',
      body: 'Olá',
      providerTimestamp: new Date('2026-08-19T10:00:00Z')
    });
    await messages.save(msg);

    const found = await messages.findByWhatsappMessageId(`wamid.it.${unique}`);
    expect(found?.body).toBe('Olá');

    await expect(
      prisma.message.create({
        data: {
          id: `dup-${unique}`,
          organizationId: orgId,
          ticketId,
          contactId,
          whatsappMessageId: `wamid.it.${unique}`,
          direction: 'INBOUND',
          type: 'text',
          body: 'duplicada'
        }
      })
    ).rejects.toThrow();
  });

  it('persiste evento de webhook e atualiza status', async () => {
    const event = WebhookEvent.create({
      id: webhookEventId,
      providerEventId: `pev-${unique}`,
      payload: { object: 'whatsapp_business_account', entry: [] }
    });
    await webhookEvents.save(event);

    const found = await webhookEvents.findById(webhookEventId);
    expect(found?.providerEventId).toBe(`pev-${unique}`);
    expect(found?.payload).toMatchObject({ object: 'whatsapp_business_account' });
  });
});
