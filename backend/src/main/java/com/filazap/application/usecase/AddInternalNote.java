package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.ContactRepository;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.InternalNoteRepository;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.InternalNote;
import com.filazap.domain.error.ContactNotFoundError;
import com.filazap.domain.error.TicketNotFoundError;
import com.filazap.domain.service.Clock;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class AddInternalNote {
    private final InternalNoteRepository notes;
    private final ContactRepository contacts;
    private final TicketRepository tickets;
    private final OrganizationMemberRepository members;
    private final Clock clock;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public AddInternalNote(InternalNoteRepository notes, ContactRepository contacts,
                           TicketRepository tickets, OrganizationMemberRepository members,
                           Clock clock, AuditLogger logger, IdGenerator idGenerator) {
        this.notes = notes;
        this.contacts = contacts;
        this.tickets = tickets;
        this.members = members;
        this.clock = clock;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId,
                                       String contactId, String ticketId, String body) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canAddNotes(actor);

        var contact = contacts.findById(contactId);
        if (contact == null || !contact.getOrganizationId().equals(organizationId)) {
            throw new ContactNotFoundError(contactId);
        }

        if (ticketId != null) {
            var ticket = tickets.findById(ticketId);
            if (ticket == null || !ticket.getOrganizationId().equals(organizationId)) {
                throw new TicketNotFoundError(ticketId);
            }
        }

        var now = clock.now();
        InternalNote note = InternalNote.create(idGenerator.generate(), organizationId,
                contactId, ticketId, actorUserId, body, now);
        notes.save(note);

        logger.log("info", "note.added", Json.obj(
                "organizationId", organizationId,
                "contactId", contactId,
                "noteId", note.getId(),
                "actorUserId", actorUserId));

        return Json.obj("note", Json.obj(
                "id", note.getId(),
                "contactId", note.getContactId(),
                "ticketId", note.getTicketId(),
                "body", note.getBody(),
                "createdAt", note.getCreatedAt()));
    }
}
