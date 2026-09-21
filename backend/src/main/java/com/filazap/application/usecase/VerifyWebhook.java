package com.filazap.application.usecase;

import com.filazap.application.port.WhatsAppChannelRepository;
import com.filazap.application.util.Json;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class VerifyWebhook {
    private final WhatsAppChannelRepository channels;

    public VerifyWebhook(WhatsAppChannelRepository channels) {
        this.channels = channels;
    }

    public Map<String, Object> execute(String mode, String verifyToken, String challenge) {
        if (!"subscribe".equals(mode) || verifyToken == null || verifyToken.isEmpty()) {
            return Json.obj("valid", false, "challenge", challenge);
        }
        boolean valid = channels.findByWebhookVerifyToken(verifyToken) != null;
        return Json.obj("valid", valid, "challenge", challenge);
    }
}
