package com.filazap.application.usecase;

import com.filazap.application.port.ContactRepository;
import com.filazap.application.port.InternalNoteRepository;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.port.UserRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.Ticket;
import com.filazap.domain.error.ContactNotFoundError;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class GetContactProfile {
    private final ContactRepository contacts;
    private final TicketRepository tickets;
    private final InternalNoteRepository notes;
    private final UserRepository users;
    private final OrganizationMemberRepository members;

    public GetContactProfile(ContactRepository contacts, TicketRepository tickets,
                             InternalNoteRepository notes, UserRepository users,
                             OrganizationMemberRepository members) {
        this.contacts = contacts;
        this.tickets = tickets;
        this.notes = notes;
        this.users = users;
        this.members = members;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId, String contactId) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canViewTickets(actor);

        var contact = contacts.findById(contactId);
        if (contact == null || !contact.getOrganizationId().equals(organizationId)) {
            throw new ContactNotFoundError(contactId);
        }

        var history = tickets.findByContact(organizationId, contact.getId());
        Ticket activeTicket = history.stream()
                .map(TicketRepository.TicketHistoryItem::ticket)
                .filter(Ticket::isActive)
                .findFirst()
                .orElse(null);

        String assignedUserName = null;
        if (activeTicket != null && activeTicket.getAssignedUserId() != null) {
            var user = users.findById(activeTicket.getAssignedUserId());
            assignedUserName = user != null ? user.getName() : null;
        }

        List<Map<String, Object>> noteList = notes.findByContactId(organizationId, contact.getId())
                .stream()
                .map(n -> Json.obj(
                        "id", n.getId(),
                        "body", n.getBody(),
                        "authorUserId", n.getAuthorUserId(),
                        "createdAt", n.getCreatedAt()))
                .toList();

        return Json.obj(
                "contact", Json.obj(
                        "id", contact.getId(),
                        "channelId", contact.getChannelId(),
                        "phoneE164", contact.getPhoneE164(),
                        "name", contact.getName(),
                        "firstContactAt", contact.getFirstContactAt(),
                        "lastContactAt", contact.getLastContactAt()),
                "stats", Json.obj(
                        "totalTickets", history.size(),
                        "currentStatus", activeTicket != null ? activeTicket.getStatusName() : null,
                        "assignedUserName", assignedUserName),
                "notes", noteList);
    }
}
