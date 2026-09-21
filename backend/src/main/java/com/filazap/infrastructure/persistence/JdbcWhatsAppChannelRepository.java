package com.filazap.infrastructure.persistence;

import com.filazap.application.port.WhatsAppChannelRepository;
import com.filazap.domain.entity.WhatsAppChannel;
import com.filazap.domain.valueobject.ChannelStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class JdbcWhatsAppChannelRepository implements WhatsAppChannelRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcWhatsAppChannelRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<WhatsAppChannel> MAPPER = (rs, i) -> WhatsAppChannel.restore(
            rs.getString("id"), rs.getString("organizationId"), rs.getString("phoneNumberId"),
            rs.getString("businessAccountId"), rs.getString("displayPhoneNumber"),
            ChannelStatus.fromString(rs.getString("status")),
            rs.getString("accessTokenEncrypted"), rs.getString("appSecretEncrypted"),
            rs.getString("webhookVerifyToken"), rs.getString("apiBaseUrl"),
            Rows.ts(rs, "createdAt"), Rows.ts(rs, "updatedAt"));

    @Override
    public WhatsAppChannel save(WhatsAppChannel channel) {
        String sql = """
                INSERT INTO "WhatsAppChannel"
                  (id, "organizationId", "phoneNumberId", "businessAccountId",
                   "displayPhoneNumber", status, "accessTokenEncrypted", "appSecretEncrypted",
                   "webhookVerifyToken", "apiBaseUrl")
                VALUES (:id, :organizationId, :phoneNumberId, :businessAccountId,
                   :displayPhoneNumber, :status, :accessTokenEncrypted, :appSecretEncrypted,
                   :webhookVerifyToken, :apiBaseUrl)
                ON CONFLICT (id) DO UPDATE SET
                  "phoneNumberId" = EXCLUDED."phoneNumberId",
                  "businessAccountId" = EXCLUDED."businessAccountId",
                  "displayPhoneNumber" = EXCLUDED."displayPhoneNumber",
                  status = EXCLUDED.status,
                  "accessTokenEncrypted" = EXCLUDED."accessTokenEncrypted",
                  "appSecretEncrypted" = EXCLUDED."appSecretEncrypted",
                  "webhookVerifyToken" = EXCLUDED."webhookVerifyToken",
                  "apiBaseUrl" = EXCLUDED."apiBaseUrl",
                  "updatedAt" = now()
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", channel.getId())
                .addValue("organizationId", channel.getOrganizationId())
                .addValue("phoneNumberId", channel.getPhoneNumberId())
                .addValue("businessAccountId", channel.getBusinessAccountId())
                .addValue("displayPhoneNumber", channel.getDisplayPhoneNumber())
                .addValue("status", channel.getStatus().name())
                .addValue("accessTokenEncrypted", channel.getAccessTokenEncrypted())
                .addValue("appSecretEncrypted", channel.getAppSecretEncrypted())
                .addValue("webhookVerifyToken", channel.getWebhookVerifyToken())
                .addValue("apiBaseUrl", channel.getApiBaseUrl());
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public WhatsAppChannel findById(String id) {
        String sql = "SELECT * FROM \"WhatsAppChannel\" WHERE id = :id";
        return jdbc.query(sql, new MapSqlParameterSource("id", id), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public WhatsAppChannel findByPhoneNumberId(String phoneNumberId) {
        String sql = "SELECT * FROM \"WhatsAppChannel\" WHERE \"phoneNumberId\" = :phoneNumberId";
        return jdbc.query(sql, new MapSqlParameterSource("phoneNumberId", phoneNumberId), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public List<WhatsAppChannel> findByOrganizationId(String organizationId) {
        String sql = "SELECT * FROM \"WhatsAppChannel\" WHERE \"organizationId\" = :organizationId ORDER BY \"createdAt\" ASC";
        return jdbc.query(sql, new MapSqlParameterSource("organizationId", organizationId), MAPPER);
    }

    @Override
    public WhatsAppChannel findByBusinessAccountId(String businessAccountId) {
        String sql = "SELECT * FROM \"WhatsAppChannel\" WHERE \"businessAccountId\" = :businessAccountId LIMIT 1";
        return jdbc.query(sql, new MapSqlParameterSource("businessAccountId", businessAccountId), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public WhatsAppChannel findByWebhookVerifyToken(String verifyToken) {
        String sql = "SELECT * FROM \"WhatsAppChannel\" WHERE \"webhookVerifyToken\" = :verifyToken";
        return jdbc.query(sql, new MapSqlParameterSource("verifyToken", verifyToken), MAPPER)
                .stream().findFirst().orElse(null);
    }
}
