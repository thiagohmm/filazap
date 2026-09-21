package com.filazap.domain.error;

public class InvalidTicketTransitionError extends DomainError {
    public InvalidTicketTransitionError(String fromStatus, String toStatus) {
        super("Transição de atendimento inválida: \"" + fromStatus + "\" não pode ir para \"" + toStatus + "\".");
    }
}
