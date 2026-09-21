package com.filazap.test;

import com.filazap.infrastructure.security.Aes256GcmCredentialCipher;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CredentialCipherTest {

    @Test
    void fazRoundTripDeEncryptDecrypt() {
        var cipher = new Aes256GcmCredentialCipher("master-key");
        String encrypted = cipher.encrypt("super-secreto");
        assertFalse(encrypted.contains("super-secreto"));
        assertTrue(cipher.decrypt(encrypted).equals("super-secreto"));
    }

    @Test
    void geraCifrasDiferentesParaOMesmoTexto() {
        var cipher = new Aes256GcmCredentialCipher("master-key");
        assertNotEquals(cipher.encrypt("x"), cipher.encrypt("x"));
    }

    @Test
    void naoDecifraTextoDeOutraChave() {
        var a = new Aes256GcmCredentialCipher("chave-a");
        var b = new Aes256GcmCredentialCipher("chave-b");
        String encrypted = a.encrypt("segredo");
        assertThrows(IllegalArgumentException.class, () -> b.decrypt(encrypted));
    }

    @Test
    void rejeitaCifraMalformada() {
        var cipher = new Aes256GcmCredentialCipher("master-key");
        assertThrows(IllegalArgumentException.class, () -> cipher.decrypt("invalido"));
    }

    @Test
    void rejeitaChaveMestreVazia() {
        assertThrows(IllegalArgumentException.class, () -> new Aes256GcmCredentialCipher(""));
    }
}
