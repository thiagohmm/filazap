import { DomainError } from './DomainError';

export class ChannelAlreadyExistsError extends DomainError {
  constructor(phoneNumberId: string) {
    super(`Já existe um canal com o phone_number_id "${phoneNumberId}".`);
  }
}
