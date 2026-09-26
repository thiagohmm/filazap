package com.filazap.infrastructure.persistence;

import com.filazap.application.port.WebhookEventRepository;
import com.filazap.domain.entity.WebhookEvent;
import com.filazap.domain.valueobject.WebhookEventStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcWebhookEventRepository implements WebhookEventRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcWebhookEventRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<WebhookEvent> MAPPER = (rs, i) -> WebhookEvent.restore(
            rs.getString("id"), rs.getString("organizationId"), rs.getString("providerEventId"),
            JsonCodec.toMap(rs.getString("payload")),
            WebhookEventStatus.fromString(rs.getString("processingStatus")),
            rs.getInt("attempts"), Rows.ts(rs, "receivedAt"), Rows.ts(rs, "processedAt"),
            rs.getString("errorMessage"));

    @Override
    public WebhookEvent save(WebhookEvent event) {
        String sql = """
                INSERT INTO "WebhookEvent"
                  (id, "organizationId", "providerEventId", payload, "processingStatus",
                   attempts, "receivedAt", "processedAt", "errorMessage")
                VALUES (:id, :organizationId, :providerEventId, :payload::jsonb, :processingStatus,
                   :attempts, :receivedAt, :processedAt, :errorMessage)
                ON CONFLICT (id) DO UPDATE SET
                  "organizationId" = EXCLUDED."organizationId",
                  "providerEventId" = EXCLUDED."providerEventId",
                  payload = EXCLUDED.payload,
                  "processingStatus" = EXCLUDED."processingStatus",
                  attempts = EXCLUDED.attempts,
                  "processedAt" = EXCLUDED."processedAt",
                  "errorMessage" = EXCLUDED."errorMessage"
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", event.getId())
                .addValue("organizationId", event.getOrganizationId())
                .addValue("providerEventId", event.getProviderEventId())
                .addValue("payload", JsonCodec.toJson(event.getPayload()))
                .addValue("processingStatus", event.getProcessingStatus().name())
                .addValue("attempts", event.getAttempts())
                .addValue("receivedAt", Params.instant(event.getReceivedAt()))
                .addValue("processedAt", Params.instant(event.getProcessedAt()))
                .addValue("errorMessage", event.getErrorMessage());
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public WebhookEvent findById(String id) {
        String sql = "SELECT * FROM \"WebhookEvent\" WHERE id = :id";
        return jdbc.query(sql, new MapSqlParameterSource("id", id), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public WebhookEvent findByProviderEventId(String providerEventId) {
        String sql = "SELECT * FROM \"WebhookEvent\" WHERE \"providerEventId\" = :providerEventId";
        return jdbc.query(sql, new MapSqlParameterSource("providerEventId", providerEventId), MAPPER)
                .stream().findFirst().orElse(null);
    }
}
