package com.filazap.domain.error;

/** Erro de domínio base — mapeado para HTTP 400 na camada de apresentação. */
public class DomainError extends RuntimeException {
    public DomainError(String message) {
        super(message);
    }
}
