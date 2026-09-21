package com.filazap.presentation.web;

import com.filazap.presentation.error.BadRequestException;

import java.util.Map;

/** Extração e validação de campos de corpos JSON. */
public final class Req {
    private Req() {}

    public static String str(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value == null ? null : String.valueOf(value);
    }

    public static String strReq(Map<String, Object> body, String key, String message) {
        String value = str(body, key);
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }

    public static boolean isEmail(String value) {
        return value != null && value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }
}
