import { DomainError } from './DomainError';

export class InvalidSlugError extends DomainError {
  constructor(slug: string) {
    super(
      `O slug "${slug}" é inválido. Use apenas letras minúsculas, números e hífens.`
    );
  }
}
