import { TicketStatus } from '../value-objects/TicketStatus';
import {
  InvalidTicketTransitionError,
  TicketAlreadyAssignedError
} from '../errors';

export type TicketProps = {
  id: string;
  organizationId: string;
  channelId: string;
  contactId: string;
  sequenceNumber: number;
  status: string;
  priority: number;
  queueEnteredAt: Date;
  assignedUserId: string | null;
  assignedAt: Date | null;
  firstResponseAt: Date | null;
  waitingCustomerSince: Date | null;
  finishedAt: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export class Ticket {
  private constructor(private readonly props: TicketProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    channelId: string;
    contactId: string;
    sequenceNumber: number;
    queueEnteredAt: Date;
    status?: string;
    priority?: number;
    lastMessageAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  }): Ticket {
    const now = new Date();
    return new Ticket({
      id: input.id,
      organizationId: input.organizationId,
      channelId: input.channelId,
      contactId: input.contactId,
      sequenceNumber: input.sequenceNumber,
      status: input.status ?? TicketStatus.WAITING,
      priority: input.priority ?? 0,
      queueEnteredAt: input.queueEnteredAt,
      assignedUserId: null,
      assignedAt: null,
      firstResponseAt: null,
      waitingCustomerSince: null,
      finishedAt: null,
      lastMessageAt: input.lastMessageAt ?? input.queueEnteredAt,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    });
  }

  static restore(props: TicketProps): Ticket {
    return new Ticket({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get channelId(): string {
    return this.props.channelId;
  }

  get contactId(): string {
    return this.props.contactId;
  }

  get sequenceNumber(): number {
    return this.props.sequenceNumber;
  }

  get status(): string {
    return this.props.status;
  }

  get priority(): number {
    return this.props.priority;
  }

  get queueEnteredAt(): Date {
    return this.props.queueEnteredAt;
  }

  get assignedUserId(): string | null {
    return this.props.assignedUserId;
  }

  get assignedAt(): Date | null {
    return this.props.assignedAt;
  }

  get firstResponseAt(): Date | null {
    return this.props.firstResponseAt;
  }

  get waitingCustomerSince(): Date | null {
    return this.props.waitingCustomerSince;
  }

  get finishedAt(): Date | null {
    return this.props.finishedAt;
  }

  get lastMessageAt(): Date {
    return this.props.lastMessageAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isOpen(): boolean {
    return TicketStatus.isQueued(this.props.status as TicketStatus);
  }

  isFinished(): boolean {
    return this.props.status === TicketStatus.FINISHED;
  }

  isActive(): boolean {
    return TicketStatus.isActive(this.props.status as TicketStatus);
  }

  touchLastMessage(now: Date): void {
    this.props.lastMessageAt = now;
    this.props.updatedAt = now;
  }

  assign(userId: string, now: Date): void {
    if (!TicketStatus.isQueued(this.props.status as TicketStatus)) {
      throw new InvalidTicketTransitionError(this.props.status, 'IN_PROGRESS');
    }
    if (this.props.assignedUserId) {
      throw new TicketAlreadyAssignedError(this.props.id);
    }
    this.props.status = TicketStatus.IN_PROGRESS;
    this.props.assignedUserId = userId;
    this.props.assignedAt = now;
    this.props.updatedAt = now;
  }

  moveToWaitingCustomer(now: Date): void {
    if (this.props.status !== TicketStatus.IN_PROGRESS) {
      throw new InvalidTicketTransitionError(
        this.props.status,
        TicketStatus.WAITING_CUSTOMER
      );
    }
    this.props.status = TicketStatus.WAITING_CUSTOMER;
    this.props.waitingCustomerSince = now;
    this.props.updatedAt = now;
  }

  customerReplied(now: Date): void {
    if (this.props.status !== TicketStatus.WAITING_CUSTOMER) {
      throw new InvalidTicketTransitionError(
        this.props.status,
        TicketStatus.IN_PROGRESS
      );
    }
    this.props.status = TicketStatus.IN_PROGRESS;
    this.props.waitingCustomerSince = null;
    this.props.updatedAt = now;
  }

  registerFirstResponse(now: Date): void {
    if (!this.props.firstResponseAt) {
      this.props.firstResponseAt = now;
      this.props.updatedAt = now;
    }
  }

  reopen(now: Date): void {
    if (this.props.status !== TicketStatus.FINISHED) {
      throw new InvalidTicketTransitionError(
        this.props.status,
        TicketStatus.IN_PROGRESS
      );
    }
    if (!this.props.assignedUserId) {
      throw new InvalidTicketTransitionError(
        this.props.status,
        TicketStatus.IN_PROGRESS
      );
    }
    this.props.status = TicketStatus.IN_PROGRESS;
    this.props.finishedAt = null;
    this.props.waitingCustomerSince = null;
    this.props.updatedAt = now;
  }

  finish(now: Date): void {
    if (this.props.status === TicketStatus.FINISHED) {
      throw new InvalidTicketTransitionError(
        this.props.status,
        TicketStatus.FINISHED
      );
    }
    this.props.status = TicketStatus.FINISHED;
    this.props.finishedAt = now;
    this.props.waitingCustomerSince = null;
    this.props.updatedAt = now;
  }

  toJSON() {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      channelId: this.props.channelId,
      contactId: this.props.contactId,
      sequenceNumber: this.props.sequenceNumber,
      status: this.props.status,
      priority: this.props.priority,
      queueEnteredAt: this.props.queueEnteredAt,
      assignedUserId: this.props.assignedUserId,
      assignedAt: this.props.assignedAt,
      firstResponseAt: this.props.firstResponseAt,
      waitingCustomerSince: this.props.waitingCustomerSince,
      finishedAt: this.props.finishedAt,
      lastMessageAt: this.props.lastMessageAt,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt
    };
  }
}