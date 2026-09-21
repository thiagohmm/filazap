package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.OrganizationRepository;
import com.filazap.application.port.UserRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.OrganizationMember;
import com.filazap.domain.entity.User;
import com.filazap.domain.service.Clock;
import com.filazap.domain.service.PasswordHasher;
import com.filazap.domain.valueobject.Email;
import com.filazap.domain.valueobject.Role;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
public class InviteMember {
    private final UserRepository users;
    private final OrganizationMemberRepository members;
    private final OrganizationRepository organizations;
    private final PasswordHasher passwordHasher;
    private final Clock clock;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public InviteMember(UserRepository users, OrganizationMemberRepository members,
                        OrganizationRepository organizations, PasswordHasher passwordHasher,
                        Clock clock, AuditLogger logger, IdGenerator idGenerator) {
        this.users = users;
        this.members = members;
        this.organizations = organizations;
        this.passwordHasher = passwordHasher;
        this.clock = clock;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId,
                                       String emailRaw, String name, String roleRaw) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canManageMembers(actor);

        Email email = Email.create(emailRaw);
        Role role = Role.fromString(roleRaw);

        User user = users.findByEmail(email.value());
        if (user == null) {
            String temporaryPassword = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            user = User.create(idGenerator.generate(), email.value(), name,
                    passwordHasher.hash(temporaryPassword));
            users.save(user);
        }

        OrganizationMember existing = members.findByUserAndOrganization(user.getId(), organizationId);
        if (existing != null) {
            OrganizationMember updated = OrganizationMember.restore(existing.getId(),
                    existing.getOrganizationId(), existing.getUserId(), existing.getRole(),
                    true, existing.getCreatedAt(), clock.now());
            members.save(updated);
            return toOutput(updated, user);
        }

        OrganizationMember member = OrganizationMember.create(idGenerator.generate(),
                organizationId, user.getId(), role);
        members.save(member);

        logger.log("info", "member.invited", Json.obj(
                "organizationId", organizationId,
                "userId", user.getId(),
                "role", role.name(),
                "actorUserId", actorUserId));

        return toOutput(member, user);
    }

    private Map<String, Object> toOutput(OrganizationMember member, User user) {
        return Json.obj("member", Json.obj(
                "id", member.getId(),
                "organizationId", member.getOrganizationId(),
                "user", Json.obj("id", user.getId(), "name", user.getName(), "email", user.getEmail()),
                "role", member.getRole(),
                "active", member.isActive(),
                "createdAt", member.getCreatedAt()));
    }
}
