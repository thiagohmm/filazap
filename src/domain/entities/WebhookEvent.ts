import { WebhookEventStatus } from '../value-objects/WebhookEventStatus';

export type WebhookEventProps = {
  id: string;
  organizationId: string | null;
  providerEventId: string | null;
  payload: Record<string, unknown>;
  processingStatus: WebhookEventStatus;
  attempts: number;
  receivedAt: Date;
  processedAt: Date | null;
  errorMessage: string | null;
};

export class WebhookEvent {
  private constructor(private readonly props: WebhookEventProps) {}

  static create(input: {
    id: string;
    providerEventId?: string | null;
    payload: Record<string, unknown>;
    organizationId?: string | null;
    processingStatus?: WebhookEventStatus;
    attempts?: number;
    receivedAt?: Date;
  }): WebhookEvent {
    const now = new Date();
    return new WebhookEvent({
      id: input.id,
      organizationId: input.organizationId ?? null,
      providerEventId: input.providerEventId ?? null,
      payload: input.payload,
      processingStatus: input.processingStatus ?? WebhookEventStatus.PENDING,
      attempts: input.attempts ?? 0,
      receivedAt: input.receivedAt ?? now,
      processedAt: null,
      errorMessage: null
    });
  }

  static restore(props: WebhookEventProps): WebhookEvent {
    return new WebhookEvent({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get organizationId(): string | null {
    return this.props.organizationId;
  }

  get providerEventId(): string | null {
    return this.props.providerEventId;
  }

  get payload(): Record<string, unknown> {
    return this.props.payload;
  }

  get processingStatus(): WebhookEventStatus {
    return this.props.processingStatus;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get receivedAt(): Date {
    return this.props.receivedAt;
  }

  get processedAt(): Date | null {
    return this.props.processedAt;
  }

  get errorMessage(): string | null {
    return this.props.errorMessage;
  }

  markProcessed(now: Date): void {
    this.props.processingStatus = WebhookEventStatus.PROCESSED;
    this.props.processedAt = now;
  }

  markFailed(now: Date, error: string): void {
    this.props.processingStatus = WebhookEventStatus.FAILED;
    this.props.attempts += 1;
    this.props.errorMessage = error;
    this.props.processedAt = now;
  }

  toJSON() {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      providerEventId: this.props.providerEventId,
      payload: this.props.payload,
      processingStatus: this.props.processingStatus,
      attempts: this.props.attempts,
      receivedAt: this.props.receivedAt,
      processedAt: this.props.processedAt,
      errorMessage: this.props.errorMessage
    };
  }
}
