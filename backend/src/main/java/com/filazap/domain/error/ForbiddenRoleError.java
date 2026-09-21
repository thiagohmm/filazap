package com.filazap.domain.error;

public class ForbiddenRoleError extends DomainError {
    public ForbiddenRoleError(String role, String action) {
        super("O papel \"" + role + "\" não pode executar \"" + action + "\".");
    }
}
