import {
  ChatRecipientUnavailableError,
  MemberNotFoundError
} from '../../domain/errors';
import { Role } from '../../domain/value-objects/Role';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TeamChatRepository } from '../ports/TeamChatRepository';
import { OrganizationPolicy } from '../policies/OrganizationPolicy';

const ONLINE_WINDOW_MS = 60_000;

export class SendTeamChatMessage {
  constructor(private readonly deps: {
    members: OrganizationMemberRepository;
    teamChat: TeamChatRepository;
    clock: Clock;
    logger: AuditLogger;
    idGenerator(): string;
  }) {}

  async execute(input: {
    actorUserId: string;
    organizationId: string;
    recipientUserId?: string | null;
    body: string;
  }) {
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

    const recipientUserId = input.recipientUserId || null;
    if (recipientUserId) {
      const recipient = await this.deps.members.findByUserAndOrganization(
        recipientUserId,
        input.organizationId
      );
      const since = new Date(this.deps.clock.now().getTime() - ONLINE_WINDOW_MS);
      const online = await this.deps.teamChat.isUserOnline(
        input.organizationId,
        recipientUserId,
        since
      );
      if (
        recipientUserId === input.actorUserId ||
        !recipient?.active ||
        !recipient ||
        !Role.canHandleTickets(recipient.role) ||
        !online
      ) throw new ChatRecipientUnavailableError();
    }

    const message = await this.deps.teamChat.save({
      id: this.deps.idGenerator(),
      organizationId: input.organizationId,
      senderUserId: input.actorUserId,
      recipientUserId,
      body: input.body.trim(),
      createdAt: this.deps.clock.now()
    });
    this.deps.logger.log('info', 'team_chat.message_sent', {
      organizationId: input.organizationId,
      senderUserId: input.actorUserId,
      scope: recipientUserId ? 'direct' : 'broadcast'
    });
    return { message: { id: message.id, createdAt: message.createdAt } };
  }
}
