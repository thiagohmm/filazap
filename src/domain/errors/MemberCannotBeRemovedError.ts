import { DomainError } from './DomainError';

export class MemberCannotBeRemovedError extends DomainError {
  constructor() {
    super('Somente atendentes ativos podem ser removidos da equipe.');
  }
}
