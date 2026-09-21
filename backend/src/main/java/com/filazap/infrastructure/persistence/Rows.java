package com.filazap.infrastructure.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;

/** Helpers de leitura de ResultSet compartilhados pelos repositórios. */
public final class Rows {
    private Rows() {}

    /**
     * Converte uma coluna de timestamp/timestamptz para Instant de forma
     * independente da versão do driver JDBC: o getObject() sem tipo retorna
     * Timestamp (drivers mais antigos) ou OffsetDateTime (drivers JDBC42+),
     * evitando a conversão rs.getObject(col, Instant.class) que alguns drivers
     * de PostgreSQL não suportam para timestamptz.
     */
    public static Instant ts(ResultSet rs, String col) throws SQLException {
        Object v = rs.getObject(col);
        if (v == null) {
            return null;
        }
        if (v instanceof OffsetDateTime odt) {
            return odt.toInstant();
        }
        if (v instanceof Instant i) {
            return i;
        }
        if (v instanceof Timestamp ts) {
            return ts.toInstant();
        }
        throw new SQLException("Tipo incompatível para coluna de tempo: " + v.getClass());
    }
}
