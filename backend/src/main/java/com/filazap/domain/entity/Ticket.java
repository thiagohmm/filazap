package com.filazap.domain.entity;

import com.filazap.domain.error.InvalidTicketTransitionError;
import com.filazap.domain.error.TicketAlreadyAssignedError;
import com.filazap.domain.valueobject.TicketStatus;

import java.time.Instant;

public class Ticket {
    private final String id;
    private final String organizationId;
    private final String channelId;
    private final String contactId;
    private final int sequenceNumber;
    private TicketStatus status;
    private final int priority;
    private final Instant queueEnteredAt;
    private String assignedUserId;
    private Instant assignedAt;
    private Instant firstResponseAt;
    private Instant waitingCustomerSince;
    private Instant finishedAt;
    private Instant lastMessageAt;
    private final Instant createdAt;
    private Instant updatedAt;

    private Ticket(String id, String organizationId, String channelId, String contactId,
                   int sequenceNumber, TicketStatus status, int priority, Instant queueEnteredAt,
                   String assignedUserId, Instant assignedAt, Instant firstResponseAt,
                   Instant waitingCustomerSince, Instant finishedAt, Instant lastMessageAt,
                   Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.organizationId = organizationId;
        this.channelId = channelId;
        this.contactId = contactId;
        this.sequenceNumber = sequenceNumber;
        this.status = status;
        this.priority = priority;
        this.queueEnteredAt = queueEnteredAt;
        this.assignedUserId = assignedUserId;
        this.assignedAt = assignedAt;
        this.firstResponseAt = firstResponseAt;
        this.waitingCustomerSince = waitingCustomerSince;
        this.finishedAt = finishedAt;
        this.lastMessageAt = lastMessageAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static Ticket create(String id, String organizationId, String channelId,
                                String contactId, int sequenceNumber, Instant queueEnteredAt) {
        return create(id, organizationId, channelId, contactId, sequenceNumber, queueEnteredAt,
                TicketStatus.WAITING);
    }

    public static Ticket create(String id, String organizationId, String channelId,
                                String contactId, int sequenceNumber, Instant queueEnteredAt,
                                TicketStatus status) {
        Instant now = Instant.now();
        return new Ticket(id, organizationId, channelId, contactId, sequenceNumber, status, 0,
                queueEnteredAt, null, null, null, null, null, queueEnteredAt, now, now);
    }

    public static Ticket restore(String id, String organizationId, String channelId,
                                 String contactId, int sequenceNumber, TicketStatus status,
                                 int priority, Instant queueEnteredAt, String assignedUserId,
                                 Instant assignedAt, Instant firstResponseAt,
                                 Instant waitingCustomerSince, Instant finishedAt,
                                 Instant lastMessageAt, Instant createdAt, Instant updatedAt) {
        return new Ticket(id, organizationId, channelId, contactId, sequenceNumber, status,
                priority, queueEnteredAt, assignedUserId, assignedAt, firstResponseAt,
                waitingCustomerSince, finishedAt, lastMessageAt, createdAt, updatedAt);
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getChannelId() { return channelId; }
    public String getContactId() { return contactId; }
    public int getSequenceNumber() { return sequenceNumber; }
    public TicketStatus getStatus() { return status; }
    public String getStatusName() { return status.name(); }
    public int getPriority() { return priority; }
    public Instant getQueueEnteredAt() { return queueEnteredAt; }
    public String getAssignedUserId() { return assignedUserId; }
    public Instant getAssignedAt() { return assignedAt; }
    public Instant getFirstResponseAt() { return firstResponseAt; }
    public Instant getWaitingCustomerSince() { return waitingCustomerSince; }
    public Instant getFinishedAt() { return finishedAt; }
    public Instant getLastMessageAt() { return lastMessageAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public boolean isOpen() {
        return TicketStatus.isQueued(status);
    }

    public boolean isFinished() {
        return status == TicketStatus.FINISHED;
    }

    public boolean isActive() {
        return TicketStatus.isActive(status);
    }

    public void touchLastMessage(Instant now) {
        this.lastMessageAt = now;
        this.updatedAt = now;
    }

    public void assign(String userId, Instant now) {
        if (!TicketStatus.isQueued(status)) {
            throw new InvalidTicketTransitionError(status.name(), "IN_PROGRESS");
        }
        if (assignedUserId != null) {
            throw new TicketAlreadyAssignedError(id);
        }
        this.status = TicketStatus.IN_PROGRESS;
        this.assignedUserId = userId;
        this.assignedAt = now;
        this.updatedAt = now;
    }

    public void moveToWaitingCustomer(Instant now) {
        if (status != TicketStatus.IN_PROGRESS) {
            throw new InvalidTicketTransitionError(status.name(), "WAITING_CUSTOMER");
        }
        this.status = TicketStatus.WAITING_CUSTOMER;
        this.waitingCustomerSince = now;
        this.updatedAt = now;
    }

    public void customerReplied(Instant now) {
        if (status != TicketStatus.WAITING_CUSTOMER) {
            throw new InvalidTicketTransitionError(status.name(), "IN_PROGRESS");
        }
        this.status = TicketStatus.IN_PROGRESS;
        this.waitingCustomerSince = null;
        this.updatedAt = now;
    }

    public void registerFirstResponse(Instant now) {
        if (firstResponseAt == null) {
            this.firstResponseAt = now;
            this.updatedAt = now;
        }
    }

    public void reopen(Instant now) {
        if (status != TicketStatus.FINISHED) {
            throw new InvalidTicketTransitionError(status.name(), "IN_PROGRESS");
        }
        if (assignedUserId == null) {
            throw new InvalidTicketTransitionError(status.name(), "IN_PROGRESS");
        }
        this.status = TicketStatus.IN_PROGRESS;
        this.finishedAt = null;
        this.waitingCustomerSince = null;
        this.updatedAt = now;
    }

    public void finish(Instant now) {
        if (status == TicketStatus.FINISHED) {
            throw new InvalidTicketTransitionError(status.name(), "FINISHED");
        }
        this.status = TicketStatus.FINISHED;
        this.finishedAt = now;
        this.waitingCustomerSince = null;
        this.updatedAt = now;
    }
}
