package com.filazap.application.port;

import com.filazap.domain.entity.Organization;

public interface OrganizationRepository {
    Organization save(Organization organization);

    Organization findBySlug(String slug);

    Organization findById(String id);
}
