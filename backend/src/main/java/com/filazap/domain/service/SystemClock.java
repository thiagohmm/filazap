package com.filazap.domain.service;

import java.time.Instant;

/** Implementação padrão que usa o relógio do sistema. */
public final class SystemClock implements Clock {
    @Override
    public Instant now() {
        return Instant.now();
    }
}
