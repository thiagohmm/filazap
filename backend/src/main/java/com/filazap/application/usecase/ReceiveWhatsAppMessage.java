package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.ContactRepository;
import com.filazap.application.port.CredentialCipher;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.MediaFileInput;
import com.filazap.application.port.MediaStorage;
import com.filazap.application.port.MessageRepository;
import com.filazap.application.port.TicketEventRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.port.WebhookEventRepository;
import com.filazap.application.port.WhatsAppChannelRepository;
import com.filazap.application.port.WhatsAppGateway;
import com.filazap.application.port.WhatsAppWebhookParser;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.Contact;
import com.filazap.domain.entity.Message;
import com.filazap.domain.entity.Ticket;
import com.filazap.domain.entity.TicketEvent;
import com.filazap.domain.entity.WebhookEvent;
import com.filazap.domain.entity.WhatsAppChannel;
import com.filazap.domain.error.ChannelNotFoundError;
import com.filazap.domain.service.Clock;
import com.filazap.domain.valueobject.MessageDirection;
import com.filazap.domain.valueobject.PhoneNumberE164;
import com.filazap.domain.valueobject.TicketStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Service
public class ReceiveWhatsAppMessage {
    private final WebhookEventRepository webhookEvents;
    private final WhatsAppChannelRepository channels;
    private final ContactRepository contacts;
    private final TicketRepository tickets;
    private final MessageRepository messages;
    private final TicketEventRepository ticketEvents;
    private final WhatsAppWebhookParser parser;
    private final WhatsAppGateway gateway;
    private final MediaStorage mediaStorage;
    private final CredentialCipher cipher;
    private final Clock clock;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public ReceiveWhatsAppMessage(WebhookEventRepository webhookEvents,
                                  WhatsAppChannelRepository channels, ContactRepository contacts,
                                  TicketRepository tickets, MessageRepository messages,
                                  TicketEventRepository ticketEvents, WhatsAppWebhookParser parser,
                                  WhatsAppGateway gateway, MediaStorage mediaStorage,
                                  CredentialCipher cipher, Clock clock, AuditLogger logger,
                                  IdGenerator idGenerator) {
        this.webhookEvents = webhookEvents;
        this.channels = channels;
        this.contacts = contacts;
        this.tickets = tickets;
        this.messages = messages;
        this.ticketEvents = ticketEvents;
        this.parser = parser;
        this.gateway = gateway;
        this.mediaStorage = mediaStorage;
        this.cipher = cipher;
        this.clock = clock;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(Map<String, Object> payload) {
        WebhookEvent event = WebhookEvent.create(idGenerator.generate(), payload, clock.now());
        webhookEvents.save(event);

        boolean duplicate = false;
        int messagesCount = 0;
        int statusesCount = 0;

        try {
            var parsed = parser.parse(payload);

            for (var message : parsed.messages()) {
                Message existing = messages.findByWhatsappMessageId(message.whatsappMessageId());
                if (existing != null) {
                    duplicate = true;
                    continue;
                }
                handleInbound(parsed.phoneNumberId(), message);
                messagesCount += 1;
            }

            for (var status : parsed.statuses()) {
                Message message = messages.findByWhatsappMessageId(status.whatsappMessageId());
                if (message == null) continue;
                message.updateProviderStatus(status.status());
                messages.save(message);
                statusesCount += 1;
            }

            event.markProcessed(clock.now());
            webhookEvents.save(event);
            return Json.obj("processed", true, "duplicate", duplicate,
                    "messagesCount", messagesCount, "statusesCount", statusesCount);
        } catch (RuntimeException error) {
            event.markFailed(clock.now(), error.getMessage() == null ? "Erro desconhecido" : error.getMessage());
            webhookEvents.save(event);
            logger.log("error", "webhook.receive_failed", Json.obj(
                    "webhookEventId", event.getId(),
                    "error", error.getMessage() == null ? "unknown" : error.getMessage()));
            throw error;
        }
    }

    private void handleInbound(String phoneNumberId, WhatsAppWebhookParser.ParsedWebhookMessage message) {
        Instant messageTimestamp = Instant.ofEpochSecond(Long.parseLong(message.timestamp()));

        WhatsAppChannel channel = phoneNumberId != null
                ? channels.findByPhoneNumberId(phoneNumberId) : null;
        if (channel == null) {
            throw new ChannelNotFoundError(phoneNumberId == null ? "desconhecido" : phoneNumberId);
        }

        WhatsAppIdentity identity = resolveIdentity(channel, message.from());
        PhoneNumberE164 phone = identity.phone();
        Contact contact = contacts.findByChannelAndPhone(channel.getOrganizationId(),
                channel.getId(), phone.e164());
        boolean isNewContact = contact == null;
        if (isNewContact) {
            contact = Contact.create(idGenerator.generate(), channel.getOrganizationId(),
                    channel.getId(), phone, messageTimestamp, messageTimestamp)
                    .withWhatsappJid(identity.jid());
        } else {
            contact = contact.withLastContactAt(messageTimestamp).withWhatsappJid(identity.jid());
        }
        contacts.save(contact);

        Ticket ticket = tickets.findActiveByContact(contact.getId());
        if (ticket == null) {
            int sequenceNumber = tickets.nextSequenceNumber(channel.getOrganizationId());
            TicketStatus createdStatus = isNewContact ? TicketStatus.WAITING : TicketStatus.RETURNING;
            ticket = Ticket.create(idGenerator.generate(), channel.getOrganizationId(),
                    channel.getId(), contact.getId(), sequenceNumber, messageTimestamp, createdStatus);
            tickets.save(ticket);
            ticketEvents.save(TicketEvent.create(idGenerator.generate(),
                    channel.getOrganizationId(), ticket.getId(), null, "TICKET_OPENED",
                    null, createdStatus.name(), messageTimestamp));
        } else {
            if (ticket.getStatus() == TicketStatus.WAITING_CUSTOMER) {
                String fromStatus = ticket.getStatusName();
                ticket.customerReplied(messageTimestamp);
                ticketEvents.save(TicketEvent.create(idGenerator.generate(),
                        channel.getOrganizationId(), ticket.getId(), null, "TICKET_STATUS_CHANGED",
                        fromStatus, ticket.getStatusName(), messageTimestamp));
            }
            ticket.touchLastMessage(messageTimestamp);
        }
        tickets.save(ticket);

        String type = message.type();
        String mediaPath = null;
        if (message.mediaId() != null) {
            mediaPath = downloadMedia(channel, message.mediaId());
            if (mediaPath != null) {
                type = mapMediaTypeName(message.type());
            }
        }
        // Location tem type próprio e não é mídia (sem mediaId): mapeia direto.
        if ("location".equals(message.type())) {
            type = "LOCATION";
        }

        Message record = Message.create(idGenerator.generate(), channel.getOrganizationId(),
                ticket.getId(), contact.getId(), message.whatsappMessageId(),
                MessageDirection.INBOUND, type, message.body(), mediaPath, null, null,
                messageTimestamp);
        messages.save(record);
    }

    private record WhatsAppIdentity(PhoneNumberE164 phone, String jid) {
    }

    /**
     * Decide o telefone (identidade/exibição) e o JID canônico (destino do envio).
     *
     * <p>Contatos que chegam como {@code @lid} não trazem número de telefone. Tentamos resolver
     * na agenda do celular pareado via WAHA; sem sucesso, guardamos o próprio {@code @lid} como
     * destino, pois o WAHA aceita enviar para LIDs (evita resposta indo para número inexistente).
     */
    private WhatsAppIdentity resolveIdentity(WhatsAppChannel channel, String from) {
        if (from != null && from.endsWith("@lid")) {
            String resolved = resolveLid(channel, from);
            if (resolved != null && !resolved.isBlank()) {
                String digits = resolved.replaceAll("[^0-9]", "");
                return new WhatsAppIdentity(PhoneNumberE164.create(digits), digits + "@c.us");
            }
            return new WhatsAppIdentity(PhoneNumberE164.create(from), from);
        }
        PhoneNumberE164 phone = PhoneNumberE164.create(from);
        return new WhatsAppIdentity(phone, phone.e164().replaceAll("[^0-9]", "") + "@c.us");
    }

    private String resolveLid(WhatsAppChannel channel, String lid) {
        if (channel.getAccessTokenEncrypted() == null) {
            return null;
        }
        try {
            String token = cipher.decrypt(channel.getAccessTokenEncrypted());
            return gateway.resolveLid(new WhatsAppGateway.ChannelRef(
                    channel.getPhoneNumberId(), token, channel.getApiBaseUrl()), lid);
        } catch (Exception error) {
            logger.log("warn", "webhook.lid_resolve_failed", Json.obj(
                    "lid", lid, "error", error.getMessage() == null ? "unknown" : error.getMessage()));
            return null;
        }
    }

    private String mapMediaTypeName(String providerType) {
        return switch (providerType) {
            case "image" -> "IMAGE";
            case "audio" -> "AUDIO";
            case "video" -> "VIDEO";
            case "document" -> "DOCUMENT";
            case "location" -> "LOCATION";
            case "text" -> "TEXT";
            default -> "DOCUMENT";
        };
    }

    private String downloadMedia(WhatsAppChannel channel, String mediaId) {
        if (channel.getAccessTokenEncrypted() == null) {
            logger.log("warn", "webhook.media_download_skipped", Json.obj(
                    "reason", "canal sem access token", "whatsappMessageId", mediaId));
            return null;
        }
        try {
            String accessToken = cipher.decrypt(channel.getAccessTokenEncrypted());
            var media = gateway.fetchMedia(new WhatsAppGateway.FetchMediaCommand(
                    new WhatsAppGateway.ChannelRef(channel.getPhoneNumberId(), accessToken,
                            channel.getApiBaseUrl()), mediaId));
            var stored = mediaStorage.store(new MediaFileInput(
                    channel.getOrganizationId(),
                    media.filename() == null ? mediaId : media.filename(),
                    media.mimeType(), media.data()));
            return stored.storedPath();
        } catch (Exception error) {
            logger.log("error", "webhook.media_download_failed", Json.obj(
                    "whatsappMessageId", mediaId,
                    "error", error.getMessage() == null ? "unknown" : error.getMessage()));
            return null;
        }
    }
}
