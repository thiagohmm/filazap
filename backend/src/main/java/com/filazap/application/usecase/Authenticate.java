package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.SessionPayload;
import com.filazap.application.port.TokenService;
import com.filazap.application.port.UserRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.User;
import com.filazap.domain.error.InvalidCredentialsError;
import com.filazap.domain.service.PasswordHasher;
import com.filazap.domain.valueobject.Email;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class Authenticate {
    private final UserRepository users;
    private final OrganizationMemberRepository members;
    private final PasswordHasher passwordHasher;
    private final TokenService tokenService;
    private final AuditLogger logger;

    public Authenticate(UserRepository users, OrganizationMemberRepository members,
                        PasswordHasher passwordHasher, TokenService tokenService, AuditLogger logger) {
        this.users = users;
        this.members = members;
        this.passwordHasher = passwordHasher;
        this.tokenService = tokenService;
        this.logger = logger;
    }

    public Map<String, Object> execute(String emailRaw, String password) {
        Email email = Email.create(emailRaw);
        User user = users.findByEmail(email.value());
        if (user == null) {
            throw new InvalidCredentialsError();
        }

        if (!passwordHasher.verify(password, user.getPasswordHash())) {
            logger.log("warn", "auth.failed", Json.obj("userId", user.getId()));
            throw new InvalidCredentialsError();
        }

        List<Map<String, Object>> organizations = members.findByUserIdActive(user.getId())
                .stream()
                .map(m -> Json.obj(
                        "id", m.orgId(),
                        "name", m.orgName(),
                        "slug", m.orgSlug(),
                        "role", m.member().getRole(),
                        "theme", m.theme(),
                        "brandColor", m.brandColor()))
                .toList();

        String token = tokenService.sign(new SessionPayload(user.getId(), user.getEmail(), user.getName()));

        return Json.obj(
                "token", token,
                "user", Json.obj("id", user.getId(), "name", user.getName(), "email", user.getEmail()),
                "organizations", organizations);
    }
}
