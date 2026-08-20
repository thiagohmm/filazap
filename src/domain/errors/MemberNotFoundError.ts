import { DomainError } from './DomainError';

export class MemberNotFoundError extends DomainError {
  constructor(userId: string, organizationId: string) {
    super(
      `O usuário "${userId}" não é membro da organização "${organizationId}".`
    );
  }
}
