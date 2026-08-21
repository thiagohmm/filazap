import { OrganizationMember } from '../../../domain/entities/OrganizationMember';
import { Role } from '../../../domain/value-objects/Role';
import type {
  MemberWithOrganization,
  OrganizationMemberRepository
} from '../../../application/ports/OrganizationMemberRepository';
import { prisma } from '../prisma';
import type { $Enums } from '@prisma/client';
import { TicketStatus } from '../../../domain/value-objects/TicketStatus';

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

  async findById(id: string): Promise<OrganizationMember | null> {
    const record = await prisma.organizationMember.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async deactivateAgentAndReleaseTickets(input: {
    memberId: string;
    organizationId: string;
    userId: string;
    now: Date;
  }): Promise<{ removed: boolean; releasedTickets: number }> {
    return prisma.$transaction(async (tx) => {
      const removed = await tx.organizationMember.updateMany({
        where: {
          id: input.memberId,
          organizationId: input.organizationId,
          userId: input.userId,
          role: 'AGENT',
          active: true
        },
        data: { active: false, updatedAt: input.now }
      });
      if (removed.count !== 1) return { removed: false, releasedTickets: 0 };

      const released = await tx.ticket.updateMany({
        where: {
          organizationId: input.organizationId,
          assignedUserId: input.userId,
          status: { in: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER] }
        },
        data: {
          status: TicketStatus.RETURNING,
          assignedUserId: null,
          assignedAt: null,
          waitingCustomerSince: null,
          queueEnteredAt: input.now,
          updatedAt: input.now
        }
      });
      return { removed: true, releasedTickets: released.count };
    });
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
