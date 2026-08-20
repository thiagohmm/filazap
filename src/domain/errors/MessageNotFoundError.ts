import { DomainError } from './DomainError';

export class MessageNotFoundError extends DomainError {
  constructor(messageId: string) {
    super(`A mensagem "${messageId}" não foi encontrada.`);
  }
}
