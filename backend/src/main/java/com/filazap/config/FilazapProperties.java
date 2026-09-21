package com.filazap.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propriedades de configuração da aplicação (prefixo "filazap").
 */
@ConfigurationProperties(prefix = "filazap")
public record FilazapProperties(
        String jwtSecret,
        String credentialEncryptionKey,
        String appUrl,
        String whatsappApiUrl,
        String whatsappDriver,
        String mediaStorageDriver,
        String mediaStorageRoot,
        String organizationSignupAllowedDomains,
        Resend resend,
        Supabase supabase,
        Waha waha
) {
    public record Resend(String apiKey, String from) {}

    public record Supabase(String url, String serviceRoleKey, String storageBucket) {}

    /**
     * WAHA (self-hosted gateway, QR pairing).
     *
     * @param url          base URL of the WAHA instance
     * @param apiKey       WAHA X-Api-Key header (shared key used by the QR pairing proxy;
     *                     the per-channel send path still uses the channel's own key)
     * @param convertVoice run input audio through ffmpeg to ogg/opus. WhatsApp voice notes
     *                      must be ogg/opus; set false if the image has no ffmpeg.
     */
    public record Waha(String url, String apiKey, boolean convertVoice) {}
}
