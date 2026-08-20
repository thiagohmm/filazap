import type {
  ParsedWebhook,
  ParsedWebhookMessage,
  ParsedWebhookStatus,
  WhatsAppWebhookParser
} from '../../application/ports/WhatsAppWebhookParser';

function getEntryValues(payload: Record<string, unknown>): Record<string, unknown>[] {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const values: Record<string, unknown>[] = [];
  for (const entry of entries) {
    const changes = (entry as Record<string, unknown>).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as Record<string, unknown>).value;
      if (value && typeof value === 'object') {
        values.push(value as Record<string, unknown>);
      }
    }
  }
  return values;
}

function extractBody(message: Record<string, unknown>): string | null {
  if (message.type === 'text') {
    const text = message.text as Record<string, unknown> | undefined;
    return typeof text?.body === 'string' ? text.body : null;
  }
  return null;
}

export class MetaWhatsAppWebhookParser implements WhatsAppWebhookParser {
  parse(payload: Record<string, unknown>): ParsedWebhook {
    const values = getEntryValues(payload);

    let businessAccountId: string | null = null;
    let phoneNumberId: string | null = null;
    const messages: ParsedWebhookMessage[] = [];
    const statuses: ParsedWebhookStatus[] = [];

    for (const value of values) {
      const metadata = value.metadata as Record<string, unknown> | undefined;
      if (metadata) {
        if (typeof metadata.phone_number_id === 'string') {
          phoneNumberId = metadata.phone_number_id;
        }
        if (typeof metadata.display_phone_number === 'string' && !businessAccountId) {
          businessAccountId = metadata.display_phone_number;
        }
      }

      const rawMessages = Array.isArray(value.messages) ? value.messages : [];
      for (const raw of rawMessages) {
        const message = raw as Record<string, unknown>;
        messages.push({
          whatsappMessageId: String(message.id ?? ''),
          from: String(message.from ?? ''),
          timestamp: String(message.timestamp ?? '0'),
          type: String(message.type ?? 'text'),
          body: extractBody(message)
        });
      }

      const rawStatuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const raw of rawStatuses) {
        const status = raw as Record<string, unknown>;
        statuses.push({
          whatsappMessageId: String(status.id ?? ''),
          status: String(status.status ?? ''),
          timestamp: String(status.timestamp ?? '0')
        });
      }
    }

    return { businessAccountId, phoneNumberId, messages, statuses };
  }
}
