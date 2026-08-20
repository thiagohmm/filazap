import {
  ContactNotFoundError,
  MemberNotFoundError
} from '../../domain/errors';
import type { ContactRepository } from '../ports/ContactRepository';
import type { InternalNoteRepository } from '../ports/InternalNoteRepository';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import type { UserRepository } from '../ports/UserRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type {
  GetContactProfileInput,
  GetContactProfileOutput
} from '../dto/GetContactProfileDTO';

export class GetContactProfile {
  constructor(
    private readonly deps: {
      contacts: ContactRepository;
      tickets: TicketRepository;
      notes: InternalNoteRepository;
      users: UserRepository;
      members: OrganizationMemberRepository;
    }
  ) {}

  async execute(input: GetContactProfileInput): Promise<GetContactProfileOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canViewTickets(actor);

    const contact = await this.deps.contacts.findById(input.contactId);
    if (!contact || contact.organizationId !== input.organizationId) {
      throw new ContactNotFoundError(input.contactId);
    }

    const history = await this.deps.tickets.findByContact(
      input.organizationId,
      contact.id
    );
    const notes = await this.deps.notes.findByContactId(
      input.organizationId,
      contact.id
    );

    const activeTicket = history.find((h) => h.ticket.isActive())?.ticket ?? null;
    let assignedUserName: string | null = null;
    if (activeTicket?.assignedUserId) {
      const user = await this.deps.users.findById(activeTicket.assignedUserId);
      assignedUserName = user?.name ?? null;
    }

    return {
      contact: {
        id: contact.id,
        channelId: contact.channelId,
        phoneE164: contact.phoneE164,
        name: contact.name,
        firstContactAt: contact.firstContactAt,
        lastContactAt: contact.lastContactAt
      },
      stats: {
        totalTickets: history.length,
        currentStatus: activeTicket?.status ?? null,
        assignedUserName
      },
      notes: notes.map((n) => ({
        id: n.id,
        body: n.body,
        authorUserId: n.authorUserId,
        createdAt: n.createdAt
      }))
    };
  }

  private async loadActor(userId: string, organizationId: string): Promise<Actor> {
    const member = await this.deps.members.findByUserAndOrganization(
      userId,
      organizationId
    );
    if (!member) {
      throw new MemberNotFoundError(userId, organizationId);
    }
    return { userId, role: member.role, active: member.active };
  }
}
