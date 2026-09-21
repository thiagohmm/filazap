package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.MessageRepository;
import com.filazap.application.port.WebhookEventRepository;
import com.filazap.application.port.WhatsAppWebhookParser;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.Message;
import com.filazap.domain.entity.WebhookEvent;
import com.filazap.domain.service.Clock;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class UpdateMessageStatus {
    private final WebhookEventRepository webhookEvents;
    private final MessageRepository messages;
    private final WhatsAppWebhookParser parser;
    private final Clock clock;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public UpdateMessageStatus(WebhookEventRepository webhookEvents, MessageRepository messages,
                               WhatsAppWebhookParser parser, Clock clock, AuditLogger logger,
                               IdGenerator idGenerator) {
        this.webhookEvents = webhookEvents;
        this.messages = messages;
        this.parser = parser;
        this.clock = clock;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(Map<String, Object> payload) {
        WebhookEvent event = WebhookEvent.create(idGenerator.generate(), payload, clock.now());
        webhookEvents.save(event);

        int updated = 0;
        try {
            var parsed = parser.parse(payload);
            for (var status : parsed.statuses()) {
                Message message = messages.findByWhatsappMessageId(status.whatsappMessageId());
                if (message == null) continue;
                message.updateProviderStatus(status.status());
                messages.save(message);
                updated += 1;
            }
            event.markProcessed(clock.now());
            webhookEvents.save(event);
            return Json.obj("updated", updated);
        } catch (RuntimeException error) {
            event.markFailed(clock.now(), error.getMessage() == null ? "Erro desconhecido" : error.getMessage());
            webhookEvents.save(event);
            logger.log("error", "webhook.status_failed", Json.obj("webhookEventId", event.getId()));
            throw error;
        }
    }
}
