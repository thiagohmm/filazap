package com.filazap.application.port;

import com.filazap.domain.entity.InternalNote;

import java.util.List;

public interface InternalNoteRepository {
    InternalNote save(InternalNote note);

    InternalNote findById(String id);

    List<InternalNote> findByContactId(String organizationId, String contactId);
}
