package com.filazap.domain.error;

public class ChannelNotConfiguredError extends DomainError {
    public ChannelNotConfiguredError(String channelId) {
        super("O canal \"" + channelId + "\" ainda não tem credenciais do WhatsApp configuradas.");
    }
}
