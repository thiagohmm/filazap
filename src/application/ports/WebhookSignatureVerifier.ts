export interface WebhookSignatureVerifier {
  verify(rawBody: string, signatureHeader: string): boolean;
}
