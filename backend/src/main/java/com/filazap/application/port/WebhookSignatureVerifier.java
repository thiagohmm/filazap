package com.filazap.application.port;

/**
 * Verificador de signature de webhooks.
 *
 * <p>Estado-free por design: o secret nunca e stored aqui. O caller (controller) resolve
 * the per-channel secret (desencrypted) and passes it in, which lets the driver be chosen
 * at configuration time without re-instantiating verifiers per request.
 */
public interface WebhookSignatureVerifier {

    /**
     * @param rawBody             corpo raw exatamente como received (no re-serialization)
     * @param signatureHeader     header signature sent by the provider
     * @param secret              per-channel shared secret
     * @return true only when the signature matches; must fail closed on missing inputs
     */
    boolean verify(String rawBody, String signatureHeader, String secret);
}
