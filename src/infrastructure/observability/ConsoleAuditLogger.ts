import type { AuditLogger } from '../../application/ports/AuditLogger';

export class ConsoleAuditLogger implements AuditLogger {
  log(
    level: 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): void {
    const entry = {
      level,
      message,
      ...(context ?? {}),
      timestamp: new Date().toISOString()
    };
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry));
    } else {
      console.info(JSON.stringify(entry));
    }
  }
}
