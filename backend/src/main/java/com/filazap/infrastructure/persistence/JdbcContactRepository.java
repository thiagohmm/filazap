package com.filazap.infrastructure.persistence;

import com.filazap.application.port.ContactRepository;
import com.filazap.domain.entity.Contact;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public class JdbcContactRepository implements ContactRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcContactRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Contact> MAPPER = (rs, i) -> Contact.restore(
            rs.getString("id"), rs.getString("organizationId"), rs.getString("channelId"),
            rs.getString("phoneE164"), rs.getString("name"),
            JsonCodec.toMap(rs.getString("metadata")),
            Rows.ts(rs, "firstContactAt"), Rows.ts(rs, "lastContactAt"),
            Rows.ts(rs, "createdAt"), Rows.ts(rs, "updatedAt"));

    @Override
    public Contact save(Contact contact) {
        String sql = """
                INSERT INTO "Contact"
                  (id, "organizationId", "channelId", "phoneE164", name, metadata,
                   "firstContactAt", "lastContactAt")
                VALUES (:id, :organizationId, :channelId, :phoneE164, :name, :metadata::jsonb,
                   :firstContactAt, :lastContactAt)
                ON CONFLICT (id) DO UPDATE SET
                  name = EXCLUDED.name,
                  metadata = EXCLUDED.metadata,
                  "lastContactAt" = EXCLUDED."lastContactAt",
                  "updatedAt" = now()
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", contact.getId())
                .addValue("organizationId", contact.getOrganizationId())
                .addValue("channelId", contact.getChannelId())
                .addValue("phoneE164", contact.getPhoneE164())
                .addValue("name", contact.getName())
                .addValue("metadata", JsonCodec.toJson(contact.getMetadata()))
                .addValue("firstContactAt", contact.getFirstContactAt())
                .addValue("lastContactAt", contact.getLastContactAt());
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public Contact findById(String id) {
        String sql = "SELECT * FROM \"Contact\" WHERE id = :id";
        return jdbc.query(sql, new MapSqlParameterSource("id", id), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public Contact findByChannelAndPhone(String organizationId, String channelId, String phoneE164) {
        String sql = "SELECT * FROM \"Contact\" WHERE \"organizationId\" = :organizationId AND \"channelId\" = :channelId AND \"phoneE164\" = :phoneE164";
        return jdbc.query(sql, new MapSqlParameterSource()
                        .addValue("organizationId", organizationId)
                        .addValue("channelId", channelId)
                        .addValue("phoneE164", phoneE164), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public List<ContactSearchResult> search(String organizationId, String query, int limit) {
        String trimmed = query.trim();
        if (trimmed.isEmpty()) return List.of();
        String like = "%" + trimmed + "%";
        String sql = """
                SELECT c.*,
                  (SELECT COUNT(*) FROM "Ticket" t WHERE t."contactId" = c.id) AS "totalTickets",
                  (SELECT MAX(t."lastMessageAt") FROM "Ticket" t WHERE t."contactId" = c.id) AS "lastMessageAt"
                FROM "Contact" c
                WHERE c."organizationId" = :organizationId
                  AND (c.name ILIKE :like OR c."phoneE164" LIKE :like)
                ORDER BY c."lastContactAt" DESC
                LIMIT :limit""";
        return jdbc.query(sql, new MapSqlParameterSource()
                        .addValue("organizationId", organizationId)
                        .addValue("like", like)
                        .addValue("limit", limit),
                (rs, i) -> new ContactSearchResult(
                        MAPPER.mapRow(rs, i),
                        rs.getInt("totalTickets"),
                        (Instant) rs.getObject("lastMessageAt", Instant.class)));
    }
}
