package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketEventRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.TicketEvent;
import com.filazap.domain.service.Clock;
import com.filazap.domain.valueobject.TicketStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;

@Service
public class AssignNextTicket {
    private final TicketRepository tickets;
    private final OrganizationMemberRepository members;
    private final TicketEventRepository events;
    private final Clock clock;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public AssignNextTicket(TicketRepository tickets, OrganizationMemberRepository members,
                            TicketEventRepository events, Clock clock, AuditLogger logger,
                            IdGenerator idGenerator) {
        this.tickets = tickets;
        this.members = members;
        this.events = events;
        this.clock = clock;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canHandleTickets(actor);

        var now = clock.now();
        var result = tickets.assignNext(organizationId, actorUserId, now);
        if (!result.ok()) {
            return Json.obj("assigned", false, "ticket", null);
        }

        var ticket = result.ticket();
        events.save(TicketEvent.create(idGenerator.generate(), organizationId, ticket.getId(),
                actorUserId, "TICKET_ASSIGNED", TicketStatus.WAITING.name(), ticket.getStatusName(), now));

        logger.log("info", "ticket.assign_next", Json.obj(
                "organizationId", organizationId,
                "ticketId", ticket.getId(),
                "actorUserId", actorUserId));

        long waitSeconds = Math.max(0,
                Duration.between(ticket.getQueueEnteredAt(), now).getSeconds());

        return Json.obj("assigned", true, "ticket", Json.obj(
                "id", ticket.getId(),
                "contactId", ticket.getContactId(),
                "status", ticket.getStatusName(),
                "queueEnteredAt", ticket.getQueueEnteredAt(),
                "waitSeconds", waitSeconds));
    }
}
