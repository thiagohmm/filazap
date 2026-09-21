package com.filazap.presentation.web;

import com.filazap.application.usecase.HeartbeatTeamChat;
import com.filazap.application.usecase.ListTeamChat;
import com.filazap.application.usecase.SendTeamChatMessage;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.security.SessionHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/organizations/{organizationId}/team-chat")
public class TeamChatController {
    private final ListTeamChat listTeamChat;
    private final SendTeamChatMessage sendTeamChatMessage;
    private final HeartbeatTeamChat heartbeatTeamChat;

    public TeamChatController(ListTeamChat listTeamChat, SendTeamChatMessage sendTeamChatMessage,
                              HeartbeatTeamChat heartbeatTeamChat) {
        this.listTeamChat = listTeamChat;
        this.sendTeamChatMessage = sendTeamChatMessage;
        this.heartbeatTeamChat = heartbeatTeamChat;
    }

    @GetMapping
    public Map<String, Object> list(@PathVariable String organizationId) {
        var session = SessionHolder.require();
        return listTeamChat.execute(session.userId(), organizationId);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> send(@PathVariable String organizationId,
                                                    @RequestBody Map<String, Object> body) {
        var session = SessionHolder.require();
        String recipientUserId = Req.str(body, "recipientUserId");
        String text = Req.str(body, "body");
        if (text == null || text.trim().isEmpty()) {
            throw new BadRequestException("Digite uma mensagem.");
        }
        if (text.trim().length() > 1000) {
            throw new BadRequestException("A mensagem deve ter no máximo 1000 caracteres.");
        }
        Map<String, Object> result = sendTeamChatMessage.execute(session.userId(), organizationId,
                recipientUserId, text.trim());
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/presence")
    public ResponseEntity<Void> presence(@PathVariable String organizationId) {
        var session = SessionHolder.require();
        heartbeatTeamChat.execute(session.userId(), organizationId);
        return ResponseEntity.noContent().build();
    }
}
