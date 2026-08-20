import {
  ContactNotFoundError,
  MemberNotFoundError
} from '../../domain/errors';
import type { ContactRepository } from '../ports/ContactRepository';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type {
  ListContactHistoryInput,
  ListContactHistoryOutput
} from '../dto/ListContactHistoryDTO';

export class ListContactHistory {
  constructor(
    private readonly deps: {
      contacts: ContactRepository;
      tickets: TicketRepository;
      members: OrganizationMemberRepository;
    }
  ) {}

  async execute(input: ListContactHistoryInput): Promise<ListContactHistoryOutput> {
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

    return {
      history: history.map(({ ticket, assignedUserName }) => ({
        ticketId: ticket.id,
        sequenceNumber: ticket.sequenceNumber,
        status: ticket.status,
        queueEnteredAt: ticket.queueEnteredAt,
        finishedAt: ticket.finishedAt,
        assignedUserName,
        durationSeconds:
          ticket.finishedAt && ticket.queueEnteredAt
            ? Math.max(
                0,
                Math.floor(
                  (ticket.finishedAt.getTime() - ticket.queueEnteredAt.getTime()) /
                    1000
                )
              )
            : null
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
