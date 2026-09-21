package com.filazap.infrastructure.whatsapp;

import com.filazap.application.port.WebhookSignatureVerifier;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * WhatsApp Cloud API (Meta): header {@code X-Hub-Signature-256: sha256=<hex>}.
 */
public class MetaWebhookSignatureVerifier implements WebhookSignatureVerifier {

    @Override
    public boolean verify(String rawBody, String signatureHeader, String secret) {
        if (secret == null || secret.isEmpty()) return false;
        if (rawBody == null) return false;
        if (signatureHeader == null || signatureHeader.isEmpty()) return false;

        String expected = "sha256=" + hmacSha256Hex(secret, rawBody);
        return MessageDigest.isEqual(
                signatureHeader.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8));
    }

    private static String hmacSha256Hex(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao calcular HMAC.", e);
        }
    }
}
