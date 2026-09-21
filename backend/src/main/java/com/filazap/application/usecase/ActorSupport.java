package com.filazap.application.usecase;

import com.filazap.application.policy.OrganizationPolicy.Actor;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.domain.error.MemberNotFoundError;

/** Carrega o ator (membro) e aplica a validação básica de pertencimento. */
public final class ActorSupport {
    private ActorSupport() {}

    public static Actor loadActor(OrganizationMemberRepository members,
                                  String userId, String organizationId) {
        var member = members.findByUserAndOrganization(userId, organizationId);
        if (member == null) {
            throw new MemberNotFoundError(userId, organizationId);
        }
        return new Actor(userId, member.getRole(), member.isActive());
    }
}
