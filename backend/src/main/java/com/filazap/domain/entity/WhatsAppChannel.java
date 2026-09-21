package com.filazap.domain.entity;

import com.filazap.domain.valueobject.ChannelStatus;

import java.time.Instant;

public class WhatsAppChannel {
    private final String id;
    private final String organizationId;
    private final String phoneNumberId;
    private final String businessAccountId;
    private final String displayPhoneNumber;
    private final ChannelStatus status;
    private final String accessTokenEncrypted;
    private final String appSecretEncrypted;
    private final String webhookVerifyToken;
    private final String apiBaseUrl;
    private final Instant createdAt;
    private final Instant updatedAt;

    private WhatsAppChannel(String id, String organizationId, String phoneNumberId,
                            String businessAccountId, String displayPhoneNumber,
                            ChannelStatus status, String accessTokenEncrypted,
                            String appSecretEncrypted, String webhookVerifyToken,
                            String apiBaseUrl, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.organizationId = organizationId;
        this.phoneNumberId = phoneNumberId;
        this.businessAccountId = businessAccountId;
        this.displayPhoneNumber = displayPhoneNumber;
        this.status = status;
        this.accessTokenEncrypted = accessTokenEncrypted;
        this.appSecretEncrypted = appSecretEncrypted;
        this.webhookVerifyToken = webhookVerifyToken;
        this.apiBaseUrl = apiBaseUrl;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static WhatsAppChannel create(String id, String organizationId, String phoneNumberId,
                                         String businessAccountId, String displayPhoneNumber) {
        Instant now = Instant.now();
        return new WhatsAppChannel(id, organizationId, phoneNumberId, businessAccountId,
                displayPhoneNumber, ChannelStatus.CONNECTED, null, null, null, null, now, now);
    }

    public static WhatsAppChannel restore(String id, String organizationId, String phoneNumberId,
                                          String businessAccountId, String displayPhoneNumber,
                                          ChannelStatus status, String accessTokenEncrypted,
                                          String appSecretEncrypted, String webhookVerifyToken,
                                          String apiBaseUrl, Instant createdAt, Instant updatedAt) {
        return new WhatsAppChannel(id, organizationId, phoneNumberId, businessAccountId,
                displayPhoneNumber, status, accessTokenEncrypted, appSecretEncrypted,
                webhookVerifyToken, apiBaseUrl, createdAt, updatedAt);
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getPhoneNumberId() { return phoneNumberId; }
    public String getBusinessAccountId() { return businessAccountId; }
    public String getDisplayPhoneNumber() { return displayPhoneNumber; }
    public ChannelStatus getStatus() { return status; }
    public String getAccessTokenEncrypted() { return accessTokenEncrypted; }
    public String getAppSecretEncrypted() { return appSecretEncrypted; }
    public String getWebhookVerifyToken() { return webhookVerifyToken; }
    public String getApiBaseUrl() { return apiBaseUrl; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public boolean hasCredentials() {
        return accessTokenEncrypted != null && appSecretEncrypted != null && webhookVerifyToken != null;
    }
}
