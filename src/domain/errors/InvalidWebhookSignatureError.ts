import { DomainError } from './DomainError';

export class InvalidWebhookSignatureError extends DomainError {
  constructor() {
    super('Assinatura do webhook inválida.');
  }
}
