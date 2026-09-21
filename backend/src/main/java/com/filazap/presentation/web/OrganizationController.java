package com.filazap.presentation.web;

import com.filazap.application.usecase.CreateOrganization;
import com.filazap.application.usecase.GetOrganizationAppearance;
import com.filazap.application.usecase.UpdateOrganizationAppearance;
import com.filazap.config.FilazapProperties;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.security.RateLimiter;
import com.filazap.presentation.security.SessionHolder;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Map;

@RestController
@RequestMapping("/api/organizations")
public class OrganizationController {
    private final CreateOrganization createOrganization;
    private final GetOrganizationAppearance getOrganizationAppearance;
    private final UpdateOrganizationAppearance updateOrganizationAppearance;
    private final RateLimiter rateLimiter;
    private final FilazapProperties properties;

    public OrganizationController(CreateOrganization createOrganization,
                                  GetOrganizationAppearance getOrganizationAppearance,
                                  UpdateOrganizationAppearance updateOrganizationAppearance,
                                  RateLimiter rateLimiter, FilazapProperties properties) {
        this.createOrganization = createOrganization;
        this.getOrganizationAppearance = getOrganizationAppearance;
        this.updateOrganizationAppearance = updateOrganizationAppearance;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String name = Req.str(body, "name");
        String adminName = Req.str(body, "adminName");
        String adminEmail = Req.str(body, "adminEmail");
        String adminPassword = Req.str(body, "adminPassword");

        if (name == null || name.trim().length() < 2) throw new BadRequestException("Nome da empresa é obrigatório.");
        if (adminName == null || adminName.trim().length() < 2) throw new BadRequestException("Nome do administrador é obrigatório.");
        if (!Req.isEmail(adminEmail)) throw new BadRequestException("E-mail do administrador inválido.");
        validateAdminPassword(adminPassword);

        String allowed = properties.organizationSignupAllowedDomains();
        if (allowed != null && !allowed.isBlank()) {
            String emailDomain = adminEmail.contains("@")
                    ? adminEmail.substring(adminEmail.indexOf('@') + 1).toLowerCase() : "";
            boolean permitted = Arrays.stream(allowed.split(","))
                    .map(String::trim).map(String::toLowerCase)
                    .filter(d -> !d.isEmpty())
                    .anyMatch(d -> d.equals(emailDomain));
            if (!permitted) {
                throw new BadRequestException("Domínio de e-mail não autorizado para cadastro.");
            }
        }

        String key = "org-signup:" + HttpUtil.clientIp(request);
        if (!rateLimiter.isAllowed(key, 3, 60_000)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(rateLimiter.retryAfterSeconds(key, 3, 60_000)))
                    .body(Map.of("error", "Muitas tentativas. Tente novamente mais tarde."));
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(createOrganization.execute(name.trim(), adminName.trim(), adminEmail, adminPassword));
    }

    @GetMapping("/{organizationId}")
    public Map<String, Object> get(@PathVariable String organizationId) {
        var session = SessionHolder.require();
        return getOrganizationAppearance.execute(session.userId(), organizationId);
    }

    @PatchMapping("/{organizationId}")
    public Map<String, Object> patch(@PathVariable String organizationId,
                                     @RequestBody Map<String, Object> body) {
        var session = SessionHolder.require();
        String theme = Req.str(body, "theme");
        String brandColor = Req.str(body, "brandColor");
        if ((theme == null || theme.isBlank()) && (brandColor == null || brandColor.isBlank())) {
            throw new BadRequestException("Informe ao menos uma opção de aparência para atualizar.");
        }
        if (theme != null && !theme.isBlank() && !"light".equals(theme) && !"dark".equals(theme)) {
            throw new BadRequestException("Tema inválido. Use light ou dark.");
        }
        if (brandColor != null && !brandColor.isBlank() && !brandColor.matches("^#[0-9a-fA-F]{6}$")) {
            throw new BadRequestException("Cor inválida. Use o formato #RRGGBB.");
        }
        return updateOrganizationAppearance.execute(session.userId(), organizationId, theme, brandColor);
    }

    private void validateAdminPassword(String password) {
        if (password == null || password.length() < 8) {
            throw new BadRequestException("A senha deve ter pelo menos 8 caracteres.");
        }
        if (password.length() < 12 || !password.matches(".*[a-z].*")
                || !password.matches(".*[A-Z].*") || !password.matches(".*\\d.*")) {
            throw new BadRequestException(
                    "A senha deve ter pelo menos 12 caracteres, com maiúscula, minúscula e número.");
        }
    }
}
