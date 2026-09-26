package com.filazap.test;

import com.filazap.application.port.WhatsAppGateway;
import com.filazap.domain.error.SendMessageFailedError;
import com.filazap.infrastructure.whatsapp.WahaWhatsAppGateway;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for {@link WahaWhatsAppGateway} that need no network: the JID mapping and the
 * guards that must fire <b>before</b> an HTTP call is made.
 */
class WahaGatewayTest {

    private final WahaWhatsAppGateway gateway = new WahaWhatsAppGateway("http://waha:3000", true);

    private WhatsAppGateway.ChannelRef channel() {
        return new WhatsAppGateway.ChannelRef("acme-support", "waha-api-key");
    }

    // ---- chatId: a wrong value delivers to the wrong recipient ----

    @Test
    void convertsE164ToWahaJid() {
        assertEquals("5511999990001@c.us", WahaWhatsAppGateway.chatId("+5511999990001"));
    }

    @Test
    void passesThroughAlreadyQualifiedJids() {
        assertEquals("5511999990001@c.us", WahaWhatsAppGateway.chatId("5511999990001@c.us"));
        // Group JIDs are accepted at this layer; the parser is what drops group inbound.
        assertEquals("1112223333@g.us", WahaWhatsAppGateway.chatId("1112223333@g.us"));
    }

    @Test
    void passesThroughLidJidsSoRepliesReachLidOnlyContacts() {
        // Contacts without a resolvable phone are stored as @lid; WAHA must receive the LID
        // untouched, otherwise the reply silently goes to a non-existent @c.us number.
        assertEquals("37048606048491@lid", WahaWhatsAppGateway.chatId("37048606048491@lid"));
    }

    @Test
    void resolveLidIgnoresNonLidIdentifiersWithoutTouchingTheNetwork() {
        assertNull(gateway.resolveLid(channel(), "+5511999990001"));
        assertNull(gateway.resolveLid(channel(), "5511999990001@c.us"));
        assertNull(gateway.resolveLid(channel(), null));
    }

    @Test
    void stripsSeparatorsButKeepsDigits() {
        assertEquals("5511999990001@c.us", WahaWhatsAppGateway.chatId("+55 11 9999-90001"));
    }

    @Test
    void rejectsEmptyOrNonNumericDestination() {
        assertThrows(SendMessageFailedError.class, () -> WahaWhatsAppGateway.chatId(""));
        assertThrows(SendMessageFailedError.class, () -> WahaWhatsAppGateway.chatId(null));
        assertThrows(SendMessageFailedError.class, () -> WahaWhatsAppGateway.chatId("abc"));
        assertThrows(SendMessageFailedError.class, () -> WahaWhatsAppGateway.chatId("@c.us"));
        // All-zeros is not rejected here: E.164 validation happens upstream in PhoneNumberE164,
        // which is the only caller in production code.
        assertEquals("0000@c.us", WahaWhatsAppGateway.chatId("+00 00"));
    }

    // ---- uploadMedia is intentionally a validated no-op ----

    @Test
    void uploadMediaReturnsInlineHandleBecauseWahaHasNoUploadEndpoint() {
        var result = gateway.uploadMedia(new WhatsAppGateway.UploadMediaCommand(
                channel(), new byte[] {1, 2, 3}, "image/png", "a.png"));
        assertEquals(WahaWhatsAppGateway.INLINE_HANDLE, result.fileId());
    }

    @Test
    void uploadMediaRejectsMissingContentAndOversizeFiles() {
        assertThrows(SendMessageFailedError.class, () -> gateway.uploadMedia(
                new WhatsAppGateway.UploadMediaCommand(channel(), null, "image/png", "a.png")));

        byte[] tooBig = new byte[16 * 1024 * 1024 + 1];
        assertThrows(SendMessageFailedError.class, () -> gateway.uploadMedia(
                new WhatsAppGateway.UploadMediaCommand(channel(), tooBig, "image/png", "a.png")));
    }

    // ---- guards that must fire before any HTTP call ----

