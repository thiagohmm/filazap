import { DomainError } from './DomainError';

export class ContactNotFoundError extends DomainError {
  constructor(contactId: string) {
    super(`O contato "${contactId}" não foi encontrado.`);
  }
}
