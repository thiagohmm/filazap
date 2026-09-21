package com.filazap.application.usecase;

import com.filazap.application.port.ContactRepository;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.error.ContactNotFoundError;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class ListContactHistory {
    private final ContactRepository contacts;
    private final TicketRepository tickets;
    private final OrganizationMemberRepository members;

    public ListContactHistory(ContactRepository contacts, TicketRepository tickets,
                              OrganizationMemberRepository members) {
        this.contacts = contacts;
        this.tickets = tickets;
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
        List<Map<String, Object>> items = history.stream().map(h -> {
            Long duration = (h.ticket().getFinishedAt() != null && h.ticket().getQueueEnteredAt() != null)
                    ? Math.max(0, Duration.between(h.ticket().getQueueEnteredAt(),
                            h.ticket().getFinishedAt()).getSeconds())
                    : null;
            return Json.obj(
                    "ticketId", h.ticket().getId(),
                    "sequenceNumber", h.ticket().getSequenceNumber(),
                    "status", h.ticket().getStatusName(),
                    "queueEnteredAt", h.ticket().getQueueEnteredAt(),
                    "finishedAt", h.ticket().getFinishedAt(),
                    "assignedUserName", h.assignedUserName(),
                    "durationSeconds", duration);
        }).toList();

        return Json.obj("history", items);
    }
}
