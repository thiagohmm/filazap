package com.filazap.domain.error;

public class TicketNotAssignedError extends DomainError {
    public TicketNotAssignedError(String ticketId) {
        super("O atendimento " + ticketId + " não está atribuído ao atendente atual.");
    }
}
