package com.filazap.infrastructure.security;

import com.filazap.application.port.CredentialCipher;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

public class Aes256GcmCredentialCipher implements CredentialCipher {
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public Aes256GcmCredentialCipher(String masterKey) {
        if (masterKey == null || masterKey.isEmpty()) {
            throw new IllegalArgumentException("Chave mestre de criptografia não configurada.");
        }
        this.key = new SecretKeySpec(sha256(masterKey), "AES");
    }

    @Override
    public String encrypt(String plain) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] out = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));

            byte[] data = Arrays.copyOfRange(out, 0, out.length - 16);
            byte[] tag = Arrays.copyOfRange(out, out.length - 16, out.length);
            Base64.Encoder b64 = Base64.getEncoder();
            return "v1." + b64.encodeToString(iv) + "." + b64.encodeToString(tag) + "."
                    + b64.encodeToString(data);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao criptografar credencial.", e);
        }
    }

    @Override
    public String decrypt(String cipherText) {
        try {
            String[] parts = cipherText.split("\\.");
            if (parts.length != 4 || !"v1".equals(parts[0])) {
                throw new IllegalArgumentException("Cifra inválida.");
            }
            Base64.Decoder b64 = Base64.getDecoder();
            byte[] iv = b64.decode(parts[1]);
            byte[] tag = b64.decode(parts[2]);
            byte[] data = b64.decode(parts[3]);

            byte[] full = Arrays.copyOf(data, data.length + tag.length);
            System.arraycopy(tag, 0, full, data.length, tag.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(full), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalArgumentException("Falha ao descriptografar credencial.", e);
        }
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }
}
