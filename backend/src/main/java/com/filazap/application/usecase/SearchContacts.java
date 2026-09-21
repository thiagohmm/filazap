package com.filazap.application.usecase;

import com.filazap.application.port.ContactRepository;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.util.Json;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class SearchContacts {
    private final ContactRepository contacts;
    private final OrganizationMemberRepository members;

    public SearchContacts(ContactRepository contacts, OrganizationMemberRepository members) {
        this.contacts = contacts;
        this.members = members;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId,
                                       String query, Integer limit) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canViewTickets(actor);

        int effectiveLimit = limit != null ? limit : 25;
        List<Map<String, Object>> results = contacts.search(organizationId, query, effectiveLimit)
                .stream()
                .map(r -> Json.obj(
                        "id", r.contact().getId(),
                        "channelId", r.contact().getChannelId(),
                        "phoneE164", r.contact().getPhoneE164(),
                        "name", r.contact().getName(),
                        "firstContactAt", r.contact().getFirstContactAt(),
                        "lastContactAt", r.contact().getLastContactAt(),
                        "totalTickets", r.totalTickets(),
                        "lastMessageAt", r.lastMessageAt()))
                .toList();

        return Json.obj("contacts", results);
    }
}
