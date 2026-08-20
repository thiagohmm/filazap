import { DomainError } from './DomainError';

export class SlugAlreadyExistsError extends DomainError {
  constructor(slug: string) {
    super(`A empresa com o slug "${slug}" já existe.`);
  }
}
