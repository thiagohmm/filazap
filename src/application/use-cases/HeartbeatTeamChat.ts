import { MemberNotFoundError } from '../../domain/errors';
import type { Clock } from '../ports/Clock';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TeamChatRepository } from '../ports/TeamChatRepository';
import { OrganizationPolicy } from '../policies/OrganizationPolicy';

export class HeartbeatTeamChat {
  constructor(private readonly deps: {
    members: OrganizationMemberRepository;
    teamChat: TeamChatRepository;
    clock: Clock;
  }) {}

  async execute(input: { actorUserId: string; organizationId: string }): Promise<void> {
    const member = await this.deps.members.findByUserAndOrganization(
      input.actorUserId,
      input.organizationId
    );
    if (!member) throw new MemberNotFoundError(input.actorUserId, input.organizationId);
    OrganizationPolicy.canHandleTickets({
      userId: input.actorUserId,
      role: member.role,
      active: member.active
    });
    await this.deps.teamChat.touchPresence(
      input.organizationId,
      input.actorUserId,
      this.deps.clock.now()
    );
  }
}
