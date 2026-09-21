package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.PasswordResetMailer;
import com.filazap.application.port.PasswordResetRepository;
import com.filazap.application.port.UserRepository;
import com.filazap.application.util.Json;
import com.filazap.config.AppConfig;
import com.filazap.domain.entity.User;
import com.filazap.domain.service.Clock;
import com.filazap.domain.valueobject.Email;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.function.Supplier;

@Service
public class RequestPasswordReset {
    private static final long RESET_TOKEN_TTL_MS = 30L * 60 * 1000;

    private final UserRepository users;
    private final PasswordResetRepository passwordResets;
    private final PasswordResetMailer mailer;
    private final AuditLogger logger;
    private final Clock clock;
    private final IdGenerator idGenerator;
    private final Supplier<String> tokenGenerator;
    private final String appUrl;

    public RequestPasswordReset(UserRepository users, PasswordResetRepository passwordResets,
                                PasswordResetMailer mailer, AuditLogger logger, Clock clock,
                                IdGenerator idGenerator, Supplier<String> tokenGenerator,
                                @Value("${filazap.app-url}") String appUrl) {
        this.users = users;
        this.passwordResets = passwordResets;
        this.mailer = mailer;
        this.logger = logger;
        this.clock = clock;
        this.idGenerator = idGenerator;
        this.tokenGenerator = tokenGenerator;
        this.appUrl = appUrl;
    }

    public void execute(String emailRaw) {
        Email email = Email.create(emailRaw);
        User user = users.findByEmail(email.value());
        if (user == null) {
            logger.log("info", "password_reset.requested_unknown_email", Json.obj());
            return;
        }

        Instant now = clock.now();
        String token = tokenGenerator.get();

        passwordResets.replaceForUser(new PasswordResetRepository.NewPasswordResetToken(
                idGenerator.generate(), user.getId(), AppConfig.sha256Hex(token),
                now.plusMillis(RESET_TOKEN_TTL_MS), now));

        String resetUrl = appUrl.replaceAll("/$", "") + "/redefinir-senha?token=" + token;
        try {
            mailer.send(user.getEmail(), user.getName(), resetUrl);
            logger.log("info", "password_reset.email_sent", Json.obj("userId", user.getId()));
        } catch (Exception error) {
            logger.log("error", "password_reset.email_failed", Json.obj(
                    "userId", user.getId(),
                    "error", error.getMessage() == null ? "unknown" : error.getMessage()));
        }
    }
}
