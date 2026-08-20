import { DomainError } from './DomainError';

export class InvalidTicketTransitionError extends DomainError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Transição de atendimento inválida: "${fromStatus}" não pode ir para "${toStatus}".`
    );
  }
}