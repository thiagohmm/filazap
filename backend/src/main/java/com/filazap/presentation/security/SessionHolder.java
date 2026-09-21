package com.filazap.presentation.security;

import com.filazap.application.port.SessionPayload;
import com.filazap.presentation.error.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Acesso ao usuário autenticado da requisição atual. */
public final class SessionHolder {
    private SessionHolder() {}

    public static SessionPayload current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof SessionPayload payload) {
            return payload;
        }
        return null;
    }

    public static SessionPayload require() {
        SessionPayload payload = current();
        if (payload == null) {
            throw new UnauthorizedException();
        }
        return payload;
    }
}
