package com.filazap.infrastructure.whatsapp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.filazap.config.FilazapProperties;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Adapter de <b>pairing</b> com o WAHA: cria/inicia a sessão, devolve o QR code de
 * conexão e consulta o estado de pareamento. Diferente do
 * {@link WahaWhatsAppGateway} (que envia mensagens por uma sessão já pairada), este
 * serviço opera <i>antes</i> de existir um canal: usa a chave de API global
 * ({@link FilazapProperties#waha()}) e o nome da sessão como identificador.
 *
 * <p>Fluxo concreto (WAHA 2026.8.2, engine WEBJS):
 * <ul>
 *   <li>criar+iniciar: {@code POST /api/sessions/}  body {@code {"name":..,"start":true}}</li>
 *   <li>QR:             {@code GET  /api/{session}/auth/qr}  → imagem PNG</li>
 *   <li>estado:         {@code GET  /api/sessions/{session}} → {@code {status, engine.state, me}}</li>
 * </ul>
 *
 * <p><b>Nota de transport:</b> usa {@link HttpURLConnection} em vez de
 * {@code java.net.http.HttpClient}: esta última devolve
 * {@code HTTP/1.1 header parser received no bytes} contra o WAHA (o servidor aceita o
 * TCP mas não responde ao framing do novo cliente), enquanto {@link HttpURLConnection}
 * funciona normalmente.
 */
public class WahaPairingService {

    private record Res(int status, byte[] body) {}

    private final String baseUrl;
    private final String apiKey;
    private final ObjectMapper mapper = new ObjectMapper();

    public WahaPairingService(FilazapProperties props) {
        FilazapProperties.Waha waha = props.waha();
        this.baseUrl = normalize(waha != null && waha.url() != null && !waha.url().isBlank()
                ? waha.url() : "http://localhost:3000");
        this.apiKey = waha != null ? waha.apiKey() : null;
    }

    /** Chave de API global do WAHA (exposta ao frontend só para registrar o canal pairado). */
    public String apiKeyForFrontend() {
        return apiKey;
    }

    /**
     * Garante que a sessão existe e está iniciando. Idempotente: se a sessão já existir,
     * o WAHA responde 400/409 na criação — nesse caso apenas confirmamos que está ativa.
     *
     * @return o nome da sessão (pronto para QR/status)
     */
    public String ensureSession(String sessionName) {
        if (sessionName == null || sessionName.isBlank()) {
            throw new IllegalArgumentException("nome da sessão não informado");
        }
        String name = sessionName.trim();
        Res r = doRequest(createUrl(), "POST",
                Map.of("Content-Type", "application/json", "X-Api-Key", apiKeyOrNull()),
                json("name", name, "start", true).getBytes(StandardCharsets.UTF_8), 60);
        // 201 = criada; 400/409/422 = já existe (WAHA usa 422: "already exists. Use PUT")
        // — em ambos os casos servimos o QR.
        if (r.status() >= 200 && r.status() < 300) {
            return name;
        }
        if (r.status() == 400 || r.status() == 409 || r.status() == 422) {
            return name;
        }
        throw new WahaPairingException("WAHA " + createUrl() + " → HTTP " + r.status()
                + ": " + bodyText(r.body()));
    }

    /**
     * Devolve o QR code como bytes PNG.
     */
    public byte[] getQr(String sessionName) {
        ensureSession(sessionName);
        Res r = doRequest(qrUrl(sessionName), "GET", Map.of("X-Api-Key", apiKeyOrNull()), null, 30);
        if (r.status() >= 200 && r.status() < 300) {
            return r.body();
        }
        throw new WahaPairingException("WAHA QR HTTP " + r.status() + ": " + bodyText(r.body()));
    }

    /**
     * Estado de pareamento normalizado para o frontend.
     *
     * @return mapa com {@code status} (SCAN_QR_CODE/CONNECTED/...), {@code state}
     *         (engine.state), {@code connected} (bool) e {@code me} (dados do número pairado)
     */
    public Map<String, Object> getStatus(String sessionName) {
        String raw = getSessionRaw(sessionName);
        if (raw == null) {
            // Sessão ainda não criada/iniciada: cria e tenta de novo (1 vez).
            ensureSession(sessionName);
            raw = getSessionRaw(sessionName);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        JsonNode node;
        try {
            node = mapper.readTree(raw);
        } catch (Exception e) {
            out.put("raw", raw);
            out.put("connected", false);
            return out;
        }
        String status = str(node, "status");
        JsonNode engine = node.get("engine");
        String state = engine != null && engine.isObject() ? str(engine, "state") : null;
        JsonNode me = node.get("me");
        boolean connected = "CONNECTED".equalsIgnoreCase(status)
                || "CONNECTED".equalsIgnoreCase(state)
                || (me != null && me.isObject() && !me.get("phone").isNull());
        out.put("status", status);
        out.put("state", state);
        out.put("connected", connected);
        out.put("me", me != null ? me : null);
        return out;
    }

    /** Encerra a sessão (despaira) — usada pelo botão "Desconectar". */
    public void logout(String sessionName) {
        Res r = doRequest(logoutUrl(sessionName), "POST", Map.of("X-Api-Key", apiKeyOrNull()), null, 15);
        if (r.status() < 200 || r.status() >= 500) {
            throw new WahaPairingException("WAHA logout HTTP " + r.status() + ": " + bodyText(r.body()));
        }
    }

    // ---- helpers ----

    /** Request HTTP genérico via {@link HttpURLConnection}. */
    private Res doRequest(String url, String method, Map<String, String> headers,
                          byte[] body, int timeoutSec) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URI(url).toURL().openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(timeoutSec * 1000);
            conn.setReadTimeout(timeoutSec * 1000);
            conn.setInstanceFollowRedirects(false);
            if (headers != null) {
                headers.forEach(conn::setRequestProperty);
            }
            if (body != null) {
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
        } catch (Exception e) {
            if (e instanceof InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new WahaPairingException("request ao WAHA interrompido: " + url);
            }
            throw new WahaPairingException("falha de rede falando com WAHA: " + e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private String createUrl() {
        return baseUrl + "/api/sessions/";
    }

    private String qrUrl(String sessionName) {
        return baseUrl + "/api/" + sessionName + "/auth/qr";
    }

    private String sessionUrl(String sessionName) {
        return baseUrl + "/api/sessions/" + sessionName;
    }

    private String logoutUrl(String sessionName) {
        return baseUrl + "/api/sessions/" + sessionName + "/logout";
    }

    private String apiKeyOrNull() {
        return apiKey == null || apiKey.isBlank() ? null : apiKey;
    }

    /**
     * GET da sessão: devolve o body JSON ou {@code null} quando a sessão ainda não existe
     * (404/422) — assim o poll de status não re-inicia a sessão a cada chamada.
     */
    private String getSessionRaw(String sessionName) {
        Res r = doRequest(sessionUrl(sessionName), "GET", Map.of("X-Api-Key", apiKeyOrNull()), null, 15);
        if (r.status() >= 200 && r.status() < 300) {
            return new String(r.body(), StandardCharsets.UTF_8);
        }
        return null;
    }

    private static String str(JsonNode node, String field) {
        if (node == null || !node.isObject()) return null;
        JsonNode v = node.get(field);
        return v == null ? null : v.asText(null);
    }

    private String json(Object... kv) {
        var node = mapper.createObjectNode();
        for (int i = 0; i < kv.length; i += 2) {
            Object value = kv[i + 1];
            if (value == null) {
                node.putNull((String) kv[i]);
            } else if (value instanceof String s) {
                node.put((String) kv[i], s);
            } else if (value instanceof Boolean b) {
                node.put((String) kv[i], b);
            } else {
                node.put((String) kv[i], String.valueOf(value));
            }
        }
        return node.toString();
    }

    private static String normalize(String url) {
        String value = url == null || url.isBlank() ? "http://localhost:3000" : url.trim();
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static String bodyText(Object body) {
        if (body == null) return "";
        String text = body instanceof byte[] bytes
                ? new String(bytes, StandardCharsets.UTF_8) : String.valueOf(body);
        return text.length() > 400 ? text.substring(0, 400) : text;
    }
}
