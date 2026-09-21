package com.filazap.infrastructure.persistence;

import com.filazap.application.port.PasswordResetRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Repository
public class JdbcPasswordResetRepository implements PasswordResetRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcPasswordResetRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void replaceForUser(NewPasswordResetToken token) {
        String sql = """
                INSERT INTO "PasswordResetToken" (id, "userId", "tokenHash", "expiresAt", "createdAt")
                VALUES (:id, :userId, :tokenHash, :expiresAt, :createdAt)
                ON CONFLICT ("userId") DO UPDATE SET
                  id = EXCLUDED.id,
                  "tokenHash" = EXCLUDED."tokenHash",
                  "expiresAt" = EXCLUDED."expiresAt",
                  "createdAt" = EXCLUDED."createdAt",
                  "usedAt" = NULL""";
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("id", token.id())
                .addValue("userId", token.userId())
                .addValue("tokenHash", token.tokenHash())
                .addValue("expiresAt", token.expiresAt())
                .addValue("createdAt", token.createdAt()));
    }

    @Override
    @Transactional
    public boolean consumeAndUpdatePassword(String tokenHash, String passwordHash, Instant now) {
        String findSql = "SELECT id, \"userId\", \"usedAt\", \"expiresAt\" FROM \"PasswordResetToken\" WHERE \"tokenHash\" = :tokenHash";
        List<Object[]> rows = jdbc.query(findSql, new MapSqlParameterSource("tokenHash", tokenHash),
                (rs, i) -> new Object[]{
                        rs.getString("id"), rs.getString("userId"),
                        rs.getObject("usedAt", Instant.class), rs.getObject("expiresAt", Instant.class)});
        if (rows.isEmpty()) return false;

        String tokenId = (String) rows.get(0)[0];
        String userId = (String) rows.get(0)[1];
        Instant usedAt = (Instant) rows.get(0)[2];
        Instant expiresAt = (Instant) rows.get(0)[3];
        if (usedAt != null || !expiresAt.isAfter(now)) return false;

        String consumeSql = """
                UPDATE "PasswordResetToken" SET "usedAt" = :now
                WHERE id = :id AND "usedAt" IS NULL AND "expiresAt" > :now""";
        int consumed = jdbc.update(consumeSql, new MapSqlParameterSource()
                .addValue("id", tokenId).addValue("now", now));
        if (consumed != 1) return false;

        String updateUser = "UPDATE \"User\" SET \"passwordHash\" = :passwordHash WHERE id = :userId";
        jdbc.update(updateUser, new MapSqlParameterSource()
                .addValue("passwordHash", passwordHash).addValue("userId", userId));
        return true;
    }
}
