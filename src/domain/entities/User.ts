export type UserProps = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(input: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): User {
    const now = new Date();
    return new User({
      id: input.id,
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    });
  }

  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get name(): string {
    return this.props.name;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  verifyPassword(password: string, hasher: PasswordHasher): Promise<boolean> {
    return hasher.verify(password, this.props.passwordHash);
  }

  toJSON() {
    return {
      id: this.props.id,
      email: this.props.email,
      name: this.props.name,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt
    };
  }
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
