import type { WhatsAppChannelRepository } from '../ports/WhatsAppChannelRepository';
import type { VerifyWebhookInput, VerifyWebhookOutput } from '../dto/VerifyWebhookDTO';

export class VerifyWebhook {
  constructor(
    private readonly deps: {
      channels: WhatsAppChannelRepository;
    }
  ) {}

  async execute(input: VerifyWebhookInput): Promise<VerifyWebhookOutput> {
    if (input.mode !== 'subscribe' || !input.verifyToken) {
      return { valid: false, challenge: input.challenge };
    }
    const channel = await this.deps.channels.findByWebhookVerifyToken(
      input.verifyToken
    );
    const valid = Boolean(channel);
    return { valid, challenge: input.challenge };
  }
}
