import {
  MemberNotFoundError,
  OrganizationNotFoundError
} from '../../domain/errors';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { OrganizationRepository } from '../ports/OrganizationRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';

export type GetOrganizationAppearanceInput = {
  actorUserId: string;
  organizationId: string;
};

export type GetOrganizationAppearanceOutput = {
  organization: {
    id: string;
    name: string;
    slug: string;
    theme: string;
    brandColor: string;
  };
};

export class GetOrganizationAppearance {
  constructor(
    private readonly deps: {
      organizations: OrganizationRepository;
      members: OrganizationMemberRepository;
    }
  ) {}

  async execute(
    input: GetOrganizationAppearanceInput
  ): Promise<GetOrganizationAppearanceOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canViewSettings(actor);

    const organization = await this.deps.organizations.findById(
      input.organizationId
    );
    if (!organization) {
      throw new OrganizationNotFoundError(input.organizationId);
    }

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        theme: organization.theme,
        brandColor: organization.brandColor
      }
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
