import { DomainError } from './DomainError';

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('E-mail ou senha inválidos.');
  }
}
