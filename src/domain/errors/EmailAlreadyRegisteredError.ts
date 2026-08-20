import { DomainError } from './DomainError';

export class EmailAlreadyRegisteredError extends DomainError {
  constructor(email: string) {
    super(`Já existe um usuário com o e-mail "${email}".`);
  }
}
