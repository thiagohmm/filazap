import { MemberNotFoundError } from '../../domain/errors';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import type { Clock } from '../ports/Clock';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type {
  GetOperationalCountersInput,
  GetOperationalCountersOutput
} from '../dto/GetOperationalCountersDTO';

export class GetOperationalCounters {
  constructor(
    private readonly deps: {
      tickets: TicketRepository;
      members: OrganizationMemberRepository;
      clock: Clock;
    }
  ) {}

  async execute(
    input: GetOperationalCountersInput
  ): Promise<GetOperationalCountersOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canViewTickets(actor);

    const now = this.deps.clock.now();
    return this.deps.tickets.getOperationalCounters(input.organizationId, now);
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