package com.filazap.application.usecase;

import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.WhatsAppChannelRepository;
import com.filazap.application.util.Json;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ListChannels {
    private final WhatsAppChannelRepository channels;
    private final OrganizationMemberRepository members;

    public ListChannels(WhatsAppChannelRepository channels, OrganizationMemberRepository members) {
        this.channels = channels;
        this.members = members;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canViewChannels(actor);

        List<Map<String, Object>> result = channels.findByOrganizationId(organizationId)
                .stream()
                .map(c -> Json.obj(
                        "id", c.getId(),
                        "phoneNumberId", c.getPhoneNumberId(),
                        "businessAccountId", c.getBusinessAccountId(),
                        "displayPhoneNumber", c.getDisplayPhoneNumber(),
                        "status", c.getStatus(),
                        "configured", c.hasCredentials(),
                        "createdAt", c.getCreatedAt()))
                .toList();

        return Json.obj("channels", result);
    }
}
