import { DomainError } from './DomainError';

export class SendMessageFailedError extends DomainError {
  constructor(message: string) {
    super(`Falha ao enviar mensagem pelo WhatsApp: ${message}`);
  }
}
