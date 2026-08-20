export type ParsedWebhookMessage = {
  whatsappMessageId: string;
  from: string;
  timestamp: string;
  type: string;
  body: string | null;
};

export type ParsedWebhookStatus = {
  whatsappMessageId: string;
  status: string;
  timestamp: string;
};

export type ParsedWebhook = {
  businessAccountId: string | null;
  phoneNumberId: string | null;
  messages: ParsedWebhookMessage[];
  statuses: ParsedWebhookStatus[];
};

export interface WhatsAppWebhookParser {
  parse(payload: Record<string, unknown>): ParsedWebhook;
}
