import type {
  NewPasswordResetToken,
  PasswordResetRepository
} from '../../../application/ports/PasswordResetRepository';
import { prisma } from '../prisma';

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  async replaceForUser(token: NewPasswordResetToken): Promise<void> {
    await prisma.passwordResetToken.upsert({
      where: { userId: token.userId },
      create: token,
      update: {
        id: token.id,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        usedAt: null
      }
    });
  }

  async consumeAndUpdatePassword(
    tokenHash: string,
    passwordHash: string,
    now: Date
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!token || token.usedAt || token.expiresAt <= now) return false;

      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now }
      });
      if (consumed.count !== 1) return false;

      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash }
      });
      return true;
    });
  }
}
