package com.filazap.domain.entity;

import com.filazap.domain.valueobject.Role;

import java.time.Instant;

public class OrganizationMember {
    private final String id;
    private final String organizationId;
    private final String userId;
    private Role role;
    private boolean active;
    private final Instant createdAt;
    private final Instant updatedAt;

    private OrganizationMember(String id, String organizationId, String userId, Role role,
                               boolean active, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.organizationId = organizationId;
        this.userId = userId;
        this.role = role;
        this.active = active;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static OrganizationMember create(String id, String organizationId, String userId, Role role) {
        Instant now = Instant.now();
        return new OrganizationMember(id, organizationId, userId, role, true, now, now);
    }

    public static OrganizationMember restore(String id, String organizationId, String userId,
                                             Role role, boolean active, Instant createdAt,
                                             Instant updatedAt) {
        return new OrganizationMember(id, organizationId, userId, role, active, createdAt, updatedAt);
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getUserId() { return userId; }
    public Role getRole() { return role; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void deactivate(Instant now) {
        this.active = false;
    }
}
