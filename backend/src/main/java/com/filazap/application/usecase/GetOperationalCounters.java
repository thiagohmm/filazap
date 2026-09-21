package com.filazap.application.usecase;

import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.service.Clock;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class GetOperationalCounters {
    private final TicketRepository tickets;
    private final OrganizationMemberRepository members;
    private final Clock clock;

    public GetOperationalCounters(TicketRepository tickets, OrganizationMemberRepository members,
                                  Clock clock) {
        this.tickets = tickets;
        this.members = members;
        this.clock = clock;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canViewTickets(actor);

        var c = tickets.getOperationalCounters(organizationId, clock.now());
        return Json.obj(
                "waiting", c.waiting(),
                "returning", c.returning(),
                "inProgress", c.inProgress(),
                "waitingCustomer", c.waitingCustomer(),
                "finishedToday", c.finishedToday(),
                "maxWaitSeconds", c.maxWaitSeconds(),
                "avgFirstResponseSeconds", c.avgFirstResponseSeconds());
    }
}
