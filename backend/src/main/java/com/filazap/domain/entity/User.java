package com.filazap.domain.entity;

import com.filazap.domain.service.PasswordHasher;

import java.time.Instant;

public class User {
    private final String id;
    private final String email;
    private final String name;
    private String passwordHash;
    private final Instant createdAt;
    private final Instant updatedAt;

    private User(String id, String email, String name, String passwordHash,
                 Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.email = email;
        this.name = name;
        this.passwordHash = passwordHash;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static User create(String id, String email, String name, String passwordHash) {
        Instant now = Instant.now();
        return new User(id, email, name, passwordHash, now, now);
    }

    public static User restore(String id, String email, String name, String passwordHash,
                               Instant createdAt, Instant updatedAt) {
        return new User(id, email, name, passwordHash, createdAt, updatedAt);
    }

    public String getId() { return id; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public String getPasswordHash() { return passwordHash; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public boolean verifyPassword(String password, PasswordHasher hasher) {
        return hasher.verify(password, passwordHash);
    }
}
