import { DomainError } from './DomainError';

export class InvalidPhoneNumberError extends DomainError {
  constructor(phone: string) {
    super(`O número "${phone}" é inválido.`);
  }
}
