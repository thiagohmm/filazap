package com.filazap.test;

import com.filazap.application.port.WhatsAppWebhookParser;
import com.filazap.infrastructure.whatsapp.WahaWebhookSignatureVerifier;
import com.filazap.infrastructure.whatsapp.WahaWhatsAppWebhookParser;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WahaWebhookParserTest {

    private static Map<String, Object> m(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) map.put((String) kv[i], kv[i + 1]);
        return map;
    }

    private final WahaWhatsAppWebhookParser parser = new WahaWhatsAppWebhookParser();

    /** Wraps a payload in the WAHA envelope. */
    private static Map<String, Object> envelope(String event, String session, Map<String, Object> payload) {
        return m("event", event, "session", session, "payload", payload);
    }

    @Test
    void extraiTextoUsandoSessionComoChannelIdEJidLocalComoTelefone() {
        var parsed = parser.parse(envelope("message", "acme-support", m(
                "id", "false_5511999990001@c.us_AAAA",
                "timestamp", 1667561485,
                "from", "5511999990001@c.us",
                "fromMe", false,
                "source", "app",
                "to", "5511999990002@c.us",
                "body", "Olá, need help",
                "hasMedia", false)));

        assertEquals("acme-support", parsed.phoneNumberId());
        assertEquals(1, parsed.messages().size());
        var message = parsed.messages().get(0);
        assertEquals("false_5511999990001@c.us_AAAA", message.whatsappMessageId());
        // JID domain is stripped so PhoneNumberE164.create gets bare digits.
        assertEquals("5511999990001", message.from());
        assertEquals("Olá, need help", message.body());
        assertEquals("text", message.type());
        assertEquals("1667561485", message.timestamp());
        assertEquals(0, parsed.statuses().size());
    }

    @Test
    void derivesTypeFromMimetypeBecauseWahaHasNoTypeField() {
        var image = parser.parse(envelope("message", "s", m(
                "id", "m1", "timestamp", 1667561485, "from", "5511999990001@c.us",
                "fromMe", false, "hasMedia", true, "body", "see this",
                "media", m("url", "http://waha.local:3000/media/s/m1/image.jpg",
                        "mimetype", "image/jpeg", "filename", "photo.jpg"))));
        assertEquals("image", image.messages().get(0).type());
        // The absolute URL *is* the mediaId for WAHA (no upload ids exist).
        assertEquals("http://waha.local:3000/media/s/m1/image.jpg", image.messages().get(0).mediaId());

        var audio = parser.parse(envelope("message", "s", m(
                "id", "m2", "timestamp", 1667561485, "from", "5511999990001@c.us",
                "fromMe", false, "hasMedia", true,
                "media", m("url", "http://waha.local:3000/media/s/m2/audio.oga", "mimetype", "audio/ogg"))));
        assertEquals("audio", audio.messages().get(0).type());

        var video = parser.parse(envelope("message", "s", m(
                "id", "m3", "timestamp", 1667561485, "from", "5511999990001@c.us",
                "fromMe", false, "hasMedia", true,
                "media", m("url", "http://waha.local:3000/media/s/m3/v.mp4", "mimetype", "video/mp4"))));
        assertEquals("video", video.messages().get(0).type());

        var doc = parser.parse(envelope("message", "s", m(
                "id", "m4", "timestamp", 1667561485, "from", "5511999990001@c.us",
                "fromMe", false, "hasMedia", true,
                "media", m("url", "http://waha.local:3000/media/s/m4/f.pdf", "mimetype", "application/pdf"))));
        assertEquals("document", doc.messages().get(0).type());
    }

    @Test
    void dropsOutboundEchoesSoSentMessagesDoNotOpenTickets() {
        // WAHA echoes messages sent by the paired phone (fromMe:true) on `message` and
        // `message.any`. Turning those into inbound tickets would let the bot talk to itself.
        var parsed = parser.parse(envelope("message.any", "s", m(
                "id", "true_5511999990001@c.us_BBBB",
                "timestamp", 1667561485,
                "from", "5511999990002@c.us",
                "fromMe", true,
                "source", "api",
                "body", "Auto-reply sent by us",
                "hasMedia", false)));

        assertEquals(0, parsed.messages().size());
        assertEquals(0, parsed.statuses().size());
    }

    @Test
    void dropsGroupMessagesInsteadOfCollapsingThemToABogusPhone() {
        var parsed = parser.parse(envelope("message", "s", m(
                "id", "false_111@g.us_CCCC",
                "timestamp", 1667561485,
                "from", "1112223333@g.us",
                "fromMe", false,
                "participant", "9999@c.us",
                "body", "group chatter",
                "hasMedia", false)));

        assertEquals(0, parsed.messages().size());
    }

    @Test
    void mapsAckVocabularyToTheAppsProviderStatusVocabulary() {
        var read = parser.parse(envelope("message.ack", "s", m(
                "id", "true_5511999990001@c.us_4CC5",
                "from", "5511999990001@c.us",
                "fromMe", true, "ack", 3, "ackName", "READ")));
        assertEquals(1, read.statuses().size());
        assertEquals("read", read.statuses().get(0).status());

        var delivered = parser.parse(envelope("message.ack", "s", m(
                "id", "m", "ack", 2, "ackName", "DEVICE")));
        assertEquals("delivered", delivered.statuses().get(0).status());

        var sent = parser.parse(envelope("message.ack", "s", m("id", "m", "ack", 1)));
        assertEquals("sent", sent.statuses().get(0).status());

        var failed = parser.parse(envelope("message.ack", "s", m("id", "m", "ack", -1)));
        assertEquals("failed", failed.statuses().get(0).status());

        var unknown = parser.parse(envelope("message.ack", "s", m("id", "m")));
        assertNull(unknown.statuses().get(0).status());
    }

    @Test
    void normalizesFloatAndMillisecondTimestampsToIntegerSeconds() {
        // Some engines emit float seconds (1710481111.853); Long.parseLong would throw.
        var asFloat = parser.parse(envelope("message", "s", m(
                "id", "m", "timestamp", 1710481111.853, "from", "5511999990001@c.us",
                "fromMe", false, "body", "hi", "hasMedia", false)));
        assertEquals("1710481111", asFloat.messages().get(0).timestamp());

        // Milliseconds must be divided by 1000, otherwise the ticket date is year 55000+.
        var asMillis = parser.parse(envelope("message", "s", m(
                "id", "m2", "timestamp", 1741249702485L, "from", "5511999990001@c.us",
                "fromMe", false, "body", "hi", "hasMedia", false)));
        assertEquals("1741249702", asMillis.messages().get(0).timestamp());

        var asString = parser.parse(envelope("message", "s", m(
                "id", "m3", "timestamp", "1667561485", "from", "5511999990001@c.us",
                "fromMe", false, "body", "hi", "hasMedia", false)));
        assertEquals("1667561485", asString.messages().get(0).timestamp());
    }

    @Test
    void keepsMediaAsMediaButWithoutMediaIdWhenWahaDidNotDownloadIt() {
        // Documented WAHA case: hasMedia true but media.url null (media not downloaded).
        var parsed = parser.parse(envelope("message", "s", m(
                "id", "m", "timestamp", 1667561485, "from", "5511999990001@c.us",
                "fromMe", false, "hasMedia", true,
                "media", m("mimetype", "image/png", "filename", "x.png", "url", null))));

        assertEquals(1, parsed.messages().size());
        assertEquals("image", parsed.messages().get(0).type());
        assertNull(parsed.messages().get(0).mediaId());
    }

    @Test
    void ignoresEventsTheTicketModelDoesNotUse() {
        var status = parser.parse(envelope("session.status", "s", m("status", "WORKING")));
        assertEquals(0, status.messages().size());
        assertEquals(0, status.statuses().size());
        assertEquals("s", status.phoneNumberId());

        var reaction = parser.parse(envelope("message.reaction", "s", m("id", "m")));
        assertEquals(0, reaction.messages().size());
        assertEquals(0, reaction.statuses().size());

        var empty = parser.parse(m("event", "unknown.event", "session", "s"));
        assertEquals(0, empty.messages().size());
        assertEquals(0, empty.statuses().size());
    }

    @Test
    void usesTypedRecordsFromThePort() {
        WhatsAppWebhookParser.ParsedWebhook parsed =
                parser.parse(envelope("message", "s", m("id", "m")));
        assertTrue(parsed.messages() instanceof List);
    }

    // ---- WAHA HMAC (sha512, X-Webhook-Hmac) ----

    private static String hmacSha512(String secret, String body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("failed to compute HMAC-SHA512", e);
        }
    }

    @Test
    void acceptsWahaHmacOverRawBody() {
        var verifier = new WahaWebhookSignatureVerifier();
        String secret = "my-secret-key";
        // Example taken from the WAHA events docs.
        String body = "{\"event\":\"message\",\"session\":\"default\",\"engine\":\"WEBJS\"}";
        assertTrue(verifier.verify(body, hmacSha512(secret, body), secret));
    }

    @Test
    void acceptsOptionalSha512Prefix() {
        var verifier = new WahaWebhookSignatureVerifier();
        String secret = "my-secret-key";
        String body = "{\"event\":\"message\"}";
        assertTrue(verifier.verify(body, "sha512=" + hmacSha512(secret, body), secret));
    }

    @Test
    void rejectsWrongSignature() {
        var verifier = new WahaWebhookSignatureVerifier();
        assertFalse(verifier.verify("{\"event\":\"message\"}", "sha512=deadbeef", "my-secret-key"));
    }

    @Test
    void rejectsMetaStyleSha256Signature() {
        // A Meta sha256 digest must never pass as a valid WAHA sha512 signature.
        var verifier = new WahaWebhookSignatureVerifier();
        String body = "{\"event\":\"message\"}";
        String sha256 = "deadbeef";
        assertFalse(verifier.verify(body, sha256, "my-secret-key"));
    }

    @Test
    void failsClosedOnMissingHeaderOrSecret() {
        var verifier = new WahaWebhookSignatureVerifier();
        assertFalse(verifier.verify("{}", "", "secret"));
        assertFalse(verifier.verify("{}", "   ", "secret"));
        assertFalse(verifier.verify("{}", "abc", null));
        assertFalse(verifier.verify("{}", "abc", ""));
        assertFalse(verifier.verify(null, "abc", "secret"));
    }

    @Test
    void rejectsTamperedBody() {
        var verifier = new WahaWebhookSignatureVerifier();
        String secret = "my-secret-key";
        String signature = hmacSha512(secret, "{\"event\":\"message\"}");
        assertFalse(verifier.verify("{\"event\":\"message\",\"session\":\"evil\"}", signature, secret));
    }
}
