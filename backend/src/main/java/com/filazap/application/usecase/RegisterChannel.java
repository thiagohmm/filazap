package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.WhatsAppChannelRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.WhatsAppChannel;
import com.filazap.domain.error.ChannelAlreadyExistsError;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class RegisterChannel {
    private final WhatsAppChannelRepository channels;
    private final OrganizationMemberRepository members;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public RegisterChannel(WhatsAppChannelRepository channels, OrganizationMemberRepository members,
                           AuditLogger logger, IdGenerator idGenerator) {
        this.channels = channels;
        this.members = members;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId,
                                       String phoneNumberId, String businessAccountId,
                                       String displayPhoneNumber) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canManageChannels(actor);

        if (channels.findByPhoneNumberId(phoneNumberId) != null) {
            throw new ChannelAlreadyExistsError(phoneNumberId);
        }

        WhatsAppChannel channel = WhatsAppChannel.create(idGenerator.generate(), organizationId,
                phoneNumberId, businessAccountId, displayPhoneNumber);
        channels.save(channel);

        logger.log("info", "channel.registered", Json.obj(
                "organizationId", organizationId,
                "channelId", channel.getId(),
                "phoneNumberId", channel.getPhoneNumberId(),
                "actorUserId", actorUserId));

        return Json.obj("channel", Json.obj(
                "id", channel.getId(),
                "organizationId", channel.getOrganizationId(),
                "phoneNumberId", channel.getPhoneNumberId(),
                "businessAccountId", channel.getBusinessAccountId(),
                "displayPhoneNumber", channel.getDisplayPhoneNumber(),
                "status", channel.getStatus(),
                "createdAt", channel.getCreatedAt()));
    }
}
