package com.filazap.test;

import com.filazap.application.port.WhatsAppWebhookParser;
import com.filazap.infrastructure.whatsapp.MetaWhatsAppWebhookParser;
import com.filazap.infrastructure.whatsapp.MetaWebhookSignatureVerifier;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WhatsAppParserVerifierTest {

    private static Map<String, Object> m(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) map.put((String) kv[i], kv[i + 1]);
        return map;
    }

    private final MetaWhatsAppWebhookParser parser = new MetaWhatsAppWebhookParser();

    @Test
    void extraiMensagensDeTextoEStatusDoPayloadOficial() {
        var parsed = parser.parse(m(
                "object", "whatsapp_business_account",
                "entry", List.of(m(
                        "id", "WABA_1",
                        "changes", List.of(m(
                                "value", m(
                                        "messaging_product", "whatsapp",
                                        "metadata", m("display_phone_number", "16505551111", "phone_number_id", "123456789"),
                                        "messages", List.of(m(
                                                "from", "15551234567", "id", "wamid.abc",
                                                "timestamp", "1700000001", "type", "text",
                                                "text", m("body", "Olá"))),
                                        "statuses", List.of(m("id", "wamid.def", "status", "delivered", "timestamp", "1700000010"))),
                                "field", "messages"))))));

        assertEquals("123456789", parsed.phoneNumberId());
        assertEquals(1, parsed.messages().size());
        assertEquals("wamid.abc", parsed.messages().get(0).whatsappMessageId());
        assertEquals("15551234567", parsed.messages().get(0).from());
        assertEquals("Olá", parsed.messages().get(0).body());
        assertEquals("text", parsed.messages().get(0).type());
        assertEquals(1, parsed.statuses().size());
        assertEquals("wamid.def", parsed.statuses().get(0).whatsappMessageId());
        assertEquals("delivered", parsed.statuses().get(0).status());
    }

    @Test
    void extraiCaptionEMediaIdDeImagem() {
        var parsed = parser.parse(m(
                "entry", List.of(m("changes", List.of(m(
                        "value", m(
                                "metadata", m("phone_number_id", "123456789"),
                                "messages", List.of(m(
                                        "from", "1555", "id", "wamid.img", "timestamp", "1",
                                        "type", "image", "image", m("id", "media-image", "caption", "Comprovante")))),
                        "field", "messages"))))));

        assertEquals("image", parsed.messages().get(0).type());
        assertEquals("Comprovante", parsed.messages().get(0).body());
        assertEquals("media-image", parsed.messages().get(0).mediaId());
    }

    @Test
    void extraiIdsDeAudioEDocumento() {
        var parsed = parser.parse(m(
                "entry", List.of(m("changes", List.of(m(
                        "value", m(
                                "metadata", m("phone_number_id", "123"),
                                "messages", List.of(
                                        m("from", "1555", "id", "a1", "timestamp", "1", "type", "audio",
                                                "audio", m("id", "media-audio")),
                                        m("from", "1555", "id", "d1", "timestamp", "2", "type", "document",
                                                "document", m("id", "media-document", "filename", "nota.pdf")))),
                        "field", "messages"))))));

        assertEquals("media-audio", parsed.messages().get(0).mediaId());
        assertNull(parsed.messages().get(0).body());
        assertEquals("media-document", parsed.messages().get(1).mediaId());
        assertEquals("nota.pdf", parsed.messages().get(1).body());
    }

    @Test
    void ignoraPayloadVazio() {
        var parsed = parser.parse(m("object", "whatsapp_business_account", "entry", List.of()));
        assertEquals(0, parsed.messages().size());
        assertEquals(0, parsed.statuses().size());
    }

    // ---- Assinatura HMAC ----

    private static String hmac(String secret, String body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return java.util.HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void aceitaAssinaturaCorreta() throws Exception {
        String secret = "my-app-secret";
        var verifier = new MetaWebhookSignatureVerifier();
        String body = "{\"object\":\"whatsapp\"}";
        assertTrue(verifier.verify(body, "sha256=" + hmac(secret, body), secret));
    }

    @Test
    void rejeitaAssinaturaIncorreta() {
        var verifier = new MetaWebhookSignatureVerifier();
        assertFalse(verifier.verify("{\"object\":\"whatsapp\"}", "sha256=deadbeef", "my-app-secret"));
    }

    @Test
    void rejeitaCabecalhoAusente() {
        var verifier = new MetaWebhookSignatureVerifier();
        assertFalse(verifier.verify("{}", "", "my-app-secret"));
    }

    @Test
    void rejeitaSecretAusente() {
        var verifier = new MetaWebhookSignatureVerifier();
        assertFalse(verifier.verify("{}", "sha256=deadbeef", null));
        assertFalse(verifier.verify("{}", "sha256=deadbeef", ""));
    }
}
