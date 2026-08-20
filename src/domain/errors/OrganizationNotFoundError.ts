import { DomainError } from './DomainError';

export class OrganizationNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Organização "${id}" não encontrada.`);
  }
}
