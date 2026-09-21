package com.filazap.config;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.CredentialCipher;
import com.filazap.application.port.MediaStorage;
import com.filazap.application.port.PasswordResetMailer;
import com.filazap.application.port.TokenService;
import com.filazap.application.port.WebhookSignatureVerifier;
import com.filazap.application.port.WhatsAppGateway;
import com.filazap.application.port.WhatsAppWebhookParser;
import com.filazap.domain.service.PasswordHasher;
import com.filazap.infrastructure.mail.ResendPasswordResetMailer;
import com.filazap.infrastructure.observability.ConsoleAuditLogger;
import com.filazap.infrastructure.security.Aes256GcmCredentialCipher;
import com.filazap.infrastructure.security.BcryptPasswordHasher;
import com.filazap.infrastructure.security.JwtTokenService;
import com.filazap.infrastructure.storage.LocalMediaStorage;
import com.filazap.infrastructure.storage.SupabaseMediaStorage;
import com.filazap.infrastructure.whatsapp.MetaWhatsAppGateway;
import com.filazap.infrastructure.whatsapp.MetaWhatsAppWebhookParser;
import com.filazap.infrastructure.whatsapp.MetaWebhookSignatureVerifier;
import com.filazap.infrastructure.whatsapp.WahaPairingService;
import com.filazap.infrastructure.whatsapp.WahaWhatsAppGateway;
import com.filazap.infrastructure.whatsapp.WahaWhatsAppWebhookParser;
import com.filazap.infrastructure.whatsapp.WahaWebhookSignatureVerifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class InfrastructureConfig {

    /** WhatsApp driver: "meta" (Cloud API) or "waha" (self-hosted, QR pairing). */
    private static final String DRIVER_WAHA = "waha";

    private static boolean useWaha(FilazapProperties props) {
        return DRIVER_WAHA.equalsIgnoreCase(trimmed(props.whatsappDriver()));
    }

    private static String trimmed(String value) {
        return value == null ? "" : value.trim();
    }

    @Bean
    public PasswordHasher passwordHasher() {
        return new BcryptPasswordHasher();
    }

    @Bean
    public TokenService tokenService(FilazapProperties props) {
        return new JwtTokenService(props.jwtSecret());
    }

    @Bean
    public CredentialCipher credentialCipher(FilazapProperties props) {
        return new Aes256GcmCredentialCipher(props.credentialEncryptionKey());
    }

    @Bean
    public AuditLogger auditLogger() {
        return new ConsoleAuditLogger();
    }

    @Bean
    public WahaPairingService wahaPairingService(FilazapProperties props) {
        // Pairing (QR) usa a chave global de API; o envio de mensagens continua usando a
        // chave por-canal. Conectado separadamente do WhatsAppGateway para manter o driver
        // 'meta' funcional mesmo antes de qualquer linha ser pairada pelo QR.
        return new WahaPairingService(props);
    }

    /**
     * Chooses the WhatsApp adapter by {@code filazap.whatsapp-driver}.
     *
     * <p>{@code waha} talks to a self-hosted gateway, so any phone can be paired via QR; the
     * default {@code meta} requires a WhatsApp Business number.
     */
    @Bean
    public WhatsAppGateway whatsAppGateway(FilazapProperties props) {
        if (useWaha(props)) {
            String url = props.waha() != null && props.waha().url() != null && !props.waha().url().isBlank()
                    ? props.waha().url() : "http://localhost:3000";
            boolean convertVoice = props.waha() == null || props.waha().convertVoice();
            return new WahaWhatsAppGateway(url, convertVoice);
        }
        String baseUrl = props.whatsappApiUrl() == null || props.whatsappApiUrl().isBlank()
                ? "https://graph.facebook.com/v19.0" : props.whatsappApiUrl();
        return new MetaWhatsAppGateway(baseUrl);
    }

    @Bean
    public WhatsAppWebhookParser whatsAppWebhookParser(FilazapProperties props) {
        return useWaha(props) ? new WahaWhatsAppWebhookParser() : new MetaWhatsAppWebhookParser();
    }

    @Bean
    public WebhookSignatureVerifier webhookSignatureVerifier(FilazapProperties props) {
        return useWaha(props) ? new WahaWebhookSignatureVerifier() : new MetaWebhookSignatureVerifier();
    }

    @Bean
    public PasswordResetMailer passwordResetMailer(FilazapProperties props) {
        return new ResendPasswordResetMailer(props.resend().apiKey(), props.resend().from());
    }

    @Bean
    public MediaStorage mediaStorage(FilazapProperties props) {
        boolean useSupabase = "supabase".equalsIgnoreCase(props.mediaStorageDriver())
                || (props.supabase().url() != null && !props.supabase().url().isBlank()
                && props.supabase().serviceRoleKey() != null && !props.supabase().serviceRoleKey().isBlank());
        if (useSupabase) {
            return new SupabaseMediaStorage(props.supabase().storageBucket(),
                    props.supabase().url(), props.supabase().serviceRoleKey());
        }
        return new LocalMediaStorage(props.mediaStorageRoot());
    }
}
