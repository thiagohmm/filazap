package com.filazap.infrastructure.whatsapp;

import com.filazap.application.port.WebhookSignatureVerifier;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Verificador HMAC para webhooks WAHA.
 *
 * <p>WAHA posts two headers: {@code X-Webhook-Hmac} (hex digest of the <b>raw</b> body) and
 * {@code X-Webhook-Hmac-Algorithm}, which is always {@code sha512}. The shared secret comes
 * from {@code hmac.key} on the webhook config (or {@code WHATSAPP_HOOK_HMAC_KEY} globally) and
 * is stored per-channel, encrypted at rest.
 *
 * <p>Differs from Meta, which uses {@code X-Hub-Signature-256} with SHA-256 and a
 * {@code sha256=} prefix. The bare hex form is accepted too, since some deployments configure
 * a {@code customHeaders} value without the prefix.
 */
public class WahaWebhookSignatureVerifier implements WebhookSignatureVerifier {

    @Override
    public boolean verify(String rawBody, String signatureHeader, String secret) {
        if (secret == null || secret.isEmpty()) return false;
        if (rawBody == null) return false;
        if (signatureHeader == null || signatureHeader.isBlank()) return false;

        String expected = hmacSha512Hex(secret, rawBody);
        String provided = signatureHeader.trim();
        // Tolerate an optional "sha512=" prefix; WAHA sends bare hex.
        if (provided.startsWith("sha512=")) {
            provided = provided.substring("sha512=".length());
        }

        return MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8));
    }

    private static String hmacSha512Hex(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao calcular HMAC-SHA512.", e);
        }
    }
}
