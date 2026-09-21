package com.filazap.config;

import com.filazap.application.port.IdGenerator;
import com.filazap.domain.service.Clock;
import com.filazap.domain.service.SystemClock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;
import java.util.function.Supplier;

@Configuration
@EnableConfigurationProperties(FilazapProperties.class)
public class AppConfig {

    @Bean
    public Clock clock() {
        return new SystemClock();
    }

    @Bean
    public IdGenerator idGenerator() {
        return () -> UUID.randomUUID().toString();
    }

    @Bean
    public SecureRandom secureRandom() {
        return new SecureRandom();
    }

    /** Gerador de token de recuperação de senha (32 bytes aleatórios em hex). */
    @Bean
    public Supplier<String> passwordResetTokenGenerator(SecureRandom secureRandom) {
        return () -> {
            byte[] bytes = new byte[32];
            secureRandom.nextBytes(bytes);
            return HexFormat.of().formatHex(bytes);
        };
    }

    /** Hash SHA-256 usado para armazenar tokens de recuperação de senha. */
    public static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }

    /** Gera uma senha temporária aleatória (como o container original). */
    public static String temporaryPassword(SecureRandom random) {
        byte[] bytes = new byte[9];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
