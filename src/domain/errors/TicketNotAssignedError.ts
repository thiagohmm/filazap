import { DomainError } from './DomainError';

export class TicketNotAssignedError extends DomainError {
  constructor(ticketId: string) {
    super(`O atendimento ${ticketId} não está atribuído ao atendente atual.`);
  }
}
