import { readFile } from 'node:fs/promises';

async function loadLocalEnv() {
  const raw = await readFile(new URL('../.env', import.meta.url), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

async function json(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.url}: HTTP ${response.status}`);
  return body;
}

async function main() {
  await loadLocalEnv();
  const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:3000';
  const mockUrl = process.env.MOCK_URL ?? 'http://127.0.0.1:4000';
  const loginResponse = await fetch(`${appUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD
    })
  });
  const auth = await json(loginResponse);
  const organization = auth.organizations[0];
  if (!organization) throw new Error('O usuário demonstrativo não possui organização.');

  const headers = {
    authorization: `Bearer ${auth.token}`,
    'content-type': 'application/json'
  };
  const incomingPhone = `5511988${String(Date.now()).slice(-7)}`;
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '1010101010',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '5511999990000', phone_number_id: '123456789' },
          contacts: [{ profile: { name: 'Teste Docker' }, wa_id: incomingPhone }],
          messages: [{
            from: incomingPhone,
            id: `wamid.E2E.${Date.now()}`,
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: 'text',
            text: { body: 'Mensagem recebida no teste Docker' }
          }]
        },
        field: 'messages'
      }]
    }]
  };

  const webhook = await json(await fetch(`${mockUrl}/graph/webhook/forward`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ appUrl: 'http://app:3000', appSecret: 'local-app-secret', payload })
  }));
  if (webhook.upstream_status !== 200) throw new Error(`Webhook rejeitado: HTTP ${webhook.upstream_status}`);

  const queue = await json(await fetch(`${appUrl}/api/organizations/${organization.id}/tickets`, { headers }));
  const received = queue.queue.find((item) => item.contact.phoneE164.includes(incomingPhone));
  if (!received) throw new Error('A mensagem recebida não apareceu na fila.');

  await json(await fetch(`${appUrl}/api/organizations/${organization.id}/tickets/${received.ticketId}/assign`, {
    method: 'POST', headers
  }));
  const sent = await json(await fetch(`${appUrl}/api/organizations/${organization.id}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      channelId: received.channelId,
      contactId: received.contact.id,
      body: 'Resposta enviada pelo FilaZap no teste Docker'
    })
  }));

  const outboundFiles = [
    { name: 'imagem.png', type: 'image/png', data: Buffer.from('imagem-mock') },
    { name: 'audio.wav', type: 'audio/wav', data: Buffer.from('audio-mock') },
    { name: 'documento.pdf', type: 'application/pdf', data: Buffer.from('%PDF-1.4 mock') }
  ];
  for (const file of outboundFiles) {
    const form = new FormData();
    form.append('channelId', received.channelId);
    form.append('contactId', received.contact.id);
    form.append('body', `Teste ${file.name}`);
    form.append('file', new Blob([file.data], { type: file.type }), file.name);
    await json(await fetch(`${appUrl}/api/organizations/${organization.id}/messages`, {
      method: 'POST', headers: { authorization: `Bearer ${auth.token}` }, body: form
    }));
  }

  const inboundMedia = {
    object: 'whatsapp_business_account',
    entry: [{ id: '1010101010', changes: [{ value: {
      messaging_product: 'whatsapp',
      metadata: { display_phone_number: '5511999990000', phone_number_id: '123456789' },
      contacts: [{ profile: { name: 'Teste Docker' }, wa_id: incomingPhone }],
      messages: [
        { from: incomingPhone, id: `wamid.mock-image-${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'image', image: { id: 'mock-image', caption: 'Imagem recebida' } },
        { from: incomingPhone, id: `wamid.mock-audio-${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'audio', audio: { id: 'mock-audio' } },
        { from: incomingPhone, id: `wamid.mock-document-${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'document', document: { id: 'mock-document', filename: 'documento-mock.pdf' } }
      ]
    }, field: 'messages' }] }]
  };
  const mediaWebhook = await json(await fetch(`${mockUrl}/graph/webhook/forward`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ appUrl: 'http://app:3000', appSecret: 'local-app-secret', payload: inboundMedia })
  }));
  if (mediaWebhook.upstream_status !== 200) throw new Error('Webhook de mídia foi rejeitado.');

  const history = await json(await fetch(
    `${appUrl}/api/organizations/${organization.id}/tickets/${received.ticketId}/messages`,
    { headers: { authorization: `Bearer ${auth.token}` } }
  ));
  for (const type of ['IMAGE', 'AUDIO', 'DOCUMENT']) {
    const message = [...history.messages].reverse().find((item) => item.type === type && item.mediaPath);
    if (!message) throw new Error(`Mídia ${type} não foi persistida.`);
    const mediaResponse = await fetch(
      `${appUrl}/api/organizations/${organization.id}/media/${message.mediaPath}`,
      { headers: { authorization: `Bearer ${auth.token}` } }
    );
    if (!mediaResponse.ok || (await mediaResponse.arrayBuffer()).byteLength === 0) {
      throw new Error(`Mídia ${type} não pode ser lida.`);
    }
    const downloadResponse = await fetch(
      `${appUrl}/api/organizations/${organization.id}/media/${message.mediaPath}?download=1`,
      { headers: { authorization: `Bearer ${auth.token}` } }
    );
    if (!downloadResponse.ok || !downloadResponse.headers.get('content-disposition')?.includes('attachment')) {
      throw new Error(`Download da mídia ${type} não foi disponibilizado.`);
    }
  }

  console.log('✓ Login da demo');
  console.log('✓ Webhook assinado recebido e ticket criado');
  console.log('✓ Ticket assumido e resposta enviada ao WhatsApp mock');
  console.log(`✓ Mensagem persistida: ${sent.message?.id ? 'sim' : 'não'}`);
  console.log('✓ Imagem, áudio e documento enviados e recebidos pelo mock');
  console.log('✓ Mídias persistidas e acessíveis após recarregar o histórico');
  console.log('✓ Download disponível para cada tipo de mídia');
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
