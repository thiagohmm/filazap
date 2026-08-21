export interface PasswordResetMailer {
  send(input: { email: string; name: string; resetUrl: string }): Promise<void>;
}
