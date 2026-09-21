package com.filazap.domain.valueobject;

public enum ChannelStatus {
    DISCONNECTED, CONNECTED, FAILED;

    public static ChannelStatus fromString(String raw) {
        switch (raw.toUpperCase()) {
            case "CONNECTED": return CONNECTED;
            case "DISCONNECTED": return DISCONNECTED;
            case "FAILED": return FAILED;
            default: throw new IllegalArgumentException("Status de canal inválido: " + raw);
        }
    }
}
