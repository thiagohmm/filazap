import { Contact } from '../../../domain/entities/Contact';
import type {
  ContactRepository,
  ContactSearchResult
} from '../../../application/ports/ContactRepository';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

function toMetadata(
  value: Record<string, unknown> | null
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  return value
    ? (value as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull;
}

function toDomain(record: {
  id: string;
  organizationId: string;
  channelId: string;
  phoneE164: string;
  name: string | null;
  metadata: unknown;
  firstContactAt: Date;
  lastContactAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): Contact {
  return Contact.restore({
    id: record.id,
    organizationId: record.organizationId,
    channelId: record.channelId,
    phoneE164: record.phoneE164,
    name: record.name,
    metadata: (record.metadata ?? null) as Record<string, unknown> | null,
    firstContactAt: record.firstContactAt,
    lastContactAt: record.lastContactAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
}

export class PrismaContactRepository implements ContactRepository {
  async save(contact: Contact): Promise<Contact> {
    const data = contact.toJSON();
    const record = await prisma.contact.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        organizationId: data.organizationId,
        channelId: data.channelId,
        phoneE164: data.phoneE164,
        name: data.name,
        metadata: toMetadata(data.metadata),
        firstContactAt: data.firstContactAt,
        lastContactAt: data.lastContactAt
      },
      update: {
        name: data.name,
        metadata: toMetadata(data.metadata),
        lastContactAt: data.lastContactAt
      }
    });
    return toDomain(record);
  }

  async findById(id: string): Promise<Contact | null> {
    const record = await prisma.contact.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByChannelAndPhone(
    organizationId: string,
    channelId: string,
    phoneE164: string
  ): Promise<Contact | null> {
    const record = await prisma.contact.findUnique({
      where: {
        organizationId_channelId_phoneE164: {
          organizationId,
          channelId,
          phoneE164
        }
      }
    });
    return record ? toDomain(record) : null;
  }

  async search(
    organizationId: string,
    query: string,
    limit = 25
  ): Promise<ContactSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const records = await prisma.contact.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: trimmed, mode: 'insensitive' } },
          { phoneE164: { contains: trimmed } }
        ]
      },
      orderBy: { lastContactAt: 'desc' },
      take: limit,
      include: {
        tickets: {
          select: {
            lastMessageAt: true
          },
          orderBy: { lastMessageAt: 'desc' },
          take: 1
        },
        _count: {
          select: { tickets: true }
        }
      }
    });

    return records.map((r) => ({
      contact: toDomain(r),
      totalTickets: r._count.tickets,
      lastMessageAt: r.tickets[0]?.lastMessageAt ?? null
    }));
  }
}
