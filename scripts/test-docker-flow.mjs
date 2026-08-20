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

  console.log('✓ Login da demo');
  console.log('✓ Webhook assinado recebido e ticket criado');
  console.log('✓ Ticket assumido e resposta enviada ao WhatsApp mock');
  console.log(`✓ Mensagem persistida: ${sent.message?.id ? 'sim' : 'não'}`);
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
