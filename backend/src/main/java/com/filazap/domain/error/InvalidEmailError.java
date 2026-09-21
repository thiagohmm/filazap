package com.filazap.domain.error;

public class InvalidEmailError extends DomainError {
    public InvalidEmailError(String email) {
        super("O e-mail \"" + email + "\" é inválido.");
    }
}
