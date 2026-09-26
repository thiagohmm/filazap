package com.filazap.application.port;

/**
 * Port para sending/receiving WhatsApp messages.
 *
 * <p>Adapters: {@code MetaWhatsAppGateway} (Cloud API, exige numero Business Verified) e
 * {@code WahaWhatsAppGateway} (gateway self-hosted, paira qualquer celular via QR).
 *
 * <h2>Mapping ChannelRef per adapter</h2>
 * <table>
 *   <tr><th>Port</th><th>Meta Cloud API</th><th>WAHA</th></tr>
 *   <tr><td>{@code phoneNumberId}</td><td>phone_number_id</td><td>session name</td></tr>
 *   <tr><td>{@code accessToken}</td><td>per-channel CLOUD token</td><td>X-Api-Key (per WAHA instance)</td></tr>
 *   <tr><td>{@code mediaId}</td><td>Meta media id (2-step: upload then reference)</td><td>absolute media.url from webhook</td></tr>
 * </table>
 */
public interface WhatsAppGateway {

    /**
     * Where to talk to the provider.
     *
     * <p>{@code apiBaseUrl} is optional and overrides the globally configured URL, which
     * matters for multi-instance setups (one WAHA container per client). Null means
     * "use the configured default".
     */
    record ChannelRef(String phoneNumberId, String accessToken, String apiBaseUrl) {

        /** Back-compatible constructor: use the globally configured base URL. */
        public ChannelRef(String phoneNumberId, String accessToken) {
            this(phoneNumberId, accessToken, null);
        }
    }

    record SendMessageResult(String providerMessageId) {}

    record SendMessageCommand(ChannelRef channel, String to, String type, String body) {}

    record UploadMediaCommand(ChannelRef channel, byte[] data, String mimeType, String filename) {}

    record UploadMediaResult(String fileId) {}

    /**
     * Command for sending media.
     *
     * <p>{@code data} existe porque WAHA não have a separate upload endpoint: the file travels
     * inline (base64) in the send request. Meta adapters ignore it and reference
     * {@code fileId} instead. {@code SendMessage} passes the bytes it already read from
     * {@link MediaStorage}, so no cache or temp state is needed.
     */
    record SendMediaCommand(ChannelRef channel, String to, String fileId, String mimeType,
                            String filename, String caption, String mediaType, byte[] data) {

        /** Back-compatible constructor (Meta path). */
        public SendMediaCommand(ChannelRef channel, String to, String fileId, String mimeType,
                                String filename, String caption, String mediaType) {
            this(channel, to, fileId, mimeType, filename, caption, mediaType, null);
        }
    }

    record FetchMediaCommand(ChannelRef channel, String mediaId) {}

    record FetchMediaResult(byte[] data, String mimeType, String filename) {}

    SendMessageResult sendText(SendMessageCommand command);

    UploadMediaResult uploadMedia(UploadMediaCommand command);

    SendMessageResult sendMedia(SendMediaCommand command);

    FetchMediaResult fetchMedia(FetchMediaCommand command);

    /**
     * Resolve um {@code @lid} (Linked ID do WhatsApp) para o telefone E.164 (somente dígitos).
     *
     * <p>O WAHA só consegue resolver quando o contato está na agenda do celular pareado; caso
     * contrário devolve {@code null} e o chamador deve responder usando o próprio {@code @lid}.
     * Adapters que não usam LID (Meta) mantêm o default {@code null}.
     */
    default String resolveLid(ChannelRef channel, String lid) {
        return null;
    }
}
