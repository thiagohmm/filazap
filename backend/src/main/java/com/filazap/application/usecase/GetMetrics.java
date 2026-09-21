package com.filazap.application.usecase;

import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.service.Clock;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class GetMetrics {
    private final TicketRepository tickets;
    private final OrganizationMemberRepository members;
    private final Clock clock;

    public GetMetrics(TicketRepository tickets, OrganizationMemberRepository members, Clock clock) {
        this.tickets = tickets;
        this.members = members;
        this.clock = clock;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canViewTickets(actor);

        var m = tickets.getMetrics(organizationId, clock.now());
        List<Map<String, Object>> perAgent = m.ticketsPerAgent().stream()
                .map(a -> Json.obj("userId", a.userId(), "name", a.name(), "count", a.count()))
                .toList();

        return Json.obj(
                "avgAttendanceSeconds", m.avgAttendanceSeconds(),
                "totalFinished", m.totalFinished(),
                "ticketsPerAgent", perAgent,
                "returnRate", m.returnRate());
    }
}
