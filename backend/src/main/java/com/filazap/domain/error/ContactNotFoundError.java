package com.filazap.domain.error;

public class ContactNotFoundError extends DomainError {
    public ContactNotFoundError(String contactId) {
        super("O contato \"" + contactId + "\" não foi encontrado.");
    }
}
