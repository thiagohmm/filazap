package com.filazap.test;

import com.filazap.application.usecase.CreateOrganization;
import com.filazap.application.usecase.GetContactProfile;
import com.filazap.application.usecase.GetMetrics;
import com.filazap.application.usecase.ListContactHistory;
import com.filazap.application.usecase.SearchContacts;
import com.filazap.domain.entity.Contact;
import com.filazap.domain.entity.InternalNote;
import com.filazap.domain.entity.Ticket;
import com.filazap.domain.error.ContactNotFoundError;
import com.filazap.domain.valueobject.PhoneNumberE164;
import com.filazap.domain.valueobject.TicketStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static com.filazap.test.Maps.list;
import static com.filazap.test.Maps.map;
import static com.filazap.test.Maps.str;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CrmUseCasesTest {

    private static final class Services {
        final TestFakes.TestServices base = TestFakes.testServices();
        final TestFakes.WhatsAppServices wa = TestFakes.whatsappServices();
        final CreateOrganization createOrganization;
        final SearchContacts searchContacts;
        final GetContactProfile getContactProfile;
        final ListContactHistory listContactHistory;
        final GetMetrics getMetrics;

        Services() {
            createOrganization = new CreateOrganization(base.organizations, base.users, base.members,
                    base.passwordHasher, base.tokenService, base.clock, base.logger, base.idGenerator);
            searchContacts = new SearchContacts(wa.contacts, base.members);
            getContactProfile = new GetContactProfile(wa.contacts, wa.tickets, wa.notes, base.users, base.members);
            listContactHistory = new ListContactHistory(wa.contacts, wa.tickets, base.members);
            getMetrics = new GetMetrics(wa.tickets, base.members, base.clock);
        }
    }

    private static final class Setup {
        final Services services;
        final Map<String, Object> org;

        Setup() {
            services = new Services();
            org = services.createOrganization.execute("Empresa A", "Ana", "ana@example.com", "senha1234");
        }
    }

    private static String orgId(Map<String, Object> org) { return str(org, "organizationId"); }
    private static String ownerId(Map<String, Object> org) { return str(map(org, "user"), "id"); }

    private Contact addContact(Services s, Map<String, Object> org, String id, String phone, String name) {
        Instant first = Instant.parse("2026-08-01T10:00:00Z");
        Instant last = Instant.parse("2026-08-19T10:00:00Z");
        Contact c = Contact.restore(id, orgId(org), "ch-1", PhoneNumberE164.create(phone).e164(),
                name, null, first, last, first, last);
        s.wa.contacts.save(c);
        return c;
    }

    private Ticket addTicket(Services s, Map<String, Object> org, String id, String contactId,
                             int seq, Instant queueEnteredAt, TicketStatus status) {
        Ticket created = Ticket.create(id, orgId(org), "ch-1", contactId, seq, queueEnteredAt, status);
        Ticket ticket;
        if (status == TicketStatus.FINISHED) {
            ticket = Ticket.restore(created.getId(), created.getOrganizationId(), created.getChannelId(),
                    created.getContactId(), created.getSequenceNumber(), TicketStatus.FINISHED,
                    created.getPriority(), created.getQueueEnteredAt(), null, null, null, null,
                    queueEnteredAt.plusSeconds(3600), created.getLastMessageAt(), created.getCreatedAt(),
                    created.getUpdatedAt());
        } else {
            ticket = created;
        }
        s.wa.tickets.save(ticket);
        return ticket;
    }

    @Test
    void buscaPorNomeETelefone() {
        Setup setup = new Setup();
        addContact(setup.services, setup.org, "c1", "+5511999990001", "Maria Silva");
        addContact(setup.services, setup.org, "c2", "+5511999990002", "João");

        Map<String, Object> byName = setup.services.searchContacts.execute(
                ownerId(setup.org), orgId(setup.org), "maria", null);
        assertEquals(java.util.List.of("c1"), list(byName, "contacts").stream().map(c -> str(c, "id")).toList());

        Map<String, Object> byPhone = setup.services.searchContacts.execute(
                ownerId(setup.org), orgId(setup.org), "0002", null);
        assertEquals(java.util.List.of("c2"), list(byPhone, "contacts").stream().map(c -> str(c, "id")).toList());
    }

    @Test
    void naoBuscaContatosDeOutraOrganizacao() {
        Setup setup = new Setup();
        Map<String, Object> other = setup.services.createOrganization.execute(
                "Outra", "Outra", "outra@example.com", "senha1234");
        addContact(setup.services, other, "c-other", "+5511999990003", "Maria");

        Map<String, Object> out = setup.services.searchContacts.execute(
                ownerId(setup.org), orgId(setup.org), "Maria", null);
        assertEquals(0, list(out, "contacts").size());
    }

    @Test
    void retornaPerfilTotalDeAtendimentosENotas() {
        Setup setup = new Setup();
        addContact(setup.services, setup.org, "c1", "+5511999990001", "Maria");
        addTicket(setup.services, setup.org, "t1", "c1", 1, Instant.parse("2026-08-01T10:00:00Z"), TicketStatus.FINISHED);
        addTicket(setup.services, setup.org, "t2", "c1", 2, Instant.parse("2026-08-05T10:00:00Z"), TicketStatus.FINISHED);
        setup.services.wa.notes.save(InternalNote.create("n1", orgId(setup.org), "c1", null,
                ownerId(setup.org), "Cliente pediu ligação", Instant.parse("2026-08-06T10:00:00Z")));

        Map<String, Object> out = setup.services.getContactProfile.execute(
                ownerId(setup.org), orgId(setup.org), "c1");
        assertEquals("Maria", str(map(out, "contact"), "name"));
        assertEquals(2, map(out, "stats").get("totalTickets"));
        assertEquals(1, list(out, "notes").size());
        assertEquals("Cliente pediu ligação", str(list(out, "notes").get(0), "body"));
    }

    @Test
    void informaStatusAtualQuandoHaTicketAtivo() {
        Setup setup = new Setup();
        addContact(setup.services, setup.org, "c1", "+5511999990001", "Maria");
        addTicket(setup.services, setup.org, "t1", "c1", 1, Instant.parse("2026-08-01T10:00:00Z"), TicketStatus.WAITING);

        Map<String, Object> out = setup.services.getContactProfile.execute(
                ownerId(setup.org), orgId(setup.org), "c1");
        assertEquals("WAITING", str(map(out, "stats"), "currentStatus"));
    }

    @Test
    void rejeitaContatoDeOutraOrganizacao() {
        Setup setup = new Setup();
        Map<String, Object> other = setup.services.createOrganization.execute(
                "Outra", "Outra", "outra@example.com", "senha1234");
        addContact(setup.services, other, "c-other", "+5511999990003", "Maria");

        assertThrows(ContactNotFoundError.class, () -> setup.services.getContactProfile.execute(
                ownerId(setup.org), orgId(setup.org), "c-other"));
    }

    @Test
    void listaAtendimentosOrdenadosDoMaisRecente() {
        Setup setup = new Setup();
        addContact(setup.services, setup.org, "c1", "+5511999990001", "Maria");
        addTicket(setup.services, setup.org, "t1", "c1", 1, Instant.parse("2026-08-01T10:00:00Z"), TicketStatus.FINISHED);
        addTicket(setup.services, setup.org, "t2", "c1", 2, Instant.parse("2026-08-05T10:00:00Z"), TicketStatus.FINISHED);

        Map<String, Object> out = setup.services.listContactHistory.execute(
                ownerId(setup.org), orgId(setup.org), "c1");
        assertEquals(2, list(out, "history").size());
        assertEquals(2, list(out, "history").get(0).get("sequenceNumber"));
        assertEquals("FINISHED", str(list(out, "history").get(0), "status"));
    }

    @Test
    void calculaTempoMedioTotalFinalizadoETaxaDeRetorno() {
        Setup setup = new Setup();
        addContact(setup.services, setup.org, "c1", "+5511999990001", "Maria");
        addContact(setup.services, setup.org, "c2", "+5511999990002", "João");
        addContact(setup.services, setup.org, "c3", "+5511999990003", "Ana");

        addTicket(setup.services, setup.org, "t1", "c1", 1, Instant.parse("2026-08-01T10:00:00Z"), TicketStatus.FINISHED);
        addTicket(setup.services, setup.org, "t2", "c1", 2, Instant.parse("2026-08-05T10:00:00Z"), TicketStatus.FINISHED);
        addTicket(setup.services, setup.org, "t3", "c2", 3, Instant.parse("2026-08-02T10:00:00Z"), TicketStatus.FINISHED);
        addTicket(setup.services, setup.org, "t4", "c3", 4, Instant.parse("2026-08-03T10:00:00Z"), TicketStatus.FINISHED);

        Map<String, Object> out = setup.services.getMetrics.execute(ownerId(setup.org), orgId(setup.org));
        assertEquals(4, out.get("totalFinished"));
        assertEquals(33.3, out.get("returnRate"));
    }
}
