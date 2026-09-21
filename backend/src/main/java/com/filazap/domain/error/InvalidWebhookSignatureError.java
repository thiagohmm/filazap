package com.filazap.domain.error;

public class InvalidWebhookSignatureError extends DomainError {
    public InvalidWebhookSignatureError() {
        super("Assinatura do webhook inválida.");
    }
}
