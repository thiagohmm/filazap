package com.filazap.domain.entity;

import java.time.Instant;
import java.util.Map;

public class TicketEvent {
    private final String id;
    private final String organizationId;
    private final String ticketId;
    private final String actorUserId;
    private final String eventType;
    private final String fromStatus;
    private final String toStatus;
    private final Map<String, Object> payload;
    private final Instant createdAt;

    private TicketEvent(String id, String organizationId, String ticketId, String actorUserId,
                        String eventType, String fromStatus, String toStatus,
                        Map<String, Object> payload, Instant createdAt) {
        this.id = id;
        this.organizationId = organizationId;
        this.ticketId = ticketId;
        this.actorUserId = actorUserId;
        this.eventType = eventType;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.payload = payload;
        this.createdAt = createdAt;
    }

    public static TicketEvent create(String id, String organizationId, String ticketId,
                                     String actorUserId, String eventType, String fromStatus,
                                     String toStatus, Instant createdAt) {
        return new TicketEvent(id, organizationId, ticketId, actorUserId, eventType,
                fromStatus, toStatus, null, createdAt);
    }

    public static TicketEvent restore(String id, String organizationId, String ticketId,
                                      String actorUserId, String eventType, String fromStatus,
                                      String toStatus, Map<String, Object> payload, Instant createdAt) {
        return new TicketEvent(id, organizationId, ticketId, actorUserId, eventType,
                fromStatus, toStatus, payload, createdAt);
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getTicketId() { return ticketId; }
    public String getActorUserId() { return actorUserId; }
    public String getEventType() { return eventType; }
    public String getFromStatus() { return fromStatus; }
    public String getToStatus() { return toStatus; }
    public Map<String, Object> getPayload() { return payload; }
    public Instant getCreatedAt() { return createdAt; }
}
