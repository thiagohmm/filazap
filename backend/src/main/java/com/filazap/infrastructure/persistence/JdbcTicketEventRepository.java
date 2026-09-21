package com.filazap.infrastructure.persistence;

import com.filazap.application.port.TicketEventRepository;
import com.filazap.domain.entity.TicketEvent;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class JdbcTicketEventRepository implements TicketEventRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcTicketEventRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<TicketEvent> MAPPER = (rs, i) -> TicketEvent.restore(
            rs.getString("id"), rs.getString("organizationId"), rs.getString("ticketId"),
            rs.getString("actorUserId"), rs.getString("eventType"), rs.getString("fromStatus"),
            rs.getString("toStatus"), JsonCodec.toMap(rs.getString("payload")),
            Rows.ts(rs, "createdAt"));

    @Override
    public TicketEvent save(TicketEvent event) {
        String sql = """
                INSERT INTO "TicketEvent"
                  (id, "organizationId", "ticketId", "actorUserId", "eventType",
                   "fromStatus", "toStatus", payload)
                VALUES (:id, :organizationId, :ticketId, :actorUserId, :eventType,
                   :fromStatus, :toStatus, :payload::jsonb)
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", event.getId())
                .addValue("organizationId", event.getOrganizationId())
                .addValue("ticketId", event.getTicketId())
                .addValue("actorUserId", event.getActorUserId())
                .addValue("eventType", event.getEventType())
                .addValue("fromStatus", event.getFromStatus())
                .addValue("toStatus", event.getToStatus())
                .addValue("payload", JsonCodec.toJson(event.getPayload()));
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public List<TicketEvent> findByTicketId(String organizationId, String ticketId) {
        String sql = "SELECT * FROM \"TicketEvent\" WHERE \"organizationId\" = :organizationId AND \"ticketId\" = :ticketId ORDER BY \"createdAt\" ASC";
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("ticketId", ticketId), MAPPER);
    }
}
