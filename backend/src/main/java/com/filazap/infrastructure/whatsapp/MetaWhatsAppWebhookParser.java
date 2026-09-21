package com.filazap.infrastructure.whatsapp;

import com.filazap.application.port.WhatsAppWebhookParser;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class MetaWhatsAppWebhookParser implements WhatsAppWebhookParser {

    @Override
    @SuppressWarnings("unchecked")
    public ParsedWebhook parse(Map<String, Object> payload) {
        List<Map<String, Object>> values = new ArrayList<>();
        Object entry = payload.get("entry");
        if (entry instanceof List<?> entries) {
            for (Object e : entries) {
                if (!(e instanceof Map<?, ?> em)) continue;
                Object changes = em.get("changes");
                if (!(changes instanceof List<?> cl)) continue;
                for (Object c : cl) {
                    if (!(c instanceof Map<?, ?> cm)) continue;
                    Object value = cm.get("value");
                    if (value instanceof Map<?, ?> vm) {
                        values.add((Map<String, Object>) vm);
                    }
                }
            }
        }

        String businessAccountId = null;
        String phoneNumberId = null;
        List<ParsedWebhookMessage> messages = new ArrayList<>();
        List<ParsedWebhookStatus> statuses = new ArrayList<>();

        for (Map<String, Object> value : values) {
            Object metadata = value.get("metadata");
            if (metadata instanceof Map<?, ?> md) {
                Object phone = md.get("phone_number_id");
                if (phone instanceof String s) phoneNumberId = s;
                Object display = md.get("display_phone_number");
                if (display instanceof String s && businessAccountId == null) businessAccountId = s;
            }

            Object rawMessages = value.get("messages");
            if (rawMessages instanceof List<?> msgs) {
                for (Object raw : msgs) {
                    if (!(raw instanceof Map<?, ?> rm)) continue;
                    String messageType = str(rm.get("type"));
                    String mediaId = null;
                    if (messageType != null) {
                        Object media = rm.get(messageType);
                        if (media instanceof Map<?, ?> mm && mm.get("id") instanceof String id) {
                            mediaId = id;
                        }
                    }
                    messages.add(new ParsedWebhookMessage(
                            str(rm.get("id")),
                            str(rm.get("from")),
                            str(rm.get("timestamp")),
                            messageType,
                            extractBody(rm),
                            mediaId));
                }
            }

            Object rawStatuses = value.get("statuses");
            if (rawStatuses instanceof List<?> sts) {
                for (Object raw : sts) {
                    if (!(raw instanceof Map<?, ?> st)) continue;
                    statuses.add(new ParsedWebhookStatus(
                            str(st.get("id")),
                            str(st.get("status")),
                            str(st.get("timestamp"))));
                }
            }
        }

        return new ParsedWebhook(businessAccountId, phoneNumberId, messages, statuses);
    }

    private String extractBody(Map<?, ?> message) {
        Object typeObj = message.get("type");
        String type = typeObj instanceof String s ? s : null;
        if ("text".equals(type)) {
            Object text = message.get("text");
            if (text instanceof Map<?, ?> tm && tm.get("body") instanceof String body) {
                return body;
            }
            return null;
        }
        if (type != null) {
            Object media = message.get(type);
            if (media instanceof Map<?, ?> mm) {
                if (mm.get("caption") instanceof String caption) return caption;
                if ("document".equals(type) && mm.get("filename") instanceof String fn) return fn;
            }
        }
        return null;
    }

    private String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
