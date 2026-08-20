import { TicketEvent } from '../../domain/entities/TicketEvent';
import { Role } from '../../domain/value-objects/Role';
import { ForbiddenRoleError, TicketNotFoundError, MemberNotFoundError } from '../../domain/errors';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketEventRepository } from '../ports/TicketEventRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type { ReopenTicketInput, ReopenTicketOutput } from '../dto/ReopenTicketDTO';

export class ReopenTicket {
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

  async execute(input: ReopenTicketInput): Promise<ReopenTicketOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canHandleTickets(actor);

    const ticket = await this.deps.tickets.findById(input.ticketId);
    if (!ticket) {
      throw new TicketNotFoundError(input.ticketId);
    }
    if (ticket.organizationId !== input.organizationId) {
      throw new TicketNotFoundError(input.ticketId);
    }
    const isManager = actor.role === Role.OWNER || actor.role === Role.ADMIN;
    if (ticket.assignedUserId !== input.actorUserId && !isManager) {
      // Só o responsável pelo atendimento reabre; OWNER/ADMIN reabrem qualquer um
      throw new ForbiddenRoleError(
        actor.role,
        'reabrir atendimento de outro atendente'
      );
    }

    const fromStatus = ticket.status;
    const now = this.deps.clock.now();
    ticket.reopen(now);
    await this.deps.tickets.save(ticket);

    await this.deps.events.save(
      TicketEvent.create({
        id: this.deps.idGenerator(),
        organizationId: input.organizationId,
        ticketId: ticket.id,
        actorUserId: input.actorUserId,
        eventType: 'TICKET_REOPENED',
        fromStatus,
        toStatus: ticket.status
      })
    );

    this.deps.logger.log('info', 'ticket.reopened', {
      organizationId: input.organizationId,
      ticketId: ticket.id,
      actorUserId: input.actorUserId,
      reassignedTo: ticket.assignedUserId ?? null
    });

    return {
      ticket: {
        id: ticket.id,
        status: ticket.status
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
