package com.filazap.domain.valueobject;

import com.filazap.domain.error.InvalidEmailError;

public record Email(String value) {
    private static final java.util.regex.Pattern PATTERN =
            java.util.regex.Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    public static Email create(String raw) {
        String email = raw.trim().toLowerCase();
        if (!PATTERN.matcher(email).matches()) {
            throw new InvalidEmailError(raw);
        }
        return new Email(email);
    }
}
