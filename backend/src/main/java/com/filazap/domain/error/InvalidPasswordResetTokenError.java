package com.filazap.domain.error;

public class InvalidPasswordResetTokenError extends DomainError {
    public InvalidPasswordResetTokenError() {
        super("Este link de recuperação é inválido ou expirou. Solicite um novo link.");
    }
}
