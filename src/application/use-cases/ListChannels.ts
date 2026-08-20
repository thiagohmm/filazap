import { MemberNotFoundError } from '../../domain/errors';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { WhatsAppChannelRepository } from '../ports/WhatsAppChannelRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type { ListChannelsInput, ListChannelsOutput } from '../dto/ListChannelsDTO';

export class ListChannels {
  constructor(
    private readonly deps: {
      channels: WhatsAppChannelRepository;
      members: OrganizationMemberRepository;
    }
  ) {}

  async execute(input: ListChannelsInput): Promise<ListChannelsOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canViewChannels(actor);

    const channels = await this.deps.channels.findByOrganizationId(
      input.organizationId
    );

    return {
      channels: channels.map((channel) => ({
        id: channel.id,
        phoneNumberId: channel.phoneNumberId,
        businessAccountId: channel.businessAccountId,
        displayPhoneNumber: channel.displayPhoneNumber,
        status: channel.status,
        configured: channel.hasCredentials(),
        createdAt: channel.createdAt
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
