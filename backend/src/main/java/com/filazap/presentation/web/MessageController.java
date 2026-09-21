package com.filazap.presentation.web;

import com.filazap.application.port.MediaFileInput;
import com.filazap.application.port.MediaStorage;
import com.filazap.application.usecase.ListMessages;
import com.filazap.application.usecase.SendMessage;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.security.SessionHolder;
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
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/organizations/{organizationId}")
public class MessageController {
    private static final int MAX_MEDIA_BYTES = 16 * 1024 * 1024;

    private final SendMessage sendMessage;
    private final ListMessages listMessages;
    private final MediaStorage mediaStorage;

    public MessageController(SendMessage sendMessage, ListMessages listMessages, MediaStorage mediaStorage) {
        this.sendMessage = sendMessage;
        this.listMessages = listMessages;
        this.mediaStorage = mediaStorage;
    }

    @PostMapping(value = "/messages", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> sendMultipart(@PathVariable String organizationId,
                                                             @RequestParam("channelId") String channelId,
                                                             @RequestParam("contactId") String contactId,
                                                             @RequestParam(value = "body", required = false) String body,
                                                             @RequestParam(value = "file", required = false) MultipartFile file) {
        var session = SessionHolder.require();
        if (channelId == null || channelId.isBlank() || contactId == null || contactId.isBlank()) {
            throw new BadRequestException("channel_id e contact_id são obrigatórios.");
        }

        SendMessage.MediaInput media = null;
        if (file != null && !file.isEmpty()) {
            if (file.getSize() > MAX_MEDIA_BYTES) {
                throw new BadRequestException("Arquivo excede o tamanho máximo permitido (16 MB).");
            }
            byte[] bytes;
            try {
                bytes = file.getBytes();
            } catch (IOException e) {
                throw new BadRequestException("Falha ao ler o arquivo enviado.");
            }
            String mimeType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
            String filename = file.getOriginalFilename() == null ? "arquivo" : file.getOriginalFilename();
            var stored = mediaStorage.store(new MediaFileInput(
                    organizationId, filename, mimeType, bytes));
            media = new SendMessage.MediaInput(filename, mimeType, stored.storedPath(),
                    (body == null || body.isBlank()) ? null : body);
        }

        Map<String, Object> result = sendMessage.execute(session.userId(), organizationId, channelId,
                contactId, body == null ? "" : body, media);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/messages")
    public ResponseEntity<Map<String, Object>> sendJson(@PathVariable String organizationId,
                                                        @RequestBody Map<String, Object> raw) {
        var session = SessionHolder.require();
        String channelId = Req.str(raw, "channelId");
        String contactId = Req.str(raw, "contactId");
        String body = Req.str(raw, "body") != null ? Req.str(raw, "body") : Req.str(raw, "message");

        if (channelId == null || channelId.isBlank() || contactId == null || contactId.isBlank()) {
            throw new BadRequestException("channel_id e contact_id são obrigatórios.");
        }

        Object mediaObj = raw.get("media");
        SendMessage.MediaInput media = null;
        if (mediaObj instanceof Map<?, ?> m) {
            String storedPath = m.get("storedPath") == null ? null : String.valueOf(m.get("storedPath"));
            String filename = m.get("filename") == null ? "arquivo" : String.valueOf(m.get("filename"));
            String mimeType = m.get("mimeType") == null ? "application/octet-stream" : String.valueOf(m.get("mimeType"));
            String caption = m.get("caption") == null ? null : String.valueOf(m.get("caption"));
            if (storedPath == null || !storedPath.startsWith("media/" + organizationId + "/")
                    || storedPath.contains("..") || storedPath.contains("\\")) {
                throw new BadRequestException("Caminho de mídia inválido.");
            }
            media = new SendMessage.MediaInput(filename, mimeType, storedPath, caption);
        }

        Map<String, Object> result = sendMessage.execute(session.userId(), organizationId, channelId,
                contactId, body == null ? "" : body, media);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping("/tickets/{ticketId}/messages")
    public Map<String, Object> ticketMessages(@PathVariable String organizationId,
                                              @PathVariable String ticketId) {
        var session = SessionHolder.require();
        return listMessages.execute(session.userId(), organizationId, ticketId);
    }
}
