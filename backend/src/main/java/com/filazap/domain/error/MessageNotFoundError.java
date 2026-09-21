package com.filazap.domain.error;

public class MessageNotFoundError extends DomainError {
    public MessageNotFoundError(String messageId) {
        super("A mensagem \"" + messageId + "\" não foi encontrada.");
    }
}
