package com.filazap.presentation.error;

/** Requisição sem autenticação — mapeada para HTTP 401. */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException() {
        super("Não autenticado.");
    }
}
