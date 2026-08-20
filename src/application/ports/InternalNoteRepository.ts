import { InternalNote } from '../../domain/entities/InternalNote';

export interface InternalNoteRepository {
  save(note: InternalNote): Promise<InternalNote>;
  findById(id: string): Promise<InternalNote | null>;
  findByContactId(
    organizationId: string,
    contactId: string
  ): Promise<InternalNote[]>;
}