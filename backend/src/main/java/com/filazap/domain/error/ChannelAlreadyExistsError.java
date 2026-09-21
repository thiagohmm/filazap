package com.filazap.domain.error;

public class ChannelAlreadyExistsError extends DomainError {
    public ChannelAlreadyExistsError(String phoneNumberId) {
        super("Já existe um canal com o phone_number_id \"" + phoneNumberId + "\".");
    }
}
