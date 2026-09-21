package com.filazap.domain.valueobject;

import com.filazap.domain.error.InvalidSlugError;

import java.text.Normalizer;

public record Slug(String value) {
    public static Slug create(String raw) {
        String slug = raw.trim().toLowerCase();
        if (!slug.matches("^[a-z0-9]+(?:-[a-z0-9]+)*$")) {
            throw new InvalidSlugError(raw);
        }
        return new Slug(slug);
    }

    public static Slug createFromName(String name) {
        String slug = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("[\\u0300-\\u036f]", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return Slug.create(slug);
    }
}
