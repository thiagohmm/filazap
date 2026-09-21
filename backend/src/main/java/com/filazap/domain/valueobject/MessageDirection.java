package com.filazap.domain.valueobject;

public enum MessageDirection {
    INBOUND, OUTBOUND;

    public static MessageDirection fromString(String raw) {
        switch (raw.toUpperCase()) {
            case "INBOUND": return INBOUND;
            case "OUTBOUND": return OUTBOUND;
            default: throw new IllegalArgumentException("Direção de mensagem inválida: " + raw);
        }
    }
}
