import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'crypto';
import { MetaWhatsAppWebhookParser } from '../MetaWhatsAppWebhookParser';
import { MetaWhatsAppGateway } from '../MetaWhatsAppGateway';
import { MetaWebhookSignatureVerifier } from '../MetaWebhookSignatureVerifier';

describe('MetaWhatsAppWebhookParser', () => {
  const parser = new MetaWhatsAppWebhookParser();

  it('extrai mensagens de texto e status do payload oficial', () => {
    const parsed = parser.parse({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_1',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '16505551111',
                  phone_number_id: '123456789'
                },
                contacts: [{ profile: { name: 'Maria' }, wa_id: '15551234567' }],
                messages: [
                  {
                    from: '15551234567',
                    id: 'wamid.abc',
                    timestamp: '1700000001',
                    type: 'text',
                    text: { body: 'Olá' }
                  }
                ],
                statuses: [
                  { id: 'wamid.def', status: 'delivered', timestamp: '1700000010' }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    });

    expect(parsed.phoneNumberId).toBe('123456789');
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]).toMatchObject({
      whatsappMessageId: 'wamid.abc',
      from: '15551234567',
      body: 'Olá',
      type: 'text'
    });
    expect(parsed.statuses).toHaveLength(1);
    expect(parsed.statuses[0]).toMatchObject({
      whatsappMessageId: 'wamid.def',
      status: 'delivered'
    });
  });

  it('retorna body nulo para mensagens não-texto', () => {
    const parsed = parser.parse({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_1',
          changes: [
            {
              value: {
                metadata: { phone_number_id: '123456789' },
                messages: [
                  {
                    from: '1555', id: 'wamid.img', timestamp: '1', type: 'image',
                    image: { id: 'media-image', caption: 'Comprovante' }
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    });
    expect(parsed.messages[0].type).toBe('image');
    expect(parsed.messages[0].body).toBe('Comprovante');
    expect(parsed.messages[0].mediaId).toBe('media-image');
  });

  it('extrai IDs dos campos reais de áudio e documento', () => {
    const parsed = parser.parse({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: '123' }, messages: [
        { from: '1555', id: 'a1', timestamp: '1', type: 'audio', audio: { id: 'media-audio' } },
        { from: '1555', id: 'd1', timestamp: '2', type: 'document', document: { id: 'media-document', filename: 'nota.pdf' } }
      ] } }] }]
    });
    expect(parsed.messages[0]).toMatchObject({ mediaId: 'media-audio', body: null });
    expect(parsed.messages[1]).toMatchObject({ mediaId: 'media-document', body: 'nota.pdf' });
  });

  it('ignora payload vazio', () => {
    const parsed = parser.parse({ object: 'whatsapp_business_account', entry: [] });
    expect(parsed.messages).toHaveLength(0);
    expect(parsed.statuses).toHaveLength(0);
  });
});

describe('MetaWebhookSignatureVerifier', () => {
  const secret = 'my-app-secret';
  const verifier = new MetaWebhookSignatureVerifier(() => secret);

  it('aceita assinatura correta', () => {
    const body = JSON.stringify({ object: 'whatsapp' });
    const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifier.verify(body, sig)).toBe(true);
  });

  it('rejeita assinatura incorreta', () => {
    const body = JSON.stringify({ object: 'whatsapp' });
    expect(verifier.verify(body, 'sha256=deadbeef')).toBe(false);
  });

  it('rejeita cabeçalho ausente', () => {
    expect(verifier.verify('{}', '')).toBe(false);
  });
});

describe('MetaWhatsAppGateway.sendMedia', () => {
  function fakeResponse() {
    return {
      json: async () => ({ messages: [{ id: 'wamid.TEST' }] }),
      text: async () => '{}',
      ok: true,
      status: 200
    } as unknown as Response;
  }

  it('envia document quando o mimeType não é imagem ou áudio', async () => {
    let requestBody: string = '';
    const fetchMock = vi.fn(async (_url: string, opts: { body: string }) => {
      requestBody = opts.body;
      return fakeResponse();
    });
    vi.stubGlobal('fetch', fetchMock);

    const gateway = new MetaWhatsAppGateway({ baseUrl: () => 'http://api.test/123' });

    await gateway.sendMedia({
      channel: { phoneNumberId: '123', accessToken: 'token' },
      to: '5511999999999',
      fileRef: { fileId: 'FILE_ID', mimeType: 'application/pdf', filename: 'relatorio.pdf' },
      caption: 'Meu relatório',
      mediaType: 'document'
    });

    const body = JSON.parse(requestBody) as {
      type: string;
      document: { id: string; caption: string };
    };
    expect(body.type).toBe('document');
    expect(body.document).toEqual({ id: 'FILE_ID', caption: 'Meu relatório' });

    vi.unstubAllGlobals();
  });

  it('envia audio (sem caption) a partir de um fileId', async () => {
    let requestBody: string = '';
    const fetchMock = vi.fn(async (_url: string, opts: { body: string }) => {
      requestBody = opts.body;
      return fakeResponse();
    });
    vi.stubGlobal('fetch', fetchMock);

    const gateway = new MetaWhatsAppGateway({ baseUrl: () => 'http://api.test/123' });

    await gateway.sendMedia({
      channel: { phoneNumberId: '123', accessToken: 'token' },
      to: '5511999999999',
      fileRef: { fileId: 'AUDIO_ID', mimeType: 'audio/ogg', filename: 'mensagem.ogg' },
      caption: null,
      mediaType: 'audio'
    });

    const body = JSON.parse(requestBody) as { type: string; audio: { id: string } };
    expect(body.type).toBe('audio');
    expect(body.audio).toEqual({ id: 'AUDIO_ID' });

    vi.unstubAllGlobals();
  });

  it('baixa mídia recebida (GET /{mediaId} + download do binário)', async () => {
    const calls: Array<{ url: string; auth: string | null }> = [];
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const auth = init?.headers
        ? String((init.headers as Record<string, string>).Authorization ?? '')
        : null;
      calls.push({ url: String(input), auth: auth ?? null });

      if (/\/media\d+$/.test(String(input))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            url: 'http://api.test/bin/download',
            mime_type: 'audio/ogg',
            file_name: 'voz.ogg'
          }),
          text: async () => ''
        };
      }

      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        headers: new Headers({ 'content-type': 'audio/ogg' })
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const gateway = new MetaWhatsAppGateway({ baseUrl: () => 'http://api.test' });

    const result = await gateway.fetchMedia({
      channel: { phoneNumberId: '123', accessToken: 'token' },
      mediaId: 'media123'
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('http://api.test/media123');
    expect(calls[0].auth).toBe('Bearer token');
    expect(result.data.equals(Buffer.from([1, 2, 3]))).toBe(true);
    expect(result.mimeType).toBe('audio/ogg');
    expect(result.filename).toBe('voz.ogg');

    vi.unstubAllGlobals();
  });
});
