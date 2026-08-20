import { DomainError } from './DomainError';

export class InvalidTicketStatusError extends DomainError {
  constructor(status: string) {
    super(`Status de atendimento inválido: "${status}".`);
  }
}