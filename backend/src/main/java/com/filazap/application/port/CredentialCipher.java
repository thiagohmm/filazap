package com.filazap.application.port;

/** Criptografia reversível de credenciais em repouso (AES-256-GCM na infra). */
public interface CredentialCipher {
    String encrypt(String plain);

    String decrypt(String cipher);
}
