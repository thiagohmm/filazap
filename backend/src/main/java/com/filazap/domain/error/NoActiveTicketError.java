package com.filazap.domain.error;

public class NoActiveTicketError extends DomainError {
    public NoActiveTicketError() {
        super("Não existe um atendimento aberto para este contato. Não é possível enviar mensagem.");
    }
}
