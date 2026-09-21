package com.filazap.application.usecase;

import com.filazap.application.port.MessageRepository;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.error.TicketNotFoundError;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ListMessages {
    private final MessageRepository messages;
    private final TicketRepository tickets;
    private final OrganizationMemberRepository members;

    public ListMessages(MessageRepository messages, TicketRepository tickets,
                        OrganizationMemberRepository members) {
        this.messages = messages;
        this.tickets = tickets;
        this.members = members;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId, String ticketId) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canViewTickets(actor);

        var ticket = tickets.findById(ticketId);
        if (ticket == null || !ticket.getOrganizationId().equals(organizationId)) {
            throw new TicketNotFoundError(ticketId);
        }

        List<Map<String, Object>> result = messages.findByTicketId(organizationId, ticketId)
                .stream()
                .map(m -> Json.obj(
                        "id", m.getId(),
                        "ticketId", m.getTicketId(),
                        "contactId", m.getContactId(),
                        "direction", m.getDirection(),
                        "type", m.getType(),
                        "body", m.getBody(),
                        "mediaPath", m.getMediaPath(),
                        "senderUserId", m.getSenderUserId(),
                        "providerStatus", m.getProviderStatus(),
                        "createdAt", m.getCreatedAt()))
                .toList();

        return Json.obj("messages", result);
    }
}
