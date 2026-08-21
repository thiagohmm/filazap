import { DomainError } from './DomainError';

export class InvalidPasswordResetTokenError extends DomainError {
  constructor() {
    super('Este link de recuperação é inválido ou expirou. Solicite um novo link.');
  }
}
