import { randomUUID } from 'crypto';
import {
  CreateOrganization,
  Authenticate,
  InviteMember,
  ListMembers,
  RegisterChannel,
  ListChannels,
  VerifyWebhook,
  ReceiveWhatsAppMessage,
  SendMessage,
  UpdateMessageStatus,
  UpdateChannelCredentials,
  AssignTicket,
  AssignNextTicket,
  MoveTicketToWaitingCustomer,
  FinishTicket,
  AddInternalNote,
  ListQueue,
  GetOperationalCounters,
  ListMessages,
  GetContactProfile,
  ListContactHistory,
  SearchContacts,
  GetMetrics,
  UpdateOrganizationAppearance,
  GetOrganizationAppearance
} from '@/application/use-cases';
import {
  BcryptPasswordHasher,
  JwtTokenService,
  PrismaOrganizationMemberRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaWhatsAppChannelRepository,
  PrismaContactRepository,
  PrismaTicketRepository,
  PrismaMessageRepository,
  PrismaWebhookEventRepository,
  PrismaInternalNoteRepository,
  PrismaTicketEventRepository,
  MetaWhatsAppWebhookParser,
  MetaWhatsAppGateway
} from '@/infrastructure';
import { Aes256GcmCredentialCipher } from '@/infrastructure/security/Aes256GcmCredentialCipher';
import { ConsoleAuditLogger } from '@/infrastructure/observability/ConsoleAuditLogger';

const idGenerator = () => randomUUID();
const generateTemporaryPassword = () => randomUUID().replace(/-/g, '').slice(0, 12);

const secret = process.env.JWT_SECRET ?? '';

const passwordHasher = new BcryptPasswordHasher();
const tokenService = new JwtTokenService(secret);
const logger = new ConsoleAuditLogger();

const organizations = new PrismaOrganizationRepository();
const users = new PrismaUserRepository();
const members = new PrismaOrganizationMemberRepository();
const channels = new PrismaWhatsAppChannelRepository();
const contacts = new PrismaContactRepository();
const tickets = new PrismaTicketRepository();
const messages = new PrismaMessageRepository();
const webhookEvents = new PrismaWebhookEventRepository();
const internalNotes = new PrismaInternalNoteRepository();
const ticketEvents = new PrismaTicketEventRepository();

const webhookParser = new MetaWhatsAppWebhookParser();
const credentialCipher = new Aes256GcmCredentialCipher(
  process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY ?? ''
);
const whatsappGateway = new MetaWhatsAppGateway({
  baseUrl: () =>
    process.env.WHATSAPP_API_URL ??
    'https://graph.facebook.com/v19.0'
});

export const useCases = {
  createOrganization: new CreateOrganization({
    organizations,
    users,
    members,
    passwordHasher,
    tokenService,
    clock: { now: () => new Date() },
    logger,
    idGenerator
  }),
  authenticate: new Authenticate({
    users,
    members,
    passwordHasher,
    tokenService,
    logger
  }),
  inviteMember: new InviteMember({
    users,
    members,
    organizations,
    passwordHasher,
    clock: { now: () => new Date() },
    logger,
    idGenerator,
    generateTemporaryPassword
  }),
  listMembers: new ListMembers({ users, members }),
  registerChannel: new RegisterChannel({
    channels,
    members,
    logger,
    idGenerator
  }),
  listChannels: new ListChannels({ channels, members }),
  verifyWebhook: new VerifyWebhook({ channels }),
  receiveWhatsAppMessage: new ReceiveWhatsAppMessage({
    webhookEvents,
    channels,
    contacts,
    tickets,
    messages,
    ticketEvents,
    parser: webhookParser,
    clock: { now: () => new Date() },
    logger,
    idGenerator
  }),
  updateMessageStatus: new UpdateMessageStatus({
    webhookEvents,
    messages,
    parser: webhookParser,
    clock: { now: () => new Date() },
    logger,
    idGenerator
  }),
  sendMessage: new SendMessage({
    channels,
    contacts,
    tickets,
    messages,
    members,
    ticketEvents,
    gateway: whatsappGateway,
    cipher: credentialCipher,
    clock: { now: () => new Date() },
    logger,
    idGenerator
  }),
  updateChannelCredentials: new UpdateChannelCredentials({
    channels,
    members,
    cipher: credentialCipher,
    logger,
    idGenerator,
    clock: { now: () => new Date() }
  }),
  assignTicket: new AssignTicket({
    tickets,
    contacts,
    channels,
    members,
    events: ticketEvents,
    clock: { now: () => new Date() },
    logger,
    idGenerator
  }),
  assignNextTicket: new AssignNextTicket({
    tickets,
    members,
    events: ticketEvents,
    clock: { now: () => new Date() },
    logger,
    idGenerator
  }),
  moveTicketToWaitingCustomer: new MoveTicketToWaitingCustomer({
    tickets,
    members,
    events: ticketEvents,
    clock: { now: () => new Date() },
    logger,
    idGenerator
  }),
  finishTicket: new FinishTicket({
    tickets,
    members,
    events: ticketEvents,
    clock: { now: () => new Date() },
    logger,
    idGenerator
  }),
  addInternalNote: new AddInternalNote({
    notes: internalNotes,
    contacts,
    tickets,
    members,
    clock: { now: () => new Date() },
    logger,
    idGenerator
  }),
  listQueue: new ListQueue({
    tickets,
    members,
    clock: { now: () => new Date() }
  }),
  getOperationalCounters: new GetOperationalCounters({
    tickets,
    members,
    clock: { now: () => new Date() }
  }),
  listMessages: new ListMessages({
    messages,
    tickets,
    members
  }),
  getContactProfile: new GetContactProfile({
    contacts,
    tickets,
    notes: internalNotes,
    users,
    members
  }),
  listContactHistory: new ListContactHistory({
    contacts,
    tickets,
    members
  }),
  searchContacts: new SearchContacts({
    contacts,
    members
  }),
  getMetrics: new GetMetrics({
    tickets,
    members,
    clock: { now: () => new Date() }
  }),
  updateOrganizationAppearance: new UpdateOrganizationAppearance({
    organizations,
    members,
    logger,
    clock: { now: () => new Date() }
  }),
  getOrganizationAppearance: new GetOrganizationAppearance({
    organizations,
    members
  })
};

export { webhookParser, credentialCipher, channels };
