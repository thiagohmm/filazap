package com.filazap.application.port;

public interface PasswordResetMailer {
    void send(String email, String name, String resetUrl);
}
