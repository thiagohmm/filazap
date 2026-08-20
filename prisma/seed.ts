import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { BcryptPasswordHasher } from '../src/infrastructure/auth/BcryptPasswordHasher';
import { Organization } from '../src/domain/entities/Organization';
import { OrganizationMember } from '../src/domain/entities/OrganizationMember';
import { User } from '../src/domain/entities/User';
import { Role } from '../src/domain/value-objects/Role';
import { Email } from '../src/domain/value-objects/Email';
import { Aes256GcmCredentialCipher } from '../src/infrastructure/security/Aes256GcmCredentialCipher';

const prisma = new PrismaClient();

// S2 — Senha padrão/admin fraca no seed é um risco em produção.
// Regras:
// - Senha fraca ou placeholder: aborta (não semeia credencial perigosa).
// - NODE_ENV=production: exige senha forte e loga alerta explícito.
const PASSWORD_PLACEHOLDER = '__CHANGE_ME_STRONG_PASSWORD__';
const WEAK_PASSWORDS = new Set([
  'admin1234',
  'admin',
  'password',
  'changeme',
  PASSWORD_PLACEHOLDER
]);

function passwordIsStrong(pw: string): boolean {
  return pw.length >= 12 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function seedDemoData(input: {
  organizationId: string;
  ownerId: string;
  passwordHash: string;
}) {
  const masterKey = process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY ?? '';
  if (masterKey.length < 32) {
    throw new Error('[seed] WHATSAPP_CREDENTIAL_ENCRYPTION_KEY deve ter pelo menos 32 caracteres para criar a demo.');
  }
  const cipher = new Aes256GcmCredentialCipher(masterKey);
  const channel = await prisma.whatsAppChannel.upsert({
    where: { phoneNumberId: '123456789' },
    create: {
      id: 'demo-channel-whatsapp',
      organizationId: input.organizationId,
      phoneNumberId: '123456789',
      businessAccountId: '1010101010',
      displayPhoneNumber: '+55 11 99999-0000',
      status: 'CONNECTED',
      accessTokenEncrypted: cipher.encrypt('demo-access-token'),
      appSecretEncrypted: cipher.encrypt('local-app-secret'),
      webhookVerifyToken: 'filazap-demo-webhook-token',
      apiBaseUrl: process.env.WHATSAPP_API_URL ?? 'http://whatsapp-mock:4000/graph'
    },
    update: {
      status: 'CONNECTED',
      accessTokenEncrypted: cipher.encrypt('demo-access-token'),
      appSecretEncrypted: cipher.encrypt('local-app-secret'),
      webhookVerifyToken: 'filazap-demo-webhook-token',
      apiBaseUrl: process.env.WHATSAPP_API_URL ?? 'http://whatsapp-mock:4000/graph'
    }
  });

  const demoAgents = [
    { id: 'demo-agent-ana', name: 'Ana Souza', email: 'ana@filazap.demo', role: Role.AGENT },
    { id: 'demo-agent-carlos', name: 'Carlos Lima', email: 'carlos@filazap.demo', role: Role.AGENT }
  ];
  const agentIds: string[] = [];
  for (const agent of demoAgents) {
    const user = await prisma.user.upsert({
      where: { email: agent.email },
      create: { id: agent.id, name: agent.name, email: agent.email, passwordHash: input.passwordHash },
      update: { name: agent.name }
    });
    agentIds.push(user.id);
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: input.organizationId, userId: user.id } },
      create: { id: `membership-${agent.id}`, organizationId: input.organizationId, userId: user.id, role: agent.role, active: true },
      update: { role: agent.role, active: true }
    });
  }

  const demos = [
    { id: 'demo-contact-maria', name: 'Maria Oliveira', phone: '+5511999990001', status: 'WAITING', wait: 42, message: 'Olá! Preciso de ajuda com meu pedido.', sequence: 101 },
    { id: 'demo-contact-joao', name: 'João Martins', phone: '+5511999990002', status: 'RETURNING', wait: 24, message: 'Voltei, ainda preciso de suporte.', sequence: 102 },
    { id: 'demo-contact-beatriz', name: 'Beatriz Costa', phone: '+5511999990003', status: 'IN_PROGRESS', wait: 16, message: 'Pode me enviar a segunda via?', sequence: 103, assignedUserId: input.ownerId },
    { id: 'demo-contact-rafael', name: 'Rafael Almeida', phone: '+5511999990004', status: 'WAITING_CUSTOMER', wait: 58, message: 'Vou verificar e já retorno.', sequence: 104, assignedUserId: agentIds[0] },
    { id: 'demo-contact-larissa', name: 'Larissa Mendes', phone: '+5511999990005', status: 'FINISHED', wait: 90, message: 'Muito obrigada pelo atendimento!', sequence: 105, assignedUserId: agentIds[0] },
    { id: 'demo-contact-pedro', name: 'Pedro Rocha', phone: '+5511999990006', status: 'FINISHED', wait: 130, message: 'Tudo certo agora.', sequence: 106, assignedUserId: agentIds[1] }
  ];

  for (const demo of demos) {
    const contact = await prisma.contact.upsert({
      where: { organizationId_channelId_phoneE164: { organizationId: input.organizationId, channelId: channel.id, phoneE164: demo.phone } },
      create: { id: demo.id, organizationId: input.organizationId, channelId: channel.id, phoneE164: demo.phone, name: demo.name, firstContactAt: minutesAgo(demo.wait + 180), lastContactAt: minutesAgo(Math.max(2, demo.wait - 5)) },
      update: { name: demo.name }
    });
    const enteredAt = minutesAgo(demo.wait);
    const finishedAt = demo.status === 'FINISHED' ? minutesAgo(demo.sequence === 105 ? 25 : 75) : null;
    const ticket = await prisma.ticket.upsert({
      where: { organizationId_sequenceNumber: { organizationId: input.organizationId, sequenceNumber: demo.sequence } },
      create: {
        id: `demo-ticket-${demo.sequence}`,
        organizationId: input.organizationId,
        channelId: channel.id,
        contactId: contact.id,
        sequenceNumber: demo.sequence,
        status: demo.status,
        priority: demo.status === 'RETURNING' ? 1 : 0,
        queueEnteredAt: enteredAt,
        assignedUserId: demo.assignedUserId ?? null,
        assignedAt: demo.assignedUserId ? minutesAgo(Math.max(10, demo.wait - 8)) : null,
        firstResponseAt: demo.assignedUserId ? minutesAgo(Math.max(8, demo.wait - 10)) : null,
        waitingCustomerSince: demo.status === 'WAITING_CUSTOMER' ? minutesAgo(12) : null,
        finishedAt,
        lastMessageAt: minutesAgo(Math.max(2, demo.wait - 5))
      },
      update: {}
    });
    await prisma.message.upsert({
      where: { whatsappMessageId: `wamid.DEMO.IN.${demo.sequence}` },
      create: { id: `demo-message-in-${demo.sequence}`, organizationId: input.organizationId, ticketId: ticket.id, contactId: contact.id, whatsappMessageId: `wamid.DEMO.IN.${demo.sequence}`, direction: 'INBOUND', body: demo.message, providerStatus: 'read', providerTimestamp: minutesAgo(Math.max(3, demo.wait - 4)) },
      update: {}
    });
    if (demo.assignedUserId) {
      await prisma.message.upsert({
        where: { whatsappMessageId: `wamid.DEMO.OUT.${demo.sequence}` },
        create: { id: `demo-message-out-${demo.sequence}`, organizationId: input.organizationId, ticketId: ticket.id, contactId: contact.id, whatsappMessageId: `wamid.DEMO.OUT.${demo.sequence}`, direction: 'OUTBOUND', body: demo.status === 'FINISHED' ? 'Pronto! Resolvi sua solicitação. Posso ajudar em algo mais?' : 'Olá! Já estou verificando sua solicitação.', senderUserId: demo.assignedUserId, providerStatus: 'delivered', providerTimestamp: minutesAgo(Math.max(2, demo.wait - 7)) },
        update: {}
      });
    }
  }

  await prisma.internalNote.upsert({
    where: { id: 'demo-note-customer' },
    create: { id: 'demo-note-customer', organizationId: input.organizationId, contactId: 'demo-contact-beatriz', ticketId: 'demo-ticket-103', authorUserId: input.ownerId, body: 'Cliente solicitou contato preferencialmente no período da tarde.' },
    update: {}
  });
  console.log('[seed] Dados demonstrativos criados: canal mock, equipe, contatos, tickets e mensagens.');
}

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';

  if (WEAK_PASSWORDS.has(password) || password.length < 8) {
    console.error(
      `[seed] SEED_ADMIN_PASSWORD ausente/placeholder/fraco. Defina uma senha forte (>= 12 caracteres) com: openssl rand -base64 16. Seed abortado.`
    );
    process.exitCode = 1;
    return;
  }
  if (!passwordIsStrong(password)) {
    console.warn(
      '[seed] AVISO: SEED_ADMIN_PASSWORD não atende à política de força recomendada (>= 12 caracteres, maiúsculas, minúsculas e dígitos). Considere gerar com: openssl rand -base64 16'
    );
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      `[seed] PRODUÇÃO: criando conta admin OWNER para ${process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'}. Revogue/altere a senha imediatamente após o primeiro acesso.`
    );
  }

  const hasher = new BcryptPasswordHasher();

  const name = process.env.SEED_ADMIN_NAME ?? 'Admin';
  const email = Email.create(process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com');
  const orgName = process.env.SEED_ORG_NAME ?? 'Empresa Piloto';
  const slug = process.env.SEED_ORG_SLUG ?? 'empresa-piloto';

  const passwordHash = await hasher.hash(password);

  const organization = await prisma.organization.upsert({
    where: { slug },
    update: { name: orgName },
    create: {
      id: randomUUID(),
      name: orgName,
      slug,
      timezone: 'America/Sao_Paulo',
      plan: 'STARTER',
      subscriptionStatus: 'TRIAL'
    }
  });

  const user = await prisma.user.upsert({
    where: { email: email.value },
    update: { name, passwordHash },
    create: {
      id: randomUUID(),
      email: email.value,
      name,
      passwordHash
    }
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id
      }
    },
    update: { role: Role.OWNER, active: true },
    create: {
      id: randomUUID(),
      organizationId: organization.id,
      userId: user.id,
      role: Role.OWNER,
      active: true
    }
  });

  if (process.env.SEED_DEMO_DATA === 'true') {
    await seedDemoData({
      organizationId: organization.id,
      ownerId: user.id,
      passwordHash
    });
  }

  console.log(
    `Seed concluído. Empresa "${organization.name}" (${organization.slug}) com admin ${email.value}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
