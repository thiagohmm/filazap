import { TicketEvent } from '../../domain/entities/TicketEvent';
import { MemberNotFoundError } from '../../domain/errors';
import { TicketStatus } from '../../domain/value-objects/TicketStatus';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketEventRepository } from '../ports/TicketEventRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type {
  AssignNextTicketInput,
  AssignNextTicketOutput
} from '../dto/AssignNextTicketDTO';

export class AssignNextTicket {
  constructor(
    private readonly deps: {
      tickets: TicketRepository;
      members: OrganizationMemberRepository;
      events: TicketEventRepository;
      clock: Clock;
      logger: AuditLogger;
      idGenerator: () => string;
    }
  ) {}

  async execute(input: AssignNextTicketInput): Promise<AssignNextTicketOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canHandleTickets(actor);

    const now = this.deps.clock.now();
    const result = await this.deps.tickets.assignNext(
      input.organizationId,
      input.actorUserId,
      now
    );

    if (!result.ok) {
      return { assigned: false, ticket: null };
    }

    const ticket = result.ticket;

    await this.deps.events.save(
      TicketEvent.create({
        id: this.deps.idGenerator(),
        organizationId: input.organizationId,
        ticketId: ticket.id,
        actorUserId: input.actorUserId,
        eventType: 'TICKET_ASSIGNED',
        fromStatus: TicketStatus.WAITING,
        toStatus: ticket.status
      })
    );

    this.deps.logger.log('info', 'ticket.assign_next', {
      organizationId: input.organizationId,
      ticketId: ticket.id,
      actorUserId: input.actorUserId
    });

    const waitSeconds = Math.max(
      0,
      Math.floor((now.getTime() - ticket.queueEnteredAt.getTime()) / 1000)
    );

    return {
      assigned: true,
      ticket: {
        id: ticket.id,
        contactId: ticket.contactId,
        status: ticket.status,
        queueEnteredAt: ticket.queueEnteredAt,
        waitSeconds
      }
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