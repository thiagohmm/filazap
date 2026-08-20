import { Role } from '../value-objects/Role';

export type OrganizationMemberProps = {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class OrganizationMember {
  private constructor(private readonly props: OrganizationMemberProps) {}

  static create(input: {
    id: string;
    organizationId: string;
    userId: string;
    role: Role;
    active?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }): OrganizationMember {
    const now = new Date();
    return new OrganizationMember({
      id: input.id,
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      active: input.active ?? true,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    });
  }

  static restore(props: OrganizationMemberProps): OrganizationMember {
    return new OrganizationMember({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get role(): Role {
    return this.props.role;
  }

  get active(): boolean {
    return this.props.active;
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
      userId: this.props.userId,
      role: this.props.role,
      active: this.props.active,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt
    };
  }
}
