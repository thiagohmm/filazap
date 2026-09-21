package com.filazap.infrastructure.whatsapp;

/** Falha na comunicação com o WAHA durante o pairing (criação de sessão, QR ou status). */
public class WahaPairingException extends RuntimeException {
    public WahaPairingException(String message) {
        super(message);
    }
}
