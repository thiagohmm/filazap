package com.filazap.infrastructure.observability;

import com.filazap.application.port.AuditLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.Map;

public class ConsoleAuditLogger implements AuditLogger {
    private static final Logger log = LoggerFactory.getLogger("audit");

    @Override
    public void log(String level, String message, Map<String, Object> context) {
        var sb = new StringBuilder("{");
        sb.append("\"level\":\"").append(level).append("\",");
        sb.append("\"message\":\"").append(escape(message)).append("\",");
        if (context != null) {
            for (var entry : context.entrySet()) {
                sb.append("\"").append(escape(entry.getKey())).append("\":");
                sb.append(jsonValue(entry.getValue())).append(",");
            }
        }
        sb.append("\"timestamp\":\"").append(Instant.now()).append("\"}");

        switch (level) {
            case "error" -> log.error(sb.toString());
            case "warn" -> log.warn(sb.toString());
            default -> log.info(sb.toString());
        }
    }

    private String jsonValue(Object value) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return String.valueOf(value);
        return "\"" + escape(String.valueOf(value)) + "\"";
    }

    private String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
