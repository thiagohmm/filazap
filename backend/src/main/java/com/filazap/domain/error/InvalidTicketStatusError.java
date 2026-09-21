package com.filazap.domain.error;

public class InvalidTicketStatusError extends DomainError {
    public InvalidTicketStatusError(String status) {
        super("Status de atendimento inválido: \"" + status + "\".");
    }
}
