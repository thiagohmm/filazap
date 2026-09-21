package com.filazap.domain.error;

public class InvalidSlugError extends DomainError {
    public InvalidSlugError(String slug) {
        super("O slug \"" + slug + "\" é inválido. Use apenas letras minúsculas, números e hífens.");
    }
}
