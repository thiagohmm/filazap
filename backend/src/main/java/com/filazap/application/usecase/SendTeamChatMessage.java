package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TeamChatRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.error.ChatRecipientUnavailableError;
import com.filazap.domain.error.MemberNotFoundError;
import com.filazap.domain.service.Clock;
import com.filazap.domain.valueobject.Role;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class SendTeamChatMessage {
    private static final long ONLINE_WINDOW_MS = 60_000;

    private final OrganizationMemberRepository members;
    private final TeamChatRepository teamChat;
    private final Clock clock;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public SendTeamChatMessage(OrganizationMemberRepository members, TeamChatRepository teamChat,
                               Clock clock, AuditLogger logger, IdGenerator idGenerator) {
        this.members = members;
        this.teamChat = teamChat;
        this.clock = clock;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId,
                                       String recipientUserId, String body) {
        var actor = members.findByUserAndOrganization(actorUserId, organizationId);
        if (actor == null) {
            throw new MemberNotFoundError(actorUserId, organizationId);
        }
        com.filazap.application.policy.OrganizationPolicy.canHandleTickets(
                new com.filazap.application.policy.OrganizationPolicy.Actor(
                        actorUserId, actor.getRole(), actor.isActive()));

        String recipient = (recipientUserId == null || recipientUserId.isEmpty()) ? null : recipientUserId;
        if (recipient != null) {
            var recipientMember = members.findByUserAndOrganization(recipient, organizationId);
            var since = clock.now().minusMillis(ONLINE_WINDOW_MS);
            boolean online = teamChat.isUserOnline(organizationId, recipient, since);
            if (recipient.equals(actorUserId)
                    || recipientMember == null
                    || !recipientMember.isActive()
                    || !Role.canHandleTickets(recipientMember.getRole())
                    || !online) {
                throw new ChatRecipientUnavailableError();
            }
        }

        var message = teamChat.save(new TeamChatRepository.TeamChatRecord(
                idGenerator.generate(), organizationId, actorUserId, recipient, body.trim(), clock.now()));

        logger.log("info", "team_chat.message_sent", Json.obj(
                "organizationId", organizationId,
                "senderUserId", actorUserId,
                "scope", recipient != null ? "direct" : "broadcast"));

        return Json.obj("message", Json.obj("id", message.id(), "createdAt", message.createdAt()));
    }
}
