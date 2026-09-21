package com.filazap.infrastructure.security;

import com.filazap.application.port.SessionPayload;
import com.filazap.application.port.TokenService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

public class JwtTokenService implements TokenService {
    private final SecretKey key;

    public JwtTokenService(String secret) {
        if (secret == null || secret.length() < 16) {
            throw new IllegalArgumentException(
                    "JWT_SECRET deve ter pelo menos 16 caracteres. Gere com: openssl rand -base64 32");
        }
        this.key = Keys.hmacShaKeyFor(sha256(secret));
    }

    @Override
    public String sign(SessionPayload payload) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(payload.userId())
                .claim("email", payload.email())
                .claim("name", payload.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(7, ChronoUnit.DAYS)))
                .signWith(key)
                .compact();
    }

    @Override
    public SessionPayload verify(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
            String sub = claims.getSubject();
            if (sub == null) {
                throw new JwtException("Token sem subject.");
            }
            String email = claims.get("email", String.class);
            String name = claims.get("name", String.class);
            return new SessionPayload(sub, email == null ? "" : email, name == null ? "" : name);
        } catch (JwtException | IllegalArgumentException e) {
            throw new JwtException("Token inválido.", e);
        }
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }
}
