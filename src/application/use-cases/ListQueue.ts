import { MemberNotFoundError } from '../../domain/errors';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import type { Clock } from '../ports/Clock';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type { ListQueueInput, ListQueueOutput } from '../dto/ListQueueDTO';

export class ListQueue {
  constructor(
    private readonly deps: {
      tickets: TicketRepository;
      members: OrganizationMemberRepository;
      clock: Clock;
    }
  ) {}

  async execute(input: ListQueueInput): Promise<ListQueueOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canViewTickets(actor);

    const now = this.deps.clock.now();
    const queue = await this.deps.tickets.listQueue({
      organizationId: input.organizationId,
      status: input.status,
      assignedUserId: input.assignedUserId,
      limit: input.limit
    });

    return {
      queue: queue.map(({ ticket, contactName, contactPhone, assignedUserName, lastMessageBody, lastMessageAt }) => ({
        ticketId: ticket.id,
        channelId: ticket.channelId,
        sequenceNumber: ticket.sequenceNumber,
        status: ticket.status,
        queueEnteredAt: ticket.queueEnteredAt,
        waitSeconds: Math.max(
          0,
          Math.floor((now.getTime() - ticket.queueEnteredAt.getTime()) / 1000)
        ),
        priority: ticket.priority,
        assignedUserId: ticket.assignedUserId,
        assignedUserName,
        contact: {
          id: ticket.contactId,
          name: contactName,
          phoneE164: contactPhone
        },
        lastMessage: {
          body: lastMessageBody,
          createdAt: lastMessageAt
        }
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
