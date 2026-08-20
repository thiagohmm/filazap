import { WhatsAppChannel } from '../../domain/entities/WhatsAppChannel';
import { MemberNotFoundError, ChannelAlreadyExistsError } from '../../domain/errors';
import { ChannelStatus } from '../../domain/value-objects/ChannelStatus';
import type { AuditLogger } from '../ports/AuditLogger';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { WhatsAppChannelRepository } from '../ports/WhatsAppChannelRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type {
  RegisterChannelInput,
  RegisterChannelOutput
} from '../dto/RegisterChannelDTO';

export class RegisterChannel {
  constructor(
    private readonly deps: {
      channels: WhatsAppChannelRepository;
      members: OrganizationMemberRepository;
      logger: AuditLogger;
      idGenerator: () => string;
    }
  ) {}

  async execute(input: RegisterChannelInput): Promise<RegisterChannelOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canManageChannels(actor);

    const existing = await this.deps.channels.findByPhoneNumberId(
      input.phoneNumberId
    );
    if (existing) {
      throw new ChannelAlreadyExistsError(input.phoneNumberId);
    }

    const channel = WhatsAppChannel.create({
      id: this.deps.idGenerator(),
      organizationId: input.organizationId,
      phoneNumberId: input.phoneNumberId,
      businessAccountId: input.businessAccountId,
      displayPhoneNumber: input.displayPhoneNumber,
      status: ChannelStatus.CONNECTED
    });
    await this.deps.channels.save(channel);

    this.deps.logger.log('info', 'channel.registered', {
      organizationId: input.organizationId,
      channelId: channel.id,
      phoneNumberId: channel.phoneNumberId,
      actorUserId: input.actorUserId
    });

    return this.toOutput(channel);
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

  private toOutput(channel: WhatsAppChannel): RegisterChannelOutput {
    return {
      channel: {
        id: channel.id,
        organizationId: channel.organizationId,
        phoneNumberId: channel.phoneNumberId,
        businessAccountId: channel.businessAccountId,
        displayPhoneNumber: channel.displayPhoneNumber,
        status: channel.status,
        createdAt: channel.createdAt
      }
    };
  }
}
