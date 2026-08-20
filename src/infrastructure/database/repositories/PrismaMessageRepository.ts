import { Message } from '../../../domain/entities/Message';
import { MessageDirection } from '../../../domain/value-objects/MessageDirection';
import type { MessageRepository } from '../../../application/ports/MessageRepository';
import { prisma } from '../prisma';

function toDomain(record: {
  id: string;
  organizationId: string;
  ticketId: string;
  contactId: string;
  whatsappMessageId: string | null;
  direction: string;
  type: string;
  body: string | null;
  mediaPath: string | null;
  senderUserId: string | null;
  providerStatus: string | null;
  providerTimestamp: Date | null;
  createdAt: Date;
}): Message {
  return Message.restore({
    id: record.id,
    organizationId: record.organizationId,
    ticketId: record.ticketId,
    contactId: record.contactId,
    whatsappMessageId: record.whatsappMessageId,
    direction: MessageDirection.fromString(record.direction),
    type: record.type,
    body: record.body,
    mediaPath: record.mediaPath,
    senderUserId: record.senderUserId,
    providerStatus: record.providerStatus,
    providerTimestamp: record.providerTimestamp,
    createdAt: record.createdAt
  });
}

export class PrismaMessageRepository implements MessageRepository {
  async save(message: Message): Promise<Message> {
    const data = message.toJSON();
    const record = await prisma.message.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        organizationId: data.organizationId,
        ticketId: data.ticketId,
        contactId: data.contactId,
        whatsappMessageId: data.whatsappMessageId,
        direction: data.direction,
        type: data.type,
        body: data.body,
        mediaPath: data.mediaPath,
        senderUserId: data.senderUserId,
        providerStatus: data.providerStatus,
        providerTimestamp: data.providerTimestamp
      },
      update: {
        whatsappMessageId: data.whatsappMessageId,
        providerStatus: data.providerStatus
      }
    });
    return toDomain(record);
  }

  async findById(id: string): Promise<Message | null> {
    const record = await prisma.message.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByWhatsappMessageId(
    whatsappMessageId: string
  ): Promise<Message | null> {
    const record = await prisma.message.findUnique({
      where: { whatsappMessageId }
    });
    return record ? toDomain(record) : null;
  }

  async findByProviderMessageId(providerMessageId: string): Promise<Message | null> {
    return this.findByWhatsappMessageId(providerMessageId);
  }

  async findByTicketId(
    organizationId: string,
    ticketId: string
  ): Promise<Message[]> {
    const records = await prisma.message.findMany({
      where: { organizationId, ticketId },
      orderBy: { providerTimestamp: 'asc' }
    });
    return records.map(toDomain);
  }
}