    @Test
    void sendMediaRequiresBytesInline() {
        assertThrows(SendMessageFailedError.class, () -> gateway.sendMedia(
                new WhatsAppGateway.SendMediaCommand(channel(), "+5511999990001",
                        WahaWhatsAppGateway.INLINE_HANDLE, "image/png", "a.png",
                        null, "image", null)));

        assertThrows(SendMessageFailedError.class, () -> gateway.sendMedia(
                new WhatsAppGateway.SendMediaCommand(channel(), "+5511999990001",
                        WahaWhatsAppGateway.INLINE_HANDLE, "image/png", "a.png",
                        null, "image", new byte[0])));
    }

    @Test
    void sendMediaRejectsOversizeFile() {
        byte[] tooBig = new byte[16 * 1024 * 1024 + 1];
        assertThrows(SendMessageFailedError.class, () -> gateway.sendMedia(
                new WhatsAppGateway.SendMediaCommand(channel(), "+5511999990001",
                        WahaWhatsAppGateway.INLINE_HANDLE, "video/mp4", "v.mp4",
                        null, "video", tooBig)));
    }

    @Test
    void fetchMediaRejectsMediaIdThatIsNotAFullUrl() {
        // WAHA hands out absolute URLs; a bare id means the wrong parser produced this payload.
        assertThrows(SendMessageFailedError.class, () -> gateway.fetchMedia(
                new WhatsAppGateway.FetchMediaCommand(channel(), "3EB1234ABC")));
        assertThrows(SendMessageFailedError.class, () -> gateway.fetchMedia(
                new WhatsAppGateway.FetchMediaCommand(channel(), null)));
    }

    @Test
    void sendTextRequiresSessionAndApiKeyBeforeReachingTheNetwork() {
        assertThrows(SendMessageFailedError.class, () -> gateway.sendText(
                new WhatsAppGateway.SendMessageCommand(
                        new WhatsAppGateway.ChannelRef(null, "key"), "+5511999990001", "text", "hi")));

        assertThrows(SendMessageFailedError.class, () -> gateway.sendText(
                new WhatsAppGateway.SendMessageCommand(
                        new WhatsAppGateway.ChannelRef("  ", "key"), "+5511999990001", "text", "hi")));

        assertThrows(SendMessageFailedError.class, () -> gateway.sendText(
                new WhatsAppGateway.SendMessageCommand(
                        new WhatsAppGateway.ChannelRef("s", null), "+5511999990001", "text", "hi")));
    }

    @Test
    void findsTheMessageIdAcrossTheResponseShapesWahaActuallyReturns() throws Exception {
        // sendText returns the flat WAMessage; some engines/versions wrap it.
        assertEquals("AAA", WahaWhatsAppGateway.requireMessageId(parse("""
                {"id":"AAA"}""")));
        assertEquals("AAA", WahaWhatsAppGateway.requireMessageId(parse("""
                {"_data":{"id":"AAA"}}""")));
        assertEquals("AAA", WahaWhatsAppGateway.requireMessageId(parse("""
                {"key":{"id":"AAA"}}""")));
        assertEquals("AAA", WahaWhatsAppGateway.requireMessageId(parse("""
                {"data":{"id":"AAA"}}""")));
    }

    @Test
    void missingIdFallsBackToLocalIdInsteadOfThrowingAfterA2xx() throws Exception {
        // The request already succeeded: throwing would lose the Message row and invite a
        // duplicate send to the customer. We only give up the delivery/read acks.
        String id = WahaWhatsAppGateway.requireMessageId(parse("{}"));
        assertTrue(id.startsWith("waha-local-"));

        // An empty-string id must not be stored as the providerMessageId.
        String blank = WahaWhatsAppGateway.requireMessageId(parse("""
                {"id":"  "}"""));
        assertTrue(blank.startsWith("waha-local-"));
    }

    @Test
    void implementsTheWhatsAppGatewayPort() {
        assertTrue(gateway instanceof WhatsAppGateway);
    }

    private static com.fasterxml.jackson.databind.JsonNode parse(String json) throws Exception {
        return new com.fasterxml.jackson.databind.ObjectMapper().readTree(json);
    }
}
