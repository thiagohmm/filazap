import { PhoneNumberE164 } from '../value-objects/PhoneNumberE164';

export type ContactProps = {
  id: string;
  organizationId: string;
  channelId: string;
  phoneE164: string;
  name: string | null;
  metadata: Record<string, unknown> | null;
  firstContactAt: Date;
  lastContactAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export class Contact {
  private constructor(private readonly props: ContactProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    channelId: string;
    phone: PhoneNumberE164;
    name?: string | null;
    metadata?: Record<string, unknown> | null;
    firstContactAt?: Date;
    lastContactAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  }): Contact {
    const now = new Date();
    return new Contact({
      id: input.id,
      organizationId: input.organizationId,
      channelId: input.channelId,
      phoneE164: input.phone.e164,
      name: input.name ?? null,
      metadata: input.metadata ?? null,
      firstContactAt: input.firstContactAt ?? now,
      lastContactAt: input.lastContactAt ?? now,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    });
  }

  static restore(props: ContactProps): Contact {
    return new Contact({ ...props });
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

  get phoneE164(): string {
    return this.props.phoneE164;
  }

  get name(): string | null {
    return this.props.name;
  }

  get metadata(): Record<string, unknown> | null {
    return this.props.metadata;
  }

  get firstContactAt(): Date {
    return this.props.firstContactAt;
  }

  get lastContactAt(): Date {
    return this.props.lastContactAt;
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
      channelId: this.props.channelId,
      phoneE164: this.props.phoneE164,
      name: this.props.name,
      metadata: this.props.metadata,
      firstContactAt: this.props.firstContactAt,
      lastContactAt: this.props.lastContactAt,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt
    };
  }
}
