package com.filazap.application.port;

import com.filazap.domain.entity.Message;

import java.util.List;

public interface MessageRepository {
    Message save(Message message);

    Message findById(String id);

    Message findByWhatsappMessageId(String whatsappMessageId);

    default Message findByProviderMessageId(String providerMessageId) {
        return findByWhatsappMessageId(providerMessageId);
    }

    List<Message> findByTicketId(String organizationId, String ticketId);
}
