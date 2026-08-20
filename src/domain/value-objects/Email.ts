import { InvalidEmailError } from '../errors/InvalidEmailError';

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const email = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new InvalidEmailError(raw);
    }
    return new Email(email);
  }
}
