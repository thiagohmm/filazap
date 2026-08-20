import { Organization } from '../../domain/entities/Organization';
import { OrganizationMember } from '../../domain/entities/OrganizationMember';
import { User } from '../../domain/entities/User';
import { WhatsAppChannel } from '../../domain/entities/WhatsAppChannel';
import { Contact } from '../../domain/entities/Contact';
import { Ticket } from '../../domain/entities/Ticket';
import { Message } from '../../domain/entities/Message';
import { WebhookEvent } from '../../domain/entities/WebhookEvent';
import { InternalNote } from '../../domain/entities/InternalNote';
import { TicketEvent } from '../../domain/entities/TicketEvent';
import { Role } from '../../domain/value-objects/Role';
import type { OrganizationRepository } from '../../application/ports/OrganizationRepository';
import type { UserRepository } from '../../application/ports/UserRepository';
import type {
  MemberWithOrganization,
  OrganizationMemberRepository
} from '../../application/ports/OrganizationMemberRepository';
import type { PasswordHasher } from '../../application/ports/PasswordHasher';
import type { TokenService, SessionPayload } from '../../application/ports/TokenService';
import type { AuditLogger } from '../../application/ports/AuditLogger';
import type { WhatsAppChannelRepository } from '../../application/ports/WhatsAppChannelRepository';
import type {
  ContactRepository,
  ContactSearchResult
} from '../../application/ports/ContactRepository';
import type {
  AssignResult,
  OperationalCounters,
  OrganizationMetrics,
  QueueTicket,
  TicketHistoryItem,
  TicketQueueFilter,
  TicketRepository
} from '../../application/ports/TicketRepository';
import type { MessageRepository } from '../../application/ports/MessageRepository';
import type { InternalNoteRepository } from '../../application/ports/InternalNoteRepository';
import type { TicketEventRepository } from '../../application/ports/TicketEventRepository';
import type { WebhookEventRepository } from '../../application/ports/WebhookEventRepository';
import { TicketStatus } from '../../domain/value-objects/TicketStatus';
import type {
  SendMessageCommand,
  SendMessageResult,
  WhatsAppGateway
} from '../../application/ports/WhatsAppGateway';
import type {
  ParsedWebhook,
  WhatsAppWebhookParser
} from '../../application/ports/WhatsAppWebhookParser';
import type { CredentialCipher } from '../../application/ports/CredentialCipher';

export class InMemoryOrganizationRepository implements OrganizationRepository {
  private store = new Map<string, Organization>();

  async save(organization: Organization): Promise<Organization> {
    this.store.set(organization.id, organization);
    return organization;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    for (const org of this.store.values()) {
      if (org.slug === slug) return org;
    }
    return null;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.store.get(id) ?? null;
  }
}

export class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();

  async save(user: User): Promise<User> {
    this.store.set(user.id, user);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }
}

export class InMemoryMemberRepository implements OrganizationMemberRepository {
  private store = new Map<string, OrganizationMember>();
  private organizations = new Map<
    string,
    { id: string; name: string; slug: string; theme: string; brandColor: string }
  >();

  registerOrganization(org: Organization): void {
    this.organizations.set(org.id, {
      id: org.id,
      name: org.name,
      slug: org.slug,
      theme: org.theme,
      brandColor: org.brandColor
    });
  }

  async save(member: OrganizationMember): Promise<OrganizationMember> {
    this.store.set(
      `${member.organizationId}:${member.userId}`,
      member
    );
    return member;
  }

  async findByOrganizationId(organizationId: string): Promise<OrganizationMember[]> {
    return [...this.store.values()].filter((m) => m.organizationId === organizationId);
  }

  async findByUserAndOrganization(
    userId: string,
    organizationId: string
  ): Promise<OrganizationMember | null> {
    return this.store.get(`${organizationId}:${userId}`) ?? null;
  }

  async findUsersByOrganizationAndRoles(
    organizationId: string,
    roles: Role[]
  ): Promise<OrganizationMember[]> {
    return [...this.store.values()].filter(
      (m) => m.organizationId === organizationId && roles.includes(m.role)
    );
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return this.findByOrganizationId(organizationId).then((m) => m.length);
  }

