import { InternalNote } from '../../domain/entities/InternalNote';
import {
  ContactNotFoundError,
  MemberNotFoundError,
  TicketNotFoundError
} from '../../domain/errors';
import type { AuditLogger } from '../ports/AuditLogger';
import type { Clock } from '../ports/Clock';
import type { ContactRepository } from '../ports/ContactRepository';
import type { InternalNoteRepository } from '../ports/InternalNoteRepository';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import type { TicketRepository } from '../ports/TicketRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type {
  AddInternalNoteInput,
  AddInternalNoteOutput
} from '../dto/AddInternalNoteDTO';

export class AddInternalNote {
  constructor(
    private readonly deps: {
      notes: InternalNoteRepository;
      contacts: ContactRepository;
      tickets: TicketRepository;
      members: OrganizationMemberRepository;
      clock: Clock;
      logger: AuditLogger;
      idGenerator: () => string;
    }
  ) {}

  async execute(input: AddInternalNoteInput): Promise<AddInternalNoteOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canAddNotes(actor);

    const contact = await this.deps.contacts.findById(input.contactId);
    if (!contact || contact.organizationId !== input.organizationId) {
      throw new ContactNotFoundError(input.contactId);
    }

    if (input.ticketId) {
      const ticket = await this.deps.tickets.findById(input.ticketId);
      if (!ticket || ticket.organizationId !== input.organizationId) {
        throw new TicketNotFoundError(input.ticketId);
      }
    }

    const now = this.deps.clock.now();
    const note = InternalNote.create({
      id: this.deps.idGenerator(),
      organizationId: input.organizationId,
      contactId: input.contactId,
      ticketId: input.ticketId ?? null,
      authorUserId: input.actorUserId,
      body: input.body,
      createdAt: now,
      updatedAt: now
    });
    await this.deps.notes.save(note);

    this.deps.logger.log('info', 'note.added', {
      organizationId: input.organizationId,
      contactId: input.contactId,
      noteId: note.id,
      actorUserId: input.actorUserId
    });

    return {
      note: {
        id: note.id,
        contactId: note.contactId,
        ticketId: note.ticketId,
        body: note.body,
        createdAt: note.createdAt
      }
    };
  }

  private async loadActor(userId: string, organizationId: string): Promise<Actor> {
    const member = await this.deps.members.findByUserAndOrganization(
      userId,
      organizationId
    );
    if (!member) {
      throw new MemberNotFoundError(userId, organizationId);
    }
    return { userId, role: member.role, active: member.active };
  }
}