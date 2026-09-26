package com.filazap.domain.entity;

import com.filazap.domain.valueobject.PhoneNumberE164;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

public class Contact {
    private final String id;
    private final String organizationId;
    private final String channelId;
    private final String phoneE164;
    private final String name;
    private final Map<String, Object> metadata;
    private final Instant firstContactAt;
    private final Instant lastContactAt;
    private final Instant createdAt;
    private final Instant updatedAt;

    private Contact(String id, String organizationId, String channelId, String phoneE164,
                    String name, Map<String, Object> metadata, Instant firstContactAt,
                    Instant lastContactAt, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.organizationId = organizationId;
        this.channelId = channelId;
        this.phoneE164 = phoneE164;
        this.name = name;
        this.metadata = metadata;
        this.firstContactAt = firstContactAt;
        this.lastContactAt = lastContactAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static Contact create(String id, String organizationId, String channelId,
                                 PhoneNumberE164 phone) {
        Instant now = Instant.now();
        return new Contact(id, organizationId, channelId, phone.e164(), null, null, now, now, now, now);
    }

    public static Contact create(String id, String organizationId, String channelId,
                                 PhoneNumberE164 phone, Instant firstContactAt, Instant lastContactAt) {
        Instant now = Instant.now();
        return new Contact(id, organizationId, channelId, phone.e164(), null, null,
                firstContactAt, lastContactAt, now, now);
    }

    public static Contact restore(String id, String organizationId, String channelId,
                                  String phoneE164, String name, Map<String, Object> metadata,
                                  Instant firstContactAt, Instant lastContactAt,
                                  Instant createdAt, Instant updatedAt) {
        return new Contact(id, organizationId, channelId, phoneE164, name, metadata,
                firstContactAt, lastContactAt, createdAt, updatedAt);
    }

    public String getId() { return id; }
    public String getOrganizationId() { return organizationId; }
    public String getChannelId() { return channelId; }
    public String getPhoneE164() { return phoneE164; }
    public String getName() { return name; }
    public Map<String, Object> getMetadata() { return metadata; }
    public Instant getFirstContactAt() { return firstContactAt; }
    public Instant getLastContactAt() { return lastContactAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    /** Retorna uma cópia com o lastContactAt atualizado (usada ao receber mensagem). */
    public Contact withLastContactAt(Instant newLastContactAt) {
        return new Contact(id, organizationId, channelId, phoneE164, name, metadata,
                firstContactAt, newLastContactAt, createdAt, updatedAt);
    }

    /**
     * Guarda o JID canônico usado para enviar mensagens (ex.: {@code 5511...@c.us} ou
     * {@code 123...@lid}). Necessário porque o WhatsApp pode identificar o contato por um LID
     * sem número de telefone associado.
     */
    public Contact withWhatsappJid(String jid) {
        if (jid == null || jid.isBlank()) {
            return this;
        }
        Map<String, Object> next = metadata == null ? new HashMap<>() : new HashMap<>(metadata);
        next.put("whatsappJid", jid);
        return new Contact(id, organizationId, channelId, phoneE164, name, next,
                firstContactAt, lastContactAt, createdAt, updatedAt);
    }
}
