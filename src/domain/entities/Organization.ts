import { Slug } from '../value-objects/Slug';

export type OrganizationProps = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  plan: string;
  subscriptionStatus: string;
  theme: string;
  brandColor: string;
  createdAt: Date;
  updatedAt: Date;
};

export class Organization {
  private constructor(private readonly props: OrganizationProps) {}

  static create(input: {
    id: string;
    name: string;
    timezone?: string;
    plan?: string;
    subscriptionStatus?: string;
    theme?: string;
    brandColor?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): Organization {
    const slug = Slug.createFromName(input.name);
    const now = new Date();
    return new Organization({
      id: input.id,
      name: input.name,
      slug: slug.value,
      timezone: input.timezone ?? 'America/Sao_Paulo',
      plan: input.plan ?? 'STARTER',
      subscriptionStatus: input.subscriptionStatus ?? 'TRIAL',
      theme: input.theme ?? 'light',
      brandColor: input.brandColor ?? '#10b981',
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    });
  }

  static restore(props: OrganizationProps): Organization {
    return new Organization({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get plan(): string {
    return this.props.plan;
  }

  get subscriptionStatus(): string {
    return this.props.subscriptionStatus;
  }

  get theme(): string {
    return this.props.theme;
  }

  get brandColor(): string {
    return this.props.brandColor;
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
      name: this.props.name,
      slug: this.props.slug,
      timezone: this.props.timezone,
      plan: this.props.plan,
      subscriptionStatus: this.props.subscriptionStatus,
      theme: this.props.theme,
      brandColor: this.props.brandColor,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt
    };
  }
}
