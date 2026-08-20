import { MemberNotFoundError } from '../../domain/errors';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { UserRepository } from '../ports/UserRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type { ListMembersInput, ListMembersOutput } from '../dto/ListMembersDTO';

export class ListMembers {
  constructor(
    private readonly deps: {
      users: UserRepository;
      members: OrganizationMemberRepository;
    }
  ) {}

  async execute(input: ListMembersInput): Promise<ListMembersOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canViewMembers(actor);

    const members = await this.deps.members.findByOrganizationId(
      input.organizationId
    );

    const userIds = [...new Set(members.map((m) => m.userId))];
    const users = new Map<string, { id: string; name: string; email: string }>();
    for (const id of userIds) {
      const user = await this.deps.users.findById(id);
      if (user) {
        users.set(id, { id: user.id, name: user.name, email: user.email });
      }
    }

    return {
      members: members.map((m) => ({
        id: m.id,
        user: users.get(m.userId) ?? { id: m.userId, name: '?', email: '?' },
        role: m.role,
        active: m.active,
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
    return {
      userId,
      role: member.role,
      active: member.active
    };
  }
}
