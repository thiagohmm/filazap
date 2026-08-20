import { OrganizationMember } from '../../../domain/entities/OrganizationMember';
import { Role } from '../../../domain/value-objects/Role';
import type {
  MemberWithOrganization,
  OrganizationMemberRepository
} from '../../../application/ports/OrganizationMemberRepository';
import { prisma } from '../prisma';
import type { $Enums } from '@prisma/client';

type PrismaMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(member: PrismaMember): OrganizationMember {
  return OrganizationMember.restore({
    id: member.id,
    organizationId: member.organizationId,
    userId: member.userId,
    role: Role.fromString(member.role),
    active: member.active,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt
  });
}

export class PrismaOrganizationMemberRepository
  implements OrganizationMemberRepository
{
  async save(member: OrganizationMember): Promise<OrganizationMember> {
    const record = await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: member.organizationId,
          userId: member.userId
        }
      },
      create: {
        id: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role,
        active: member.active
      },
      update: {
        role: member.role,
        active: member.active
      }
    });
    return toDomain(record);
  }

  async findByOrganizationId(
    organizationId: string
  ): Promise<OrganizationMember[]> {
    const records = await prisma.organizationMember.findMany({
      where: { organizationId }
    });
    return records.map((r) => toDomain(r));
  }

  async findByUserAndOrganization(
    userId: string,
    organizationId: string
  ): Promise<OrganizationMember | null> {
    const record = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId }
      }
    });
    return record ? toDomain(record) : null;
  }

  async findUsersByOrganizationAndRoles(
    organizationId: string,
    roles: Role[]
  ): Promise<OrganizationMember[]> {
    const records = await prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: { in: roles as unknown as $Enums.Role[] }
      }
    });
    return records.map((r) => toDomain(r));
  }

  async countByOrganization(organizationId: string): Promise<number> {
    return prisma.organizationMember.count({ where: { organizationId } });
  }

  async findByUserIdActive(
    userId: string
  ): Promise<MemberWithOrganization[]> {
    const records = await prisma.organizationMember.findMany({
      where: { userId, active: true },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, theme: true, brandColor: true }
        }
      }
    });
    return records.map((r) => {
      const { organization, ...member } = r;
      return {
        ...toDomain(member).toJSON(),
        organization
      } as MemberWithOrganization;
    });
  }
}
