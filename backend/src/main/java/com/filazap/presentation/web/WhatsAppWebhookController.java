package com.filazap.presentation.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.filazap.application.port.CredentialCipher;
import com.filazap.application.port.WhatsAppChannelRepository;
import com.filazap.application.port.WebhookSignatureVerifier;
import com.filazap.application.port.WhatsAppWebhookParser;
import com.filazap.application.usecase.ReceiveWhatsAppMessage;
import com.filazap.application.usecase.VerifyWebhook;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/webhooks/whatsapp")
public class WhatsAppWebhookController {
    private final VerifyWebhook verifyWebhook;
    private final ReceiveWhatsAppMessage receiveWhatsAppMessage;
    private final WhatsAppWebhookParser parser;
    private final WebhookSignatureVerifier signatureVerifier;
    private final WhatsAppChannelRepository channels;
    private final CredentialCipher cipher;
    private final ObjectMapper objectMapper;

    public WhatsAppWebhookController(VerifyWebhook verifyWebhook,
                                     ReceiveWhatsAppMessage receiveWhatsAppMessage,
                                     WhatsAppWebhookParser parser,
                                     WebhookSignatureVerifier signatureVerifier,
                                     WhatsAppChannelRepository channels,
                                     CredentialCipher cipher,
                                     ObjectMapper objectMapper) {
        this.verifyWebhook = verifyWebhook;
        this.receiveWhatsAppMessage = receiveWhatsAppMessage;
        this.parser = parser;
        this.signatureVerifier = signatureVerifier;
        this.channels = channels;
        this.cipher = cipher;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<String> verify(@RequestParam(value = "hub.mode", required = false) String mode,
                                         @RequestParam(value = "hub.verify_token", required = false) String verifyToken,
                                         @RequestParam(value = "hub.challenge", required = false) String challenge) {
        var result = verifyWebhook.execute(mode == null ? "" : mode,
                verifyToken == null ? "" : verifyToken, challenge == null ? "" : challenge);
        if (!(Boolean) result.get("valid")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Verificação falhou");
        }
        return ResponseEntity.ok(challenge);
    }

    /**
     * Accepts both provider signature headers: Meta posts {@code X-Hub-Signature-256}
     * (SHA-256) and WAHA posts {@code X-Webhook-Hmac} (SHA-512). The driver-specific verifier
     * bean decides which one validates, so the controller never branches on the driver.
     */
    @PostMapping
    public ResponseEntity<?> receive(@RequestBody String rawBody,
                                    @RequestHeader(value = "x-hub-signature-256", required = false) String hubSignature,
                                    @RequestHeader(value = "x-webhook-hmac", required = false) String wahaSignature) {
        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(rawBody, new TypeReference<>() {});
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Payload inválido."));
        }

        var parsed = parser.parse(payload);
        if (parsed.phoneNumberId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Channel id not found in payload."));
        }

        var channel = channels.findByPhoneNumberId(parsed.phoneNumberId());
        if (channel == null || channel.getAppSecretEncrypted() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Canal não configurado."));
        }

        String appSecret = cipher.decrypt(channel.getAppSecretEncrypted());
        String signature = firstNonBlank(hubSignature, wahaSignature);
        if (!signatureVerifier.verify(rawBody, signature, appSecret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Assinatura inválida."));
        }

        try {
            return ResponseEntity.ok(receiveWhatsAppMessage.execute(payload));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage() == null ? "Erro interno." : e.getMessage()));
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }
}
