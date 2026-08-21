import type {
  TeamChatRecord,
  TeamChatRepository
} from '../../../application/ports/TeamChatRepository';
import { prisma } from '../prisma';

export class PrismaTeamChatRepository implements TeamChatRepository {
  async touchPresence(organizationId: string, userId: string, now: Date): Promise<void> {
    await prisma.teamPresence.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: { organizationId, userId, lastSeenAt: now },
      update: { lastSeenAt: now }
    });
  }

  async listOnlineUserIds(organizationId: string, since: Date): Promise<string[]> {
    const records = await prisma.teamPresence.findMany({
      where: { organizationId, lastSeenAt: { gte: since } },
      select: { userId: true }
    });
    return records.map((record) => record.userId);
  }

  async isUserOnline(organizationId: string, userId: string, since: Date): Promise<boolean> {
    const record = await prisma.teamPresence.findFirst({
      where: { organizationId, userId, lastSeenAt: { gte: since } },
      select: { id: true }
    });
    return !!record;
  }

  async save(message: TeamChatRecord): Promise<TeamChatRecord> {
    return prisma.teamChatMessage.create({ data: message });
  }

  async listVisibleMessages(
    organizationId: string,
    userId: string,
    limit: number
  ): Promise<TeamChatRecord[]> {
    const records = await prisma.teamChatMessage.findMany({
      where: {
        organizationId,
        OR: [
          { recipientUserId: null },
          { senderUserId: userId },
          { recipientUserId: userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return records.reverse();
  }
}
