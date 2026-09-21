package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.OrganizationRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.Organization;
import com.filazap.domain.error.OrganizationNotFoundError;
import com.filazap.domain.service.Clock;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class UpdateOrganizationAppearance {
    private final OrganizationRepository organizations;
    private final OrganizationMemberRepository members;
    private final AuditLogger logger;
    private final Clock clock;

    public UpdateOrganizationAppearance(OrganizationRepository organizations,
                                        OrganizationMemberRepository members,
                                        AuditLogger logger, Clock clock) {
        this.organizations = organizations;
        this.members = members;
        this.logger = logger;
        this.clock = clock;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId,
                                       String theme, String brandColor) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canManageSettings(actor);

        Organization org = organizations.findById(organizationId);
        if (org == null) {
            throw new OrganizationNotFoundError(organizationId);
        }

        String newTheme = (theme != null && !theme.trim().isEmpty()) ? theme : org.getTheme();
        String newBrand = (brandColor != null && !brandColor.trim().isEmpty()) ? brandColor : org.getBrandColor();

        Organization updated = Organization.restore(org.getId(), org.getName(), org.getSlug(),
                org.getTimezone(), org.getPlan(), org.getSubscriptionStatus(), newTheme, newBrand,
                org.getCreatedAt(), clock.now());
        organizations.save(updated);

        logger.log("info", "organization.appearance_updated", Json.obj(
                "organizationId", updated.getId(),
                "actorUserId", actorUserId,
                "theme", newTheme,
                "brandColor", newBrand));

        return Json.obj("organization", Json.obj(
                "id", updated.getId(), "name", updated.getName(), "slug", updated.getSlug(),
                "theme", updated.getTheme(), "brandColor", updated.getBrandColor()));
    }
}
