package com.filazap.infrastructure.whatsapp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.filazap.application.port.WhatsAppGateway;
import com.filazap.domain.error.SendMessageFailedError;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

/**
 * Adapter para <a href="https://waha.devlike.pro">WAHA</a> — gateway WhatsApp self-hosted
 * that speaks the WhatsApp Web multi-device protocol, so <b>qualquer celular</b> (personal ou
 * Business) conecta via QR code. No Business Verification, no per-message fees.
 *
 * <h2>Mapping of the port onto WAHA</h2>
 * <ul>
 *   <li>{@code channel.phoneNumberId} → WAHA <b>session name</b> (chosen when pairing).</li>
 *   <li>{@code channel.accessToken} → WAHA <b>X-Api-Key</b> header (encrypted at rest).</li>
 *   <li>{@code channel.apiBaseUrl} → optional per-channel WAHA URL (multi-instance).</li>
 *   <li>{@code mediaId} → WAHA has no media ids; the webhook carries an absolute
 *       {@code payload.media.url}, and that URL <i>is</i> the mediaId.</li>
 * </ul>
 *
 * <h2>Why uploadMedia is a no-op</h2>
 * WAHA has no upload endpoint — media travels inline as base64 in the send request. So
 * {@link #uploadMedia} only validates the payload and returns {@link #INLINE_HANDLE}, and the
 * bytes reach WAHA through {@code SendMediaCommand.data()}.
 */
public class WahaWhatsAppGateway implements WhatsAppGateway {

    /** Handle returned by {@link #uploadMedia}; see the class doc for why. */
    public static final String INLINE_HANDLE = "waha:inline";

    /**
     * Objects that may carry the message id, in preference order. WAHA returns the flat
     * {@code WAMessage} from {@code sendText}, but some engines/versions wrap it as
     * {@code {"_data": {...}}} or {@code {"key": {...}}} (see devlikeapro/waha#760, #1490).
     */
    private static final String[] ID_CONTAINERS = {"", "_data", "key", "data"};

    private static final int MAX_MEDIA_BYTES = 16 * 1024 * 1024;

    private final String defaultBaseUrl;
    private final boolean convertVoice;
    private final ObjectMapper mapper = new ObjectMapper();

    public WahaWhatsAppGateway(String defaultBaseUrl, boolean convertVoice) {
        this.defaultBaseUrl = normalize(defaultBaseUrl);
        this.convertVoice = convertVoice;
    }

    @Override
    public SendMessageResult sendText(SendMessageCommand command) {
        String body = json("session", session(command.channel()),
                "chatId", chatId(command.to()),
                "text", command.body() == null ? "" : command.body());
        JsonNode data = postJson(api(command.channel(), "/api/sendText"), apiKey(command.channel()), body);
        return new SendMessageResult(requireMessageId(data));
    }

    @Override
    public UploadMediaResult uploadMedia(UploadMediaCommand command) {
        if (command.data() == null) {
            throw new SendMessageFailedError("WAHA não accepta upload de media without content");
        }
        if (command.data().length > MAX_MEDIA_BYTES) {
            throw new SendMessageFailedError("arquivo excede the maximum allowed size (16 MB)");
        }
        // WAHA doesn't upload separately: the bytes travel in sendMedia.
        return new UploadMediaResult(INLINE_HANDLE);
    }

    @Override
    public SendMessageResult sendMedia(SendMediaCommand command) {
        if (command.data() == null || command.data().length == 0) {
            throw new SendMessageFailedError(
                    "WAHA requires the file bytes inline in SendMediaCommand.data()");
        }
        if (command.data().length > MAX_MEDIA_BYTES) {
            throw new SendMessageFailedError("arquivo excede the limit of 16 MB");
        }

        String path = switch (command.mediaType()) {
            case "image" -> "/api/sendImage";
            case "audio" -> "/api/sendVoice";
            case "video" -> "/api/sendVideo";
            default -> "/api/sendFile";
        };

        String body = json("session", session(command.channel()),
                "chatId", chatId(command.to()),
                "file", rawJson(json("mimetype", command.mimeType(),
                        "filename", command.filename(),
                        "data", Base64.getEncoder().encodeToString(command.data()))),
                "caption", blankToNull(command.caption()),
                "convert", "audio".equals(command.mediaType()) ? convertVoice : null);

        JsonNode data = postJson(api(command.channel(), path), apiKey(command.channel()), body);
        return new SendMessageResult(requireMessageId(data));
    }

