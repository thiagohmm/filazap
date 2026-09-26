package com.filazap.application.usecase;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.ContactRepository;
import com.filazap.application.port.CredentialCipher;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.MediaStorage;
import com.filazap.application.port.MessageRepository;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.TicketEventRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.port.WhatsAppChannelRepository;
import com.filazap.application.port.WhatsAppGateway;
import com.filazap.application.util.Json;
import com.filazap.domain.entity.Contact;
import com.filazap.domain.entity.Message;
import com.filazap.domain.entity.Ticket;
import com.filazap.domain.entity.TicketEvent;
import com.filazap.domain.error.ChannelNotConfiguredError;
import com.filazap.domain.error.ChannelNotFoundError;
import com.filazap.domain.error.ContactNotFoundError;
import com.filazap.domain.error.NoActiveTicketError;
import com.filazap.domain.error.TicketNotAssignedError;
import com.filazap.domain.service.Clock;
import com.filazap.domain.valueobject.MessageDirection;
import com.filazap.domain.valueobject.Role;
import com.filazap.domain.valueobject.TicketStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Service
public class SendMessage {

    public record MediaInput(String filename, String mimeType, String storedPath, String caption) {}

    private final WhatsAppChannelRepository channels;
    private final ContactRepository contacts;
    private final TicketRepository tickets;
    private final MessageRepository messages;
    private final OrganizationMemberRepository members;
    private final TicketEventRepository ticketEvents;
    private final WhatsAppGateway gateway;
    private final MediaStorage mediaStorage;
    private final CredentialCipher cipher;
    private final Clock clock;
    private final AuditLogger logger;
    private final IdGenerator idGenerator;

    public SendMessage(WhatsAppChannelRepository channels, ContactRepository contacts,
                       TicketRepository tickets, MessageRepository messages,
                       OrganizationMemberRepository members, TicketEventRepository ticketEvents,
                       WhatsAppGateway gateway, MediaStorage mediaStorage, CredentialCipher cipher,
                       Clock clock, AuditLogger logger, IdGenerator idGenerator) {
        this.channels = channels;
        this.contacts = contacts;
        this.tickets = tickets;
        this.messages = messages;
        this.members = members;
        this.ticketEvents = ticketEvents;
        this.gateway = gateway;
        this.mediaStorage = mediaStorage;
        this.cipher = cipher;
        this.clock = clock;
        this.logger = logger;
        this.idGenerator = idGenerator;
    }

    public Map<String, Object> execute(String actorUserId, String organizationId, String channelId,
                                       String contactId, String body, MediaInput media) {
        var actor = ActorSupport.loadActor(members, actorUserId, organizationId);
        com.filazap.application.policy.OrganizationPolicy.canSendMessages(actor);

        var channel = channels.findById(channelId);
        if (channel == null) {
            throw new ChannelNotFoundError(channelId);
        }
        var contact = contacts.findById(contactId);
        if (contact == null) {
            throw new ContactNotFoundError(contactId);
        }

        Ticket ticket = tickets.findActiveByContact(contact.getId());
        if (ticket == null) {
            throw new NoActiveTicketError();
        }

        boolean canReplyToAny = actor.role() == Role.OWNER || actor.role() == Role.ADMIN;
        if (!canReplyToAny && !actorUserId.equals(ticket.getAssignedUserId())) {
            throw new TicketNotAssignedError(ticket.getId());
        }

        Instant now = clock.now();

        boolean isImage = media != null && media.mimeType() != null && media.mimeType().startsWith("image/");
        boolean isAudio = media != null && media.mimeType() != null && media.mimeType().startsWith("audio/");
        boolean isVideo = media != null && media.mimeType() != null && media.mimeType().startsWith("video/");
        String mediaType = isImage ? "image" : isAudio ? "audio" : isVideo ? "video" : "document";

        if (canReplyToAny && (ticket.getStatus() == TicketStatus.WAITING
                || ticket.getStatus() == TicketStatus.RETURNING)) {
            var result = tickets.assignTicket(ticket.getId(), actorUserId, now);
            if (result.ok()) {
                String fromStatus = ticket.getStatusName();
                ticket = result.ticket();
                ticketEvents.save(TicketEvent.create(idGenerator.generate(), organizationId,
                        ticket.getId(), actorUserId, "TICKET_ASSIGNED", fromStatus,
                        ticket.getStatusName(), now));
            } else {
                ticket = tickets.findById(ticket.getId());
            }
        }

        String fromStatus = ticket.getStatusName();
        ticket.registerFirstResponse(now);
        if (ticket.getStatus() == TicketStatus.IN_PROGRESS) {
            ticket.moveToWaitingCustomer(now);
        }
        tickets.save(ticket);

        if (!fromStatus.equals(ticket.getStatusName())) {
            ticketEvents.save(TicketEvent.create(idGenerator.generate(), organizationId,
                    ticket.getId(), actorUserId, "TICKET_STATUS_CHANGED", fromStatus,
                    ticket.getStatusName(), now));
        }

        if (channel.getAccessTokenEncrypted() == null) {
            throw new ChannelNotConfiguredError(channel.getId());
        }
        String accessToken = cipher.decrypt(channel.getAccessTokenEncrypted());
        var channelRef = new WhatsAppGateway.ChannelRef(channel.getPhoneNumberId(), accessToken);

        WhatsAppGateway.SendMessageResult result;
        String destination = destinationOf(contact);
        if (media != null) {
            byte[] fileData = mediaStorage.read(media.storedPath());
            var uploaded = gateway.uploadMedia(new WhatsAppGateway.UploadMediaCommand(
                    channelRef, fileData, media.mimeType(), media.filename()));
            result = gateway.sendMedia(new WhatsAppGateway.SendMediaCommand(
                    channelRef, destination, uploaded.fileId(), media.mimeType(),
                    media.filename(), media.caption(), mediaType, fileData));
        } else {
            result = gateway.sendText(new WhatsAppGateway.SendMessageCommand(
                    channelRef, destination, "TEXT", body));
        }

        String type = media != null
                ? (isAudio ? "AUDIO" : isImage ? "IMAGE" : isVideo ? "VIDEO" : "DOCUMENT")
                : "TEXT";
        String messageBody = media != null ? media.caption() : (body == null || body.isEmpty() ? null : body);

        Message message = Message.create(idGenerator.generate(), organizationId, ticket.getId(),
                contact.getId(), result.providerMessageId(), MessageDirection.OUTBOUND, type,
                messageBody, media != null ? media.storedPath() : null, actorUserId, "SENT", now);

        messages.save(message);

        logger.log("info", "message.sent", Json.obj(
                "organizationId", organizationId,
                "ticketId", ticket.getId(),
                "messageId", message.getId(),
                "actorUserId", actorUserId));

        return Json.obj("message", Json.obj(
                "id", message.getId(),
                "ticketId", message.getTicketId(),
                "direction", message.getDirection(),
                "type", message.getType(),
                "body", message.getBody(),
                "mediaPath", message.getMediaPath(),
                "providerStatus", message.getProviderStatus(),
                "createdAt", message.getCreatedAt()));
    }

    /**
     * Destino do envio: o JID canônico guardado no metadata do contato (ex.: {@code ...@lid}
     * quando o WhatsApp não expõe o número) ou, na ausência dele, o telefone E.164.
     */
    private static String destinationOf(Contact contact) {
        Map<String, Object> metadata = contact.getMetadata();
        if (metadata != null && metadata.get("whatsappJid") instanceof String jid && !jid.isBlank()) {
            return jid;
        }
        return contact.getPhoneE164();
    }
}
