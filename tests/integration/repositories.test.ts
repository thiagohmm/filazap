import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaOrganizationRepository } from '../../src/infrastructure/database/repositories/PrismaOrganizationRepository';
import { PrismaUserRepository } from '../../src/infrastructure/database/repositories/PrismaUserRepository';
import { PrismaOrganizationMemberRepository } from '../../src/infrastructure/database/repositories/PrismaOrganizationMemberRepository';
import { Organization } from '../../src/domain/entities/Organization';
import { User } from '../../src/domain/entities/User';
import { OrganizationMember } from '../../src/domain/entities/OrganizationMember';
import { Role } from '../../src/domain/value-objects/Role';
import { BcryptPasswordHasher } from '../../src/infrastructure/auth/BcryptPasswordHasher';

const prisma = new PrismaClient();
const organizations = new PrismaOrganizationRepository();
const users = new PrismaUserRepository();
const members = new PrismaOrganizationMemberRepository();
const hasher = new BcryptPasswordHasher();

const unique = Date.now();
const orgId = `org-${unique}`;
const userId = `user-${unique}`;

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.organizationMember.deleteMany({
    where: { OR: [{ id: `mem-${unique}` }, { userId }] }
  });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe('Prisma repositories (integração)', () => {
  it('persiste organização, usuário e associação e respeita unicidade do slug', async () => {
    const org = Organization.create({ id: orgId, name: `Empresa ${unique}` });
    await organizations.save(org);

    const found = await organizations.findBySlug(org.slug);
    expect(found?.name).toBe(org.name);

    const user = User.create({
      id: userId,
      email: `user${unique}@example.com`,
      name: 'João',
      passwordHash: await hasher.hash('senha1234')
    });
    await users.save(user);
    expect((await users.findByEmail(user.email))?.name).toBe('João');

    const member = OrganizationMember.create({
      id: `mem-${unique}`,
      organizationId: orgId,
      userId,
      role: Role.OWNER
    });
    await members.save(member);

    const membership = await members.findByUserAndOrganization(userId, orgId);
    expect(membership?.role).toBe(Role.OWNER);

    const active = await members.findByUserIdActive(userId);
    expect(active).toHaveLength(1);
    expect(active[0].organization.slug).toBe(org.slug);
  });

  it('verifica senha com bcrypt', async () => {
    const hash = await hasher.hash('minhasenha');
    expect(await hasher.verify('minhasenha', hash)).toBe(true);
    expect(await hasher.verify('outra', hash)).toBe(false);
  });
});
