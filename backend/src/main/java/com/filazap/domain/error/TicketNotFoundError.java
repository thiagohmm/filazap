package com.filazap.domain.error;

public class TicketNotFoundError extends DomainError {
    public TicketNotFoundError(String ticketId) {
        super("O atendimento \"" + ticketId + "\" não foi encontrado.");
    }
}
