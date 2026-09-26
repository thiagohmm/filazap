package com.filazap.presentation.web;

import com.filazap.application.port.MediaStorage;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.error.UnauthorizedException;
import com.filazap.presentation.security.SessionHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/organizations/{organizationId}/media")
public class MediaController {
    private static final int MAX_MEDIA_BYTES = 16 * 1024 * 1024;
    private static final Set<String> DOCUMENT_MIMES = Set.of(
            "application/pdf", "text/plain", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation");

    private static final Map<String, String> CONTENT_TYPES = Map.ofEntries(
            Map.entry(".png", "image/png"), Map.entry(".jpg", "image/jpeg"),
            Map.entry(".jpeg", "image/jpeg"), Map.entry(".gif", "image/gif"),
            Map.entry(".webp", "image/webp"), Map.entry(".pdf", "application/pdf"),
            Map.entry(".txt", "text/plain"), Map.entry(".ogg", "audio/ogg"),
            Map.entry(".oga", "audio/ogg"), Map.entry(".webm", "audio/webm"),
            Map.entry(".mp3", "audio/mpeg"), Map.entry(".wav", "audio/wav"),
            Map.entry(".m4a", "audio/mp4"), Map.entry(".doc", "application/msword"),
            Map.entry(".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry(".xls", "application/vnd.ms-excel"),
            Map.entry(".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));

    private final MediaStorage mediaStorage;
    private final OrganizationMemberRepository members;

    public MediaController(MediaStorage mediaStorage, OrganizationMemberRepository members) {
        this.mediaStorage = mediaStorage;
        this.members = members;
    }

    private void requireMembership(String organizationId) {
        var session = SessionHolder.require();
        var membership = members.findByUserAndOrganization(session.userId(), organizationId);
        if (membership == null || !membership.isActive()) {
            throw new UnauthorizedException();
        }
    }

    @GetMapping("/{*storedPath}")
    public ResponseEntity<?> serve(@PathVariable String organizationId,
                                   @PathVariable("storedPath") String storedPath,
                                   @RequestParam(value = "download", required = false) String download) {
        requireMembership(organizationId);
        // O catch-all {*storedPath} do Spring captura a barra inicial; sem removê-la o
        // startsWith abaixo falha e todo arquivo responde 400.
        String normalized = storedPath.replace("\\", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (!normalized.startsWith("media/" + organizationId + "/")
                || normalized.contains("..") || normalized.contains("\0")) {
            throw new BadRequestException("Caminho inválido.");
        }

        boolean isDownload = "1".equals(download);
        if (mediaStorage.supportsSignedReadUrl()) {
            String signedUrl = mediaStorage.createSignedReadUrl(normalized, 300, isDownload);
            return ResponseEntity.status(HttpStatus.TEMPORARY_REDIRECT)
                    .location(URI.create(signedUrl)).build();
        }

        try {
            byte[] data = mediaStorage.read(normalized);
            String ext = normalized.contains(".")
                    ? normalized.substring(normalized.lastIndexOf('.')).toLowerCase() : "";
            String contentType = CONTENT_TYPES.getOrDefault(ext, "application/octet-stream");
            String filename = normalized.substring(normalized.lastIndexOf('/') + 1)
                    .replaceAll("[\"\\r\\n]", "");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setCacheControl("private, max-age=300");
            if (isDownload) {
                headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
            }
            return new ResponseEntity<>(data, headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Arquivo não encontrado."));
        }
    }

    @PostMapping("/upload-url")
    public ResponseEntity<?> uploadUrl(@PathVariable String organizationId,
                                       @RequestBody Map<String, Object> body) {
        requireMembership(organizationId);
        String filename = Req.str(body, "filename");
        String mimeType = Req.str(body, "mimeType");
        Object sizeObj = body.get("size");

        String normalizedMime = mimeType == null ? "" : mimeType.toLowerCase().split(";")[0].trim();
        double size = sizeObj instanceof Number n ? n.doubleValue() : 0;

        boolean allowed = normalizedMime.startsWith("image/") || normalizedMime.startsWith("audio/")
                || normalizedMime.startsWith("video/")
                || DOCUMENT_MIMES.contains(normalizedMime);
        if (filename == null || filename.trim().isEmpty() || !allowed || size <= 0) {
            throw new BadRequestException("Arquivo inválido ou não suportado.");
        }
        if (size > MAX_MEDIA_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(Map.of("error", "Arquivo excede o limite de 16 MB."));
        }
        if (!mediaStorage.supportsSignedUpload()) {
            return ResponseEntity.ok(Map.of("mode", "local"));
        }
        try {
            var signed = mediaStorage.createSignedUpload(organizationId, filename.trim(), normalizedMime);
            return ResponseEntity.ok(Map.of(
                    "mode", "supabase",
                    "storedPath", signed.storedPath(),
                    "token", signed.token()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Não foi possível autorizar o upload."));
        }
    }
}