    @Override
    public FetchMediaResult fetchMedia(FetchMediaCommand command) {
        String url = command.mediaId();
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            throw new SendMessageFailedError(
                    "WAHA delivers media as a full URL; unexpected mediaId: " + url);
        }
        byte[] bytes = getBytes(url, apiKey(command.channel()));
        if (bytes.length > MAX_MEDIA_BYTES) {
            throw new SendMessageFailedError("arquivo excede the limit of 16 MB");
        }
        return new FetchMediaResult(bytes, guessContentType(url), filenameFrom(url));
    }

    // ---- helpers ----

    @Override
    public String resolveLid(ChannelRef channel, String lid) {
        if (lid == null || !lid.endsWith("@lid")) return null;
        String id = lid.substring(0, lid.length() - "@lid".length());
        String url = api(channel, "/api/" + session(channel) + "/lids/" + id);
        try {
            Res r = doRequest(url, "GET", apiKey(channel), null, 30);
            if (r.status() < 200 || r.status() >= 300) return null;
            JsonNode node = mapper.readTree(r.body());
            JsonNode pn = node == null ? null : node.get("pn");
            if (pn == null || pn.isNull()) return null;
            String value = pn.asText(null);
            if (value == null || value.isBlank()) return null;
            int at = value.indexOf('@');
            String digits = (at >= 0 ? value.substring(0, at) : value).replaceAll("[^0-9]", "");
            return digits.isEmpty() ? null : digits;
        } catch (Exception e) {
            // Sem número na agenda (ou API indisponível): o chamador responde usando o @lid.
            return null;
        }
    }

    private String session(ChannelRef channel) {
        if (channel.phoneNumberId() == null || channel.phoneNumberId().isBlank()) {
            throw new SendMessageFailedError("session (phoneNumberId) não configurado");
        }
        return channel.phoneNumberId();
    }

    private String apiKey(ChannelRef channel) {
        if (channel.accessToken() == null || channel.accessToken().isBlank()) {
            throw new SendMessageFailedError("WAHA API key (accessToken) não configurado");
        }
        return channel.accessToken();
    }

    private String api(ChannelRef channel, String path) {
        String base = (channel.apiBaseUrl() != null && !channel.apiBaseUrl().isBlank())
                ? normalize(channel.apiBaseUrl()) : defaultBaseUrl;
        return base + path;
    }

    /**
     * WAHA wants {@code 5511999990001@c.us}; the domain stores E.164 ({@code +55...}).
     * Anything already carrying a JID domain passes through untouched.
     *
     * <p>Public because a wrong chatId silently delivers to the wrong recipient.
     */
    public static String chatId(String to) {
        if (to == null || to.isBlank()) {
            throw new SendMessageFailedError("destination is required");
        }
        if (to.contains("@")) {
            // Already a qualified JID. A bare "@c.us" would be accepted silently and then fail
            // deep inside WAHA, so require at least one digit before the "@".
            if (!to.substring(0, to.indexOf('@')).matches(".*[0-9].*")) {
                throw new SendMessageFailedError("destination JID invalid: " + to);
            }
            return to;
        }
        String digits = to.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) {
            throw new SendMessageFailedError("destination number invalid: " + to);
        }
        return digits + "@c.us";
    }

    private static String normalize(String url) {
        String value = url == null || url.isBlank() ? "http://localhost:3000" : url.trim();
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * WAHA's send responses are <b>not uniform</b> across engines and versions: {@code sendText}
     * historically returns the raw {@code WAMessage} ({@code {"id": ...}}), while other builds
     * wrap it as {@code {"_data": {"id": ...}}} or {@code {"key": {"id": ...}}}.
     *
     * <p>We probe the known shapes, then fall back to a synthetic id. Throwing here would be
     * <b>wrong</b>: the request already returned 2xx, so the message <i>left</i> the gateway.
     * Raising {@link SendMessageFailedError} would drop the {@code Message} row entirely
     * ({@link com.filazap.application.usecase.SendMessage} saves only after a successful return),
     * the agent would see an error and retry — sending the customer the same message twice. A
     * synthetic id costs us only the delivery/read acks, which reference the provider id.
     */
    public static String requireMessageId(JsonNode data) {
        if (data == null) return localMessageId();
        for (String container : ID_CONTAINERS) {
            JsonNode node = container.isEmpty() ? data : data.get(container);
            if (node == null || !node.isObject()) continue;
            JsonNode id = node.get("id");
            if (id == null) continue;
            String text = id.asText(null);
            if (text != null && !text.isBlank()) return text;
        }
        // 2xx means WAHA accepted the message; keep a local id rather than losing the row.
        return localMessageId();
    }

    private static String localMessageId() {
        return "waha-local-" + UUID.randomUUID();
    }

    private record Res(int status, byte[] body) {
    }

    private JsonNode postJson(String url, String wahaApiKey, String body) {
        Res r = doRequest(url, "POST", wahaApiKey, body.getBytes(StandardCharsets.UTF_8), 30);
        if (r.status() < 200 || r.status() >= 300) {
            throw new SendMessageFailedError(
                    "WAHA " + url + " → HTTP " + r.status() + ": " + bodyText(r.body()));
        }
        return parseJson(r.body(), url);
    }

    private byte[] getBytes(String url, String wahaApiKey) {
        Res r = doRequest(url, "GET", wahaApiKey, null, 60);
        if (r.status() < 200 || r.status() >= 300) {
            throw new SendMessageFailedError(
                    "WAHA " + url + " → HTTP " + r.status() + ": " + bodyText(r.body()));
        }
        return r.body();
    }

    /**
     * Request HTTP via {@link HttpURLConnection}. O {@code java.net.http.HttpClient} não fala
     * com o WAHA (devolve {@code HTTP/1.1 header parser received no bytes}), então usamos a
     * mesma transport do {@link WahaPairingService}.
     */
    private Res doRequest(String url, String method, String wahaApiKey, byte[] body, int timeoutSec) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URI(url).toURL().openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(timeoutSec * 1000);
            conn.setReadTimeout(timeoutSec * 1000);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("X-Api-Key", wahaApiKey);
            if (body != null) {
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);
                conn.setFixedLengthStreamingMode(body.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body);
                }
            }
            int status = conn.getResponseCode();
            InputStream is = (status >= 200 && status < 300)
                    ? conn.getInputStream() : conn.getErrorStream();
            byte[] resp = is == null ? new byte[0] : is.readAllBytes();
            return new Res(status, resp);
        } catch (SendMessageFailedError e) {
            throw e;
        } catch (Exception e) {
            throw new SendMessageFailedError("network failure talking to WAHA: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private JsonNode parseJson(byte[] body, String url) {
        try {
            return mapper.readTree(body);
        } catch (Exception e) {
            throw new SendMessageFailedError("WAHA returned a response that is not JSON: " + url);
        }
    }

    private String bodyText(Object body) {
        if (body == null) return "";
        String text = body instanceof byte[] bytes
                ? new String(bytes, StandardCharsets.UTF_8) : String.valueOf(body);
        return text.length() > 500 ? text.substring(0, 500) : text;
    }

    /** Content-type comes from the URL extension — WAHA serves the file directly. */
    private String guessContentType(String url) {
        String path = url;
        int q = path.indexOf('?');
        if (q >= 0) path = path.substring(0, q);
        int dot = path.lastIndexOf('.');
        if (dot < 0 || dot < path.lastIndexOf('/')) return "application/octet-stream";
        return switch (path.substring(dot + 1).toLowerCase()) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "ogg", "opus" -> "audio/ogg";
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            case "mp4" -> "video/mp4";
            case "pdf" -> "application/pdf";
            case "txt" -> "text/plain";
            default -> "application/octet-stream";
        };
    }

    private String filenameFrom(String url) {
        String path = url;
        int q = path.indexOf('?');
        if (q >= 0) path = path.substring(0, q);
        String name = path.substring(path.lastIndexOf('/') + 1);
        return name.isBlank() ? null : name;
    }

    private String json(Object... kv) {
        var node = mapper.createObjectNode();
        for (int i = 0; i < kv.length; i += 2) {
            String key = (String) kv[i];
            Object value = kv[i + 1];
            if (value == null) {
                node.putNull(key);
            } else if (value instanceof String s) {
                node.put(key, s);
            } else if (value instanceof Boolean b) {
                node.put(key, b);
            } else if (value instanceof JsonNode n) {
                node.set(key, n);
            } else {
                node.put(key, String.valueOf(value));
            }
        }
        return node.toString();
    }

    /** Embed an already-serialized JSON fragment as a value. */
    private JsonNode rawJson(String serialized) {
        try {
            return mapper.readTree(serialized);
        } catch (Exception e) {
            throw new SendMessageFailedError("failed to serialize media payload");
        }
    }
}
