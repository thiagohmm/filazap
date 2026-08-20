import { Organization } from '../../../domain/entities/Organization';
import type { OrganizationRepository } from '../../../application/ports/OrganizationRepository';
import { prisma } from '../prisma';

export class PrismaOrganizationRepository implements OrganizationRepository {
  async save(organization: Organization): Promise<Organization> {
    const data = organization.toJSON();
    const record = await prisma.organization.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        timezone: data.timezone,
        plan: data.plan,
        subscriptionStatus: data.subscriptionStatus,
        theme: data.theme,
        brandColor: data.brandColor
      },
      update: {
        name: data.name,
        timezone: data.timezone,
        plan: data.plan,
        subscriptionStatus: data.subscriptionStatus,
        theme: data.theme,
        brandColor: data.brandColor
      }
    });
    return Organization.restore(record);
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const record = await prisma.organization.findUnique({ where: { slug } });
    return record ? Organization.restore(record) : null;
  }

  async findById(id: string): Promise<Organization | null> {
    const record = await prisma.organization.findUnique({ where: { id } });
    return record ? Organization.restore(record) : null;
  }
}
