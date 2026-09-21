package com.filazap.domain.error;

public class ChannelNotFoundError extends DomainError {
    public ChannelNotFoundError(String channelId) {
        super("O canal \"" + channelId + "\" não foi encontrado.");
    }
}
