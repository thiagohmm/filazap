package com.filazap.application.port;

import com.filazap.domain.entity.Ticket;
import com.filazap.domain.valueobject.TicketStatus;

import java.time.Instant;
import java.util.List;

public interface TicketRepository {

    record QueueTicket(Ticket ticket, String contactName, String contactPhone,
                       String assignedUserName, String lastMessageBody, Instant lastMessageAt) {}

    record TicketQueueFilter(String organizationId, TicketStatus status,
                             String assignedUserId, Integer limit) {}

    record OperationalCounters(long waiting, long returning, long inProgress,
                               long waitingCustomer, long finishedToday,
                               Long maxWaitSeconds, Double avgFirstResponseSeconds) {}

    record TicketHistoryItem(Ticket ticket, String assignedUserName) {}

    record TicketsPerAgent(String userId, String name, int count) {}

    record OrganizationMetrics(Double avgAttendanceSeconds, int totalFinished,
                               List<TicketsPerAgent> ticketsPerAgent, Double returnRate) {}

    record AssignResult(boolean ok, Ticket ticket, String reason) {
        public static AssignResult success(Ticket ticket) {
            return new AssignResult(true, ticket, null);
        }

        public static AssignResult failure(String reason) {
            return new AssignResult(false, null, reason);
        }
    }

    Ticket save(Ticket ticket);

    Ticket findById(String id);

    Ticket findOpenByContact(String contactId);

    Ticket findActiveByContact(String contactId);

    int nextSequenceNumber(String organizationId);

    List<QueueTicket> listQueue(TicketQueueFilter filter);

    AssignResult assignNext(String organizationId, String userId, Instant now);

    AssignResult assignTicket(String ticketId, String userId, Instant now);

    List<Ticket> findAssignedOpenByUser(String organizationId, String userId);

    OperationalCounters getOperationalCounters(String organizationId, Instant now);

    List<TicketHistoryItem> findByContact(String organizationId, String contactId);

    OrganizationMetrics getMetrics(String organizationId, Instant now);
}
