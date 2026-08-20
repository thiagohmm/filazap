import { DomainError } from './DomainError';

export class NoActiveTicketError extends DomainError {
  constructor() {
    super('Não existe um atendimento aberto para este contato. Não é possível enviar mensagem.');
  }
}