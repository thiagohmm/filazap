package com.filazap.domain.error;

public class EmailAlreadyRegisteredError extends DomainError {
    public EmailAlreadyRegisteredError(String email) {
        super("Já existe um usuário com o e-mail \"" + email + "\".");
    }
}
