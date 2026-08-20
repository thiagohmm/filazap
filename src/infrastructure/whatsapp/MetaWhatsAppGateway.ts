import type {
  SendMessageCommand,
  SendMessageResult,
  WhatsAppGateway
} from '../../application/ports/WhatsAppGateway';
import { SendMessageFailedError } from '../../domain/errors';

export class MetaWhatsAppGateway implements WhatsAppGateway {
  constructor(
    private readonly deps: {
      baseUrl: () => string;
    }
  ) {}

  async sendText(command: SendMessageCommand): Promise<SendMessageResult> {
    const base = this.deps.baseUrl();
    const url = `${base}/${command.channel.phoneNumberId}/messages`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${command.channel.accessToken}`
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: command.to,
          type: 'text',
          text: { body: command.body }
        })
      });
    } catch (error) {
      throw new SendMessageFailedError(
        error instanceof Error ? error.message : 'falha de rede'
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new SendMessageFailedError(`HTTP ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
    };
    const providerMessageId = data.messages?.[0]?.id;
    if (!providerMessageId) {
      throw new SendMessageFailedError('resposta sem id de mensagem');
    }

    return { providerMessageId };
  }
}
