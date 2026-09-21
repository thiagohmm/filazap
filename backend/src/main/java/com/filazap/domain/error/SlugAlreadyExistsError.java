package com.filazap.domain.error;

public class SlugAlreadyExistsError extends DomainError {
    public SlugAlreadyExistsError(String slug) {
        super("A empresa com o slug \"" + slug + "\" já existe.");
    }
}
