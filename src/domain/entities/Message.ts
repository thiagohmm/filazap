import { MessageDirection } from '../value-objects/MessageDirection';

export type MessageProps = {
  id: string;
  organizationId: string;
  ticketId: string;
  contactId: string;
  whatsappMessageId: string | null;
  direction: MessageDirection;
  type: string;
  body: string | null;
  mediaPath: string | null;
  senderUserId: string | null;
  providerStatus: string | null;
  providerTimestamp: Date | null;
  createdAt: Date;
};

export class Message {
  private constructor(private readonly props: MessageProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    ticketId: string;
    contactId: string;
    direction: MessageDirection;
    type?: string;
    body?: string | null;
    mediaPath?: string | null;
    whatsappMessageId?: string | null;
    senderUserId?: string | null;
    providerStatus?: string | null;
    providerTimestamp?: Date | null;
    createdAt?: Date;
  }): Message {
    const now = new Date();
    return new Message({
      id: input.id,
      organizationId: input.organizationId,
      ticketId: input.ticketId,
      contactId: input.contactId,
      whatsappMessageId: input.whatsappMessageId ?? null,
      direction: input.direction,
      type: input.type ?? 'TEXT',
      body: input.body ?? null,
      mediaPath: input.mediaPath ?? null,
      senderUserId: input.senderUserId ?? null,
      providerStatus: input.providerStatus ?? null,
      providerTimestamp: input.providerTimestamp ?? null,
      createdAt: input.createdAt ?? now
    });
  }

  static restore(props: MessageProps): Message {
    return new Message({ ...props });
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

  get contactId(): string {
    return this.props.contactId;
  }

  get whatsappMessageId(): string | null {
    return this.props.whatsappMessageId;
  }

  get direction(): MessageDirection {
    return this.props.direction;
  }

  get type(): string {
    return this.props.type;
  }

  get body(): string | null {
    return this.props.body;
  }

  get mediaPath(): string | null {
    return this.props.mediaPath;
  }

  get senderUserId(): string | null {
    return this.props.senderUserId;
  }

  get providerStatus(): string | null {
    return this.props.providerStatus;
  }

  get providerTimestamp(): Date | null {
    return this.props.providerTimestamp;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  toJSON() {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      ticketId: this.props.ticketId,
      contactId: this.props.contactId,
      whatsappMessageId: this.props.whatsappMessageId,
      direction: this.props.direction,
      type: this.props.type,
      body: this.props.body,
      mediaPath: this.props.mediaPath,
      senderUserId: this.props.senderUserId,
      providerStatus: this.props.providerStatus,
      providerTimestamp: this.props.providerTimestamp,
      createdAt: this.props.createdAt
    };
  }
}
