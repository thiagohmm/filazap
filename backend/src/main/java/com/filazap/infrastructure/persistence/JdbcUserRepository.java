package com.filazap.infrastructure.persistence;

import com.filazap.application.port.UserRepository;
import com.filazap.domain.entity.User;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;


@Repository
public class JdbcUserRepository implements UserRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public JdbcUserRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<User> MAPPER = (rs, i) -> User.restore(
            rs.getString("id"), rs.getString("email"), rs.getString("name"),
            rs.getString("passwordHash"), Rows.ts(rs, "createdAt"), Rows.ts(rs, "updatedAt"));

    @Override
    public User save(User user) {
        String sql = """
                INSERT INTO "User" (id, email, name, "passwordHash")
                VALUES (:id, :email, :name, :passwordHash)
                ON CONFLICT (id) DO UPDATE SET
                  email = EXCLUDED.email,
                  name = EXCLUDED.name,
                  "passwordHash" = EXCLUDED."passwordHash",
                  "updatedAt" = now()
                RETURNING *""";
        var params = new MapSqlParameterSource()
                .addValue("id", user.getId())
                .addValue("email", user.getEmail())
                .addValue("name", user.getName())
                .addValue("passwordHash", user.getPasswordHash());
        return jdbc.queryForObject(sql, params, MAPPER);
    }

    @Override
    public User findByEmail(String email) {
        String sql = "SELECT * FROM \"User\" WHERE email = :email";
        return jdbc.query(sql, new MapSqlParameterSource("email", email), MAPPER)
                .stream().findFirst().orElse(null);
    }

    @Override
    public User findById(String id) {
        String sql = "SELECT * FROM \"User\" WHERE id = :id";
        return jdbc.query(sql, new MapSqlParameterSource("id", id), MAPPER)
                .stream().findFirst().orElse(null);
    }

}
