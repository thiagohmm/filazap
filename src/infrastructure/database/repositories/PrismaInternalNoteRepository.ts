import { InternalNote } from '../../../domain/entities/InternalNote';
import type { InternalNoteRepository } from '../../../application/ports/InternalNoteRepository';
import { prisma } from '../prisma';

function toDomain(record: {
  id: string;
  organizationId: string;
  contactId: string;
  ticketId: string | null;
  authorUserId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}): InternalNote {
  return InternalNote.restore({
    id: record.id,
    organizationId: record.organizationId,
    contactId: record.contactId,
    ticketId: record.ticketId,
    authorUserId: record.authorUserId,
    body: record.body,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
}

export class PrismaInternalNoteRepository implements InternalNoteRepository {
  async save(note: InternalNote): Promise<InternalNote> {
    const data = note.toJSON();
    const record = await prisma.internalNote.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        organizationId: data.organizationId,
        contactId: data.contactId,
        ticketId: data.ticketId,
        authorUserId: data.authorUserId,
        body: data.body
      },
      update: {
        body: data.body
      }
    });
    return toDomain(record);
  }

  async findById(id: string): Promise<InternalNote | null> {
    const record = await prisma.internalNote.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByContactId(
    organizationId: string,
    contactId: string
  ): Promise<InternalNote[]> {
    const records = await prisma.internalNote.findMany({
      where: { organizationId, contactId },
      orderBy: { createdAt: 'asc' }
    });
    return records.map(toDomain);
  }
}