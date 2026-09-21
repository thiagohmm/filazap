package com.filazap.application.port;

import com.filazap.domain.entity.WhatsAppChannel;

import java.util.List;

public interface WhatsAppChannelRepository {
    WhatsAppChannel save(WhatsAppChannel channel);

    WhatsAppChannel findById(String id);

    WhatsAppChannel findByPhoneNumberId(String phoneNumberId);

    List<WhatsAppChannel> findByOrganizationId(String organizationId);

    WhatsAppChannel findByBusinessAccountId(String businessAccountId);

    WhatsAppChannel findByWebhookVerifyToken(String verifyToken);
}
