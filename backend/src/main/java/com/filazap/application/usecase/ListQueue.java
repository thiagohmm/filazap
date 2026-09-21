package com.filazap.application.usecase;

import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.service.Clock;
import com.filazap.domain.valueobject.TicketStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class ListQueue {
    private final TicketRepository tickets;
    private final OrganizationMemberRepository members;
    private final Clock clock;

    public ListQueue(TicketRepository tickets, OrganizationMemberRepository members, Clock clock) {
        this.tickets = tickets;
        this.members = members;
        this.clock = clock;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId,
                                       TicketStatus status, String assignedUserId, Integer limit) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canViewTickets(actor);

        Instant now = clock.now();
        var queue = tickets.listQueue(new TicketRepository.TicketQueueFilter(
                organizationId, status, assignedUserId, limit));

        List<Map<String, Object>> items = queue.stream().map(q -> {
            long waitSeconds = Math.max(0,
                    Duration.between(q.ticket().getQueueEnteredAt(), now).getSeconds());
            Map<String, Object> lastMessage = q.lastMessageAt() == null ? null
                    : Json.obj("body", q.lastMessageBody(), "createdAt", q.lastMessageAt());
            return Json.obj(
                    "ticketId", q.ticket().getId(),
                    "channelId", q.ticket().getChannelId(),
                    "sequenceNumber", q.ticket().getSequenceNumber(),
                    "status", q.ticket().getStatusName(),
                    "queueEnteredAt", q.ticket().getQueueEnteredAt(),
                    "waitSeconds", waitSeconds,
                    "priority", q.ticket().getPriority(),
                    "assignedUserId", q.ticket().getAssignedUserId(),
                    "assignedUserName", q.assignedUserName(),
                    "contact", Json.obj(
                            "id", q.ticket().getContactId(),
                            "name", q.contactName(),
                            "phoneE164", q.contactPhone()),
                    "lastMessage", lastMessage);
        }).toList();

        return Json.obj("queue", items);
    }
}
