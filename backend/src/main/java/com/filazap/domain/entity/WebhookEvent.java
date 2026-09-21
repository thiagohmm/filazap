package com.filazap.domain.entity;

import com.filazap.domain.valueobject.WebhookEventStatus;

import java.time.Instant;
import java.util.Map;

public class WebhookEvent {
    private final String id;
    private final String organizationId;
    private final String providerEventId;
    private final Map<String, Object> payload;
    private WebhookEventStatus processingStatus;
    private int attempts;
    private final Instant receivedAt;
    private Instant processedAt;
    private String errorMessage;

    private WebhookEvent(String id, String organizationId, String providerEventId,
                         Map<String, Object> payload, WebhookEventStatus processingStatus,
                         int attempts, Instant receivedAt, Instant processedAt, String errorMessage) {
        this.id = id;
        this.organizationId = organizationId;
        this.providerEventId = providerEventId;
        this.payload = payload;
        this.processingStatus = processingStatus;
        this.attempts = attempts;
        this.receivedAt = receivedAt;
        this.processedAt = processedAt;
        this.errorMessage = errorMessage;
    }

    public static WebhookEvent create(String id, Map<String, Object> payload, Instant receivedAt) {
        return new WebhookEvent(id, null, null, payload, WebhookEventStatus.PROCESSING, 0,
                receivedAt, null, null);
    }

    public static WebhookEvent restore(String id, String organizationId, String providerEventId,
                                       Map<String, Object> payload, WebhookEventStatus processingStatus,
                                       int attempts, Instant receivedAt, Instant processedAt,
                                       String errorMessage) {
        return new WebhookEvent(id, organizationId, providerEventId, payload, processingStatus,
                attempts, receivedAt, processedAt, errorMessage);
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getProviderEventId() { return providerEventId; }
    public Map<String, Object> getPayload() { return payload; }
    public WebhookEventStatus getProcessingStatus() { return processingStatus; }
    public int getAttempts() { return attempts; }
    public Instant getReceivedAt() { return receivedAt; }
    public Instant getProcessedAt() { return processedAt; }
    public String getErrorMessage() { return errorMessage; }

    public void markProcessed(Instant now) {
        this.processingStatus = WebhookEventStatus.PROCESSED;
        this.processedAt = now;
    }

    public void markFailed(Instant now, String error) {
        this.processingStatus = WebhookEventStatus.FAILED;
        this.attempts += 1;
        this.errorMessage = error;
        this.processedAt = now;
    }
}
