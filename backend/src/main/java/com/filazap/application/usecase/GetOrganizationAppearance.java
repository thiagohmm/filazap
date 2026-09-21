package com.filazap.application.usecase;

import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.OrganizationRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.error.OrganizationNotFoundError;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class GetOrganizationAppearance {
    private final OrganizationRepository organizations;
    private final OrganizationMemberRepository members;

    public GetOrganizationAppearance(OrganizationRepository organizations,
                                     OrganizationMemberRepository members) {
        this.organizations = organizations;
        this.members = members;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canViewSettings(actor);

        var org = organizations.findById(organizationId);
        if (org == null) {
            throw new OrganizationNotFoundError(organizationId);
        }
        return Json.obj("organization", Json.obj(
                "id", org.getId(), "name", org.getName(), "slug", org.getSlug(),
                "theme", org.getTheme(), "brandColor", org.getBrandColor()));
    }
}
