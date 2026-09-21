package com.filazap.test;

import com.filazap.application.port.WhatsAppWebhookParser;
import com.filazap.application.usecase.AddInternalNote;
import com.filazap.application.usecase.AssignNextTicket;
import com.filazap.application.usecase.AssignTicket;
import com.filazap.application.usecase.CreateOrganization;
import com.filazap.application.usecase.FinishTicket;
import com.filazap.application.usecase.GetOperationalCounters;
import com.filazap.application.usecase.InviteMember;
import com.filazap.application.usecase.ListMessages;
import com.filazap.application.usecase.ListQueue;
import com.filazap.application.usecase.MoveTicketToWaitingCustomer;
import com.filazap.application.usecase.ReceiveWhatsAppMessage;
import com.filazap.application.usecase.RegisterChannel;
import com.filazap.application.usecase.ReopenTicket;
import com.filazap.domain.entity.Contact;
import com.filazap.domain.entity.Ticket;
import com.filazap.domain.entity.WhatsAppChannel;
import com.filazap.domain.error.ContactNotFoundError;
import com.filazap.domain.error.ForbiddenRoleError;
import com.filazap.domain.error.TicketAlreadyAssignedError;
import com.filazap.domain.error.TicketNotAssignedError;
import com.filazap.domain.valueobject.TicketStatus;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QueueUseCasesTest {

    private static final class Services {
        final TestFakes.TestServices base = TestFakes.testServices();
        final TestFakes.WhatsAppServices wa = TestFakes.whatsappServices();
        final CreateOrganization createOrganization;
        final InviteMember inviteMember;
        final RegisterChannel registerChannel;
        final ReceiveWhatsAppMessage receiveWhatsAppMessage;
        final AssignTicket assignTicket;
        final AssignNextTicket assignNextTicket;
        final MoveTicketToWaitingCustomer moveTicketToWaitingCustomer;
        final FinishTicket finishTicket;
        final ReopenTicket reopenTicket;
        final AddInternalNote addInternalNote;
        final ListQueue listQueue;
        final GetOperationalCounters getOperationalCounters;
        final ListMessages listMessages;

        Services() {
            createOrganization = new CreateOrganization(base.organizations, base.users, base.members,
                    base.passwordHasher, base.tokenService, base.clock, base.logger, base.idGenerator);
            inviteMember = new InviteMember(base.users, base.members, base.organizations,
                    base.passwordHasher, base.clock, base.logger, base.idGenerator);
            registerChannel = new RegisterChannel(wa.channels, base.members, base.logger, wa.idGenerator);
            receiveWhatsAppMessage = new ReceiveWhatsAppMessage(wa.webhookEvents, wa.channels, wa.contacts,
                    wa.tickets, wa.messages, wa.ticketEvents, wa.parser, wa.gateway, wa.mediaStorage,
                    wa.cipher, wa.clock, base.logger, wa.idGenerator);
            assignTicket = new AssignTicket(wa.tickets, base.members, wa.ticketEvents, wa.clock, base.logger, wa.idGenerator);
            assignNextTicket = new AssignNextTicket(wa.tickets, base.members, wa.ticketEvents, wa.clock, base.logger, wa.idGenerator);
            moveTicketToWaitingCustomer = new MoveTicketToWaitingCustomer(wa.tickets, base.members, wa.ticketEvents, wa.clock, base.logger, wa.idGenerator);
            finishTicket = new FinishTicket(wa.tickets, base.members, wa.ticketEvents, wa.clock, base.logger, wa.idGenerator);
            reopenTicket = new ReopenTicket(wa.tickets, base.members, wa.ticketEvents, wa.clock, base.logger, wa.idGenerator);
            addInternalNote = new AddInternalNote(wa.notes, wa.contacts, wa.tickets, base.members, wa.clock, base.logger, wa.idGenerator);
            listQueue = new ListQueue(wa.tickets, base.members, wa.clock);
            getOperationalCounters = new GetOperationalCounters(wa.tickets, base.members, wa.clock);
            listMessages = new ListMessages(wa.messages, wa.tickets, base.members);
        }
    }

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

    private static String orgId(Map<String, Object> org) { return str(org, "organizationId"); }
    private static String ownerId(Map<String, Object> org) { return str(map(org, "user"), "id"); }

    private void setInbound(Services s, String from, String timestamp, String body, String id) {
        s.wa.parser.result = new WhatsAppWebhookParser.ParsedWebhook("waba-1", "123456789",
                List.of(new WhatsAppWebhookParser.ParsedWebhookMessage(id, from, timestamp, "text", body, null)),
                List.of());
    }

    private Contact receive(Services s, Map<String, Object> org, String from, String ts, String body, String id) {
        setInbound(s, from, ts, body, id);
        s.receiveWhatsAppMessage.execute(Map.of("object", "x"));
        WhatsAppChannel channel = s.wa.channels.findByPhoneNumberId("123456789");
        return s.wa.contacts.findByChannelAndPhone(orgId(org), channel.getId(), from);
    }

    private String addAgent(Services s, Map<String, Object> org, String name) {
        s.inviteMember.execute(ownerId(org), orgId(org), name.toLowerCase() + "@example.com", name, "AGENT");
        return s.base.users.findByEmail(name.toLowerCase() + "@example.com").getId();
    }

    @Test
    void ordenaPelaPrimeiraMensagemENaoDeixaNovasMensagensFurarFila() {
        Setup setup = new Setup();
        receive(setup.services, setup.org, "+5511999990001", "1700000100", "Maria entra", "m1");
        receive(setup.services, setup.org, "+5511999990002", "1700000200", "Ana entra", "m2");
        receive(setup.services, setup.org, "+5511999990003", "1700000300", "Carla entra", "m3");
        for (int i = 0; i < 5; i++) {
            receive(setup.services, setup.org, "+5511999990003", "1700000" + (400 + i), "Carla msg " + i, "mc" + i);
        }

        Map<String, Object> queue = setup.services.listQueue.execute(ownerId(setup.org), orgId(setup.org),
                TicketStatus.WAITING, null, null);
        List<String> phones = list(queue, "queue").stream()
                .map(q -> str(map(q, "contact"), "phoneE164")).toList();
        assertEquals(List.of("+5511999990001", "+5511999990002", "+5511999990003"), phones);
        assertTrue(((Number) list(queue, "queue").get(2).get("waitSeconds")).longValue() > 0);
    }

    @Test
    void atribuiOTicketElegivelMaisAntigoEmOrdemDeEspera() {
        Setup setup = new Setup();
        String agent = addAgent(setup.services, setup.org, "Bia");
        receive(setup.services, setup.org, "+5511999990001", "1700000100", "M1", "m1");
        receive(setup.services, setup.org, "+5511999990002", "1700000200", "M2", "m2");

        Map<String, Object> out = setup.services.assignNextTicket.execute(agent, orgId(setup.org));
        assertEquals(Boolean.TRUE, out.get("assigned"));
        WhatsAppChannel channel = setup.services.wa.channels.findByPhoneNumberId("123456789");
        Contact first = setup.services.wa.contacts.findByChannelAndPhone(orgId(setup.org), channel.getId(), "+5511999990001");
        assertEquals(first.getId(), str(map(out, "ticket"), "contactId"));

        Map<String, Object> queue = setup.services.listQueue.execute(agent, orgId(setup.org), TicketStatus.WAITING, null, null);
        assertEquals("+5511999990002", str(map(list(queue, "queue").get(0), "contact"), "phoneE164"));
    }

    @Test
    void duasAtendentesNaoAssumemOMesmoTicketSimultaneamente() {
        Setup setup = new Setup();
        String bia = addAgent(setup.services, setup.org, "Bia");
        String cao = addAgent(setup.services, setup.org, "Cao");
        receive(setup.services, setup.org, "+5511999990001", "1700000100", "M1", "m1");

        Map<String, Object> first = setup.services.assignNextTicket.execute(bia, orgId(setup.org));
        assertEquals(Boolean.TRUE, first.get("assigned"));

        Map<String, Object> second = setup.services.assignNextTicket.execute(cao, orgId(setup.org));
        assertEquals(Boolean.FALSE, second.get("assigned"));
        assertNull(second.get("ticket"));
    }

    @Test
    void assumeTicketEmFilaERegistraEvento() {
        Setup setup = new Setup();
        String bia = addAgent(setup.services, setup.org, "Bia");
        Contact contact = receive(setup.services, setup.org, "+5511999990001", "1700000100", "M1", "m1");
        Ticket ticket = setup.services.wa.tickets.findOpenByContact(contact.getId());

        Map<String, Object> out = setup.services.assignTicket.execute(bia, orgId(setup.org), ticket.getId());
        assertEquals("IN_PROGRESS", str(map(out, "ticket"), "status"));
        assertEquals(bia, str(map(out, "ticket"), "assignedUserId"));

        var events = setup.services.wa.ticketEvents.findByTicketId(orgId(setup.org), ticket.getId());
        assertTrue(events.stream().anyMatch(e -> e.getEventType().equals("TICKET_ASSIGNED")));
    }

    @Test
    void rejeitaAssumirTicketJaAssumidoPorOutro() {
        Setup setup = new Setup();
        String bia = addAgent(setup.services, setup.org, "Bia");
        String cao = addAgent(setup.services, setup.org, "Cao");
        Contact contact = receive(setup.services, setup.org, "+5511999990001", "1700000100", "M1", "m1");
        Ticket ticket = setup.services.wa.tickets.findOpenByContact(contact.getId());
        setup.services.assignTicket.execute(bia, orgId(setup.org), ticket.getId());

        assertThrows(TicketAlreadyAssignedError.class,
                () -> setup.services.assignTicket.execute(cao, orgId(setup.org), ticket.getId()));
    }

    @Test
    void viewerNaoPodeAssumirTicket() {
        Setup setup = new Setup();
        setup.services.inviteMember.execute(ownerId(setup.org), orgId(setup.org), "leitor@example.com", "Leitor", "VIEWER");
        String viewer = setup.services.base.users.findByEmail("leitor@example.com").getId();
        Contact contact = receive(setup.services, setup.org, "+5511999990001", "1700000100", "M1", "m1");
        Ticket ticket = setup.services.wa.tickets.findOpenByContact(contact.getId());

        assertThrows(ForbiddenRoleError.class,
                () -> setup.services.assignTicket.execute(viewer, orgId(setup.org), ticket.getId()));
    }

    private static final class Assigned {
        final Setup setup;
        final String bia;
        final Contact contact;
        final Ticket ticket;

        Assigned(Setup setup, String bia, Contact contact, Ticket ticket) {
            this.setup = setup;
            this.bia = bia;
            this.contact = contact;
            this.ticket = ticket;
        }
    }

    private Assigned assignedTicket() {
        Setup setup = new Setup();
        String bia = addAgent(setup.services, setup.org, "Bia");
        Contact contact = receive(setup.services, setup.org, "+5511999990001", "1700000100", "M1", "m1");
        Ticket ticket = setup.services.wa.tickets.findOpenByContact(contact.getId());
        setup.services.assignTicket.execute(bia, orgId(setup.org), ticket.getId());
        return new Assigned(setup, bia, contact, ticket);
    }

    @Test
    void moveParaAguardarCliente() {
        Assigned a = assignedTicket();
        Map<String, Object> out = a.setup.services.moveTicketToWaitingCustomer.execute(
                a.bia, orgId(a.setup.org), a.ticket.getId());
        assertEquals("WAITING_CUSTOMER", str(map(out, "ticket"), "status"));
    }

    @Test
    void atendenteNaoPodeMexerEmTicketDeOutro() {
        Assigned a = assignedTicket();
        String cao = addAgent(a.setup.services, a.setup.org, "Cao");
        assertThrows(TicketNotAssignedError.class, () -> a.setup.services.finishTicket.execute(
                cao, orgId(a.setup.org), a.ticket.getId()));
    }

    @Test
    void finalizaEDepoisUmRetornoGeraNovoTicketPreservandoHistorico() {
        Assigned a = assignedTicket();
        a.setup.services.finishTicket.execute(a.bia, orgId(a.setup.org), a.ticket.getId());
        assertTrue(a.setup.services.wa.tickets.findById(a.ticket.getId()).isFinished());

        receive(a.setup.services, a.setup.org, "+5511999990001", "1700000900", "Voltei", "m-volta");
        Ticket active = a.setup.services.wa.tickets.findActiveByContact(a.contact.getId());
        assertNotNull(active);
        assertTrue(!active.getId().equals(a.ticket.getId()));
        assertEquals(TicketStatus.RETURNING, active.getStatus());
        assertEquals(1700000900L * 1000, active.getQueueEnteredAt().toEpochMilli());
    }

    @Test
    void reabreAtendimentoFinalizadoComOMesmoResponsavel() {
        Assigned a = assignedTicket();
        a.setup.services.finishTicket.execute(a.bia, orgId(a.setup.org), a.ticket.getId());

        Map<String, Object> out = a.setup.services.reopenTicket.execute(a.bia, orgId(a.setup.org), a.ticket.getId());
        assertEquals("IN_PROGRESS", str(map(out, "ticket"), "status"));
        Ticket saved = a.setup.services.wa.tickets.findById(a.ticket.getId());
        assertFalse(saved.isFinished());
        assertNull(saved.getFinishedAt());
        assertEquals(a.bia, saved.getAssignedUserId());
    }

    @Test
    void naoReabreTicketFinalizadoDeOutroAtendente() {
        Assigned a = assignedTicket();
        String cao = addAgent(a.setup.services, a.setup.org, "Cao2");
        a.setup.services.finishTicket.execute(a.bia, orgId(a.setup.org), a.ticket.getId());
        assertThrows(ForbiddenRoleError.class, () -> a.setup.services.reopenTicket.execute(
                cao, orgId(a.setup.org), a.ticket.getId()));
    }

    @Test
    void adminReabreAtendimentoFinalizadoDeOutroAtendente() {
        Assigned a = assignedTicket();
        a.setup.services.finishTicket.execute(a.bia, orgId(a.setup.org), a.ticket.getId());
        Map<String, Object> out = a.setup.services.reopenTicket.execute(ownerId(a.setup.org), orgId(a.setup.org), a.ticket.getId());
        assertEquals("IN_PROGRESS", str(map(out, "ticket"), "status"));
        assertEquals(a.bia, a.setup.services.wa.tickets.findById(a.ticket.getId()).getAssignedUserId());
    }

    @Test
    void permiteFinalizarNovamenteAposReabrir() {
        Assigned a = assignedTicket();
        a.setup.services.finishTicket.execute(a.bia, orgId(a.setup.org), a.ticket.getId());
        a.setup.services.reopenTicket.execute(a.bia, orgId(a.setup.org), a.ticket.getId());
        Map<String, Object> out = a.setup.services.finishTicket.execute(a.bia, orgId(a.setup.org), a.ticket.getId());
        assertEquals("FINISHED", str(map(out, "ticket"), "status"));
    }

    @Test
    void clienteRespondeDuranteAguardandoClienteVoltaParaInProgress() {
        Assigned a = assignedTicket();
        a.setup.services.moveTicketToWaitingCustomer.execute(a.bia, orgId(a.setup.org), a.ticket.getId());
        receive(a.setup.services, a.setup.org, "+5511999990001", "1700000600", "Respondo", "m-resp");

        Ticket active = a.setup.services.wa.tickets.findActiveByContact(a.contact.getId());
        assertEquals(a.ticket.getId(), active.getId());
        assertEquals(TicketStatus.IN_PROGRESS, active.getStatus());
    }

    @Test
    void adicionaNotaInternaQueNuncaVaiAoWhatsApp() {
        Setup setup = new Setup();
        String bia = addAgent(setup.services, setup.org, "Bia");
        Contact contact = receive(setup.services, setup.org, "+5511999990001", "1700000100", "M1", "m1");

        Map<String, Object> out = setup.services.addInternalNote.execute(bia, orgId(setup.org), contact.getId(), null, "Nota interna do agente");
        assertEquals("Nota interna do agente", str(map(out, "note"), "body"));

        Ticket ticket = setup.services.wa.tickets.findOpenByContact(contact.getId());
        Map<String, Object> messages = setup.services.listMessages.execute(bia, orgId(setup.org), ticket.getId());
        assertTrue(list(messages, "messages").stream().noneMatch(m -> "Nota interna do agente".equals(str(m, "body"))));
    }

    @Test
    void rejeitaNotaParaContatoInexistente() {
        Setup setup = new Setup();
        String bia = addAgent(setup.services, setup.org, "Bia");
        assertThrows(ContactNotFoundError.class, () -> setup.services.addInternalNote.execute(
                bia, orgId(setup.org), "nao-existe", null, "x"));
    }

    @Test
    void contadoresRefletemEmTempoReal() {
        Setup setup = new Setup();
        String bia = addAgent(setup.services, setup.org, "Bia");
        receive(setup.services, setup.org, "+5511999990001", "1700000100", "M1", "m1");
        receive(setup.services, setup.org, "+5511999990002", "1700000200", "M2", "m2");

        Map<String, Object> counters = setup.services.getOperationalCounters.execute(bia, orgId(setup.org));
        assertEquals(2L, ((Number) counters.get("waiting")).longValue());

        WhatsAppChannel channel = setup.services.wa.channels.findByPhoneNumberId("123456789");
        Contact first = setup.services.wa.contacts.findByChannelAndPhone(orgId(setup.org), channel.getId(), "+5511999990001");
        Ticket ticket = setup.services.wa.tickets.findOpenByContact(first.getId());
        setup.services.assignTicket.execute(bia, orgId(setup.org), ticket.getId());

        counters = setup.services.getOperationalCounters.execute(bia, orgId(setup.org));
        assertEquals(1L, ((Number) counters.get("waiting")).longValue());
        assertEquals(1L, ((Number) counters.get("inProgress")).longValue());
    }
}
