package com.filazap.presentation.error;

/** Erro de validação de entrada — mapeado para HTTP 400. */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
