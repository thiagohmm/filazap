import { MemberNotFoundError } from '../../domain/errors';
import { Role } from '../../domain/value-objects/Role';
import type { ListTeamChatOutput } from '../dto/TeamChatDTO';
import type { Clock } from '../ports/Clock';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TeamChatRepository } from '../ports/TeamChatRepository';
import type { UserRepository } from '../ports/UserRepository';
import { OrganizationPolicy } from '../policies/OrganizationPolicy';

const ONLINE_WINDOW_MS = 60_000;

export class ListTeamChat {
  constructor(private readonly deps: {
    users: UserRepository;
    members: OrganizationMemberRepository;
    teamChat: TeamChatRepository;
    clock: Clock;
  }) {}

  async execute(input: { actorUserId: string; organizationId: string }): Promise<ListTeamChatOutput> {
    const actor = await this.deps.members.findByUserAndOrganization(
      input.actorUserId,
      input.organizationId
    );
    if (!actor) throw new MemberNotFoundError(input.actorUserId, input.organizationId);
    OrganizationPolicy.canHandleTickets({
      userId: input.actorUserId,
      role: actor.role,
      active: actor.active
    });

    const since = new Date(this.deps.clock.now().getTime() - ONLINE_WINDOW_MS);
    const [onlineIds, memberships, records] = await Promise.all([
      this.deps.teamChat.listOnlineUserIds(input.organizationId, since),
      this.deps.members.findByOrganizationId(input.organizationId),
      this.deps.teamChat.listVisibleMessages(input.organizationId, input.actorUserId, 100)
    ]);
    const onlineSet = new Set(onlineIds);
    const relevantUserIds = new Set<string>([
      ...onlineIds,
      ...records.flatMap((message) => [message.senderUserId, message.recipientUserId].filter(Boolean) as string[])
    ]);
    const users = new Map<string, { id: string; name: string }>();
    await Promise.all([...relevantUserIds].map(async (userId) => {
      const user = await this.deps.users.findById(userId);
      if (user) users.set(userId, { id: user.id, name: user.name });
    }));

    const onlineMembers = memberships
      .filter((member) => member.active && Role.canHandleTickets(member.role) && onlineSet.has(member.userId))
      .map((member) => ({
        userId: member.userId,
        name: users.get(member.userId)?.name ?? 'Atendente',
        role: member.role,
        isCurrentUser: member.userId === input.actorUserId
      }))
      .sort((a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.name.localeCompare(b.name));

    return {
      onlineMembers,
      messages: records.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        sender: users.get(message.senderUserId) ?? { id: message.senderUserId, name: 'Atendente' },
        recipient: message.recipientUserId
          ? users.get(message.recipientUserId) ?? { id: message.recipientUserId, name: 'Atendente' }
          : null
      }))
    };
  }
}
