import { MemberNotFoundError } from '../../domain/errors';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import type { Clock } from '../ports/Clock';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type { GetMetricsInput, GetMetricsOutput } from '../dto/GetMetricsDTO';

export class GetMetrics {
  constructor(
    private readonly deps: {
      tickets: TicketRepository;
      members: OrganizationMemberRepository;
      clock: Clock;
    }
  ) {}

  async execute(input: GetMetricsInput): Promise<GetMetricsOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canViewTickets(actor);

    return this.deps.tickets.getMetrics(input.organizationId, this.deps.clock.now());
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
