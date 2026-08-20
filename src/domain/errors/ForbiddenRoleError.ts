import { DomainError } from './DomainError';

export class ForbiddenRoleError extends DomainError {
  constructor(role: string, action: string) {
    super(`O papel "${role}" não pode executar "${action}".`);
  }
}
