package com.filazap.application.port;

import java.util.List;
import java.util.Map;

public interface WhatsAppWebhookParser {

    record ParsedWebhookMessage(String whatsappMessageId, String from, String timestamp,
                                String type, String body, String mediaId) {}

    record ParsedWebhookStatus(String whatsappMessageId, String status, String timestamp) {}

    record ParsedWebhook(String businessAccountId, String phoneNumberId,
                         List<ParsedWebhookMessage> messages,
                         List<ParsedWebhookStatus> statuses) {}

    ParsedWebhook parse(Map<String, Object> payload);
}
