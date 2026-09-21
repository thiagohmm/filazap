package com.filazap.test;

import com.filazap.domain.entity.Ticket;
import com.filazap.domain.error.InvalidTicketTransitionError;
import com.filazap.domain.error.TicketAlreadyAssignedError;
import com.filazap.domain.valueobject.TicketStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TicketTest {
    private static final Instant T0 = Instant.parse("2026-08-19T10:00:00Z");

    private Ticket makeTicket(TicketStatus status) {
        return makeTicket(status, null, null, null, null);
    }

    private Ticket makeTicket(TicketStatus status, String assignedUserId, Instant assignedAt,
                              Instant waitingCustomerSince, Instant finishedAt) {
        return Ticket.restore("t1", "org-1", "ch-1", "c-1", 1, status, 0, T0,
                assignedUserId, assignedAt, null, waitingCustomerSince, finishedAt, T0, T0, T0);
    }

    @Test
    void assumeTicketEmFilaEDefineResponsavelEHorario() {
        Ticket t = makeTicket(TicketStatus.WAITING);
        Instant now = Instant.parse("2026-08-19T11:00:00Z");
        t.assign("user-2", now);
        assertEquals(TicketStatus.IN_PROGRESS, t.getStatus());
        assertEquals("user-2", t.getAssignedUserId());
        assertEquals(now, t.getAssignedAt());
    }

    @Test
    void rejeitaAssumirTicketJaAtribuido() {
        Ticket t = makeTicket(TicketStatus.WAITING, "user-1", null, null, null);
        assertThrows(TicketAlreadyAssignedError.class, () -> t.assign("user-2", Instant.now()));
    }

    @Test
    void naoPermiteAssumirTicketQueNaoEstaNaFila() {
        Ticket t = makeTicket(TicketStatus.IN_PROGRESS);
        assertThrows(InvalidTicketTransitionError.class, () -> t.assign("user-2", Instant.now()));
    }

    @Test
    void moveParaAguardarClienteApenasQuandoEmAtendimento() {
        Ticket t = makeTicket(TicketStatus.IN_PROGRESS);
        Instant now = Instant.parse("2026-08-19T11:00:00Z");
        t.moveToWaitingCustomer(now);
        assertEquals(TicketStatus.WAITING_CUSTOMER, t.getStatus());
        assertEquals(now, t.getWaitingCustomerSince());
    }

    @Test
    void clienteRespondeEnquantoAguardavaVoltaParaEmAtendimento() {
        Ticket t = makeTicket(TicketStatus.WAITING_CUSTOMER, null, null,
                Instant.parse("2026-08-19T11:00:00Z"), null);
        t.customerReplied(Instant.parse("2026-08-19T11:30:00Z"));
        assertEquals(TicketStatus.IN_PROGRESS, t.getStatus());
        assertNull(t.getWaitingCustomerSince());
    }

    @Test
    void registraPrimeiraRespostaApenasUmaVez() {
        Ticket t = makeTicket(TicketStatus.IN_PROGRESS);
        Instant first = Instant.parse("2026-08-19T11:00:00Z");
        t.registerFirstResponse(first);
        t.registerFirstResponse(Instant.parse("2026-08-19T12:00:00Z"));
        assertEquals(first, t.getFirstResponseAt());
    }

    @Test
    void finalizaAtendimentoPreenchendoFinishedAt() {
        Ticket t = makeTicket(TicketStatus.IN_PROGRESS);
        Instant now = Instant.parse("2026-08-19T11:00:00Z");
        t.finish(now);
        assertEquals(TicketStatus.FINISHED, t.getStatus());
        assertEquals(now, t.getFinishedAt());
    }

    @Test
    void naoPermiteFinalizarTicketJaFinalizado() {
        Ticket t = makeTicket(TicketStatus.FINISHED);
        assertThrows(InvalidTicketTransitionError.class, () -> t.finish(Instant.now()));
    }

    @Test
    void reabreTicketFinalizadoVoltandoParaInProgress() {
        Ticket t = makeTicket(TicketStatus.FINISHED, "user-2",
                Instant.parse("2026-08-19T11:00:00Z"), null,
                Instant.parse("2026-08-19T12:00:00Z"));
        Instant now = Instant.parse("2026-08-19T13:00:00Z");
        t.reopen(now);
        assertEquals(TicketStatus.IN_PROGRESS, t.getStatus());
        assertNull(t.getFinishedAt());
        assertEquals("user-2", t.getAssignedUserId());
    }

    @Test
    void naoReabreTicketQueNaoEstaFinalizado() {
        Ticket t = makeTicket(TicketStatus.IN_PROGRESS);
        assertThrows(InvalidTicketTransitionError.class, () -> t.reopen(Instant.now()));
    }

    @Test
    void naoReabreTicketFinalizadoSemResponsavel() {
        Ticket t = makeTicket(TicketStatus.FINISHED, null, null, null, T0);
        assertThrows(InvalidTicketTransitionError.class, () -> t.reopen(Instant.now()));
    }

    @Test
    void isOpenRefleteApenasWaitingEReturning() {
        assertTrue(makeTicket(TicketStatus.WAITING).isOpen());
        assertTrue(makeTicket(TicketStatus.RETURNING).isOpen());
        assertFalse(makeTicket(TicketStatus.IN_PROGRESS).isOpen());
        assertFalse(makeTicket(TicketStatus.FINISHED).isOpen());
    }

    @Test
    void ticketStatusConverteEValida() {
        assertEquals(TicketStatus.WAITING, TicketStatus.fromString("WAITING"));
        assertEquals(TicketStatus.IN_PROGRESS, TicketStatus.fromString("in_progress"));
        assertTrue(TicketStatus.isQueued(TicketStatus.WAITING));
        assertTrue(TicketStatus.isQueued(TicketStatus.RETURNING));
        assertFalse(TicketStatus.isQueued(TicketStatus.IN_PROGRESS));
        assertFalse(TicketStatus.isActive(TicketStatus.FINISHED));
        assertTrue(TicketStatus.isActive(TicketStatus.WAITING));
    }
}
