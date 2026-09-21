package com.filazap.infrastructure.persistence;

import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.domain.entity.OrganizationMember;
import com.filazap.domain.valueobject.Role;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public class JdbcOrganizationMemberRepository implements OrganizationMemberRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcOrganizationMemberRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<OrganizationMember> MAPPER = (rs, i) -> OrganizationMember.restore(
            rs.getString("id"), rs.getString("organizationId"), rs.getString("userId"),
            Role.fromString(rs.getString("role")), rs.getBoolean("active"),
            Rows.ts(rs, "createdAt"), Rows.ts(rs, "updatedAt"));

    @Override
    public OrganizationMember save(OrganizationMember member) {
        String sql = """
                INSERT INTO "OrganizationMember" (id, "organizationId", "userId", role, active)
                VALUES (:id, :organizationId, :userId, :role, :active)
                ON CONFLICT ("organizationId", "userId") DO UPDATE SET
                  role = EXCLUDED.role,
                  active = EXCLUDED.active,
                  "updatedAt" = now()
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", member.getId())
                .addValue("organizationId", member.getOrganizationId())
                .addValue("userId", member.getUserId())
                .addValue("role", member.getRole().name())
                .addValue("active", member.isActive());
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public List<OrganizationMember> findByOrganizationId(String organizationId) {
        String sql = "SELECT * FROM \"OrganizationMember\" WHERE \"organizationId\" = :organizationId";
        return jdbc.query(sql, new MapSqlParameterSource("organizationId", organizationId), MAPPER);
    }

    @Override
    public OrganizationMember findById(String id) {
        String sql = "SELECT * FROM \"OrganizationMember\" WHERE id = :id";
        return jdbc.query(sql, new MapSqlParameterSource("id", id), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    @Transactional
    public RemoveAgentResult deactivateAgentAndReleaseTickets(RemoveAgentInput input) {
        String updateMember = """
                UPDATE "OrganizationMember" SET active = false, "updatedAt" = :now
                WHERE id = :memberId AND "organizationId" = :organizationId
                  AND "userId" = :userId AND role = 'AGENT' AND active = true""";
        int removed = jdbc.update(updateMember, new MapSqlParameterSource()
                .addValue("memberId", input.memberId())
                .addValue("organizationId", input.organizationId())
                .addValue("userId", input.userId())
                .addValue("now", input.now()));
        if (removed != 1) {
            return new RemoveAgentResult(false, 0);
        }

        String releaseTickets = """
                UPDATE "Ticket" SET
                  status = 'RETURNING',
                  "assignedUserId" = NULL,
                  "assignedAt" = NULL,
                  "waitingCustomerSince" = NULL,
                  "queueEnteredAt" = :now,
                  "updatedAt" = :now
                WHERE "organizationId" = :organizationId AND "assignedUserId" = :userId
                  AND status IN ('IN_PROGRESS', 'WAITING_CUSTOMER')""";
        int released = jdbc.update(releaseTickets, new MapSqlParameterSource()
                .addValue("organizationId", input.organizationId())
                .addValue("userId", input.userId())
                .addValue("now", input.now()));
        return new RemoveAgentResult(true, released);
    }

    @Override
    public OrganizationMember findByUserAndOrganization(String userId, String organizationId) {
        String sql = "SELECT * FROM \"OrganizationMember\" WHERE \"userId\" = :userId AND \"organizationId\" = :organizationId";
        return jdbc.query(sql, new MapSqlParameterSource()
                        .addValue("userId", userId).addValue("organizationId", organizationId), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public List<OrganizationMember> findUsersByOrganizationAndRoles(String organizationId, List<Role> roles) {
        String sql = "SELECT * FROM \"OrganizationMember\" WHERE \"organizationId\" = :organizationId AND role IN (:roles)";
        var params = new MapSqlParameterSource()
                .addValue("organizationId", organizationId)
                .addValue("roles", roles.stream().map(Role::name).toList());
        return jdbc.query(sql, params, MAPPER);
    }

    @Override
    public long countByOrganization(String organizationId) {
        String sql = "SELECT COUNT(*) FROM \"OrganizationMember\" WHERE \"organizationId\" = :organizationId";
        Long count = jdbc.queryForObject(sql,
                new MapSqlParameterSource("organizationId", organizationId), Long.class);
        return count == null ? 0 : count;
    }

    @Override
    public List<MemberWithOrganization> findByUserIdActive(String userId) {
        String sql = """
                SELECT m.*, o.id AS "orgId", o.name AS "orgName", o.slug AS "orgSlug",
                       o.theme AS "theme", o."brandColor" AS "brandColor"
                FROM "OrganizationMember" m
                JOIN "Organization" o ON o.id = m."organizationId"
                WHERE m."userId" = :userId AND m.active = true""";
        return jdbc.query(sql, new MapSqlParameterSource("userId", userId), (rs, i) -> {
            OrganizationMember member = MAPPER.mapRow(rs, i);
            return new MemberWithOrganization(member, rs.getString("orgId"), rs.getString("orgName"),
                    rs.getString("orgSlug"), rs.getString("theme"), rs.getString("brandColor"));
        });
    }
}
