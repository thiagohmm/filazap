import { DomainError } from './DomainError';

export class TicketNotFoundError extends DomainError {
  constructor(ticketId: string) {
    super(`O atendimento "${ticketId}" não foi encontrado.`);
  }
}
