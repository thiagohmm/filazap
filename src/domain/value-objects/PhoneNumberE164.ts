import { InvalidPhoneNumberError } from '../errors/InvalidPhoneNumberError';

export class PhoneNumberE164 {
  private constructor(private readonly value: string) {}

  static create(raw: string): PhoneNumberE164 {
    const normalized = raw.replace(/[^0-9+]/g, '');
    const withoutPrefix = normalized.replace(/^\+/, '');
    if (!/^[1-9]\d{7,14}$/.test(withoutPrefix)) {
      throw new InvalidPhoneNumberError(raw);
    }
    return new PhoneNumberE164(`+${withoutPrefix}`);
  }

  static restore(value: string): PhoneNumberE164 {
    return new PhoneNumberE164(value);
  }

  get e164(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
