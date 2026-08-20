import { OrganizationMember } from '../../domain/entities/OrganizationMember';
import { Role } from '../../domain/value-objects/Role';

export type MemberWithOrganization = OrganizationMember & {
  organization: {
    id: string;
    name: string;
    slug: string;
    theme: string;
    brandColor: string;
  };
};

export interface OrganizationMemberRepository {
  save(member: OrganizationMember): Promise<OrganizationMember>;
  findByOrganizationId(organizationId: string): Promise<OrganizationMember[]>;
  findByUserAndOrganization(
    userId: string,
    organizationId: string
  ): Promise<OrganizationMember | null>;
  findUsersByOrganizationAndRoles(
    organizationId: string,
    roles: Role[]
  ): Promise<OrganizationMember[]>;
  countByOrganization(organizationId: string): Promise<number>;
  findByUserIdActive(userId: string): Promise<MemberWithOrganization[]>;
}
