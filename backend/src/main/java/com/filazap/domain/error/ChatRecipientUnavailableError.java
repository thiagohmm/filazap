package com.filazap.domain.error;

public class ChatRecipientUnavailableError extends DomainError {
    public ChatRecipientUnavailableError() {
        super("Este atendente não está disponível no chat agora.");
    }
}
