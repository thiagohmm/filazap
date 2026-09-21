package com.filazap.infrastructure.persistence;

import com.filazap.application.port.InternalNoteRepository;
import com.filazap.domain.entity.InternalNote;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class JdbcInternalNoteRepository implements InternalNoteRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcInternalNoteRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<InternalNote> MAPPER = (rs, i) -> InternalNote.restore(
            rs.getString("id"), rs.getString("organizationId"), rs.getString("contactId"),
            rs.getString("ticketId"), rs.getString("authorUserId"), rs.getString("body"),
            Rows.ts(rs, "createdAt"), Rows.ts(rs, "updatedAt"));

    @Override
    public InternalNote save(InternalNote note) {
        String sql = """
                INSERT INTO "InternalNote"
                  (id, "organizationId", "contactId", "ticketId", "authorUserId", body)
                VALUES (:id, :organizationId, :contactId, :ticketId, :authorUserId, :body)
                ON CONFLICT (id) DO UPDATE SET
                  body = EXCLUDED.body,
                  "updatedAt" = now()
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", note.getId())
                .addValue("organizationId", note.getOrganizationId())
                .addValue("contactId", note.getContactId())
                .addValue("ticketId", note.getTicketId())
                .addValue("authorUserId", note.getAuthorUserId())
                .addValue("body", note.getBody());
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public InternalNote findById(String id) {
        String sql = "SELECT * FROM \"InternalNote\" WHERE id = :id";
        return jdbc.query(sql, new MapSqlParameterSource("id", id), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public List<InternalNote> findByContactId(String organizationId, String contactId) {
        String sql = "SELECT * FROM \"InternalNote\" WHERE \"organizationId\" = :organizationId AND \"contactId\" = :contactId ORDER BY \"createdAt\" ASC";
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("contactId", contactId), MAPPER);
    }
}
