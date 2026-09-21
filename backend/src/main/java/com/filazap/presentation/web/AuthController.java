package com.filazap.presentation.web;

import com.filazap.application.usecase.Authenticate;
import com.filazap.application.usecase.RequestPasswordReset;
import com.filazap.application.usecase.ResetPassword;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.security.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final String FORGOT_MESSAGE =
            "Se existir uma conta com esse e-mail, você receberá as instruções em alguns minutos.";

    private final Authenticate authenticate;
    private final RequestPasswordReset requestPasswordReset;
    private final ResetPassword resetPassword;
    private final RateLimiter rateLimiter;

    public AuthController(Authenticate authenticate, RequestPasswordReset requestPasswordReset,
                          ResetPassword resetPassword, RateLimiter rateLimiter) {
        this.authenticate = authenticate;
        this.requestPasswordReset = requestPasswordReset;
        this.resetPassword = resetPassword;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String email = Req.str(body, "email");
        String password = Req.str(body, "password");
        if (!Req.isEmail(email)) throw new BadRequestException("E-mail inválido.");
        if (password == null || password.isEmpty()) throw new BadRequestException("Senha é obrigatória.");

        String key = "login:" + email.toLowerCase() + ":" + HttpUtil.clientIp(request);
        if (!rateLimiter.isAllowed(key, 5, 60_000)) {
            return tooMany(rateLimiter.retryAfterSeconds(key, 5, 60_000));
        }
        return ResponseEntity.ok(authenticate.execute(email, password));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout() {
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String email = Req.str(body, "email");
        if (!Req.isEmail(email)) throw new BadRequestException("Informe um e-mail válido.");

        String key = "password-reset-request:" + HttpUtil.clientIp(request);
        if (!rateLimiter.isAllowed(key, 5, 15 * 60_000)) {
            return tooMany(rateLimiter.retryAfterSeconds(key, 5, 15 * 60_000));
        }
        requestPasswordReset.execute(email);
        return ResponseEntity.ok(Map.of("message", FORGOT_MESSAGE));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String token = Req.str(body, "token");
        String password = Req.str(body, "password");
        if (token == null || token.length() < 32) throw new BadRequestException("Link de recuperação inválido.");
        validatePassword(password);

        String key = "password-reset:" + HttpUtil.clientIp(request);
        if (!rateLimiter.isAllowed(key, 10, 15 * 60_000)) {
            return tooMany(rateLimiter.retryAfterSeconds(key, 10, 15 * 60_000));
        }
        resetPassword.execute(token, password);
        return ResponseEntity.ok(Map.of("message", "Senha alterada com sucesso."));
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 12 || password.length() > 72) {
            throw new BadRequestException("A senha deve ter entre 12 e 72 caracteres.");
        }
        if (!password.matches(".*[a-z].*") || !password.matches(".*[A-Z].*") || !password.matches(".*\\d.*")) {
            throw new BadRequestException("Use pelo menos uma letra maiúscula, uma minúscula e um número.");
        }
    }

    private ResponseEntity<Map<String, String>> tooMany(long retryAfterSeconds) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(retryAfterSeconds))
                .body(Map.of("error", "Muitas tentativas. Tente novamente mais tarde."));
    }
}
