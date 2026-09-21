package com.filazap.application.usecase;

import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TeamChatRepository;
import com.filazap.application.port.UserRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.error.MemberNotFoundError;
import com.filazap.domain.service.Clock;
import com.filazap.domain.valueobject.Role;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ListTeamChat {
    private static final long ONLINE_WINDOW_MS = 60_000;

    private final UserRepository users;
    private final OrganizationMemberRepository members;
    private final TeamChatRepository teamChat;
    private final Clock clock;

    public ListTeamChat(UserRepository users, OrganizationMemberRepository members,
                        TeamChatRepository teamChat, Clock clock) {
        this.users = users;
        this.members = members;
        this.teamChat = teamChat;
        this.clock = clock;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId) {
        var actor = members.findByUserAndOrganization(actorUserId, organizationId);
        if (actor == null) {
            throw new MemberNotFoundError(actorUserId, organizationId);
        }
        com.filazap.application.policy.OrganizationPolicy.canHandleTickets(
                new com.filazap.application.policy.OrganizationPolicy.Actor(
                        actorUserId, actor.getRole(), actor.isActive()));

        Instant since = clock.now().minusMillis(ONLINE_WINDOW_MS);
        List<String> onlineIds = teamChat.listOnlineUserIds(organizationId, since);
        var memberships = members.findByOrganizationId(organizationId);
        var records = teamChat.listVisibleMessages(organizationId, actorUserId, 100);

        Set<String> onlineSet = new HashSet<>(onlineIds);
        Set<String> relevantUserIds = new HashSet<>(onlineIds);
        for (var r : records) {
            relevantUserIds.add(r.senderUserId());
            if (r.recipientUserId() != null) relevantUserIds.add(r.recipientUserId());
        }

        Map<String, Map<String, Object>> userMap = new HashMap<>();
        for (String userId : relevantUserIds) {
            var user = users.findById(userId);
            if (user != null) {
                userMap.put(userId, Json.obj("id", user.getId(), "name", user.getName()));
            }
        }

        List<Map<String, Object>> onlineMembers = memberships.stream()
                .filter(m -> m.isActive() && Role.canHandleTickets(m.getRole())
                        && onlineSet.contains(m.getUserId()))
                .map(m -> Json.obj(
                        "userId", m.getUserId(),
                        "name", userMap.containsKey(m.getUserId())
                                ? userMap.get(m.getUserId()).get("name") : "Atendente",
                        "role", m.getRole(),
                        "isCurrentUser", m.getUserId().equals(actorUserId)))
                .sorted(Comparator
                        .comparing((Map<String, Object> m) -> !(Boolean) m.get("isCurrentUser"))
                        .thenComparing(m -> (String) m.get("name")))
                .toList();

        List<Map<String, Object>> messageList = records.stream().map(r -> {
            Map<String, Object> sender = userMap.getOrDefault(r.senderUserId(),
                    Json.obj("id", r.senderUserId(), "name", "Atendente"));
            Map<String, Object> recipient = r.recipientUserId() == null ? null
                    : userMap.getOrDefault(r.recipientUserId(),
                            Json.obj("id", r.recipientUserId(), "name", "Atendente"));
            return Json.obj(
                    "id", r.id(),
                    "body", r.body(),
                    "createdAt", r.createdAt(),
                    "sender", sender,
                    "recipient", recipient);
        }).toList();

        return Json.obj("onlineMembers", onlineMembers, "messages", messageList);
    }
}
