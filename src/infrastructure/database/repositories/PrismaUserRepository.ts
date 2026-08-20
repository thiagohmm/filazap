import { User } from '../../../domain/entities/User';
import type { UserRepository } from '../../../application/ports/UserRepository';
import { prisma } from '../prisma';

export class PrismaUserRepository implements UserRepository {
  async save(user: User): Promise<User> {
    const record = await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash
      },
      update: {
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash
      }
    });
    return User.restore(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await prisma.user.findUnique({ where: { email } });
    return record ? User.restore(record) : null;
  }

  async findById(id: string): Promise<User | null> {
    const record = await prisma.user.findUnique({ where: { id } });
    return record ? User.restore(record) : null;
  }
}
