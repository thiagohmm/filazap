import { TicketEvent } from '../../domain/entities/TicketEvent';
import {
  TicketAlreadyAssignedError,
  TicketNotFoundError,
  MemberNotFoundError
} from '../../domain/errors';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { ContactRepository } from '../ports/ContactRepository';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketEventRepository } from '../ports/TicketEventRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import type { WhatsAppChannelRepository } from '../ports/WhatsAppChannelRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type { AssignTicketInput, AssignTicketOutput } from '../dto/AssignTicketDTO';

export class AssignTicket {
  constructor(
    private readonly deps: {
      tickets: TicketRepository;
      contacts: ContactRepository;
      channels: WhatsAppChannelRepository;
      members: OrganizationMemberRepository;
      events: TicketEventRepository;
      clock: Clock;
      logger: AuditLogger;
      idGenerator: () => string;
    }
  ) {}

  async execute(input: AssignTicketInput): Promise<AssignTicketOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canHandleTickets(actor);

    const ticket = await this.deps.tickets.findById(input.ticketId);
    if (!ticket) {
      throw new TicketNotFoundError(input.ticketId);
    }
    if (ticket.organizationId !== input.organizationId) {
      throw new TicketNotFoundError(input.ticketId);
    }

    const fromStatus = ticket.status;
    const now = this.deps.clock.now();
    const result = await this.deps.tickets.assignTicket(
      input.ticketId,
      input.actorUserId,
      now
    );
    if (!result.ok) {
      if (result.reason === 'ALREADY_ASSIGNED') {
        throw new TicketAlreadyAssignedError(input.ticketId);
      }
      throw new TicketNotFoundError(input.ticketId);
    }

    const assigned = result.ticket;

    await this.deps.events.save(
      TicketEvent.create({
        id: this.deps.idGenerator(),
        organizationId: input.organizationId,
        ticketId: assigned.id,
        actorUserId: input.actorUserId,
        eventType: 'TICKET_ASSIGNED',
        fromStatus,
        toStatus: assigned.status
      })
    );

    this.deps.logger.log('info', 'ticket.assigned', {
      organizationId: input.organizationId,
      ticketId: assigned.id,
      actorUserId: input.actorUserId
    });

    return {
      ticket: {
        id: assigned.id,
        contactId: assigned.contactId,
        status: assigned.status,
        assignedUserId: assigned.assignedUserId!,
        assignedAt: assigned.assignedAt!
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