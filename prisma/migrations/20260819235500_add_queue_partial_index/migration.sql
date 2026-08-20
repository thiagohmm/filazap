-- Fila justa: prioridade desc, depois tempo de entrada asc, apenas tickets em fila.
CREATE INDEX IF NOT EXISTS "tickets_queue_idx"
ON "Ticket" ("organizationId", "status", "priority" DESC, "queueEnteredAt" ASC)
WHERE "status" IN ('WAITING', 'RETURNING');
