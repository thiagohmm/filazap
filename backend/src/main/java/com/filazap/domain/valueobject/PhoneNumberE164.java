package com.filazap.domain.valueobject;

import com.filazap.domain.error.InvalidPhoneNumberError;

public record PhoneNumberE164(String e164) {
    public static PhoneNumberE164 create(String raw) {
        String normalized = raw.replaceAll("[^0-9+]", "");
        String withoutPrefix = normalized.replaceFirst("^\\+", "");
        if (!withoutPrefix.matches("^[1-9]\\d{7,14}$")) {
            throw new InvalidPhoneNumberError(raw);
        }
        return new PhoneNumberE164("+" + withoutPrefix);
    }

    public static PhoneNumberE164 restore(String value) {
        return new PhoneNumberE164(value);
    }

    @Override
    public String toString() {
        return e164;
    }
}
