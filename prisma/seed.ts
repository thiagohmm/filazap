import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { BcryptPasswordHasher } from '../src/infrastructure/auth/BcryptPasswordHasher';
import { Organization } from '../src/domain/entities/Organization';
import { OrganizationMember } from '../src/domain/entities/OrganizationMember';
import { User } from '../src/domain/entities/User';
import { Role } from '../src/domain/value-objects/Role';
import { Email } from '../src/domain/value-objects/Email';

const prisma = new PrismaClient();

async function main() {
  const hasher = new BcryptPasswordHasher();

  const name = process.env.SEED_ADMIN_NAME ?? 'Admin';
  const email = Email.create(process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com');
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';
  const orgName = process.env.SEED_ORG_NAME ?? 'Empresa Piloto';
  const slug = process.env.SEED_ORG_SLUG ?? 'empresa-piloto';

  const passwordHash = await hasher.hash(password);

  const organization = await prisma.organization.upsert({
    where: { slug },
    update: { name: orgName },
    create: {
      id: randomUUID(),
      name: orgName,
      slug,
      timezone: 'America/Sao_Paulo',
      plan: 'STARTER',
      subscriptionStatus: 'TRIAL'
    }
  });

  const user = await prisma.user.upsert({
    where: { email: email.value },
    update: { name, passwordHash },
    create: {
      id: randomUUID(),
      email: email.value,
      name,
      passwordHash
    }
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id
      }
    },
    update: { role: Role.OWNER, active: true },
    create: {
      id: randomUUID(),
      organizationId: organization.id,
      userId: user.id,
      role: Role.OWNER,
      active: true
    }
  });

  console.log(
    `Seed concluído. Empresa "${organization.name}" (${organization.slug}) com admin ${email.value}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
