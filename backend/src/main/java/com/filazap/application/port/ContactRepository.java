package com.filazap.application.port;

import com.filazap.domain.entity.Contact;

import java.time.Instant;
import java.util.List;

public interface ContactRepository {

    record ContactSearchResult(Contact contact, int totalTickets, Instant lastMessageAt) {}

    Contact save(Contact contact);

    Contact findById(String id);

    Contact findByChannelAndPhone(String organizationId, String channelId, String phoneE164);

    List<ContactSearchResult> search(String organizationId, String query, int limit);
}
