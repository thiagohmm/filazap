package com.filazap.application.usecase;

import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TeamChatRepository;
import com.filazap.domain.service.Clock;
import org.springframework.stereotype.Service;

@Service
public class HeartbeatTeamChat {
    private final OrganizationMemberRepository members;
    private final TeamChatRepository teamChat;
    private final Clock clock;

    public HeartbeatTeamChat(OrganizationMemberRepository members, TeamChatRepository teamChat,
                             Clock clock) {
        this.members = members;
        this.teamChat = teamChat;
        this.clock = clock;
    }

    public void execute(String actorUserId, String organizationId) {
        var member = members.findByUserAndOrganization(actorUserId, organizationId);
        if (member == null) {
            throw new com.filazap.domain.error.MemberNotFoundError(actorUserId, organizationId);
        }
        com.filazap.application.policy.OrganizationPolicy.canHandleTickets(
                new com.filazap.application.policy.OrganizationPolicy.Actor(
                        actorUserId, member.getRole(), member.isActive()));
        teamChat.touchPresence(organizationId, actorUserId, clock.now());
    }
}
