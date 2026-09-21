package com.filazap.application.port;

public interface TokenService {
    String sign(SessionPayload payload);

    SessionPayload verify(String token);
}
