package com.filazap.infrastructure.whatsapp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.filazap.application.port.WhatsAppGateway;
import com.filazap.domain.error.SendMessageFailedError;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

public class MetaWhatsAppGateway implements WhatsAppGateway {
    private static final int MAX_MEDIA_BYTES = 16 * 1024 * 1024;

    private final String baseUrl;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();
    private final ObjectMapper mapper = new ObjectMapper();

    public MetaWhatsAppGateway(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Override
    public SendMessageResult sendText(SendMessageCommand command) {
        String url = baseUrl + "/" + command.channel().phoneNumberId() + "/messages";
        String body = json("messaging_product", "whatsapp",
                "to", command.to(), "type", "text", "text", json("body", command.body()));
        JsonNode data = postJson(url, command.channel().accessToken(), body);
        return resultFrom(data);
    }

    @Override
    public UploadMediaResult uploadMedia(UploadMediaCommand command) {
        if (command.data().length > MAX_MEDIA_BYTES) {
            throw new SendMessageFailedError("arquivo excede o tamanho máximo permitido (16 MB)");
        }
        String url = baseUrl + "/" + command.channel().phoneNumberId() + "/media";
        String boundary = "----filazap" + UUID.randomUUID();
        byte[] multipart = buildMultipart(boundary, command.filename(), command.mimeType(), command.data());
        JsonNode data = postMultipart(url, command.channel().accessToken(), boundary, multipart);
        String fileId = data.path("id").asText(null);
        if (fileId == null) {
            throw new SendMessageFailedError("resposta sem id de mídia");
        }
        return new UploadMediaResult(fileId);
    }

    @Override
    public SendMessageResult sendMedia(SendMediaCommand command) {
        String url = baseUrl + "/" + command.channel().phoneNumberId() + "/messages";
        boolean captionable = "image".equals(command.mediaType()) || "document".equals(command.mediaType());
        String caption = (command.caption() != null && !command.caption().trim().isEmpty())
                ? command.caption().trim() : null;
        Object mediaObj = captionable && caption != null
                ? json("id", command.fileId(), "caption", caption)
                : json("id", command.fileId());
        String body = json("messaging_product", "whatsapp", "to", command.to(),
                "type", command.mediaType(), command.mediaType(), mediaObj);
        JsonNode data = postJson(url, command.channel().accessToken(), body);
        return resultFrom(data);
    }

    @Override
    public FetchMediaResult fetchMedia(FetchMediaCommand command) {
        String url = baseUrl + "/" + command.mediaId();
        JsonNode data = getJson(url, command.channel().accessToken());
        String downloadUrl = data.path("url").asText(null);
        if (downloadUrl == null) {
            throw new SendMessageFailedError("resposta de mídia sem URL de download");
        }
        byte[] bytes = getBytes(downloadUrl, command.channel().accessToken());
        if (bytes.length > MAX_MEDIA_BYTES) {
            throw new SendMessageFailedError("arquivo excede o limite de 16 MB");
        }
        String mimeType = firstNonBlank(
                data.path("mime_type").asText(null),
                data.path("mimeType").asText(null),
                "application/octet-stream");
        String filename = firstNonBlank(
                data.path("file_name").asText(null),
                data.path("fileName").asText(null));
        return new FetchMediaResult(bytes, mimeType, filename);
    }

    private SendMessageResult resultFrom(JsonNode data) {
        JsonNode messages = data.path("messages");
        String id = messages.isArray() && messages.size() > 0
                ? messages.get(0).path("id").asText(null) : null;
        if (id == null) {
            throw new SendMessageFailedError("resposta sem id de mensagem");
        }
        return new SendMessageResult(id);
    }

    private JsonNode postJson(String url, String accessToken, String body) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + accessToken)
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new SendMessageFailedError("HTTP " + response.statusCode() + ": " + response.body());
            }
            return mapper.readTree(response.body());
        } catch (SendMessageFailedError e) {
            throw e;
        } catch (IOException | InterruptedException e) {
            throw new SendMessageFailedError("falha de rede: " + e.getMessage());
        }
    }

    private JsonNode postMultipart(String url, String accessToken, String boundary, byte[] multipart) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .header("Authorization", "Bearer " + accessToken)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(multipart))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new SendMessageFailedError("HTTP " + response.statusCode() + ": " + response.body());
            }
            return mapper.readTree(response.body());
        } catch (SendMessageFailedError e) {
            throw e;
        } catch (IOException | InterruptedException e) {
            throw new SendMessageFailedError("falha de rede: " + e.getMessage());
        }
    }

    private JsonNode getJson(String url, String accessToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + accessToken)
                    .GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new SendMessageFailedError("HTTP " + response.statusCode() + ": " + response.body());
            }
            return mapper.readTree(response.body());
        } catch (SendMessageFailedError e) {
            throw e;
        } catch (IOException | InterruptedException e) {
            throw new SendMessageFailedError("falha de rede: " + e.getMessage());
        }
    }

    private byte[] getBytes(String url, String accessToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + accessToken)
                    .GET().build();
            HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new SendMessageFailedError("HTTP " + response.statusCode());
            }
            return response.body();
        } catch (SendMessageFailedError e) {
            throw e;
        } catch (IOException | InterruptedException e) {
            throw new SendMessageFailedError("falha de rede: " + e.getMessage());
        }
    }

    private byte[] buildMultipart(String boundary, String filename, String mimeType, byte[] data) {
        String preamble = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"file\"; filename=\"" + sanitize(filename) + "\"\r\n"
                + "Content-Type: " + mimeType + "\r\n\r\n";
        byte[] head = preamble.getBytes(StandardCharsets.UTF_8);
        byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] result = new byte[head.length + data.length + tail.length];
        System.arraycopy(head, 0, result, 0, head.length);
        System.arraycopy(data, 0, result, head.length, data.length);
        System.arraycopy(tail, 0, result, head.length + data.length, tail.length);
        return result;
    }

    private String sanitize(String value) {
        return value.replaceAll("[\"\\r\\n]", "");
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
            } else if (value instanceof Integer n) {
                node.put(key, n);
            } else if (value instanceof Long n) {
                node.put(key, n);
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

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
