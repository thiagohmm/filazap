import { createHmac, timingSafeEqual } from 'crypto';
import type { WebhookSignatureVerifier } from '../../application/ports/WebhookSignatureVerifier';

export class MetaWebhookSignatureVerifier implements WebhookSignatureVerifier {
  constructor(private readonly appSecret: () => string) {}

  verify(rawBody: string, signatureHeader: string): boolean {
    if (!signatureHeader) return false;
    const expected = `sha256=${createHmac('sha256', this.appSecret())
      .update(rawBody, 'utf8')
      .digest('hex')}`;

    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
