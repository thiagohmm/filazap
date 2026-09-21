package com.filazap.infrastructure.security;

import com.filazap.domain.service.PasswordHasher;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class BcryptPasswordHasher implements PasswordHasher {
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);

    @Override
    public String hash(String plain) {
        return encoder.encode(plain);
    }

    @Override
    public boolean verify(String plain, String hash) {
        return encoder.matches(plain, hash);
    }
}
