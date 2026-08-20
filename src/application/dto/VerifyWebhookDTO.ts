export type VerifyWebhookInput = {
  mode: string;
  verifyToken: string;
  challenge: string;
};

export type VerifyWebhookOutput = {
  valid: boolean;
  challenge: string;
};
