package com.filazap.domain.error;

public class MemberNotFoundError extends DomainError {
    public MemberNotFoundError(String userId, String organizationId) {
        super("O usuário \"" + userId + "\" não é membro da organização \"" + organizationId + "\".");
    }
}
