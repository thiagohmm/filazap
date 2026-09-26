package com.filazap.infrastructure.persistence;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Helpers de bind de parâmetros para o driver PostgreSQL.
 */
final class Params {

    private Params() {
    }

    /**
     * O PgJDBC não infere o tipo de {@link Instant} em {@code setObject} e lança
     * {@code Can't infer the SQL type...}. Convertemos para {@link OffsetDateTime},
     * suportado nativamente nas colunas {@code TIMESTAMPTZ}.
     */
    static OffsetDateTime instant(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
