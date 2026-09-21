package com.filazap.application.port;

import com.filazap.domain.entity.OrganizationMember;
import com.filazap.domain.valueobject.Role;

import java.time.Instant;
import java.util.List;

public interface OrganizationMemberRepository {

    record MemberWithOrganization(OrganizationMember member, String orgId, String orgName,
                                  String orgSlug, String theme, String brandColor) {}

    record RemoveAgentInput(String memberId, String organizationId, String userId, Instant now) {}

    record RemoveAgentResult(boolean removed, int releasedTickets) {}

    OrganizationMember save(OrganizationMember member);

    List<OrganizationMember> findByOrganizationId(String organizationId);

    OrganizationMember findById(String id);

    RemoveAgentResult deactivateAgentAndReleaseTickets(RemoveAgentInput input);

    OrganizationMember findByUserAndOrganization(String userId, String organizationId);

    List<OrganizationMember> findUsersByOrganizationAndRoles(String organizationId, List<Role> roles);

    long countByOrganization(String organizationId);

    List<MemberWithOrganization> findByUserIdActive(String userId);
}
