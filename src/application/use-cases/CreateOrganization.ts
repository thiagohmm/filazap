import { Organization } from '../../domain/entities/Organization';
import { OrganizationMember } from '../../domain/entities/OrganizationMember';
import { User } from '../../domain/entities/User';
import {
  EmailAlreadyRegisteredError,
  SlugAlreadyExistsError
} from '../../domain/errors';
import { Email } from '../../domain/value-objects/Email';
import { Role } from '../../domain/value-objects/Role';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { OrganizationRepository } from '../ports/OrganizationRepository';
import type { PasswordHasher } from '../ports/PasswordHasher';
import type { TokenService } from '../ports/TokenService';
import type { UserRepository } from '../ports/UserRepository';
import type {
  CreateOrganizationInput,
  CreateOrganizationOutput
} from '../dto/CreateOrganizationDTO';

export class CreateOrganization {
  constructor(
    private readonly deps: {
      organizations: OrganizationRepository;
      users: UserRepository;
      members: OrganizationMemberRepository;
      passwordHasher: PasswordHasher;
      tokenService: TokenService;
      clock: Clock;
      logger: AuditLogger;
      idGenerator: () => string;
    }
  ) {}

  async execute(input: CreateOrganizationInput): Promise<CreateOrganizationOutput> {
    const email = Email.create(input.adminEmail);
    const existingUser = await this.deps.users.findByEmail(email.value);
    if (existingUser) {
      throw new EmailAlreadyRegisteredError(email.value);
    }

    const organization = Organization.create({
      id: this.deps.idGenerator(),
      name: input.name
    });

    if (await this.deps.organizations.findBySlug(organization.slug)) {
      throw new SlugAlreadyExistsError(organization.slug);
    }

    const passwordHash = await this.deps.passwordHasher.hash(input.adminPassword);
    const user = User.create({
      id: this.deps.idGenerator(),
      email: email.value,
      name: input.adminName,
      passwordHash
    });

    const member = OrganizationMember.create({
      id: this.deps.idGenerator(),
      organizationId: organization.id,
      userId: user.id,
      role: Role.OWNER
    });

    await this.deps.organizations.save(organization);
    await this.deps.users.save(user);
    await this.deps.members.save(member);

    const token = await this.deps.tokenService.sign({
      userId: user.id,
      email: user.email,
      name: user.name
    });

    this.deps.logger.log('info', 'organization.created', {
      organizationId: organization.id,
      slug: organization.slug,
      actorUserId: user.id
    });

    return {
      organizationId: organization.id,
      slug: organization.slug,
      name: organization.name,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    };
  }
}
