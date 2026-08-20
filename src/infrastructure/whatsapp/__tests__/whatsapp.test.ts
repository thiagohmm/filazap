import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { MetaWhatsAppWebhookParser } from '../MetaWhatsAppWebhookParser';
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
                  { from: '1555', id: 'wamid.img', timestamp: '1', type: 'image' }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    });
    expect(parsed.messages[0].type).toBe('image');
    expect(parsed.messages[0].body).toBeNull();
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
