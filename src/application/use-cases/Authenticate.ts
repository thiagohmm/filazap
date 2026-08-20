import { InvalidCredentialsError } from '../../domain/errors';
import { Email } from '../../domain/value-objects/Email';
import type { AuditLogger } from '../ports/AuditLogger';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { PasswordHasher } from '../ports/PasswordHasher';
import type { TokenService } from '../ports/TokenService';
import type { UserRepository } from '../ports/UserRepository';
import type { AuthenticateInput, AuthenticateOutput } from '../dto/AuthenticateDTO';

export class Authenticate {
  constructor(
    private readonly deps: {
      users: UserRepository;
      members: OrganizationMemberRepository;
      passwordHasher: PasswordHasher;
      tokenService: TokenService;
      logger: AuditLogger;
    }
  ) {}

  async execute(input: AuthenticateInput): Promise<AuthenticateOutput> {
    const email = Email.create(input.email);
    const user = await this.deps.users.findByEmail(email.value);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordOk = await this.deps.passwordHasher.verify(
      input.password,
      user.passwordHash
    );
    if (!passwordOk) {
      this.deps.logger.log('warn', 'auth.failed', { userId: user.id });
      throw new InvalidCredentialsError();
    }

    const memberships = await this.deps.members.findByUserIdActive(
      user.id
    );

    const token = await this.deps.tokenService.sign({
      userId: user.id,
      email: user.email,
      name: user.name
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        theme: m.organization.theme,
        brandColor: m.organization.brandColor
      }))
    };
  }
}
