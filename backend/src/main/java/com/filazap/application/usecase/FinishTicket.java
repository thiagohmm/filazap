package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketEventRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.TicketEvent;
import com.filazap.domain.error.TicketNotAssignedError;
import com.filazap.domain.error.TicketNotFoundError;
import com.filazap.domain.service.Clock;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class FinishTicket {
    private final TicketRepository tickets;
    private final OrganizationMemberRepository members;
    private final TicketEventRepository events;
    private final Clock clock;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public FinishTicket(TicketRepository tickets, OrganizationMemberRepository members,
                        TicketEventRepository events, Clock clock, AuditLogger logger,
                        IdGenerator idGenerator) {
        this.tickets = tickets;
        this.members = members;
        this.events = events;
        this.clock = clock;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId, String ticketId) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canHandleTickets(actor);

        var ticket = tickets.findById(ticketId);
        if (ticket == null || !ticket.getOrganizationId().equals(organizationId)) {
            throw new TicketNotFoundError(ticketId);
        }
        if (!actorUserId.equals(ticket.getAssignedUserId())) {
            throw new TicketNotAssignedError(ticketId);
        }

        String fromStatus = ticket.getStatusName();
        var now = clock.now();
        ticket.finish(now);
        tickets.save(ticket);

        events.save(TicketEvent.create(idGenerator.generate(), organizationId, ticket.getId(),
                actorUserId, "TICKET_FINISHED", fromStatus, ticket.getStatusName(), now));

        logger.log("info", "ticket.finished", Json.obj(
                "organizationId", organizationId,
                "ticketId", ticket.getId(),
                "actorUserId", actorUserId));

        return Json.obj("ticket", Json.obj(
                "id", ticket.getId(),
                "status", ticket.getStatusName(),
                "finishedAt", ticket.getFinishedAt()));
    }
}
