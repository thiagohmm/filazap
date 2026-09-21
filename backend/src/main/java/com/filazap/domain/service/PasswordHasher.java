package com.filazap.domain.service;

/** Hash e verificação de senhas (implementado com BCrypt na infraestrutura). */
public interface PasswordHasher {
    String hash(String plain);

    boolean verify(String plain, String hash);
}
