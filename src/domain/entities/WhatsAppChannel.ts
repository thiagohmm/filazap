import { ChannelStatus } from '../value-objects/ChannelStatus';

export type WhatsAppChannelProps = {
  id: string;
  organizationId: string;
  phoneNumberId: string;
  businessAccountId: string;
  displayPhoneNumber: string;
  status: ChannelStatus;
  accessTokenEncrypted: string | null;
  appSecretEncrypted: string | null;
  webhookVerifyToken: string | null;
  apiBaseUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class WhatsAppChannel {
  private constructor(private readonly props: WhatsAppChannelProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    phoneNumberId: string;
    businessAccountId: string;
    displayPhoneNumber: string;
    status?: ChannelStatus;
    accessTokenEncrypted?: string | null;
    appSecretEncrypted?: string | null;
    webhookVerifyToken?: string | null;
    apiBaseUrl?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): WhatsAppChannel {
    const now = new Date();
    return new WhatsAppChannel({
      id: input.id,
      organizationId: input.organizationId,
      phoneNumberId: input.phoneNumberId,
      businessAccountId: input.businessAccountId,
      displayPhoneNumber: input.displayPhoneNumber,
      status: input.status ?? ChannelStatus.CONNECTED,
      accessTokenEncrypted: input.accessTokenEncrypted ?? null,
      appSecretEncrypted: input.appSecretEncrypted ?? null,
      webhookVerifyToken: input.webhookVerifyToken ?? null,
      apiBaseUrl: input.apiBaseUrl ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    });
  }

  static restore(props: WhatsAppChannelProps): WhatsAppChannel {
    return new WhatsAppChannel({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get phoneNumberId(): string {
    return this.props.phoneNumberId;
  }

  get businessAccountId(): string {
    return this.props.businessAccountId;
  }

  get displayPhoneNumber(): string {
    return this.props.displayPhoneNumber;
  }

  get status(): ChannelStatus {
    return this.props.status;
  }

  get accessTokenEncrypted(): string | null {
    return this.props.accessTokenEncrypted;
  }

  get appSecretEncrypted(): string | null {
    return this.props.appSecretEncrypted;
  }

  get webhookVerifyToken(): string | null {
    return this.props.webhookVerifyToken;
  }

  get apiBaseUrl(): string | null {
    return this.props.apiBaseUrl;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  hasCredentials(): boolean {
    return Boolean(
      this.props.accessTokenEncrypted &&
        this.props.appSecretEncrypted &&
        this.props.webhookVerifyToken
    );
  }

  toPersistence() {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      phoneNumberId: this.props.phoneNumberId,
      businessAccountId: this.props.businessAccountId,
      displayPhoneNumber: this.props.displayPhoneNumber,
      status: this.props.status,
      accessTokenEncrypted: this.props.accessTokenEncrypted,
      appSecretEncrypted: this.props.appSecretEncrypted,
      webhookVerifyToken: this.props.webhookVerifyToken,
      apiBaseUrl: this.props.apiBaseUrl,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt
    };
  }

  toJSON() {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      phoneNumberId: this.props.phoneNumberId,
      businessAccountId: this.props.businessAccountId,
      displayPhoneNumber: this.props.displayPhoneNumber,
      status: this.props.status,
      configured: this.hasCredentials(),
      apiBaseUrl: this.props.apiBaseUrl,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt
    };
  }
}
