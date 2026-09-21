package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.CredentialCipher;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.WhatsAppChannelRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.WhatsAppChannel;
import com.filazap.domain.error.ChannelNotFoundError;
import com.filazap.domain.service.Clock;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class UpdateChannelCredentials {
    private final WhatsAppChannelRepository channels;
    private final OrganizationMemberRepository members;
    private final CredentialCipher cipher;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;
    private final Clock clock;

    public UpdateChannelCredentials(WhatsAppChannelRepository channels,
                                    OrganizationMemberRepository members, CredentialCipher cipher,
                                    AuditLogger logger, IdGenerator idGenerator, Clock clock) {
        this.channels = channels;
        this.members = members;
        this.cipher = cipher;
        this.logger = logger;
        this.idGenerator = idGenerator;
        this.clock = clock;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId, String channelId,
                                       String accessToken, String appSecret,
                                       String webhookVerifyToken, String apiBaseUrl) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canManageChannels(actor);

        WhatsAppChannel channel = channels.findById(channelId);
        if (channel == null || !channel.getOrganizationId().equals(organizationId)) {
            throw new ChannelNotFoundError(channelId);
        }

        String accessTokenEncrypted = (accessToken != null && !accessToken.trim().isEmpty())
                ? cipher.encrypt(accessToken) : channel.getAccessTokenEncrypted();
        String appSecretEncrypted = (appSecret != null && !appSecret.trim().isEmpty())
                ? cipher.encrypt(appSecret) : channel.getAppSecretEncrypted();
        String newWebhookVerifyToken = (webhookVerifyToken != null && !webhookVerifyToken.trim().isEmpty())
                ? webhookVerifyToken
                : (channel.getWebhookVerifyToken() != null ? channel.getWebhookVerifyToken() : idGenerator.generate());
        String newApiBaseUrl = apiBaseUrl != null
                ? (apiBaseUrl.trim().isEmpty() ? null : apiBaseUrl.trim())
                : channel.getApiBaseUrl();

        WhatsAppChannel updated = WhatsAppChannel.restore(channel.getId(), channel.getOrganizationId(),
                channel.getPhoneNumberId(), channel.getBusinessAccountId(), channel.getDisplayPhoneNumber(),
                channel.getStatus(), accessTokenEncrypted, appSecretEncrypted, newWebhookVerifyToken,
                newApiBaseUrl, channel.getCreatedAt(), clock.now());
        channels.save(updated);

        logger.log("info", "channel.credentials_updated", Json.obj(
                "organizationId", organizationId,
                "channelId", updated.getId(),
                "actorUserId", actorUserId));

        return Json.obj("channel", Json.obj(
                "id", updated.getId(),
                "organizationId", updated.getOrganizationId(),
                "phoneNumberId", updated.getPhoneNumberId(),
                "businessAccountId", updated.getBusinessAccountId(),
                "displayPhoneNumber", updated.getDisplayPhoneNumber(),
                "status", updated.getStatus(),
                "configured", updated.hasCredentials(),
                "apiBaseUrl", updated.getApiBaseUrl(),
                "createdAt", updated.getCreatedAt(),
                "updatedAt", updated.getUpdatedAt()));
    }
}
