package com.filazap.domain.entity;

import java.time.Instant;

public class InternalNote {
    private final String id;
    private final String organizationId;
    private final String contactId;
    private final String ticketId;
    private final String authorUserId;
    private final String body;
    private final Instant createdAt;
    private final Instant updatedAt;

    private InternalNote(String id, String organizationId, String contactId, String ticketId,
                         String authorUserId, String body, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.organizationId = organizationId;
        this.contactId = contactId;
        this.ticketId = ticketId;
        this.authorUserId = authorUserId;
        this.body = body;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static InternalNote create(String id, String organizationId, String contactId,
                                      String ticketId, String authorUserId, String body, Instant now) {
        return new InternalNote(id, organizationId, contactId, ticketId, authorUserId, body, now, now);
    }

    public static InternalNote restore(String id, String organizationId, String contactId,
                                       String ticketId, String authorUserId, String body,
                                       Instant createdAt, Instant updatedAt) {
        return new InternalNote(id, organizationId, contactId, ticketId, authorUserId, body,
                createdAt, updatedAt);
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getContactId() { return contactId; }
    public String getTicketId() { return ticketId; }
    public String getAuthorUserId() { return authorUserId; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
