package com.filazap.application.usecase;

import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.UserRepository;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.User;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ListMembers {
    private final UserRepository users;
    private final OrganizationMemberRepository members;

    public ListMembers(UserRepository users, OrganizationMemberRepository members) {
        this.users = users;
        this.members = members;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canViewMembers(actor);

        var memberList = members.findByOrganizationId(organizationId);
        Map<String, User> userMap = new HashMap<>();
        for (var m : memberList) {
            if (!userMap.containsKey(m.getUserId())) {
                User u = users.findById(m.getUserId());
                if (u != null) userMap.put(m.getUserId(), u);
            }
        }

        List<Map<String, Object>> result = memberList.stream().map(m -> {
            User u = userMap.get(m.getUserId());
            return Json.obj(
                    "id", m.getId(),
                    "user", Json.obj(
                            "id", m.getUserId(),
                            "name", u != null ? u.getName() : "?",
                            "email", u != null ? u.getEmail() : "?"),
                    "role", m.getRole(),
                    "active", m.isActive(),
                    "createdAt", m.getCreatedAt());
        }).toList();

        return Json.obj("members", result);
    }
}
