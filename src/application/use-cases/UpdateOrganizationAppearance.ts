import { Organization } from '../../domain/entities/Organization';
import {
  MemberNotFoundError,
  OrganizationNotFoundError
} from '../../domain/errors';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { OrganizationRepository } from '../ports/OrganizationRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type {
  UpdateOrganizationAppearanceInput,
  UpdateOrganizationAppearanceOutput
} from '../dto/UpdateOrganizationAppearanceDTO';

export class UpdateOrganizationAppearance {
  constructor(
    private readonly deps: {
      organizations: OrganizationRepository;
      members: OrganizationMemberRepository;
      logger: AuditLogger;
      clock: Clock;
    }
  ) {}

  async execute(
    input: UpdateOrganizationAppearanceInput
  ): Promise<UpdateOrganizationAppearanceOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canManageSettings(actor);

    const organization = await this.deps.organizations.findById(
      input.organizationId
    );
    if (!organization) {
      throw new OrganizationNotFoundError(input.organizationId);
    }

    const theme =
      input.theme !== undefined && input.theme.trim() !== ''
        ? input.theme
        : organization.theme;
    const brandColor =
      input.brandColor !== undefined && input.brandColor.trim() !== ''
        ? input.brandColor
        : organization.brandColor;

    const updated = Organization.restore({
      ...organization.toJSON(),
      theme,
      brandColor,
      updatedAt: this.deps.clock.now()
    });

    await this.deps.organizations.save(updated);

    this.deps.logger.log('info', 'organization.appearance_updated', {
      organizationId: updated.id,
      actorUserId: input.actorUserId,
      theme,
      brandColor
    });

    return {
      organization: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        theme: updated.theme,
        brandColor: updated.brandColor
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
