import type {
  SendMessageCommand,
  SendMessageResult,
  SendMediaCommand,
  UploadMediaCommand,
  UploadMediaResult,
  WhatsAppGateway
} from '../../application/ports/WhatsAppGateway';
import { SendMessageFailedError } from '../../domain/errors';

const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // 16 MB (limite da Cloud API para documentos)

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

  async uploadMedia(command: UploadMediaCommand): Promise<UploadMediaResult> {
    if (command.data.length > MAX_MEDIA_BYTES) {
      throw new SendMessageFailedError(
        'arquivo excede o tamanho máximo permitido (16 MB)'
      );
    }

    const base = this.deps.baseUrl();
    const url = `${base}/${command.channel.phoneNumberId}/media`;

    const form = new FormData();
    const bytes = new Uint8Array(command.data.length);
    bytes.set(command.data);
    const blob = new Blob([bytes], { type: command.mimeType });
    form.append('file', blob, command.filename);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${command.channel.accessToken}` },
        body: form
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

    const data = (await response.json()) as { id?: string };
    if (!data.id) {
      throw new SendMessageFailedError('resposta sem id de mídia');
    }

    return { fileId: data.id };
  }

  async sendMedia(command: SendMediaCommand): Promise<SendMessageResult> {
    const base = this.deps.baseUrl();
    const url = `${base}/${command.channel.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: command.to,
      type: command.isImage ? 'image' : 'document',
      [command.isImage ? 'image' : 'document']: {
        id: command.fileRef.fileId,
        caption: command.caption?.trim() || undefined
      }
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${command.channel.accessToken}`
        },
        body: JSON.stringify(payload)
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
