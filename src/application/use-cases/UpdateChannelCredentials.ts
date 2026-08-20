import { WhatsAppChannel } from '../../domain/entities/WhatsAppChannel';
import { MemberNotFoundError, ChannelNotFoundError } from '../../domain/errors';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { CredentialCipher } from '../ports/CredentialCipher';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { WhatsAppChannelRepository } from '../ports/WhatsAppChannelRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type {
  UpdateChannelCredentialsInput,
  UpdateChannelCredentialsOutput
} from '../dto/UpdateChannelCredentialsDTO';

export class UpdateChannelCredentials {
  constructor(
    private readonly deps: {
      channels: WhatsAppChannelRepository;
      members: OrganizationMemberRepository;
      cipher: CredentialCipher;
      logger: AuditLogger;
      idGenerator: () => string;
      clock: Clock;
    }
  ) {}

  async execute(input: UpdateChannelCredentialsInput): Promise<UpdateChannelCredentialsOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canManageChannels(actor);

    const channel = await this.deps.channels.findById(input.channelId);
    if (!channel || channel.organizationId !== input.organizationId) {
      throw new ChannelNotFoundError(input.channelId);
    }

    const accessTokenEncrypted =
      input.accessToken !== undefined && input.accessToken.trim() !== ''
        ? this.deps.cipher.encrypt(input.accessToken)
        : channel.accessTokenEncrypted;

    const appSecretEncrypted =
      input.appSecret !== undefined && input.appSecret.trim() !== ''
        ? this.deps.cipher.encrypt(input.appSecret)
        : channel.appSecretEncrypted;

    const webhookVerifyToken =
      input.webhookVerifyToken !== undefined && input.webhookVerifyToken.trim() !== ''
        ? input.webhookVerifyToken
        : channel.webhookVerifyToken ?? this.deps.idGenerator();

    const apiBaseUrl =
      input.apiBaseUrl !== undefined
        ? input.apiBaseUrl.trim() === ''
          ? null
          : input.apiBaseUrl.trim()
        : channel.apiBaseUrl;

    const updated = WhatsAppChannel.restore({
      ...channel.toPersistence(),
      accessTokenEncrypted,
      appSecretEncrypted,
      webhookVerifyToken,
      apiBaseUrl,
      updatedAt: this.deps.clock.now()
    });

    await this.deps.channels.save(updated);

    this.deps.logger.log('info', 'channel.credentials_updated', {
      organizationId: input.organizationId,
      channelId: updated.id,
      actorUserId: input.actorUserId
    });

    return { channel: updated.toJSON() };
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
