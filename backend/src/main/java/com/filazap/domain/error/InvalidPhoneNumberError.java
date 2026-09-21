package com.filazap.domain.error;

public class InvalidPhoneNumberError extends DomainError {
    public InvalidPhoneNumberError(String phone) {
        super("O número \"" + phone + "\" é inválido.");
    }
}
