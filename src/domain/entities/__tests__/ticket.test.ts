import { describe, it, expect } from 'vitest';
import { Ticket } from '../Ticket';
import { TicketStatus } from '../../value-objects/TicketStatus';
import {
  InvalidTicketTransitionError,
  TicketAlreadyAssignedError
} from '../../errors';

function makeTicket(overrides: Partial<Parameters<typeof Ticket.restore>[0]> = {}) {
  return Ticket.restore({
    id: 't1',
    organizationId: 'org-1',
    channelId: 'ch-1',
    contactId: 'c-1',
    sequenceNumber: 1,
    status: TicketStatus.WAITING,
    priority: 0,
    queueEnteredAt: new Date('2026-08-19T10:00:00.000Z'),
    assignedUserId: null,
    assignedAt: null,
    firstResponseAt: null,
    waitingCustomerSince: null,
    finishedAt: null,
    lastMessageAt: new Date('2026-08-19T10:00:00.000Z'),
    createdAt: new Date('2026-08-19T10:00:00.000Z'),
    updatedAt: new Date('2026-08-19T10:00:00.000Z'),
    ...overrides
  });
}

describe('Ticket máquina de estados', () => {
  it('assume ticket em fila e define responsável e horário', () => {
    const t = makeTicket({ status: TicketStatus.WAITING });
    const now = new Date('2026-08-19T11:00:00.000Z');
    t.assign('user-2', now);
    expect(t.status).toBe(TicketStatus.IN_PROGRESS);
    expect(t.assignedUserId).toBe('user-2');
    expect(t.assignedAt).toEqual(now);
  });

  it('rejeita assumir ticket já atribuído', () => {
    const t = makeTicket({
      status: TicketStatus.WAITING,
      assignedUserId: 'user-1'
    });
    expect(() => t.assign('user-2', new Date())).toThrow(
      TicketAlreadyAssignedError
    );
  });

  it('não permite assumir ticket que não está na fila', () => {
    const t = makeTicket({ status: TicketStatus.IN_PROGRESS });
    expect(() => t.assign('user-2', new Date())).toThrow(
      InvalidTicketTransitionError
    );
  });

  it('move para aguardar cliente apenas quando está em atendimento', () => {
    const t = makeTicket({ status: TicketStatus.IN_PROGRESS });
    const now = new Date('2026-08-19T11:00:00.000Z');
    t.moveToWaitingCustomer(now);
    expect(t.status).toBe(TicketStatus.WAITING_CUSTOMER);
    expect(t.waitingCustomerSince).toEqual(now);
  });

  it('cliente responde enquanto aguardava volta para em atendimento preservando o ticket', () => {
    const t = makeTicket({
      status: TicketStatus.WAITING_CUSTOMER,
      waitingCustomerSince: new Date('2026-08-19T11:00:00.000Z')
    });
    t.customerReplied(new Date('2026-08-19T11:30:00.000Z'));
    expect(t.status).toBe(TicketStatus.IN_PROGRESS);
    expect(t.waitingCustomerSince).toBeNull();
  });

  it('registra primeira resposta apenas uma vez', () => {
    const t = makeTicket({ status: TicketStatus.IN_PROGRESS });
    const first = new Date('2026-08-19T11:00:00.000Z');
    t.registerFirstResponse(first);
    t.registerFirstResponse(new Date('2026-08-19T12:00:00.000Z'));
    expect(t.firstResponseAt).toEqual(first);
  });

  it('finaliza atendimento preenchendo finished_at', () => {
    const t = makeTicket({ status: TicketStatus.IN_PROGRESS });
    const now = new Date('2026-08-19T11:00:00.000Z');
    t.finish(now);
    expect(t.status).toBe(TicketStatus.FINISHED);
    expect(t.finishedAt).toEqual(now);
  });

  it('não permite finalizar ticket já finalizado', () => {
    const t = makeTicket({ status: TicketStatus.FINISHED });
    expect(() => t.finish(new Date())).toThrow(InvalidTicketTransitionError);
  });

  it('reabre ticket finalizado voltando para IN_PROGRESS', () => {
    const t = makeTicket({
      status: TicketStatus.FINISHED,
      assignedUserId: 'user-2',
      assignedAt: new Date('2026-08-19T11:00:00.000Z'),
      finishedAt: new Date('2026-08-19T12:00:00.000Z')
    });
    const now = new Date('2026-08-19T13:00:00.000Z');
    t.reopen(now);
    expect(t.status).toBe(TicketStatus.IN_PROGRESS);
    expect(t.finishedAt).toBeNull();
    expect(t.assignedUserId).toBe('user-2');
  });

  it('não reabre ticket que não está finalizado', () => {
    const t = makeTicket({ status: TicketStatus.IN_PROGRESS });
    expect(() => t.reopen(new Date())).toThrow(InvalidTicketTransitionError);
  });

  it('não reabre ticket finalizado sem responsável', () => {
    const t = makeTicket({ status: TicketStatus.FINISHED, assignedUserId: null });
    expect(() => t.reopen(new Date())).toThrow(InvalidTicketTransitionError);
  });

  it('isOpen reflete apenas WAITING e RETURNING', () => {
    expect(makeTicket({ status: TicketStatus.WAITING }).isOpen()).toBe(true);
    expect(makeTicket({ status: TicketStatus.RETURNING }).isOpen()).toBe(true);
    expect(makeTicket({ status: TicketStatus.IN_PROGRESS }).isOpen()).toBe(false);
    expect(makeTicket({ status: TicketStatus.FINISHED }).isOpen()).toBe(false);
  });
});

describe('TicketStatus value object', () => {
  it('converte e valida status', () => {
    expect(TicketStatus.fromString('WAITING')).toBe(TicketStatus.WAITING);
    expect(TicketStatus.fromString('in_progress')).toBe(TicketStatus.IN_PROGRESS);
    expect(TicketStatus.isQueued(TicketStatus.WAITING)).toBe(true);
    expect(TicketStatus.isQueued(TicketStatus.RETURNING)).toBe(true);
    expect(TicketStatus.isQueued(TicketStatus.IN_PROGRESS)).toBe(false);
    expect(TicketStatus.isActive(TicketStatus.FINISHED)).toBe(false);
    expect(TicketStatus.isActive(TicketStatus.WAITING)).toBe(true);
  });
});