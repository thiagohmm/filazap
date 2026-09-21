package com.filazap.domain.error;

public class MemberCannotBeRemovedError extends DomainError {
    public MemberCannotBeRemovedError() {
        super("Somente atendentes ativos podem ser removidos da equipe.");
    }
}
