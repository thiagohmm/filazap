package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.PasswordResetRepository;
import com.filazap.application.util.Json;
import com.filazap.config.AppConfig;
import com.filazap.domain.error.InvalidPasswordResetTokenError;
import com.filazap.domain.service.Clock;
import com.filazap.domain.service.PasswordHasher;
import org.springframework.stereotype.Service;

@Service
public class ResetPassword {
    private final PasswordResetRepository passwordResets;
    private final PasswordHasher passwordHasher;
    private final AuditLogger logger;
    private final Clock clock;

    public ResetPassword(PasswordResetRepository passwordResets, PasswordHasher passwordHasher,
                         AuditLogger logger, Clock clock) {
        this.passwordResets = passwordResets;
        this.passwordHasher = passwordHasher;
        this.logger = logger;
        this.clock = clock;
    }

    public void execute(String token, String password) {
        String passwordHash = passwordHasher.hash(password);
        boolean changed = passwordResets.consumeAndUpdatePassword(
                AppConfig.sha256Hex(token), passwordHash, clock.now());
        if (!changed) {
            throw new InvalidPasswordResetTokenError();
        }
        logger.log("info", "password_reset.completed", Json.obj());
    }
}
