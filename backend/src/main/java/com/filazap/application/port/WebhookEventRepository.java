package com.filazap.application.port;

import com.filazap.domain.entity.WebhookEvent;

public interface WebhookEventRepository {
    WebhookEvent save(WebhookEvent event);

    WebhookEvent findById(String id);

    WebhookEvent findByProviderEventId(String providerEventId);
}
