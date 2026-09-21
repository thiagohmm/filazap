package com.filazap.domain.valueobject;

import com.filazap.domain.error.InvalidTicketStatusError;

import java.util.List;

public enum TicketStatus {
    WAITING, IN_PROGRESS, WAITING_CUSTOMER, RETURNING, FINISHED;

    public static final List<TicketStatus> ALL =
            List.of(WAITING, IN_PROGRESS, WAITING_CUSTOMER, RETURNING, FINISHED);

    public static TicketStatus fromString(String raw) {
        switch (raw.toUpperCase()) {
            case "WAITING": return WAITING;
            case "IN_PROGRESS": return IN_PROGRESS;
            case "WAITING_CUSTOMER": return WAITING_CUSTOMER;
            case "RETURNING": return RETURNING;
            case "FINISHED": return FINISHED;
            default: throw new InvalidTicketStatusError(raw);
        }
    }

    public static boolean isQueued(TicketStatus status) {
        return status == WAITING || status == RETURNING;
    }

    public static boolean isActive(TicketStatus status) {
        return status != FINISHED;
    }
}
