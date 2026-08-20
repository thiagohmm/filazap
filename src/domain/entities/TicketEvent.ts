export type TicketEventProps = {
  id: string;
  organizationId: string;
  ticketId: string;
  actorUserId: string | null;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
};

export class TicketEvent {
  private constructor(private readonly props: TicketEventProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    ticketId: string;
    actorUserId?: string | null;
    eventType: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    payload?: Record<string, unknown> | null;
    createdAt?: Date;
  }): TicketEvent {
    const now = new Date();
    return new TicketEvent({
      id: input.id,
      organizationId: input.organizationId,
      ticketId: input.ticketId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      payload: input.payload ?? null,
      createdAt: input.createdAt ?? now
    });
  }

  static restore(props: TicketEventProps): TicketEvent {
    return new TicketEvent({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get ticketId(): string {
    return this.props.ticketId;
  }

  get actorUserId(): string | null {
    return this.props.actorUserId;
  }

  get eventType(): string {
    return this.props.eventType;
  }

  get fromStatus(): string | null {
    return this.props.fromStatus;
  }

  get toStatus(): string | null {
    return this.props.toStatus;
  }

  get payload(): Record<string, unknown> | null {
    return this.props.payload;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  toJSON() {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      ticketId: this.props.ticketId,
      actorUserId: this.props.actorUserId,
      eventType: this.props.eventType,
      fromStatus: this.props.fromStatus,
      toStatus: this.props.toStatus,
      payload: this.props.payload,
      createdAt: this.props.createdAt
    };
  }
}