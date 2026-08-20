export enum WebhookEventStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED'
}

export namespace WebhookEventStatus {
  export function fromString(raw: string): WebhookEventStatus {
    switch (raw.toUpperCase()) {
      case 'PENDING':
        return WebhookEventStatus.PENDING;
      case 'PROCESSING':
        return WebhookEventStatus.PROCESSING;
      case 'PROCESSED':
        return WebhookEventStatus.PROCESSED;
      case 'FAILED':
        return WebhookEventStatus.FAILED;
      default:
        throw new Error(`Status de evento webhook inválido: ${raw}`);
    }
  }
}
