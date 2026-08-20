import { DomainError } from './DomainError';

export class InvalidRoleError extends DomainError {
  constructor(role: string) {
    super(`O papel "${role}" é inválido.`);
  }
}
