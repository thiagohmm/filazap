import {
  MemberCannotBeRemovedError,
  MemberNotFoundError
} from '../../domain/errors';
import { Role } from '../../domain/value-objects/Role';
import type { RemoveMemberInput, RemoveMemberOutput } from '../dto/RemoveMemberDTO';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';

export class RemoveMember {
  constructor(
    private readonly deps: {
      members: OrganizationMemberRepository;
      clock: Clock;
      logger: AuditLogger;
    }
  ) {}

  async execute(input: RemoveMemberInput): Promise<RemoveMemberOutput> {
    const actorMember = await this.deps.members.findByUserAndOrganization(
      input.actorUserId,
      input.organizationId
    );
    if (!actorMember) {
      throw new MemberNotFoundError(input.actorUserId, input.organizationId);
    }
    const actor: Actor = {
      userId: input.actorUserId,
      role: actorMember.role,
      active: actorMember.active
    };
    OrganizationPolicy.canManageMembers(actor);

    const member = await this.deps.members.findById(input.memberId);
    if (!member || member.organizationId !== input.organizationId) {
      throw new MemberNotFoundError(input.memberId, input.organizationId);
    }
    if (!member.active || member.role !== Role.AGENT || member.userId === input.actorUserId) {
      throw new MemberCannotBeRemovedError();
    }

    const result = await this.deps.members.deactivateAgentAndReleaseTickets({
      memberId: member.id,
      organizationId: input.organizationId,
      userId: member.userId,
      now: this.deps.clock.now()
    });
    if (!result.removed) throw new MemberCannotBeRemovedError();
    this.deps.logger.log('info', 'member.removed', {
      organizationId: input.organizationId,
      memberId: member.id,
      userId: member.userId,
      actorUserId: input.actorUserId,
      releasedTickets: result.releasedTickets
    });

    return { member: { id: member.id, active: false } };
  }
}
