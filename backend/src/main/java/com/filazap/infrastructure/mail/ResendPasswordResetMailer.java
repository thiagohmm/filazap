package com.filazap.infrastructure.mail;

import com.filazap.application.port.PasswordResetMailer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class ResendPasswordResetMailer implements PasswordResetMailer {
    private static final Logger log = LoggerFactory.getLogger(ResendPasswordResetMailer.class);

    private final String apiKey;
    private final String from;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();

    public ResendPasswordResetMailer(String apiKey, String from) {
        this.apiKey = apiKey;
        this.from = from;
    }

    @Override
    public void send(String email, String name, String resetUrl) {
        if (apiKey == null || apiKey.isBlank() || from == null || from.isBlank()) {
            log.info("[password-reset] {}: {}", email, resetUrl);
            return;
        }

        try {
            String body = "{\"from\":\"" + escape(from) + "\",\"to\":[\"" + escape(email)
                    + "\"],\"subject\":\"Recupere sua senha do FilaZap\",\"html\":\""
                    + escape(buildHtml(name, resetUrl)) + "\"}";
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Resend respondeu com status " + response.statusCode() + ".");
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao enviar e-mail de recuperação.", e);
        }
    }

    private String buildHtml(String name, String resetUrl) {
        String safeName = escapeHtml(name);
        String safeUrl = escapeHtml(resetUrl);
        return "<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033\">"
                + "<h1 style=\"font-size:24px\">Recupere sua senha</h1>"
                + "<p>Olá, " + safeName + ".</p>"
                + "<p>Recebemos uma solicitação para redefinir sua senha do FilaZap.</p>"
                + "<p style=\"margin:28px 0\"><a href=\"" + safeUrl + "\" style=\"background:#10b981;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold\">Criar nova senha</a></p>"
                + "<p>Este link expira em 30 minutos e só pode ser usado uma vez.</p>"
                + "<p style=\"color:#6c788d;font-size:12px\">Se você não solicitou a alteração, ignore este e-mail.</p>"
                + "</div>";
    }

    private String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("'", "&#39;").replace("\"", "&quot;");
    }

    private String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
