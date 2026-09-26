package com.filazap.infrastructure.persistence;

import com.filazap.application.port.MessageRepository;
import com.filazap.domain.entity.Message;
import com.filazap.domain.valueobject.MessageDirection;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class JdbcMessageRepository implements MessageRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcMessageRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Message> MAPPER = (rs, i) -> Message.restore(
            rs.getString("id"), rs.getString("organizationId"), rs.getString("ticketId"),
            rs.getString("contactId"), rs.getString("whatsappMessageId"),
            MessageDirection.fromString(rs.getString("direction")), rs.getString("type"),
            rs.getString("body"), rs.getString("mediaPath"), rs.getString("senderUserId"),
            rs.getString("providerStatus"), Rows.ts(rs, "providerTimestamp"), Rows.ts(rs, "createdAt"));

    @Override
    public Message save(Message message) {
        String sql = """
                INSERT INTO "Message"
                  (id, "organizationId", "ticketId", "contactId", "whatsappMessageId",
                   direction, type, body, "mediaPath", "senderUserId", "providerStatus",
                   "providerTimestamp")
                VALUES (:id, :organizationId, :ticketId, :contactId, :whatsappMessageId,
                   :direction, :type, :body, :mediaPath, :senderUserId, :providerStatus,
                   :providerTimestamp)
                ON CONFLICT (id) DO UPDATE SET
                  "whatsappMessageId" = EXCLUDED."whatsappMessageId",
                  "providerStatus" = EXCLUDED."providerStatus"
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", message.getId())
                .addValue("organizationId", message.getOrganizationId())
                .addValue("ticketId", message.getTicketId())
                .addValue("contactId", message.getContactId())
                .addValue("whatsappMessageId", message.getWhatsappMessageId())
                .addValue("direction", message.getDirection().name())
                .addValue("type", message.getType())
                .addValue("body", message.getBody())
                .addValue("mediaPath", message.getMediaPath())
                .addValue("senderUserId", message.getSenderUserId())
                .addValue("providerStatus", message.getProviderStatus())
                .addValue("providerTimestamp", Params.instant(message.getProviderTimestamp()));
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public Message findById(String id) {
        String sql = "SELECT * FROM \"Message\" WHERE id = :id";
        return jdbc.query(sql, new MapSqlParameterSource("id", id), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public Message findByWhatsappMessageId(String whatsappMessageId) {
        String sql = "SELECT * FROM \"Message\" WHERE \"whatsappMessageId\" = :whatsappMessageId";
        return jdbc.query(sql, new MapSqlParameterSource("whatsappMessageId", whatsappMessageId), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public List<Message> findByTicketId(String organizationId, String ticketId) {
        String sql = "SELECT * FROM \"Message\" WHERE \"organizationId\" = :organizationId AND \"ticketId\" = :ticketId ORDER BY \"providerTimestamp\" ASC";
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("ticketId", ticketId), MAPPER);
    }
}
