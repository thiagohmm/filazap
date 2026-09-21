package com.filazap.domain.valueobject;

public enum WebhookEventStatus {
    PENDING, PROCESSING, PROCESSED, FAILED;

    public static WebhookEventStatus fromString(String raw) {
        switch (raw.toUpperCase()) {
            case "PENDING": return PENDING;
            case "PROCESSING": return PROCESSING;
            case "PROCESSED": return PROCESSED;
            case "FAILED": return FAILED;
            default: throw new IllegalArgumentException("Status de evento webhook inválido: " + raw);
        }
    }
}
