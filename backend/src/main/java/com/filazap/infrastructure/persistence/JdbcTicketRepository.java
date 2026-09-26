package com.filazap.infrastructure.persistence;

import com.filazap.application.port.TicketRepository;
import com.filazap.domain.entity.Ticket;
import com.filazap.domain.valueobject.TicketStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Repository
public class JdbcTicketRepository implements TicketRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcTicketRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Ticket> MAPPER = (rs, i) -> Ticket.restore(
            rs.getString("id"), rs.getString("organizationId"), rs.getString("channelId"),
            rs.getString("contactId"), rs.getInt("sequenceNumber"),
            TicketStatus.fromString(rs.getString("status")), rs.getInt("priority"),
            Rows.ts(rs, "queueEnteredAt"), rs.getString("assignedUserId"),
            Rows.ts(rs, "assignedAt"), Rows.ts(rs, "firstResponseAt"),
            Rows.ts(rs, "waitingCustomerSince"), Rows.ts(rs, "finishedAt"),
            Rows.ts(rs, "lastMessageAt"), Rows.ts(rs, "createdAt"), Rows.ts(rs, "updatedAt"));

    @Override
    public Ticket save(Ticket ticket) {
        String sql = """
                INSERT INTO "Ticket"
                  (id, "organizationId", "channelId", "contactId", "sequenceNumber", status,
                   priority, "queueEnteredAt", "assignedUserId", "assignedAt",
                   "firstResponseAt", "waitingCustomerSince", "finishedAt", "lastMessageAt")
                VALUES (:id, :organizationId, :channelId, :contactId, :sequenceNumber, :status,
                   :priority, :queueEnteredAt, :assignedUserId, :assignedAt,
                   :firstResponseAt, :waitingCustomerSince, :finishedAt, :lastMessageAt)
                ON CONFLICT (id) DO UPDATE SET
                  status = EXCLUDED.status,
                  priority = EXCLUDED.priority,
                  "assignedUserId" = EXCLUDED."assignedUserId",
                  "assignedAt" = EXCLUDED."assignedAt",
                  "firstResponseAt" = EXCLUDED."firstResponseAt",
                  "waitingCustomerSince" = EXCLUDED."waitingCustomerSince",
                  "finishedAt" = EXCLUDED."finishedAt",
                  "lastMessageAt" = EXCLUDED."lastMessageAt",
                  "updatedAt" = now()
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", ticket.getId())
                .addValue("organizationId", ticket.getOrganizationId())
                .addValue("channelId", ticket.getChannelId())
                .addValue("contactId", ticket.getContactId())
                .addValue("sequenceNumber", ticket.getSequenceNumber())
                .addValue("status", ticket.getStatusName())
                .addValue("priority", ticket.getPriority())
                .addValue("queueEnteredAt", Params.instant(ticket.getQueueEnteredAt()))
                .addValue("assignedUserId", ticket.getAssignedUserId())
                .addValue("assignedAt", Params.instant(ticket.getAssignedAt()))
                .addValue("firstResponseAt", Params.instant(ticket.getFirstResponseAt()))
                .addValue("waitingCustomerSince", Params.instant(ticket.getWaitingCustomerSince()))
                .addValue("finishedAt", Params.instant(ticket.getFinishedAt()))
                .addValue("lastMessageAt", Params.instant(ticket.getLastMessageAt()));
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public Ticket findById(String id) {
        String sql = "SELECT * FROM \"Ticket\" WHERE id = :id";
        return jdbc.query(sql, new MapSqlParameterSource("id", id), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public Ticket findOpenByContact(String contactId) {
        String sql = "SELECT * FROM \"Ticket\" WHERE \"contactId\" = :contactId AND status IN ('WAITING','RETURNING') ORDER BY \"createdAt\" ASC LIMIT 1";
        return jdbc.query(sql, new MapSqlParameterSource("contactId", contactId), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public Ticket findActiveByContact(String contactId) {
        String sql = "SELECT * FROM \"Ticket\" WHERE \"contactId\" = :contactId AND status <> 'FINISHED' ORDER BY \"createdAt\" ASC LIMIT 1";
        return jdbc.query(sql, new MapSqlParameterSource("contactId", contactId), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public int nextSequenceNumber(String organizationId) {
        String sql = "SELECT COALESCE(MAX(\"sequenceNumber\"), 0) + 1 FROM \"Ticket\" WHERE \"organizationId\" = :organizationId";
        Integer next = jdbc.queryForObject(sql,
                new MapSqlParameterSource("organizationId", organizationId), Integer.class);
        return next == null ? 1 : next;
    }

    @Override
    public List<QueueTicket> listQueue(TicketQueueFilter filter) {
        StringBuilder sql = new StringBuilder("""
                SELECT t.*, c.name AS "contactName", c."phoneE164" AS "contactPhone",
                  u.name AS "assignedUserName",
                  (SELECT m.body FROM "Message" m WHERE m."ticketId" = t.id
                     ORDER BY m."providerTimestamp" DESC LIMIT 1) AS "lastMessageBody",
                  (SELECT m."providerTimestamp" FROM "Message" m WHERE m."ticketId" = t.id
                     ORDER BY m."providerTimestamp" DESC LIMIT 1) AS "lastMessageAt"
                FROM "Ticket" t
                JOIN "Contact" c ON c.id = t."contactId"
                LEFT JOIN "User" u ON u.id = t."assignedUserId"
                WHERE t."organizationId" = :organizationId""");
        var params = new MapSqlParameterSource("organizationId", filter.organizationId());
        if (filter.status() != null) {
            sql.append(" AND t.status = :status");
            params.addValue("status", filter.status().name());
        }
        if (filter.assignedUserId() != null) {
            sql.append(" AND t.\"assignedUserId\" = :assignedUserId");
            params.addValue("assignedUserId", filter.assignedUserId());
        }
        sql.append(" ORDER BY t.priority DESC, t.\"queueEnteredAt\" ASC LIMIT :limit");
        params.addValue("limit", filter.limit() == null ? 100 : filter.limit());

        return jdbc.query(sql.toString(), params, (rs, i) -> new QueueTicket(
                MAPPER.mapRow(rs, i), rs.getString("contactName"), rs.getString("contactPhone"),
                rs.getString("assignedUserName"), rs.getString("lastMessageBody"),
                Rows.ts(rs, "lastMessageAt")));
    }

    @Override
    @Transactional
    public AssignResult assignNext(String organizationId, String userId, Instant now) {
        String findSql = """
                SELECT id FROM "Ticket"
                WHERE "organizationId" = :organizationId
                  AND status IN ('WAITING','RETURNING') AND "assignedUserId" IS NULL
                ORDER BY priority DESC, "queueEnteredAt" ASC LIMIT 1""";
        List<String> ids = jdbc.queryForList(findSql,
                new MapSqlParameterSource("organizationId", organizationId), String.class);
        if (ids.isEmpty()) {
            return AssignResult.failure("NOT_AVAILABLE");
        }
        String candidateId = ids.get(0);

        String updateSql = """
                UPDATE "Ticket" SET status = 'IN_PROGRESS', "assignedUserId" = :userId,
                  "assignedAt" = :now, "updatedAt" = :now
                WHERE id = :id AND status IN ('WAITING','RETURNING') AND "assignedUserId" IS NULL""";
        int updated = jdbc.update(updateSql, new MapSqlParameterSource()
                .addValue("id", candidateId).addValue("userId", userId).addValue("now", Params.instant(now)));
        if (updated == 0) {
            return AssignResult.failure("ALREADY_ASSIGNED");
        }
        return AssignResult.success(findById(candidateId));
    }

    @Override
    @Transactional
    public AssignResult assignTicket(String ticketId, String userId, Instant now) {
        String updateSql = """
                UPDATE "Ticket" SET status = 'IN_PROGRESS', "assignedUserId" = :userId,
                  "assignedAt" = :now, "updatedAt" = :now
                WHERE id = :id AND status IN ('WAITING','RETURNING') AND "assignedUserId" IS NULL""";
        int updated = jdbc.update(updateSql, new MapSqlParameterSource()
                .addValue("id", ticketId).addValue("userId", userId).addValue("now", Params.instant(now)));
        if (updated == 0) {
            return AssignResult.failure("ALREADY_ASSIGNED");
        }
        return AssignResult.success(findById(ticketId));
    }

    @Override
    public List<Ticket> findAssignedOpenByUser(String organizationId, String userId) {
        String sql = """
                SELECT * FROM "Ticket"
                WHERE "organizationId" = :organizationId AND "assignedUserId" = :userId
                  AND status IN ('IN_PROGRESS','WAITING_CUSTOMER')
                ORDER BY priority DESC, "queueEnteredAt" ASC""";
        return jdbc.query(sql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("userId", userId), MAPPER);
    }

    @Override
    public OperationalCounters getOperationalCounters(String organizationId, Instant now) {
        Instant dayStart = now.atZone(ZoneOffset.UTC).toLocalDate()
                .atStartOfDay(ZoneOffset.UTC).toInstant();

        long waiting = count(organizationId, "WAITING");
        long returning = count(organizationId, "RETURNING");
        long inProgress = count(organizationId, "IN_PROGRESS");
        long waitingCustomer = count(organizationId, "WAITING_CUSTOMER");

        String finishedSql = """
                SELECT COUNT(*) FROM "Ticket"
                WHERE "organizationId" = :organizationId AND status = 'FINISHED'
                  AND "finishedAt" >= :dayStart""";
        Long finishedToday = jdbc.queryForObject(finishedSql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("dayStart", Params.instant(dayStart)), Long.class);

        String oldestSql = """
                SELECT * FROM "Ticket"
                WHERE "organizationId" = :organizationId AND status IN ('WAITING','RETURNING')
                ORDER BY priority DESC, "queueEnteredAt" ASC LIMIT 1""";
        Ticket oldest = jdbc.query(oldestSql,
                new MapSqlParameterSource("organizationId", organizationId), MAPPER)
                .stream().findFirst().orElse(null);

        String avgSql = """
                SELECT AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "queueEnteredAt")))
                FROM "Ticket"
                WHERE "organizationId" = :organizationId AND "firstResponseAt" IS NOT NULL""";
        Double avgFirstResponseSeconds = jdbc.queryForObject(avgSql,
                new MapSqlParameterSource("organizationId", organizationId), Double.class);

        Long maxWaitSeconds = oldest != null
                ? Math.max(0, Duration.between(oldest.getQueueEnteredAt(), now).getSeconds())
                : null;

        return new OperationalCounters(waiting, returning, inProgress, waitingCustomer,
                finishedToday == null ? 0 : finishedToday, maxWaitSeconds, avgFirstResponseSeconds);
    }

    @Override
    public List<TicketHistoryItem> findByContact(String organizationId, String contactId) {
        String sql = """
                SELECT t.*, u.name AS "assignedUserName"
                FROM "Ticket" t
                LEFT JOIN "User" u ON u.id = t."assignedUserId"
                WHERE t."organizationId" = :organizationId AND t."contactId" = :contactId
                ORDER BY t."queueEnteredAt" DESC""";
        return jdbc.query(sql, new MapSqlParameterSource()
                        .addValue("organizationId", organizationId).addValue("contactId", contactId),
                (rs, i) -> new TicketHistoryItem(MAPPER.mapRow(rs, i), rs.getString("assignedUserName")));
    }

    @Override
    public OrganizationMetrics getMetrics(String organizationId, Instant now) {
        String finishedSql = """
                SELECT AVG(EXTRACT(EPOCH FROM ("finishedAt" - "queueEnteredAt")))
                FROM "Ticket"
                WHERE "organizationId" = :organizationId AND status = 'FINISHED'
                  AND "finishedAt" IS NOT NULL""";
        Double avgAttendanceSeconds = jdbc.queryForObject(finishedSql,
                new MapSqlParameterSource("organizationId", organizationId), Double.class);

        String totalSql = """
                SELECT COUNT(*) FROM "Ticket"
                WHERE "organizationId" = :organizationId AND status = 'FINISHED'""";
        Long totalFinished = jdbc.queryForObject(totalSql,
                new MapSqlParameterSource("organizationId", organizationId), Long.class);

        String perAgentSql = """
                SELECT u.id AS "userId", u.name, COUNT(t.id)::int AS "count"
                FROM "Ticket" t
                JOIN "User" u ON u.id = t."assignedUserId"
                WHERE t."organizationId" = :organizationId
                GROUP BY u.id, u.name
                ORDER BY "count" DESC""";
        List<TicketsPerAgent> perAgent = jdbc.query(perAgentSql,
                new MapSqlParameterSource("organizationId", organizationId),
                (rs, i) -> new TicketsPerAgent(rs.getString("userId"), rs.getString("name"),
                        rs.getInt("count")));

        String returnSql = """
                SELECT COUNT(*)::int AS "withTickets",
                       COUNT(*) FILTER (WHERE "ticketCount" >= 2)::int AS "returning"
                FROM (SELECT "contactId", COUNT(*) AS "ticketCount"
                      FROM "Ticket" WHERE "organizationId" = :organizationId
                      GROUP BY "contactId") counts""";
        long[] returnCounts = jdbc.queryForObject(returnSql,
                new MapSqlParameterSource("organizationId", organizationId),
                (rs, i) -> new long[]{rs.getLong("withTickets"), rs.getLong("returning")});

        Double returnRate = returnCounts[0] > 0
                ? Math.round((returnCounts[1] / (double) returnCounts[0]) * 1000) / 10.0
                : null;

        return new OrganizationMetrics(avgAttendanceSeconds,
                totalFinished == null ? 0 : totalFinished.intValue(), perAgent, returnRate);
    }

    private long count(String organizationId, String status) {
        String sql = "SELECT COUNT(*) FROM \"Ticket\" WHERE \"organizationId\" = :organizationId AND status = :status";
        Long value = jdbc.queryForObject(sql, new MapSqlParameterSource()
                .addValue("organizationId", organizationId).addValue("status", status), Long.class);
        return value == null ? 0 : value;
    }
}
