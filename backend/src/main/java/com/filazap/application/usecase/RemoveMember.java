package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.error.MemberCannotBeRemovedError;
import com.filazap.domain.error.MemberNotFoundError;
import com.filazap.domain.service.Clock;
import com.filazap.domain.valueobject.Role;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class RemoveMember {
    private final OrganizationMemberRepository members;
    private final Clock clock;
    private final AuditLogger logger;

    public RemoveMember(OrganizationMemberRepository members, Clock clock, AuditLogger logger) {
        this.members = members;
        this.clock = clock;
        this.logger = logger;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId, String memberId) {
        var actorMember = members.findByUserAndOrganization(actorUserId, organizationId);
        if (actorMember == null) {
            throw new MemberNotFoundError(actorUserId, organizationId);
        }
        com.filazap.application.policy.OrganizationPolicy.canManageMembers(
                new com.filazap.application.policy.OrganizationPolicy.Actor(
                        actorUserId, actorMember.getRole(), actorMember.isActive()));

        var member = members.findById(memberId);
        if (member == null || !member.getOrganizationId().equals(organizationId)) {
            throw new MemberNotFoundError(memberId, organizationId);
        }
        if (!member.isActive() || member.getRole() != Role.AGENT
                || member.getUserId().equals(actorUserId)) {
            throw new MemberCannotBeRemovedError();
        }

        var result = members.deactivateAgentAndReleaseTickets(
                new OrganizationMemberRepository.RemoveAgentInput(
                        member.getId(), organizationId, member.getUserId(), clock.now()));
        if (!result.removed()) {
            throw new MemberCannotBeRemovedError();
        }

        logger.log("info", "member.removed", Json.obj(
                "organizationId", organizationId,
                "memberId", member.getId(),
                "userId", member.getUserId(),
                "actorUserId", actorUserId,
                "releasedTickets", result.releasedTickets()));

        return Json.obj("member", Json.obj("id", member.getId(), "active", false));
    }
}
