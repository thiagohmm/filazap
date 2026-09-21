package com.filazap.domain.error;

public class SendMessageFailedError extends DomainError {
    public SendMessageFailedError(String message) {
        super("Falha ao enviar mensagem pelo WhatsApp: " + message);
    }
}
