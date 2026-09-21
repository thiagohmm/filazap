package com.filazap.domain.error;

public class UserNotFoundError extends DomainError {
    public UserNotFoundError() {
        super("Usuário não encontrado.");
    }
}
