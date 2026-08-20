export type InternalNoteProps = {
  id: string;
  organizationId: string;
  contactId: string;
  ticketId: string | null;
  authorUserId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

export class InternalNote {
  private constructor(private readonly props: InternalNoteProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    contactId: string;
    ticketId?: string | null;
    authorUserId: string;
    body: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): InternalNote {
    const now = new Date();
    return new InternalNote({
      id: input.id,
      organizationId: input.organizationId,
      contactId: input.contactId,
      ticketId: input.ticketId ?? null,
      authorUserId: input.authorUserId,
      body: input.body,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    });
  }

  static restore(props: InternalNoteProps): InternalNote {
    return new InternalNote({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get contactId(): string {
    return this.props.contactId;
  }

  get ticketId(): string | null {
    return this.props.ticketId;
  }

  get authorUserId(): string {
    return this.props.authorUserId;
  }

  get body(): string {
    return this.props.body;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toJSON() {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      contactId: this.props.contactId,
      ticketId: this.props.ticketId,
      authorUserId: this.props.authorUserId,
      body: this.props.body,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt
    };
  }
}