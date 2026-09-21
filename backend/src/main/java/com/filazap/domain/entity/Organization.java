package com.filazap.domain.entity;

import com.filazap.domain.valueobject.Slug;

import java.time.Instant;

public class Organization {
    private final String id;
    private final String name;
    private final String slug;
    private final String timezone;
    private final String plan;
    private final String subscriptionStatus;
    private String theme;
    private String brandColor;
    private final Instant createdAt;
    private final Instant updatedAt;

    private Organization(String id, String name, String slug, String timezone, String plan,
                         String subscriptionStatus, String theme, String brandColor,
                         Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.name = name;
        this.slug = slug;
        this.timezone = timezone;
        this.plan = plan;
        this.subscriptionStatus = subscriptionStatus;
        this.theme = theme;
        this.brandColor = brandColor;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static Organization create(String id, String name) {
        String slug = Slug.createFromName(name).value();
        Instant now = Instant.now();
        return new Organization(id, name, slug, "America/Sao_Paulo", "STARTER", "TRIAL",
                "light", "#10b981", now, now);
    }

    public static Organization restore(String id, String name, String slug, String timezone,
                                       String plan, String subscriptionStatus, String theme,
                                       String brandColor, Instant createdAt, Instant updatedAt) {
        return new Organization(id, name, slug, timezone, plan, subscriptionStatus, theme,
                brandColor, createdAt, updatedAt);
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getSlug() { return slug; }
    public String getTimezone() { return timezone; }
    public String getPlan() { return plan; }
    public String getSubscriptionStatus() { return subscriptionStatus; }
    public String getTheme() { return theme; }
    public String getBrandColor() { return brandColor; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void updateAppearance(String theme, String brandColor) {
        this.theme = theme;
        this.brandColor = brandColor;
    }
}
