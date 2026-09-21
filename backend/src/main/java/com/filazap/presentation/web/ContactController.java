package com.filazap.presentation.web;

import com.filazap.application.usecase.GetContactProfile;
import com.filazap.application.usecase.ListContactHistory;
import com.filazap.application.usecase.SearchContacts;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.security.SessionHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/organizations/{organizationId}/contacts")
public class ContactController {
    private final SearchContacts searchContacts;
    private final GetContactProfile getContactProfile;
    private final ListContactHistory listContactHistory;

    public ContactController(SearchContacts searchContacts, GetContactProfile getContactProfile,
                             ListContactHistory listContactHistory) {
        this.searchContacts = searchContacts;
        this.getContactProfile = getContactProfile;
        this.listContactHistory = listContactHistory;
    }

    @GetMapping
    public Map<String, Object> search(@PathVariable String organizationId,
                                      @RequestParam(value = "query", required = false) String query,
                                      @RequestParam(value = "limit", required = false) Integer limit) {
        var session = SessionHolder.require();
        if (query == null || query.trim().isEmpty()) {
            throw new BadRequestException("query é obrigatória.");
        }
        if (limit != null && (limit <= 0 || limit > 100)) {
            throw new BadRequestException("limit deve estar entre 1 e 100.");
        }
        return searchContacts.execute(session.userId(), organizationId, query, limit);
    }

    @GetMapping("/{contactId}")
    public Map<String, Object> profile(@PathVariable String organizationId, @PathVariable String contactId) {
        var session = SessionHolder.require();
        return getContactProfile.execute(session.userId(), organizationId, contactId);
    }

    @GetMapping("/{contactId}/history")
    public Map<String, Object> history(@PathVariable String organizationId, @PathVariable String contactId) {
        var session = SessionHolder.require();
        return listContactHistory.execute(session.userId(), organizationId, contactId);
    }
}
