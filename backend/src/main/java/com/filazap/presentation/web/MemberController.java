package com.filazap.presentation.web;

import com.filazap.application.usecase.InviteMember;
import com.filazap.application.usecase.ListMembers;
import com.filazap.application.usecase.RemoveMember;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.security.SessionHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/organizations/{organizationId}/members")
public class MemberController {
    private static final Set<String> ROLES = Set.of("OWNER", "ADMIN", "AGENT", "VIEWER");

    private final ListMembers listMembers;
    private final InviteMember inviteMember;
    private final RemoveMember removeMember;

    public MemberController(ListMembers listMembers, InviteMember inviteMember, RemoveMember removeMember) {
        this.listMembers = listMembers;
        this.inviteMember = inviteMember;
        this.removeMember = removeMember;
    }

    @GetMapping
    public Map<String, Object> list(@PathVariable String organizationId) {
        var session = SessionHolder.require();
        return listMembers.execute(session.userId(), organizationId);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> invite(@PathVariable String organizationId,
                                                      @RequestBody Map<String, Object> body) {
        var session = SessionHolder.require();
        String email = Req.str(body, "email");
        String name = Req.str(body, "name");
        String role = Req.str(body, "role");
        if (!Req.isEmail(email)) throw new BadRequestException("E-mail inválido.");
        if (name == null || name.trim().length() < 2) throw new BadRequestException("Nome é obrigatório.");
        if (role == null || !ROLES.contains(role)) throw new BadRequestException("Perfil inválido.");

        Map<String, Object> result = inviteMember.execute(session.userId(), organizationId,
                email, name.trim(), role);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @DeleteMapping("/{memberId}")
    public Map<String, Object> remove(@PathVariable String organizationId, @PathVariable String memberId) {
        var session = SessionHolder.require();
        return removeMember.execute(session.userId(), organizationId, memberId);
    }
}
