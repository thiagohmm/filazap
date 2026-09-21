package com.filazap.infrastructure.persistence;

import com.filazap.application.port.TeamChatRepository;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Repository
public class JdbcTeamChatRepository implements TeamChatRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcTeamChatRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<TeamChatRecord> MAPPER = (rs, i) -> new TeamChatRecord(
            rs.getString("id"), rs.getString("organizationId"), rs.getString("senderUserId"),
            rs.getString("recipientUserId"), rs.getString("body"), Rows.ts(rs, "createdAt"));

    @Override
    public void touchPresence(String organizationId, String userId, Instant now) {
        String sql = """
                INSERT INTO "TeamPresence" (id, "organizationId", "userId", "lastSeenAt")
                VALUES (gen_random_uuid(), :organizationId, :userId, :now)
                ON CONFLICT ("organizationId", "userId") DO UPDATE SET
                  "lastSeenAt" = EXCLUDED."lastSeenAt"
                """;
        jdbc.update(sql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("userId", userId).addValue("now", now));
    }

    @Override
    public List<String> listOnlineUserIds(String organizationId, Instant since) {
        String sql = "SELECT \"userId\" FROM \"TeamPresence\" WHERE \"organizationId\" = :organizationId AND \"lastSeenAt\" >= :since";
        return jdbc.queryForList(sql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("since", since), String.class);
    }

    @Override
    public boolean isUserOnline(String organizationId, String userId, Instant since) {
        String sql = "SELECT 1 FROM \"TeamPresence\" WHERE \"organizationId\" = :organizationId AND \"userId\" = :userId AND \"lastSeenAt\" >= :since LIMIT 1";
        List<Integer> rows = jdbc.queryForList(sql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("userId", userId)
                .addValue("since", since), Integer.class);
        return !rows.isEmpty();
    }

    @Override
    public TeamChatRecord save(TeamChatRecord message) {
        String sql = """
                INSERT INTO "TeamChatMessage"
                  (id, "organizationId", "senderUserId", "recipientUserId", body)
                VALUES (:id, :organizationId, :senderUserId, :recipientUserId, :body)
                RETURNING *""";
        return jdbc.queryForObject(sql, new MapSqlParameterSource()
                        .addValue("id", message.id())
                        .addValue("organizationId", message.organizationId())
                        .addValue("senderUserId", message.senderUserId())
                        .addValue("recipientUserId", message.recipientUserId())
                        .addValue("body", message.body()), MAPPER);
    }

    @Override
    public List<TeamChatRecord> listVisibleMessages(String organizationId, String userId, int limit) {
        String sql = """
                SELECT * FROM "TeamChatMessage"
                WHERE "organizationId" = :organizationId
                  AND ("recipientUserId" IS NULL OR "senderUserId" = :userId OR "recipientUserId" = :userId)
                ORDER BY "createdAt" DESC
                LIMIT :limit""";
        List<TeamChatRecord> desc = jdbc.query(sql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("userId", userId)
                .addValue("limit", limit), MAPPER);
        List<TeamChatRecord> asc = new ArrayList<>(desc);
        Collections.reverse(asc);
        return asc;
    }
}
