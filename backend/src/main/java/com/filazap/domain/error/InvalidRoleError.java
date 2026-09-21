package com.filazap.domain.error;

public class InvalidRoleError extends DomainError {
    public InvalidRoleError(String role) {
        super("O papel \"" + role + "\" é inválido.");
    }
}
