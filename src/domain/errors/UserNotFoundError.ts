import { DomainError } from './DomainError';

export class UserNotFoundError extends DomainError {
  constructor() {
    super('Usuário não encontrado.');
  }
}
