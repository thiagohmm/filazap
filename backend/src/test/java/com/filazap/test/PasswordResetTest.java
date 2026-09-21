package com.filazap.test;

import com.filazap.application.usecase.RequestPasswordReset;
import com.filazap.application.usecase.ResetPassword;
import com.filazap.config.AppConfig;
import com.filazap.domain.entity.User;
import com.filazap.domain.error.InvalidPasswordResetTokenError;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordResetTest {

    private static final class Services {
        final TestFakes.InMemoryUserRepository users = new TestFakes.InMemoryUserRepository();
        final TestFakes.FakePasswordHasher passwordHasher = new TestFakes.FakePasswordHasher();
        final TestFakes.InMemoryPasswordResetRepository passwordResets =
                new TestFakes.InMemoryPasswordResetRepository(users);
        final TestFakes.FakeMailer mailer = new TestFakes.FakeMailer();
        final TestFakes.FakeLogger logger = new TestFakes.FakeLogger();
        final TestFakes.MutableClock clock = new TestFakes.MutableClock(Instant.parse("2026-08-21T12:00:00Z"));
        final RequestPasswordReset request;
        final ResetPassword reset;

        Services() {
            request = new RequestPasswordReset(users, passwordResets, mailer, logger, clock,
                    () -> "reset-1", () -> "secret-token", "https://app.filazap.test/");
            reset = new ResetPassword(passwordResets, passwordHasher, logger, clock);
        }
    }

    private void createUser(Services services) {
        services.users.save(User.create("user-1", "ana@example.com", "Ana", "hash:SenhaAntiga123"));
    }

    @Test
    void enviaUmLinkEArmazenaSomenteOHashDoToken() {
        Services services = new Services();
        createUser(services);

        services.request.execute("ANA@example.com");

        assertEquals(1, services.mailer.sent.size());
        assertEquals("https://app.filazap.test/redefinir-senha?token=secret-token",
                services.mailer.sent.get(0).get("resetUrl"));
        assertNotNull(services.passwordResets.token);
        assertEquals(AppConfig.sha256Hex("secret-token"), services.passwordResets.token.tokenHash());
        assertNotEquals("secret-token", services.passwordResets.token.tokenHash());
    }

    @Test
    void naoRevelaNemEnviaEmailParaUsuarioInexistente() {
        Services services = new Services();
        services.request.execute("ninguem@example.com");
        assertEquals(0, services.mailer.sent.size());
    }

    @Test
    void alteraASenhaEImpedeReutilizarOLink() {
        Services services = new Services();
        createUser(services);
        services.request.execute("ana@example.com");

        services.reset.execute("secret-token", "NovaSenha1234");
        User user = services.users.findById("user-1");
        assertTrue(services.passwordHasher.verify("NovaSenha1234", user.getPasswordHash()));

        assertThrows(InvalidPasswordResetTokenError.class,
                () -> services.reset.execute("secret-token", "OutraSenha1234"));
    }

    @Test
    void rejeitaUmLinkExpirado() {
        Services services = new Services();
        createUser(services);
        services.request.execute("ana@example.com");
        services.clock.set(Instant.parse("2026-08-21T12:31:00Z"));

        assertThrows(InvalidPasswordResetTokenError.class,
                () -> services.reset.execute("secret-token", "NovaSenha1234"));
    }
}
