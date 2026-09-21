package com.filazap.test;

import com.filazap.application.port.WhatsAppWebhookParser;
import com.filazap.application.usecase.CreateOrganization;
import com.filazap.application.usecase.InviteMember;
import com.filazap.application.usecase.ListChannels;
import com.filazap.application.usecase.ReceiveWhatsAppMessage;
import com.filazap.application.usecase.RegisterChannel;
import com.filazap.application.usecase.SendMessage;
import com.filazap.application.usecase.UpdateChannelCredentials;
import com.filazap.application.usecase.VerifyWebhook;
import com.filazap.domain.entity.Contact;
import com.filazap.domain.entity.Ticket;
import com.filazap.domain.entity.WhatsAppChannel;
import com.filazap.domain.error.ChannelAlreadyExistsError;
import com.filazap.domain.error.ChannelNotConfiguredError;
import com.filazap.domain.error.ChannelNotFoundError;
import com.filazap.domain.error.ForbiddenRoleError;
import com.filazap.domain.error.NoActiveTicketError;
import com.filazap.domain.error.TicketNotAssignedError;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static com.filazap.test.Maps.list;
import static com.filazap.test.Maps.map;
import static com.filazap.test.Maps.str;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WhatsAppUseCasesTest {

    private static final class Services {
        final TestFakes.TestServices base = TestFakes.testServices();
        final TestFakes.WhatsAppServices wa = TestFakes.whatsappServices();
        final CreateOrganization createOrganization;
        final InviteMember inviteMember;
        final RegisterChannel registerChannel;
        final ListChannels listChannels;
        final VerifyWebhook verifyWebhook;
        final ReceiveWhatsAppMessage receiveWhatsAppMessage;
        final SendMessage sendMessage;
        final UpdateChannelCredentials updateChannelCredentials;

        Services() {
            createOrganization = new CreateOrganization(base.organizations, base.users, base.members,
                    base.passwordHasher, base.tokenService, base.clock, base.logger, base.idGenerator);
            inviteMember = new InviteMember(base.users, base.members, base.organizations,
                    base.passwordHasher, base.clock, base.logger, base.idGenerator);
            registerChannel = new RegisterChannel(wa.channels, base.members, base.logger, wa.idGenerator);
            listChannels = new ListChannels(wa.channels, base.members);
            verifyWebhook = new VerifyWebhook(wa.channels);
            receiveWhatsAppMessage = new ReceiveWhatsAppMessage(wa.webhookEvents, wa.channels, wa.contacts,
                    wa.tickets, wa.messages, wa.ticketEvents, wa.parser, wa.gateway, wa.mediaStorage,
                    wa.cipher, wa.clock, base.logger, wa.idGenerator);
            sendMessage = new SendMessage(wa.channels, wa.contacts, wa.tickets, wa.messages, base.members,
                    wa.ticketEvents, wa.gateway, wa.mediaStorage, wa.cipher, wa.clock, base.logger, wa.idGenerator);
            updateChannelCredentials = new UpdateChannelCredentials(wa.channels, base.members, wa.cipher,
                    base.logger, wa.idGenerator, wa.clock);
        }
    }

    private static String orgId(Map<String, Object> org) { return str(org, "organizationId"); }
    private static String ownerId(Map<String, Object> org) { return str(map(org, "user"), "id"); }

    private static final class Setup {
        final Services services;
        final Map<String, Object> org;
        final WhatsAppChannel channel;

        Setup() {
            services = new Services();
            org = services.createOrganization.execute("Empresa A", "Ana", "ana@example.com", "senha1234");
            services.registerChannel.execute(ownerId(org), orgId(org), "123456789", "waba-1", "5511999990000");
            channel = services.wa.channels.findByPhoneNumberId("123456789");
        }
    }

    private static Map<String, Object> msg(String id, String from, String timestamp, String body) {
        return java.util.Map.of("id", id, "from", from, "timestamp", timestamp, "body", body);
    }

    private static Map<String, Object> status(String id, String status) {
        return java.util.Map.of("id", id, "status", status);
    }

    private void setInbound(Services s, List<Map<String, Object>> messages, List<Map<String, Object>> statuses) {
        s.wa.parser.result = new WhatsAppWebhookParser.ParsedWebhook("waba-1", "123456789",
                messages.stream().map(m -> new WhatsAppWebhookParser.ParsedWebhookMessage(
                        str(m, "id"), str(m, "from"), str(m, "timestamp"), "text",
                        m.containsKey("body") ? str(m, "body") : null, null)).toList(),
                statuses.stream().map(st -> new WhatsAppWebhookParser.ParsedWebhookStatus(
                        str(st, "id"), str(st, "status"), "1700000099")).toList());
    }

    @Test
    void validaVerificacaoComTokenCorreto() {
        Setup setup = new Setup();
        setup.services.updateChannelCredentials.execute(ownerId(setup.org), orgId(setup.org),
                setup.channel.getId(), null, null, "verify-token", null);

        Map<String, Object> out = setup.services.verifyWebhook.execute("subscribe", "verify-token", "challenge123");
        assertEquals(Boolean.TRUE, out.get("valid"));
        assertEquals("challenge123", out.get("challenge"));
    }

    @Test
    void rejeitaTokenIncorreto() {
        Setup setup = new Setup();
        setup.services.updateChannelCredentials.execute(ownerId(setup.org), orgId(setup.org),
                setup.channel.getId(), null, null, "verify-token", null);

        Map<String, Object> out = setup.services.verifyWebhook.execute("subscribe", "errado", "challenge123");
        assertEquals(Boolean.FALSE, out.get("valid"));
    }

    @Test
    void ownerRegistraUmCanalConectado() {
        Services services = new Services();
        Map<String, Object> org = services.createOrganization.execute("Empresa A", "Ana", "ana@example.com", "senha1234");
        Map<String, Object> out = services.registerChannel.execute(ownerId(org), orgId(org),
                "123456789", "waba-1", "5511999990000");
        assertEquals("CONNECTED", str(map(out, "channel"), "status"));
        assertEquals("123456789", str(map(out, "channel"), "phoneNumberId"));
    }

    @Test
    void rejeitaPhoneNumberIdDuplicado() {
        Setup setup = new Setup();
        assertThrows(ChannelAlreadyExistsError.class, () -> setup.services.registerChannel.execute(
                ownerId(setup.org), orgId(setup.org), "123456789", "waba-2", "5511999990001"));
    }

    @Test
    void listaCanaisDaOrganizacao() {
        Setup setup = new Setup();
        Map<String, Object> out = setup.services.listChannels.execute(ownerId(setup.org), orgId(setup.org));
        assertEquals(1, list(out, "channels").size());
    }

    @Test
    void agentNaoPodeRegistrarCanal() {
        Setup setup = new Setup();
        setup.services.inviteMember.execute(ownerId(setup.org), orgId(setup.org), "agente@example.com", "Agente", "AGENT");
        String agent = setup.services.base.users.findByEmail("agente@example.com").getId();
        assertThrows(ForbiddenRoleError.class, () -> setup.services.registerChannel.execute(
                agent, orgId(setup.org), "999", "waba-x", "5511999999999"));
    }

    @Test
    void criaContatoETicketParaTelefoneDesconhecido() {
        Setup setup = new Setup();
        setInbound(setup.services, List.of(msg("wamid.1", "+5511999990001", "1700000001", "Olá")), List.of());

        Map<String, Object> out = setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        assertEquals(Boolean.TRUE, out.get("processed"));
        assertEquals(1, out.get("messagesCount"));

        Contact contact = setup.services.wa.contacts.findByChannelAndPhone(
                orgId(setup.org), setup.channel.getId(), "+5511999990001");
        assertNotNull(contact);

        Ticket ticket = setup.services.wa.tickets.findOpenByContact(contact.getId());
        assertNotNull(ticket);
        assertEquals("WAITING", ticket.getStatusName());
        assertEquals(1700000001L * 1000, ticket.getQueueEnteredAt().toEpochMilli());

        var events = setup.services.wa.ticketEvents.findByTicketId(orgId(setup.org), ticket.getId());
        assertEquals(1, events.size());
        assertEquals("TICKET_OPENED", events.get(0).getEventType());
    }

    @Test
    void mensagensAdicionaisNaoCriamNovoTicketNemMudamQueueEnteredAt() {
        Setup setup = new Setup();
        setInbound(setup.services, List.of(msg("wamid.1", "+5511999990001", "1700000001", "primeira")), List.of());
        setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        Contact contact = setup.services.wa.contacts.findByChannelAndPhone(
                orgId(setup.org), setup.channel.getId(), "+5511999990001");
        Ticket before = setup.services.wa.tickets.findOpenByContact(contact.getId());

        setInbound(setup.services, List.of(msg("wamid.2", "+5511999990001", "1700000020", "segunda")), List.of());
        Map<String, Object> out = setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        var msg2 = setup.services.wa.messages.findByWhatsappMessageId("wamid.2");
        assertEquals(1, out.get("messagesCount"));
        assertEquals(before.getId(), msg2.getTicketId());

        Ticket after = setup.services.wa.tickets.findOpenByContact(contact.getId());
        assertEquals(before.getId(), after.getId());
        assertEquals(1700000001L * 1000, after.getQueueEnteredAt().toEpochMilli());
    }

    @Test
    void ignoraMensagemRepetidaIdempotencia() {
        Setup setup = new Setup();
        setInbound(setup.services, List.of(msg("wamid.1", "+5511999990001", "1700000001", "Olá")), List.of());
        setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        setInbound(setup.services, List.of(msg("wamid.1", "+5511999990001", "1700000001", "Olá")), List.of());
        Map<String, Object> out = setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        assertEquals(Boolean.TRUE, out.get("duplicate"));
        assertEquals(0, out.get("messagesCount"));
    }

    @Test
    void atualizaProviderStatusAPartirDeStatuses() {
        Setup setup = new Setup();
        setInbound(setup.services, List.of(msg("wamid.1", "+5511999990001", "1700000001", "Olá")), List.of());
        setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        setInbound(setup.services, List.of(),
                List.of(status("wamid.1", "delivered"), status("wamid.1", "read")));
        Map<String, Object> out = setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        assertEquals(2, out.get("statusesCount"));
        var stored = setup.services.wa.messages.findByWhatsappMessageId("wamid.1");
        assertEquals("read", stored.getProviderStatus());
    }

    @Test
    void baixaEPersisteMidiaRecebida() {
        Setup setup = new Setup();
        setup.services.updateChannelCredentials.execute(ownerId(setup.org), orgId(setup.org),
                setup.channel.getId(), "access-token-123", "app-secret-123", "verify-token", null);

        setup.services.wa.parser.result = new WhatsAppWebhookParser.ParsedWebhook("waba-1", "123456789",
                List.of(new WhatsAppWebhookParser.ParsedWebhookMessage(
                        "wamid.media1", "+5511999990001", "1700000001", "audio", null, "media-abc")),
                List.of());

        Map<String, Object> out = setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        assertEquals(1, out.get("messagesCount"));
        assertEquals(1, setup.services.wa.gateway.fetchMediaCalls.size());
        assertEquals("media-abc", setup.services.wa.gateway.fetchMediaCalls.get(0).mediaId());
        assertEquals("access-token-123", setup.services.wa.gateway.fetchMediaCalls.get(0).channel().accessToken());

        var stored = setup.services.wa.messages.findByWhatsappMessageId("wamid.media1");
        assertEquals("AUDIO", stored.getType());
        assertTrue(stored.getMediaPath().matches("^media/[^/]+/.+"));
    }

    @Test
    void enviaTextoERegistraMensagemDeSaida() {
        Setup setup = new Setup();
        setup.services.updateChannelCredentials.execute(ownerId(setup.org), orgId(setup.org),
                setup.channel.getId(), "access-token-123", "app-secret-123", "verify-token", null);
        setInbound(setup.services, List.of(msg("wamid.1", "+5511999990001", "1700000001", "Olá")), List.of());
        setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        Contact contact = setup.services.wa.contacts.findByChannelAndPhone(
                orgId(setup.org), setup.channel.getId(), "+5511999990001");

        Map<String, Object> out = setup.services.sendMessage.execute(ownerId(setup.org), orgId(setup.org),
                setup.channel.getId(), contact.getId(), "Resposta", null);

        assertEquals("OUTBOUND", str(map(out, "message"), "direction"));
        assertEquals("Resposta", str(map(out, "message"), "body"));
        assertEquals(1, setup.services.wa.gateway.calls.size());
        assertEquals("access-token-123", setup.services.wa.gateway.calls.get(0).channel().accessToken());
    }

    @Test
    void impedeAtendenteDeResponderClienteDeOutroAtendente() {
        Setup setup = new Setup();
        setup.services.updateChannelCredentials.execute(ownerId(setup.org), orgId(setup.org),
                setup.channel.getId(), "access-token-123", null, null, null);
        Map<String, Object> first = setup.services.inviteMember.execute(ownerId(setup.org), orgId(setup.org),
                "primeiro@example.com", "Primeiro", "AGENT");
        Map<String, Object> second = setup.services.inviteMember.execute(ownerId(setup.org), orgId(setup.org),
                "segundo@example.com", "Segundo", "AGENT");
        setInbound(setup.services, List.of(msg("wamid.locked", "+5511999990040", "1700000040", "Olá")), List.of());
        setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        Contact contact = setup.services.wa.contacts.findByChannelAndPhone(
                orgId(setup.org), setup.channel.getId(), "+5511999990040");
        Ticket ticket = setup.services.wa.tickets.findOpenByContact(contact.getId());
        String firstUserId = str(map(map(first, "member"), "user"), "id");
        String secondUserId = str(map(map(second, "member"), "user"), "id");
        ticket.assign(firstUserId, setup.services.wa.clock.now());
        setup.services.wa.tickets.save(ticket);

        assertThrows(TicketNotAssignedError.class, () -> setup.services.sendMessage.execute(
                secondUserId, orgId(setup.org), setup.channel.getId(), contact.getId(), "Tentativa indevida", null));
        assertEquals(0, setup.services.wa.gateway.calls.size());

        Map<String, Object> out = setup.services.sendMessage.execute(firstUserId, orgId(setup.org),
                setup.channel.getId(), contact.getId(), "Resposta do responsável", null);
        assertEquals("Resposta do responsável", str(map(out, "message"), "body"));
        assertEquals(1, setup.services.wa.gateway.calls.size());
    }

    @Test
    void permiteAdministradorResponderClienteAtribuidoAAtendente() {
        Setup setup = new Setup();
        setup.services.updateChannelCredentials.execute(ownerId(setup.org), orgId(setup.org),
                setup.channel.getId(), "access-token-123", null, null, null);
        Map<String, Object> agent = setup.services.inviteMember.execute(ownerId(setup.org), orgId(setup.org),
                "agente@example.com", "Agente", "AGENT");
        setInbound(setup.services, List.of(msg("wamid.admin-all", "+5511999990041", "1700000041", "Olá")), List.of());
        setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        Contact contact = setup.services.wa.contacts.findByChannelAndPhone(
                orgId(setup.org), setup.channel.getId(), "+5511999990041");
        Ticket ticket = setup.services.wa.tickets.findOpenByContact(contact.getId());
        ticket.assign(str(map(map(agent, "member"), "user"), "id"), setup.services.wa.clock.now());
        setup.services.wa.tickets.save(ticket);

        Map<String, Object> out = setup.services.sendMessage.execute(ownerId(setup.org), orgId(setup.org),
                setup.channel.getId(), contact.getId(), "Resposta do administrador", null);
        assertEquals("Resposta do administrador", str(map(out, "message"), "body"));
        assertEquals(1, setup.services.wa.gateway.calls.size());
    }

    @Test
    void lancaErroSeCanalNaoTiverCredenciais() {
        Setup setup = new Setup();
        setInbound(setup.services, List.of(msg("wamid.1", "+5511999990001", "1700000001", "Olá")), List.of());
        setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        Contact contact = setup.services.wa.contacts.findByChannelAndPhone(
                orgId(setup.org), setup.channel.getId(), "+5511999990001");
        assertThrows(ChannelNotConfiguredError.class, () -> setup.services.sendMessage.execute(
                ownerId(setup.org), orgId(setup.org), setup.channel.getId(), contact.getId(), "Resposta", null));
    }

    @Test
    void lancaErroSeNaoHouverAtendimentoAberto() {
        Setup setup = new Setup();
        setInbound(setup.services, List.of(msg("wamid.1", "+5511999990001", "1700000001", "Olá")), List.of());
        setup.services.receiveWhatsAppMessage.execute(Map.of("object", "x"));

        Contact contact = setup.services.wa.contacts.findByChannelAndPhone(
                orgId(setup.org), setup.channel.getId(), "+5511999990001");
        Ticket ticket = setup.services.wa.tickets.findOpenByContact(contact.getId());
        ticket.finish(Instant.parse("2026-08-19T12:00:00Z"));
        setup.services.wa.tickets.save(ticket);

        assertThrows(NoActiveTicketError.class, () -> setup.services.sendMessage.execute(
                ownerId(setup.org), orgId(setup.org), setup.channel.getId(), contact.getId(), "Resposta", null));
    }

    @Test
    void ownerConfiguraCredenciaisEOOutputNaoExpoeSegredos() {
        Setup setup = new Setup();
        Map<String, Object> out = setup.services.updateChannelCredentials.execute(ownerId(setup.org), orgId(setup.org),
                setup.channel.getId(), "access-token", "app-secret", "verify-token", null);

        assertEquals(Boolean.TRUE, map(out, "channel").get("configured"));
        assertFalse(map(out, "channel").containsKey("accessToken"));
        assertFalse(map(out, "channel").containsKey("appSecret"));

        WhatsAppChannel stored = setup.services.wa.channels.findById(setup.channel.getId());
        assertEquals("enc:access-token", stored.getAccessTokenEncrypted());
        assertEquals("enc:app-secret", stored.getAppSecretEncrypted());
        assertEquals("verify-token", stored.getWebhookVerifyToken());
    }

    @Test
    void agentNaoPodeConfigurarCredenciais() {
        Setup setup = new Setup();
        setup.services.inviteMember.execute(ownerId(setup.org), orgId(setup.org), "agente@example.com", "Agente", "AGENT");
        String agent = setup.services.base.users.findByEmail("agente@example.com").getId();
        assertThrows(ForbiddenRoleError.class, () -> setup.services.updateChannelCredentials.execute(
                agent, orgId(setup.org), setup.channel.getId(), "token", null, null, null));
    }

    @Test
    void naoPermiteConfigurarCanalDeOutraOrganizacao() {
        Setup setup = new Setup();
        Map<String, Object> other = setup.services.createOrganization.execute(
                "Outra", "Outra", "outra@example.com", "senha1234");
        Map<String, Object> otherChannel = setup.services.registerChannel.execute(
                ownerId(other), orgId(other), "999", "waba-other", "5511999999999");

        assertThrows(ChannelNotFoundError.class, () -> setup.services.updateChannelCredentials.execute(
                ownerId(setup.org), orgId(setup.org), str(map(otherChannel, "channel"), "id"), "token", null, null, null));
    }
}
