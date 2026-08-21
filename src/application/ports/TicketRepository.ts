import { Ticket } from '../../domain/entities/Ticket';
import { TicketStatus } from '../../domain/value-objects/TicketStatus';

export type QueueTicket = {
  ticket: Ticket;
  contactName: string | null;
  contactPhone: string;
  assignedUserName: string | null;
  lastMessageBody: string | null;
  lastMessageAt: Date | null;
};

export type TicketQueueFilter = {
  organizationId: string;
  status?: TicketStatus;
  assignedUserId?: string;
  limit?: number;
};

export type OperationalCounters = {
  waiting: number;
  returning: number;
  inProgress: number;
  waitingCustomer: number;
  finishedToday: number;
  maxWaitSeconds: number | null;
  avgFirstResponseSeconds: number | null;
};

export type TicketHistoryItem = {
  ticket: Ticket;
  assignedUserName: string | null;
};

export type TicketsPerAgent = {
  userId: string;
  name: string;
  count: number;
};

export type OrganizationMetrics = {
  avgAttendanceSeconds: number | null;
  totalFinished: number;
  ticketsPerAgent: TicketsPerAgent[];
  returnRate: number | null;
};

export type AssignResult =
  | { ok: true; ticket: Ticket }
  | { ok: false; reason: 'ALREADY_ASSIGNED' | 'NOT_AVAILABLE' };

export interface TicketRepository {
  save(ticket: Ticket): Promise<Ticket>;
  findById(id: string): Promise<Ticket | null>;
  findOpenByContact(contactId: string): Promise<Ticket | null>;
  findActiveByContact(contactId: string): Promise<Ticket | null>;
  nextSequenceNumber(organizationId: string): Promise<number>;
  listQueue(filter: TicketQueueFilter): Promise<QueueTicket[]>;
  assignNext(organizationId: string, userId: string, now: Date): Promise<AssignResult>;
  assignTicket(ticketId: string, userId: string, now: Date): Promise<AssignResult>;
  findAssignedOpenByUser(organizationId: string, userId: string): Promise<Ticket[]>;
  getOperationalCounters(
    organizationId: string,
    now: Date
  ): Promise<OperationalCounters>;
  findByContact(
    organizationId: string,
    contactId: string
  ): Promise<TicketHistoryItem[]>;
  getMetrics(organizationId: string, now: Date): Promise<OrganizationMetrics>;
}
