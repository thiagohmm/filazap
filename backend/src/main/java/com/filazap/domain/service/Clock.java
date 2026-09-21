package com.filazap.domain.service;

import java.time.Instant;

/** Abstração do tempo para permitir testes determinísticos. */
public interface Clock {
    Instant now();
}
