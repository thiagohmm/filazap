import { DomainError } from './DomainError';

export class TicketAlreadyAssignedError extends DomainError {
  constructor(ticketId: string) {
    super(`O atendimento ${ticketId} já foi assumido por outra atendente.`);
  }
}