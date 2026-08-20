import { MemberNotFoundError, TicketNotFoundError } from '../../domain/errors';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { MessageRepository } from '../ports/MessageRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type { ListMessagesInput, ListMessagesOutput } from '../dto/ListMessagesDTO';

export class ListMessages {
  constructor(
    private readonly deps: {
      messages: MessageRepository;
      tickets: TicketRepository;
      members: OrganizationMemberRepository;
    }
  ) {}

  async execute(input: ListMessagesInput): Promise<ListMessagesOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canViewTickets(actor);

    const ticket = await this.deps.tickets.findById(input.ticketId);
    if (!ticket || ticket.organizationId !== input.organizationId) {
      throw new TicketNotFoundError(input.ticketId);
    }

    const messages = await this.deps.messages.findByTicketId(
      input.organizationId,
      input.ticketId
    );

    return {
      messages: messages.map((m) => ({
        id: m.id,
        ticketId: m.ticketId,
        contactId: m.contactId,
        direction: m.direction,
        type: m.type,
        body: m.body,
        mediaPath: m.mediaPath,
        senderUserId: m.senderUserId,
        providerStatus: m.providerStatus,
        createdAt: m.createdAt
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