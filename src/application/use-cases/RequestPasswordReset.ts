import { Email } from '../../domain/value-objects/Email';
import type { AuditLogger } from '../ports/AuditLogger';
import type { PasswordResetMailer } from '../ports/PasswordResetMailer';
import type { PasswordResetRepository } from '../ports/PasswordResetRepository';
import type { UserRepository } from '../ports/UserRepository';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export class RequestPasswordReset {
  constructor(
    private readonly deps: {
      users: UserRepository;
      passwordResets: PasswordResetRepository;
      mailer: PasswordResetMailer;
      logger: AuditLogger;
      clock: { now(): Date };
      idGenerator(): string;
      tokenGenerator(): string;
      hashToken(token: string): string;
      appUrl: string;
    }
  ) {}

  async execute(input: { email: string }): Promise<void> {
    const email = Email.create(input.email);
    const user = await this.deps.users.findByEmail(email.value);
    if (!user) {
      this.deps.logger.log('info', 'password_reset.requested_unknown_email');
      return;
    }

    const now = this.deps.clock.now();
    const token = this.deps.tokenGenerator();
    await this.deps.passwordResets.replaceForUser({
      id: this.deps.idGenerator(),
      userId: user.id,
      tokenHash: this.deps.hashToken(token),
      createdAt: now,
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS)
    });

    const resetUrl = `${this.deps.appUrl.replace(/\/$/, '')}/redefinir-senha?token=${encodeURIComponent(token)}`;
    try {
      await this.deps.mailer.send({ email: user.email, name: user.name, resetUrl });
      this.deps.logger.log('info', 'password_reset.email_sent', { userId: user.id });
    } catch (error) {
      this.deps.logger.log('error', 'password_reset.email_failed', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'unknown'
      });
    }
  }
}
