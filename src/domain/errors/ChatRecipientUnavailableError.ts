import { DomainError } from './DomainError';

export class ChatRecipientUnavailableError extends DomainError {
  constructor() {
    super('Este atendente não está disponível no chat agora.');
  }
}
