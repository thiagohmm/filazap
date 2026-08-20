import { OrganizationMember } from '../../domain/entities/OrganizationMember';
import { User } from '../../domain/entities/User';
import { MemberNotFoundError } from '../../domain/errors';
import { Email } from '../../domain/value-objects/Email';
import { Role } from '../../domain/value-objects/Role';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { OrganizationRepository } from '../ports/OrganizationRepository';
import type { PasswordHasher } from '../ports/PasswordHasher';
import type { UserRepository } from '../ports/UserRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type { InviteMemberInput, InviteMemberOutput } from '../dto/InviteMemberDTO';

export class InviteMember {
  constructor(
    private readonly deps: {
      users: UserRepository;
      members: OrganizationMemberRepository;
      organizations: OrganizationRepository;
      passwordHasher: PasswordHasher;
      clock: Clock;
      logger: AuditLogger;
      idGenerator: () => string;
      generateTemporaryPassword: () => string;
    }
  ) {}

  async execute(input: InviteMemberInput): Promise<InviteMemberOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canManageMembers(actor);

    const email = Email.create(input.email);
    const role = Role.fromString(input.role);

    let user = await this.deps.users.findByEmail(email.value);
    if (!user) {
      const temporaryPassword = this.deps.generateTemporaryPassword();
      const passwordHash = await this.deps.passwordHasher.hash(temporaryPassword);
      user = User.create({
        id: this.deps.idGenerator(),
        email: email.value,
        name: input.name,
        passwordHash
      });
      await this.deps.users.save(user);
    }

    const existingMembership = await this.deps.members.findByUserAndOrganization(
      user.id,
      input.organizationId
    );
    if (existingMembership) {
      const updated = OrganizationMember.restore({
        id: existingMembership.id,
        organizationId: existingMembership.organizationId,
        userId: existingMembership.userId,
        role: existingMembership.role,
        active: true,
        createdAt: existingMembership.createdAt,
        updatedAt: this.deps.clock.now()
      });
      await this.deps.members.save(updated);
      return this.toOutput(updated, user);
    }

    const member = OrganizationMember.create({
      id: this.deps.idGenerator(),
      organizationId: input.organizationId,
      userId: user.id,
      role
    });
    await this.deps.members.save(member);

    this.deps.logger.log('info', 'member.invited', {
      organizationId: input.organizationId,
      userId: user.id,
      role: role,
      actorUserId: input.actorUserId
    });

    return this.toOutput(member, user);
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

  private toOutput(member: OrganizationMember, user: User): InviteMemberOutput {
    return {
      member: {
        id: member.id,
        organizationId: member.organizationId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        role: member.role,
        active: member.active,
        createdAt: member.createdAt
      }
    };
  }
}
