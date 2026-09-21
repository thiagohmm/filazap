package com.filazap.domain.error;

public class InvalidCredentialsError extends DomainError {
    public InvalidCredentialsError() {
        super("E-mail ou senha inválidos.");
    }
}