  async findByUserIdActive(userId: string): Promise<MemberWithOrganization[]> {
    return [...this.store.values()]
      .filter((m) => m.userId === userId && m.active)
      .map((m) => {
        const org = this.organizations.get(m.organizationId);
        return {
          ...m.toJSON(),
          organization: org ?? {
            id: m.organizationId,
            name: '',
            slug: '',
            theme: 'light',
            brandColor: '#10b981'
          }
        } as MemberWithOrganization;
      });
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hash:${plain}`;
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return hash === `hash:${plain}`;
  }
}

export class FakeTokenService implements TokenService {
  private store = new Map<string, SessionPayload>();

  async sign(payload: SessionPayload): Promise<string> {
    const token = `token:${payload.userId}`;
    this.store.set(token, payload);
    return token;
  }

  async verify(token: string): Promise<SessionPayload> {
    const payload = this.store.get(token);
    if (!payload) throw new Error('invalid token');
    return payload;
  }
}

export class FakeLogger implements AuditLogger {
  logs: Array<{ level: string; message: string; context?: Record<string, unknown> }> = [];

  log(
    level: 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.logs.push({ level, message, context });
  }
}

export function createTestServices() {
  const organizations = new InMemoryOrganizationRepository();
  const users = new InMemoryUserRepository();
  const members = new InMemoryMemberRepository();
  const passwordHasher = new FakePasswordHasher();
  const tokenService = new FakeTokenService();
  const logger = new FakeLogger();

  let counter = 0;
  const idGenerator = () => `id-${++counter}`;

  return {
    organizations,
    users,
    members,
    passwordHasher,
    tokenService,
    logger,
    idGenerator,
    clock: { now: () => new Date('2026-08-19T12:00:00.000Z') },
    generateTemporaryPassword: () => 'temporary-password'
  };
}

export class InMemoryWhatsAppChannelRepository implements WhatsAppChannelRepository {
  private store = new Map<string, WhatsAppChannel>();

  async save(channel: WhatsAppChannel): Promise<WhatsAppChannel> {
    this.store.set(channel.id, channel);
    return channel;
  }

  async findById(id: string): Promise<WhatsAppChannel | null> {
    return this.store.get(id) ?? null;
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppChannel | null> {
    for (const channel of this.store.values()) {
      if (channel.phoneNumberId === phoneNumberId) return channel;
    }
    return null;
  }

  async findByOrganizationId(organizationId: string): Promise<WhatsAppChannel[]> {
    return [...this.store.values()].filter(
      (channel) => channel.organizationId === organizationId
    );
  }

  async findByBusinessAccountId(
    businessAccountId: string
  ): Promise<WhatsAppChannel | null> {
    for (const channel of this.store.values()) {
      if (channel.businessAccountId === businessAccountId) return channel;
    }
    return null;
  }

  async findByWebhookVerifyToken(
    verifyToken: string
  ): Promise<WhatsAppChannel | null> {
    for (const channel of this.store.values()) {
      if (channel.webhookVerifyToken === verifyToken) return channel;
    }
    return null;
  }
}

export class InMemoryContactRepository implements ContactRepository {
  private store = new Map<string, Contact>();
  private ticketsCountFn: ((contactId: string) => number) | null = null;

  setTicketsCount(fn: (contactId: string) => number): void {
    this.ticketsCountFn = fn;
  }

  async save(contact: Contact): Promise<Contact> {
    this.store.set(contact.id, contact);
    return contact;
  }

  async findById(id: string): Promise<Contact | null> {
    return this.store.get(id) ?? null;
  }

  findByIdSync(id: string): Contact | null {
    return this.store.get(id) ?? null;
  }

  async findByChannelAndPhone(
    organizationId: string,
    channelId: string,
    phoneE164: string
  ): Promise<Contact | null> {
    for (const contact of this.store.values()) {
      if (
        contact.organizationId === organizationId &&
        contact.channelId === channelId &&
        contact.phoneE164 === phoneE164
      ) {
        return contact;
      }
    }
    return null;
  }

  async search(
    organizationId: string,
    query: string,
    limit = 25
  ): Promise<ContactSearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = [...this.store.values()].filter(
      (c) =>
        c.organizationId === organizationId &&
        ((c.name ?? '').toLowerCase().includes(q) ||
          c.phoneE164.includes(q))
    );
    matches.sort(
      (a, b) => b.lastContactAt.getTime() - a.lastContactAt.getTime()
    );
    return matches.slice(0, limit).map((c) => ({
      contact: c,
      totalTickets: this.ticketsCountFn ? this.ticketsCountFn(c.id) : 0,
      lastMessageAt: null
    }));
  }
}

export class InMemoryTicketRepository implements TicketRepository {
  private store = new Map<string, Ticket>();
  private contacts: InMemoryContactRepository | null;

  constructor(contacts: InMemoryContactRepository | null = null) {
    this.contacts = contacts;
  }

  async save(ticket: Ticket): Promise<Ticket> {
    this.store.set(ticket.id, ticket);
    return ticket;
  }

  async findById(id: string): Promise<Ticket | null> {
    return this.store.get(id) ?? null;
  }

  async findOpenByContact(contactId: string): Promise<Ticket | null> {
    const matches = [...this.store.values()].filter(
      (ticket) => ticket.contactId === contactId && ticket.isOpen()
    );
    matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return matches[0] ?? null;
  }

  async findActiveByContact(contactId: string): Promise<Ticket | null> {
    const matches = [...this.store.values()].filter(
      (ticket) => ticket.contactId === contactId && ticket.isActive()
    );
    matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return matches[0] ?? null;
  }

  async nextSequenceNumber(organizationId: string): Promise<number> {
    const matches = [...this.store.values()].filter(
      (ticket) => ticket.organizationId === organizationId
    );
    return Math.max(0, ...matches.map((t) => t.sequenceNumber)) + 1;
  }

  async listQueue(filter: TicketQueueFilter): Promise<QueueTicket[]> {
    let matches = [...this.store.values()].filter(
      (t) => t.organizationId === filter.organizationId
    );
    if (filter.status) {
      matches = matches.filter((t) => t.status === filter.status);
    }
    if (filter.assignedUserId) {
      matches = matches.filter((t) => t.assignedUserId === filter.assignedUserId);
    }
    matches.sort(
      (a, b) =>
        b.priority - a.priority ||
        a.queueEnteredAt.getTime() - b.queueEnteredAt.getTime()
    );
    if (filter.limit) matches = matches.slice(0, filter.limit);
    return matches.map((t) => {
      let contactName: string | null = null;
      let contactPhone = '';
      if (this.contacts) {
        const contact = this.contacts.findByIdSync(t.contactId);
        if (contact) {
          contactName = contact.name;
          contactPhone = contact.phoneE164;
        }
      }
      return {
        ticket: t,
        contactName,
        contactPhone,
        lastMessageBody: null,
        lastMessageAt: null
      };
    });
  }

  async assignNext(
    organizationId: string,
    userId: string,
    now: Date
  ): Promise<AssignResult> {
    const candidates = [...this.store.values()]
      .filter(
        (t) =>
          t.organizationId === organizationId &&
          TicketStatus.isQueued(t.status as TicketStatus) &&
          !t.assignedUserId
      )
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          a.queueEnteredAt.getTime() - b.queueEnteredAt.getTime()
      );
    const candidate = candidates[0];
    if (!candidate) return { ok: false, reason: 'NOT_AVAILABLE' };
    const assigned = Ticket.restore({
      ...candidate.toJSON(),
      status: TicketStatus.IN_PROGRESS,
      assignedUserId: userId,
      assignedAt: now,
      updatedAt: now
    });
    this.store.set(assigned.id, assigned);
    return { ok: true, ticket: assigned };
  }

  async assignTicket(
    ticketId: string,
    userId: string,
    now: Date
  ): Promise<AssignResult> {
    const ticket = this.store.get(ticketId);
    if (!ticket || !TicketStatus.isQueued(ticket.status as TicketStatus) || ticket.assignedUserId) {
      return { ok: false, reason: 'ALREADY_ASSIGNED' };
    }
    const assigned = Ticket.restore({
      ...ticket.toJSON(),
      status: TicketStatus.IN_PROGRESS,
      assignedUserId: userId,
      assignedAt: now,
      updatedAt: now
    });
    this.store.set(assigned.id, assigned);
    return { ok: true, ticket: assigned };
  }

  async findAssignedOpenByUser(
    organizationId: string,
    userId: string
  ): Promise<Ticket[]> {
    return [...this.store.values()].filter(
      (t) =>
        t.organizationId === organizationId &&
        t.assignedUserId === userId &&
        (t.status === TicketStatus.IN_PROGRESS ||
          t.status === TicketStatus.WAITING_CUSTOMER)
    );
  }

  async getOperationalCounters(
    organizationId: string,
    now: Date
  ): Promise<OperationalCounters> {
    const tickets = [...this.store.values()].filter(
      (t) => t.organizationId === organizationId
    );
    const waiting = tickets.filter((t) => t.status === TicketStatus.WAITING).length;
    const returning = tickets.filter((t) => t.status === TicketStatus.RETURNING).length;
    const inProgress = tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).length;
    const waitingCustomer = tickets.filter(
      (t) => t.status === TicketStatus.WAITING_CUSTOMER
    ).length;
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const finishedToday = tickets.filter(
      (t) => t.status === TicketStatus.FINISHED && t.finishedAt && t.finishedAt >= dayStart
    ).length;
    const queued = tickets
      .filter((t) => TicketStatus.isQueued(t.status as TicketStatus))
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          a.queueEnteredAt.getTime() - b.queueEnteredAt.getTime()
      );
    const maxWaitSeconds = queued[0]
      ? Math.max(0, Math.floor((now.getTime() - queued[0].queueEnteredAt.getTime()) / 1000))
      : null;
    const withFirstResponse = tickets.filter((t) => t.firstResponseAt);
    const avgFirstResponseSeconds = withFirstResponse.length
      ? withFirstResponse.reduce(
          (acc, t) => acc + (t.firstResponseAt!.getTime() - t.queueEnteredAt.getTime()) / 1000,
          0
        ) / withFirstResponse.length
      : null;
    return {
      waiting,
      returning,
      inProgress,
      waitingCustomer,
      finishedToday,
      maxWaitSeconds,
      avgFirstResponseSeconds
    };
  }

  async findByContact(
    organizationId: string,
    contactId: string
  ): Promise<TicketHistoryItem[]> {
    const matches = [...this.store.values()].filter(
      (t) => t.organizationId === organizationId && t.contactId === contactId
    );
    matches.sort(
      (a, b) => b.queueEnteredAt.getTime() - a.queueEnteredAt.getTime()
    );
    return matches.map((t) => ({ ticket: t, assignedUserName: null }));
  }

  async getMetrics(
    organizationId: string,
    _now: Date
  ): Promise<OrganizationMetrics> {
    const tickets = [...this.store.values()].filter(
      (t) => t.organizationId === organizationId
    );
    const finished = tickets.filter((t) => t.status === TicketStatus.FINISHED && t.finishedAt);
    const avgAttendanceSeconds = finished.length
      ? finished.reduce(
          (acc, t) =>
            acc +
            (t.finishedAt!.getTime() - t.queueEnteredAt.getTime()) / 1000,
          0
        ) / finished.length
      : null;
    const byAgent = new Map<string, number>();
    for (const t of tickets) {
      if (t.assignedUserId) {
        byAgent.set(t.assignedUserId, (byAgent.get(t.assignedUserId) ?? 0) + 1);
      }
    }
    const ticketsPerAgent = [...byAgent.entries()].map(([userId, count]) => ({
      userId,
      name: userId,
      count
    }));
    const contactCounts = new Map<string, number>();
    for (const t of tickets) {
      contactCounts.set(t.contactId, (contactCounts.get(t.contactId) ?? 0) + 1);
    }
    const withTickets = contactCounts.size;
    const returning = [...contactCounts.values()].filter((c) => c >= 2).length;
    return {
      avgAttendanceSeconds,
      totalFinished: finished.length,
      ticketsPerAgent,
      returnRate:
        withTickets > 0 ? Math.round((returning / withTickets) * 1000) / 10 : null
    };
  }
}

export class InMemoryMessageRepository implements MessageRepository {
  private store = new Map<string, Message>();

  async save(message: Message): Promise<Message> {
    this.store.set(message.id, message);
    return message;
  }

  async findById(id: string): Promise<Message | null> {
    return this.store.get(id) ?? null;
  }

  async findByWhatsappMessageId(
    whatsappMessageId: string
  ): Promise<Message | null> {
    for (const message of this.store.values()) {
      if (message.whatsappMessageId === whatsappMessageId) return message;
    }
    return null;
  }

  async findByProviderMessageId(providerMessageId: string): Promise<Message | null> {
    return this.findByWhatsappMessageId(providerMessageId);
  }

  async findByTicketId(
    organizationId: string,
    ticketId: string
  ): Promise<Message[]> {
    return [...this.store.values()]
      .filter(
        (m) => m.organizationId === organizationId && m.ticketId === ticketId
      )
      .sort(
        (a, b) =>
          (a.providerTimestamp?.getTime() ?? 0) - (b.providerTimestamp?.getTime() ?? 0)
      );
  }
}

export class InMemoryWebhookEventRepository implements WebhookEventRepository {
  private store = new Map<string, WebhookEvent>();

  async save(event: WebhookEvent): Promise<WebhookEvent> {
    this.store.set(event.id, event);
    return event;
  }

  async findById(id: string): Promise<WebhookEvent | null> {
    return this.store.get(id) ?? null;
  }

  async findByProviderEventId(
    providerEventId: string
  ): Promise<WebhookEvent | null> {
    for (const event of this.store.values()) {
      if (event.providerEventId === providerEventId) return event;
    }
    return null;
  }
}

export class InMemoryInternalNoteRepository implements InternalNoteRepository {
  private store = new Map<string, InternalNote>();

  async save(note: InternalNote): Promise<InternalNote> {
    this.store.set(note.id, note);
    return note;
  }

  async findById(id: string): Promise<InternalNote | null> {
    return this.store.get(id) ?? null;
  }

  async findByContactId(
    organizationId: string,
    contactId: string
  ): Promise<InternalNote[]> {
    return [...this.store.values()].filter(
      (n) => n.organizationId === organizationId && n.contactId === contactId
    );
  }
}

export class InMemoryTicketEventRepository implements TicketEventRepository {
  private store = new Map<string, TicketEvent>();

  async save(event: TicketEvent): Promise<TicketEvent> {
    this.store.set(event.id, event);
    return event;
  }

  async findByTicketId(
    organizationId: string,
    ticketId: string
  ): Promise<TicketEvent[]> {
    return [...this.store.values()].filter(
      (e) => e.organizationId === organizationId && e.ticketId === ticketId
    );
  }
}

export class FakeWhatsAppGateway implements WhatsAppGateway {
  calls: Array<{ command: SendMessageCommand; result: SendMessageResult }> = [];

  async sendText(command: SendMessageCommand): Promise<SendMessageResult> {
    const result = { providerMessageId: `wamid.MOCK.${this.calls.length + 1}` };
    this.calls.push({ command, result });
    return result;
  }
}

export class FakeWhatsAppWebhookParser implements WhatsAppWebhookParser {
  result: ParsedWebhook = {
    businessAccountId: null,
    phoneNumberId: null,
    messages: [],
    statuses: []
  };

  parse(_payload: Record<string, unknown>): ParsedWebhook {
    return this.result;
  }
}

export class FakeCredentialCipher implements CredentialCipher {
  encrypt(plain: string): string {
    return `enc:${plain}`;
  }

  decrypt(cipher: string): string {
    return cipher.replace(/^enc:/, '');
  }
}

export function createWhatsAppTestServices() {
  const channels = new InMemoryWhatsAppChannelRepository();
  const contacts = new InMemoryContactRepository();
  const tickets = new InMemoryTicketRepository(contacts);
  const messages = new InMemoryMessageRepository();
  const webhookEvents = new InMemoryWebhookEventRepository();
  const ticketEvents = new InMemoryTicketEventRepository();
  const notes = new InMemoryInternalNoteRepository();
  const gateway = new FakeWhatsAppGateway();
  const parser = new FakeWhatsAppWebhookParser();
  const cipher = new FakeCredentialCipher();

  let counter = 0;
  const idGenerator = () => `wa-${++counter}`;

  return {
    channels,
    contacts,
    tickets,
    messages,
    webhookEvents,
    ticketEvents,
    notes,
    gateway,
    parser,
    cipher,
    idGenerator,
    clock: { now: () => new Date('2026-08-19T12:00:00.000Z') }
  };
}
