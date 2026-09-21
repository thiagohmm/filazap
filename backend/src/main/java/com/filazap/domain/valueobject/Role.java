package com.filazap.domain.valueobject;

import com.filazap.domain.error.InvalidRoleError;

import java.util.List;

public enum Role {
    OWNER, ADMIN, AGENT, VIEWER;

    public static final List<Role> ALL = List.of(OWNER, ADMIN, AGENT, VIEWER);

    public static Role fromString(String raw) {
        switch (raw.toUpperCase()) {
            case "OWNER": return OWNER;
            case "ADMIN": return ADMIN;
            case "AGENT": return AGENT;
            case "VIEWER": return VIEWER;
            default: throw new InvalidRoleError(raw);
        }
    }

    public static boolean canManageMembers(Role role) {
        return role == OWNER || role == ADMIN;
    }

    public static boolean canSendMessages(Role role) {
        return role == OWNER || role == ADMIN || role == AGENT;
    }

    public static boolean canHandleTickets(Role role) {
        return role == OWNER || role == ADMIN || role == AGENT;
    }

    public static boolean canAddNotes(Role role) {
        return role == OWNER || role == ADMIN || role == AGENT;
    }
}
