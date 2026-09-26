package com.filazap.infrastructure.whatsapp;

import com.filazap.application.port.WhatsAppWebhookParser;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Parser para webhooks WAHA.
 *
 * <p>WAHA posts an envelope {@code {event, session, me, payload, engine, ...}}. The port
 * expects a flat Meta-ish shape, so this class adapts:
 * <ul>
 *   <li>{@code phoneNumberId} ← envelope {@code session} (the pairing name; see
 *       {@link WhatsAppGateway} docs for the column mapping).</li>
 *   <li>{@code businessAccountId} ← {@code me.id} (JID of the paired phone).</li>
 *   <li>{@code message} / {@code message.any} → messages; {@code message.ack} → statuses.</li>
 * </ul>
 *
 * <h2>Three things that would otherwise be silent bugs</h2>
 * <ol>
 *   <li><b>fromMe</b>: WAHA echoes messages sent by the paired phone itself. Those must not
 *       open tickets, so messages with {@code fromMe == true} are dropped.</li>
 *   <li><b>type</b>: WAHA's payload has no {@code type} field (unlike Meta). It is derived
 *       from {@code media.mimetype}, falling back to {@code text}.</li>
 *   <li><b>timestamp</b>: WAHA mixes seconds ({@code payload.timestamp}) and milliseconds
 *       (envelope), and some engines emit floats. {@link #epochSeconds} normalizes all of
 *       them to integer seconds, which is what {@code Instant.ofEpochSecond} expects.</li>
 * </ol>
 */
public class WahaWhatsAppWebhookParser implements WhatsAppWebhookParser {

    /** WAHA ack vocabulary → the app's provider_status vocabulary (Meta-compatible). */
    private static final Map<String, String> ACK_TO_STATUS = Map.of(
            "ERROR", "failed",
            "PENDING", "pending",
            "SERVER", "sent",
            "DEVICE", "delivered",
            "READ", "read",
            "PLAYED", "played");

    private static final List<String> MESSAGE_EVENTS = List.of("message", "message.any");

    @Override
    public ParsedWebhook parse(Map<String, Object> payload) {
        String phoneNumberId = str(payload.get("session"));
        String businessAccountId = jidOf(payload.get("me"));

        String event = str(payload.get("event"));
        Map<String, Object> body = asMap(payload.get("payload"));

        List<ParsedWebhookMessage> messages = new ArrayList<>();
        List<ParsedWebhookStatus> statuses = new ArrayList<>();

        if (event != null && MESSAGE_EVENTS.contains(event) && body != null) {
            // WAHA echoes our own outbound messages; they must not create inbound tickets.
            if (!isFromMe(body)) {
                String from = normalizeJid(body.get("from"));
                if (from != null) {
                    messages.add(new ParsedWebhookMessage(
                            str(body.get("id")),
                            from,
                            epochSeconds(body.get("timestamp")),
                            deriveType(body),
                            bodyOf(body),
                            mediaIdOf(body)));
                }
            }
        } else if ("message.ack".equals(event) && body != null) {
            // Map.of() is immutable and throws NPE on a null key lookup, not just a null value.
            String ackName = str(body.get("ackName"));
            String status = ackName == null ? null : ACK_TO_STATUS.get(ackName);
            if (status == null) {
                status = statusFromAckCode(body.get("ack"));
            }
            statuses.add(new ParsedWebhookStatus(str(body.get("id")), status,
                    epochSeconds(body.get("timestamp"))));
        }

        return new ParsedWebhook(businessAccountId, phoneNumberId, messages, statuses);
    }

    /**
     * WAHA gives no {@code type}: text when there is no media, otherwise from the mimetype.
     * {@code hasMedia:true} with a null url keeps type as media but mediaId null, and the
     * use case stores the row without a file (see ReceiveWhatsAppMessage.downloadMedia).
     */
    private String deriveType(Map<?, ?> body) {
        if (isLocation(body)) return "location";
        if (!truthy(body.get("hasMedia"))) return "text";
        Map<?, ?> media = asMap(body.get("media"));
        String mimetype = media == null ? null : str(media.get("mimetype"));
        if (mimetype == null) return "document";
        if (mimetype.startsWith("image/")) return "image";
        if (mimetype.startsWith("audio/")) return "audio";
        if (mimetype.startsWith("video/")) return "video";
        return "document";
    }

    /**
     * Location messages carry the coordinates in {@code payload.location} and put the map
     * thumbnail as base64 in {@code payload.body} — storing that raw would blow up the row.
     * We replace it with a Google Maps link so the UI can render it.
     */
    private String bodyOf(Map<?, ?> body) {
        Map<?, ?> location = asMap(body.get("location"));
        if (location != null) {
            Object latitude = location.get("latitude");
            Object longitude = location.get("longitude");
            if (latitude != null && longitude != null) {
                return "https://www.google.com/maps?q=" + latitude + "," + longitude;
            }
        }
        return str(body.get("body"));
    }

    private boolean isLocation(Map<?, ?> body) {
        Map<?, ?> location = asMap(body.get("location"));
        return location != null && location.get("latitude") != null && location.get("longitude") != null;
    }

    /** The absolute media URL is the mediaId for WAHA (no upload ids exist). */
    private String mediaIdOf(Map<?, ?> body) {
        if (isLocation(body)) return null;
        if (!truthy(body.get("hasMedia"))) return null;
        Object media = body.get("media");
        if (!(media instanceof Map<?, ?> m)) return null;
        return str(m.get("url"));
    }

    /**
     * Strips the JID domain so {@code PhoneNumberE164.create} receives bare digits.
     *
     * <p>Group messages ({@code @g.us}) are dropped rather than collapsed to a bogus phone
     * number: the ticket model here is one contact per conversation.
     *
     * <p>{@code @lid} (Linked ID) is kept with its domain: it carries no phone number, so the
     * use case must resolve it via the gateway (or reply to the LID itself) — collapsing it to
     * bare digits would store a fake phone number and break replies.
     */
    private String normalizeJid(Object value) {
        String jid = str(value);
        if (jid == null || jid.isBlank()) return null;
        int at = jid.indexOf('@');
        if (at < 0) return jid;
        String local = jid.substring(0, at);
        String domain = jid.substring(at + 1);
        if ("g.us".equals(domain)) return null;
        if ("lid".equals(domain)) return local + "@lid";
        return local;
    }

    private String jidOf(Object value) {
        if (value instanceof Map<?, ?> m) return str(m.get("id"));
        return null;
    }

    private boolean isFromMe(Map<?, ?> body) {
        return body.get("fromMe") == Boolean.TRUE;
    }

    private boolean truthy(Object value) {
        return value == Boolean.TRUE;
    }

    private String statusFromAckCode(Object ack) {
        Integer code = asInt(ack);
        if (code == null) return null;
        return switch (code) {
            case -1 -> "failed";
            case 0 -> "pending";
            case 1 -> "sent";
            case 2 -> "delivered";
            case 3 -> "read";
            case 4 -> "played";
            default -> null;
        };
    }

    /**
     * Normalizes WAHA's mixed timestamps to integer <b>seconds</b>.
     * Handles Integer, Long, Double (1667561485.853) and numeric Strings; values that look
     * like milliseconds (> 1e12) are divided by 1000.
     */
    private String epochSeconds(Object value) {
        if (value == null) return null;
        Long raw = asLong(value);
        if (raw == null) return null;
        if (raw > 1_000_000_000_000L) raw = raw / 1000L;
        return String.valueOf(raw);
    }

    private Long asLong(Object value) {
        if (value instanceof Number n) return (long) Math.floor(n.doubleValue());
        String text = str(value);
        if (text == null || text.isBlank()) return null;
        try {
            return (long) Math.floor(Double.parseDouble(text));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer asInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        String text = str(value);
        if (text == null) return null;
        try {
            return Integer.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> typed = (Map<String, Object>) m;
            return typed;
        }
        return null;
    }

    private String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
