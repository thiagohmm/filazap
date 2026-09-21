package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.OrganizationRepository;
import com.filazap.application.port.TokenService;
import com.filazap.application.port.UserRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.Organization;
import com.filazap.domain.entity.OrganizationMember;
import com.filazap.domain.entity.User;
import com.filazap.domain.error.EmailAlreadyRegisteredError;
import com.filazap.domain.error.SlugAlreadyExistsError;
import com.filazap.domain.service.Clock;
import com.filazap.domain.service.PasswordHasher;
import com.filazap.domain.valueobject.Email;
import com.filazap.domain.valueobject.Role;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class CreateOrganization {
    private final OrganizationRepository organizations;
    private final UserRepository users;
    private final OrganizationMemberRepository members;
    private final PasswordHasher passwordHasher;
    private final TokenService tokenService;
    private final Clock clock;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public CreateOrganization(OrganizationRepository organizations, UserRepository users,
                              OrganizationMemberRepository members, PasswordHasher passwordHasher,
                              TokenService tokenService, Clock clock, AuditLogger logger,
                              IdGenerator idGenerator) {
        this.organizations = organizations;
        this.users = users;
        this.members = members;
        this.passwordHasher = passwordHasher;
        this.tokenService = tokenService;
        this.clock = clock;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(String name, String adminName,
                                       String adminEmail, String adminPassword) {
        Email email = Email.create(adminEmail);
        if (users.findByEmail(email.value()) != null) {
            throw new EmailAlreadyRegisteredError(email.value());
        }

        Organization organization = Organization.create(idGenerator.generate(), name);
        if (organizations.findBySlug(organization.getSlug()) != null) {
            throw new SlugAlreadyExistsError(organization.getSlug());
        }

        String passwordHash = passwordHasher.hash(adminPassword);
        User user = User.create(idGenerator.generate(), email.value(), adminName, passwordHash);
        OrganizationMember member = OrganizationMember.create(idGenerator.generate(),
                organization.getId(), user.getId(), Role.OWNER);

        organizations.save(organization);
        users.save(user);
        members.save(member);

        String token = tokenService.sign(new com.filazap.application.port.SessionPayload(
                user.getId(), user.getEmail(), user.getName()));

        logger.log("info", "organization.created", Json.obj(
                "organizationId", organization.getId(),
                "slug", organization.getSlug(),
                "actorUserId", user.getId()));

        return Json.obj(
                "organizationId", organization.getId(),
                "slug", organization.getSlug(),
                "name", organization.getName(),
                "token", token,
                "user", Json.obj("id", user.getId(), "name", user.getName(), "email", user.getEmail()));
    }
}
