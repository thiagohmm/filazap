import { describe, expect, it } from 'vitest';
import { User } from '../../domain/entities/User';
import { InvalidPasswordResetTokenError } from '../../domain/errors';
import type { PasswordResetMailer } from '../ports/PasswordResetMailer';
import type {
  NewPasswordResetToken,
  PasswordResetRepository
} from '../ports/PasswordResetRepository';
import { RequestPasswordReset } from '../use-cases/RequestPasswordReset';
import { ResetPassword } from '../use-cases/ResetPassword';
import {
  FakeLogger,
  FakePasswordHasher,
  InMemoryUserRepository
} from './fakes';

class InMemoryPasswordResetRepository implements PasswordResetRepository {
  token: (NewPasswordResetToken & { usedAt?: Date }) | null = null;

  constructor(private readonly users: InMemoryUserRepository) {}

  async replaceForUser(token: NewPasswordResetToken): Promise<void> {
    this.token = token;
  }

  async consumeAndUpdatePassword(
    tokenHash: string,
    passwordHash: string,
    now: Date
  ): Promise<boolean> {
    if (
      !this.token ||
      this.token.tokenHash !== tokenHash ||
      this.token.usedAt ||
      this.token.expiresAt <= now
    ) return false;

    this.token.usedAt = now;
    const user = await this.users.findById(this.token.userId);
    if (!user) return false;
    await this.users.save(User.restore({
      ...user.toJSON(),
      passwordHash
    }));
    return true;
  }
}

class FakeMailer implements PasswordResetMailer {
  sent: Array<{ email: string; name: string; resetUrl: string }> = [];

  async send(input: { email: string; name: string; resetUrl: string }): Promise<void> {
    this.sent.push(input);
  }
}

function build() {
  const users = new InMemoryUserRepository();
  const passwordHasher = new FakePasswordHasher();
  const passwordResets = new InMemoryPasswordResetRepository(users);
  const mailer = new FakeMailer();
  const logger = new FakeLogger();
  let now = new Date('2026-08-21T12:00:00Z');
  const hashToken = (token: string) => `hash-token:${token}`;

  return {
    users,
    passwordHasher,
    passwordResets,
    mailer,
    setNow: (value: Date) => { now = value; },
    request: new RequestPasswordReset({
      users,
      passwordResets,
      mailer,
      logger,
      clock: { now: () => now },
      idGenerator: () => 'reset-1',
      tokenGenerator: () => 'secret-token',
      hashToken,
      appUrl: 'https://app.filazap.test/'
    }),
    reset: new ResetPassword({
      passwordResets,
      passwordHasher,
      logger,
      clock: { now: () => now },
      hashToken
    })
  };
}

async function createUser(services: ReturnType<typeof build>) {
  await services.users.save(User.create({
    id: 'user-1',
    email: 'ana@example.com',
    name: 'Ana',
    passwordHash: 'hash:SenhaAntiga123'
  }));
}

describe('Password reset', () => {
  it('envia um link e armazena somente o hash do token', async () => {
    const services = build();
    await createUser(services);

    await services.request.execute({ email: 'ANA@example.com' });

    expect(services.mailer.sent).toHaveLength(1);
    expect(services.mailer.sent[0].resetUrl).toBe(
      'https://app.filazap.test/redefinir-senha?token=secret-token'
    );
    expect(services.passwordResets.token?.tokenHash).toBe('hash-token:secret-token');
    expect(services.passwordResets.token?.tokenHash).not.toBe('secret-token');
  });

  it('não revela nem envia e-mail para usuário inexistente', async () => {
    const services = build();
    await expect(services.request.execute({ email: 'ninguem@example.com' })).resolves.toBeUndefined();
    expect(services.mailer.sent).toHaveLength(0);
  });

  it('altera a senha e impede reutilizar o link', async () => {
    const services = build();
    await createUser(services);
    await services.request.execute({ email: 'ana@example.com' });

    await services.reset.execute({ token: 'secret-token', password: 'NovaSenha1234' });
    const user = await services.users.findById('user-1');
    await expect(services.passwordHasher.verify('NovaSenha1234', user!.passwordHash)).resolves.toBe(true);

    await expect(
      services.reset.execute({ token: 'secret-token', password: 'OutraSenha1234' })
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
  });

  it('rejeita um link expirado', async () => {
    const services = build();
    await createUser(services);
    await services.request.execute({ email: 'ana@example.com' });
    services.setNow(new Date('2026-08-21T12:31:00Z'));

    await expect(
      services.reset.execute({ token: 'secret-token', password: 'NovaSenha1234' })
    ).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
  });
});
