package com.filazap.application.port;

import java.util.Map;

/** Registro de eventos de auditoria. */
public interface AuditLogger {
    void log(String level, String message, Map<String, Object> context);
}
