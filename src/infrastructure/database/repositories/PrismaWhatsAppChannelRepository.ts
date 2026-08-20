import { WhatsAppChannel } from '../../../domain/entities/WhatsAppChannel';
import { ChannelStatus } from '../../../domain/value-objects/ChannelStatus';
import type { WhatsAppChannelRepository } from '../../../application/ports/WhatsAppChannelRepository';
import { prisma } from '../prisma';

type PrismaChannel = {
  id: string;
  organizationId: string;
  phoneNumberId: string;
  businessAccountId: string;
  displayPhoneNumber: string;
  status: string;
  accessTokenEncrypted: string | null;
  appSecretEncrypted: string | null;
  webhookVerifyToken: string | null;
  apiBaseUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(record: PrismaChannel): WhatsAppChannel {
  return WhatsAppChannel.restore({
    id: record.id,
    organizationId: record.organizationId,
    phoneNumberId: record.phoneNumberId,
    businessAccountId: record.businessAccountId,
    displayPhoneNumber: record.displayPhoneNumber,
    status: ChannelStatus.fromString(record.status),
    accessTokenEncrypted: record.accessTokenEncrypted,
    appSecretEncrypted: record.appSecretEncrypted,
    webhookVerifyToken: record.webhookVerifyToken,
    apiBaseUrl: record.apiBaseUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
}

export class PrismaWhatsAppChannelRepository
  implements WhatsAppChannelRepository
{
  async save(channel: WhatsAppChannel): Promise<WhatsAppChannel> {
    const data = channel.toPersistence();
    const record = await prisma.whatsAppChannel.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        organizationId: data.organizationId,
        phoneNumberId: data.phoneNumberId,
        businessAccountId: data.businessAccountId,
        displayPhoneNumber: data.displayPhoneNumber,
        status: data.status,
        accessTokenEncrypted: data.accessTokenEncrypted,
        appSecretEncrypted: data.appSecretEncrypted,
        webhookVerifyToken: data.webhookVerifyToken,
        apiBaseUrl: data.apiBaseUrl
      },
      update: {
        phoneNumberId: data.phoneNumberId,
        businessAccountId: data.businessAccountId,
        displayPhoneNumber: data.displayPhoneNumber,
        status: data.status,
        accessTokenEncrypted: data.accessTokenEncrypted,
        appSecretEncrypted: data.appSecretEncrypted,
        webhookVerifyToken: data.webhookVerifyToken,
        apiBaseUrl: data.apiBaseUrl
      }
    });
    return toDomain(record);
  }

  async findById(id: string): Promise<WhatsAppChannel | null> {
    const record = await prisma.whatsAppChannel.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppChannel | null> {
    const record = await prisma.whatsAppChannel.findUnique({
      where: { phoneNumberId }
    });
    return record ? toDomain(record) : null;
  }

  async findByOrganizationId(organizationId: string): Promise<WhatsAppChannel[]> {
    const records = await prisma.whatsAppChannel.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' }
    });
    return records.map((r) => toDomain(r));
  }

  async findByBusinessAccountId(
    businessAccountId: string
  ): Promise<WhatsAppChannel | null> {
    const record = await prisma.whatsAppChannel.findFirst({
      where: { businessAccountId }
    });
    return record ? toDomain(record) : null;
  }

  async findByWebhookVerifyToken(
    verifyToken: string
  ): Promise<WhatsAppChannel | null> {
    const record = await prisma.whatsAppChannel.findUnique({
      where: { webhookVerifyToken: verifyToken }
    });
    return record ? toDomain(record) : null;
  }
}
