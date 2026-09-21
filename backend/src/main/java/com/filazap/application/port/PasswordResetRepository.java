package com.filazap.application.port;

import java.time.Instant;

public interface PasswordResetRepository {

    record NewPasswordResetToken(String id, String userId, String tokenHash,
                                 Instant expiresAt, Instant createdAt) {}

    void replaceForUser(NewPasswordResetToken token);

    boolean consumeAndUpdatePassword(String tokenHash, String passwordHash, Instant now);
}
