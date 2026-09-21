package com.filazap.domain.error;

public class TicketAlreadyAssignedError extends DomainError {
    public TicketAlreadyAssignedError(String ticketId) {
        super("O atendimento " + ticketId + " já foi assumido por outra atendente.");
    }
}
