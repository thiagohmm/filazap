package com.filazap.presentation.web;

import com.filazap.application.usecase.AddInternalNote;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.security.SessionHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/organizations/{organizationId}/notes")
public class NotesController {
    private final AddInternalNote addInternalNote;

    public NotesController(AddInternalNote addInternalNote) {
        this.addInternalNote = addInternalNote;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> add(@PathVariable String organizationId,
                                                   @RequestBody Map<String, Object> body) {
        var session = SessionHolder.require();
        String contactId = Req.strReq(body, "contactId", "contact_id é obrigatório.");
        String ticketId = Req.str(body, "ticketId");
        String noteBody = Req.strReq(body, "body", "Nota vazia não pode ser adicionada.");

        Map<String, Object> result = addInternalNote.execute(session.userId(), organizationId,
                contactId, ticketId, noteBody);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }
}
