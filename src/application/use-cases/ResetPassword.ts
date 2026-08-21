import { InvalidPasswordResetTokenError } from '../../domain/errors';
import type { AuditLogger } from '../ports/AuditLogger';
import type { PasswordHasher } from '../ports/PasswordHasher';
import type { PasswordResetRepository } from '../ports/PasswordResetRepository';

export class ResetPassword {
  constructor(
    private readonly deps: {
      passwordResets: PasswordResetRepository;
      passwordHasher: PasswordHasher;
      logger: AuditLogger;
      clock: { now(): Date };
      hashToken(token: string): string;
    }
  ) {}

  async execute(input: { token: string; password: string }): Promise<void> {
    const passwordHash = await this.deps.passwordHasher.hash(input.password);
    const changed = await this.deps.passwordResets.consumeAndUpdatePassword(
      this.deps.hashToken(input.token),
      passwordHash,
      this.deps.clock.now()
    );
    if (!changed) throw new InvalidPasswordResetTokenError();
    this.deps.logger.log('info', 'password_reset.completed');
  }
}
