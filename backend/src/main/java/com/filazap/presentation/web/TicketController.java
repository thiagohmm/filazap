package com.filazap.presentation.web;

import com.filazap.application.usecase.AssignNextTicket;
import com.filazap.application.usecase.AssignTicket;
import com.filazap.application.usecase.FinishTicket;
import com.filazap.application.usecase.GetOperationalCounters;
import com.filazap.application.usecase.ListQueue;
import com.filazap.application.usecase.MoveTicketToWaitingCustomer;
import com.filazap.application.usecase.ReopenTicket;
import com.filazap.domain.valueobject.TicketStatus;
import com.filazap.presentation.security.SessionHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/organizations/{organizationId}/tickets")
public class TicketController {
    private final ListQueue listQueue;
    private final GetOperationalCounters getOperationalCounters;
    private final AssignNextTicket assignNextTicket;
    private final AssignTicket assignTicket;
    private final FinishTicket finishTicket;
    private final ReopenTicket reopenTicket;
    private final MoveTicketToWaitingCustomer moveTicketToWaitingCustomer;

    public TicketController(ListQueue listQueue, GetOperationalCounters getOperationalCounters,
                            AssignNextTicket assignNextTicket, AssignTicket assignTicket,
                            FinishTicket finishTicket, ReopenTicket reopenTicket,
                            MoveTicketToWaitingCustomer moveTicketToWaitingCustomer) {
        this.listQueue = listQueue;
        this.getOperationalCounters = getOperationalCounters;
        this.assignNextTicket = assignNextTicket;
        this.assignTicket = assignTicket;
        this.finishTicket = finishTicket;
        this.reopenTicket = reopenTicket;
        this.moveTicketToWaitingCustomer = moveTicketToWaitingCustomer;
    }

    @GetMapping
    public Map<String, Object> list(@PathVariable String organizationId,
                                    @RequestParam(value = "status", required = false) String statusRaw,
                                    @RequestParam(value = "assignedUserId", required = false) String assignedUserId,
                                    @RequestParam(value = "limit", required = false) Integer limit) {
        var session = SessionHolder.require();
        TicketStatus status = null;
        if (statusRaw != null && !statusRaw.isBlank()) {
            status = TicketStatus.fromString(statusRaw);
        }
        return listQueue.execute(session.userId(), organizationId, status, assignedUserId, limit);
    }

    @GetMapping("/counters")
    public Map<String, Object> counters(@PathVariable String organizationId) {
        var session = SessionHolder.require();
        return getOperationalCounters.execute(session.userId(), organizationId);
    }

    @PostMapping("/assign-next")
    public Map<String, Object> assignNext(@PathVariable String organizationId,
                                          @RequestBody(required = false) Map<String, Object> body) {
        var session = SessionHolder.require();
        return assignNextTicket.execute(session.userId(), organizationId);
    }

    @PostMapping("/{ticketId}/assign")
    public Map<String, Object> assign(@PathVariable String organizationId, @PathVariable String ticketId) {
        var session = SessionHolder.require();
        return assignTicket.execute(session.userId(), organizationId, ticketId);
    }

    @PostMapping("/{ticketId}/finish")
    public Map<String, Object> finish(@PathVariable String organizationId, @PathVariable String ticketId) {
        var session = SessionHolder.require();
        return finishTicket.execute(session.userId(), organizationId, ticketId);
    }

    @PostMapping("/{ticketId}/reopen")
    public Map<String, Object> reopen(@PathVariable String organizationId, @PathVariable String ticketId) {
        var session = SessionHolder.require();
        return reopenTicket.execute(session.userId(), organizationId, ticketId);
    }

    @PostMapping("/{ticketId}/waiting-customer")
    public Map<String, Object> waitingCustomer(@PathVariable String organizationId, @PathVariable String ticketId) {
        var session = SessionHolder.require();
        return moveTicketToWaitingCustomer.execute(session.userId(), organizationId, ticketId);
    }
}
