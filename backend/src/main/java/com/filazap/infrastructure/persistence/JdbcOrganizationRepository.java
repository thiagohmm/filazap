package com.filazap.infrastructure.persistence;

import com.filazap.application.port.OrganizationRepository;
import com.filazap.domain.entity.Organization;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcOrganizationRepository implements OrganizationRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcOrganizationRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Organization> MAPPER = (rs, i) -> Organization.restore(
            rs.getString("id"), rs.getString("name"), rs.getString("slug"),
            rs.getString("timezone"), rs.getString("plan"),
            rs.getString("subscriptionStatus"), rs.getString("theme"),
            rs.getString("brandColor"), Rows.ts(rs, "createdAt"), Rows.ts(rs, "updatedAt"));

    @Override
    public Organization save(Organization org) {
        String sql = """
                INSERT INTO "Organization"
                  (id, name, slug, timezone, plan, "subscriptionStatus", theme, "brandColor")
                VALUES (:id, :name, :slug, :timezone, :plan, :subscriptionStatus, :theme, :brandColor)
                ON CONFLICT (id) DO UPDATE SET
                  name = EXCLUDED.name,
                  timezone = EXCLUDED.timezone,
                  plan = EXCLUDED.plan,
                  "subscriptionStatus" = EXCLUDED."subscriptionStatus",
                  theme = EXCLUDED.theme,
                  "brandColor" = EXCLUDED."brandColor",
                  "updatedAt" = now()
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", org.getId())
                .addValue("name", org.getName())
                .addValue("slug", org.getSlug())
                .addValue("timezone", org.getTimezone())
                .addValue("plan", org.getPlan())
                .addValue("subscriptionStatus", org.getSubscriptionStatus())
                .addValue("theme", org.getTheme())
                .addValue("brandColor", org.getBrandColor());
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public Organization findBySlug(String slug) {
        String sql = "SELECT * FROM \"Organization\" WHERE slug = :slug";
        return jdbc.query(sql, new MapSqlParameterSource("slug", slug), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public Organization findById(String id) {
        String sql = "SELECT * FROM \"Organization\" WHERE id = :id";
        return jdbc.query(sql, new MapSqlParameterSource("id", id), MAPPER)
                .stream().findFirst().orElse(null);
    }
}
