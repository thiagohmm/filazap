package com.filazap.domain.entity;

import com.filazap.domain.valueobject.MessageDirection;

import java.time.Instant;

public class Message {
    private final String id;
    private final String organizationId;
    private final String ticketId;
    private final String contactId;
    private final String whatsappMessageId;
    private final MessageDirection direction;
    private final String type;
    private final String body;
    private final String mediaPath;
    private final String senderUserId;
    private String providerStatus;
    private final Instant providerTimestamp;
    private final Instant createdAt;

    private Message(String id, String organizationId, String ticketId, String contactId,
                    String whatsappMessageId, MessageDirection direction, String type,
                    String body, String mediaPath, String senderUserId, String providerStatus,
                    Instant providerTimestamp, Instant createdAt) {
        this.id = id;
        this.organizationId = organizationId;
        this.ticketId = ticketId;
        this.contactId = contactId;
        this.whatsappMessageId = whatsappMessageId;
        this.direction = direction;
        this.type = type;
        this.body = body;
        this.mediaPath = mediaPath;
        this.senderUserId = senderUserId;
        this.providerStatus = providerStatus;
        this.providerTimestamp = providerTimestamp;
        this.createdAt = createdAt;
    }

    public static Message create(String id, String organizationId, String ticketId,
                                 String contactId, String whatsappMessageId,
                                 MessageDirection direction, String type, String body,
                                 String mediaPath, String senderUserId, String providerStatus,
                                 Instant providerTimestamp) {
        Instant now = Instant.now();
        return new Message(id, organizationId, ticketId, contactId, whatsappMessageId,
                direction, type, body, mediaPath, senderUserId, providerStatus, providerTimestamp, now);
    }

    public static Message restore(String id, String organizationId, String ticketId,
                                  String contactId, String whatsappMessageId,
                                  MessageDirection direction, String type, String body,
                                  String mediaPath, String senderUserId, String providerStatus,
                                  Instant providerTimestamp, Instant createdAt) {
        return new Message(id, organizationId, ticketId, contactId, whatsappMessageId,
                direction, type, body, mediaPath, senderUserId, providerStatus, providerTimestamp, createdAt);
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getTicketId() { return ticketId; }
    public String getContactId() { return contactId; }
    public String getWhatsappMessageId() { return whatsappMessageId; }
    public MessageDirection getDirection() { return direction; }
    public String getType() { return type; }
    public String getBody() { return body; }
    public String getMediaPath() { return mediaPath; }
    public String getSenderUserId() { return senderUserId; }
    public String getProviderStatus() { return providerStatus; }
    public Instant getProviderTimestamp() { return providerTimestamp; }
    public Instant getCreatedAt() { return createdAt; }

    public void updateProviderStatus(String status) {
        this.providerStatus = status;
    }
}
