package com.filazap.application.policy;

import com.filazap.domain.error.ForbiddenRoleError;
import com.filazap.domain.valueobject.Role;

public final class OrganizationPolicy {

    public record Actor(String userId, Role role, boolean active) {}

    private OrganizationPolicy() {}

    public static void canManageMembers(Actor actor) {
        requireActive(actor, "gerenciar membros");
        if (!Role.canManageMembers(actor.role())) {
            throw new ForbiddenRoleError(actor.role().name(), "gerenciar membros");
        }
    }

    public static void canViewMembers(Actor actor) {
        requireActive(actor, "visualizar membros");
    }

    public static void canManageChannels(Actor actor) {
        requireActive(actor, "gerenciar canais");
        if (!Role.canManageMembers(actor.role())) {
            throw new ForbiddenRoleError(actor.role().name(), "gerenciar canais");
        }
    }

    public static void canViewChannels(Actor actor) {
        requireActive(actor, "visualizar canais");
    }

    public static void canManageSettings(Actor actor) {
        requireActive(actor, "gerenciar configurações");
        if (!Role.canManageMembers(actor.role())) {
            throw new ForbiddenRoleError(actor.role().name(), "gerenciar configurações");
        }
    }

    public static void canViewSettings(Actor actor) {
        requireActive(actor, "visualizar configurações");
    }

    public static void canSendMessages(Actor actor) {
        requireActive(actor, "enviar mensagens");
        if (!Role.canSendMessages(actor.role())) {
            throw new ForbiddenRoleError(actor.role().name(), "enviar mensagens");
        }
    }

    public static void canViewTickets(Actor actor) {
        requireActive(actor, "visualizar atendimentos");
    }

    public static void canHandleTickets(Actor actor) {
        requireActive(actor, "gerenciar atendimentos");
        if (!Role.canHandleTickets(actor.role())) {
            throw new ForbiddenRoleError(actor.role().name(), "gerenciar atendimentos");
        }
    }

    public static void canAddNotes(Actor actor) {
        requireActive(actor, "adicionar notas internas");
        if (!Role.canAddNotes(actor.role())) {
            throw new ForbiddenRoleError(actor.role().name(), "adicionar notas internas");
        }
    }

    private static void requireActive(Actor actor, String action) {
        if (!actor.active()) {
            throw new ForbiddenRoleError(actor.role().name(), action);
        }
    }
}
