export type NewPasswordResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export interface PasswordResetRepository {
  replaceForUser(token: NewPasswordResetToken): Promise<void>;
  consumeAndUpdatePassword(
    tokenHash: string,
    passwordHash: string,
    now: Date
  ): Promise<boolean>;
}
