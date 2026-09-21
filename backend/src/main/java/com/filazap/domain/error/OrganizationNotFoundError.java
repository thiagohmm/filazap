package com.filazap.domain.error;

public class OrganizationNotFoundError extends DomainError {
    public OrganizationNotFoundError(String id) {
        super("Organização \"" + id + "\" não encontrada.");
    }
}
