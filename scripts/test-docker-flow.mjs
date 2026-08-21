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

  const loginAs = async (email) => json(await fetch(`${appUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: process.env.SEED_ADMIN_PASSWORD })
  }));
  const agentAuth = await loginAs('ana@filazap.demo');
  const otherAgentAuth = await loginAs('carlos@filazap.demo');
  const authHeaders = (token) => ({
    authorization: `Bearer ${token}`,
    'content-type': 'application/json'
  });
  for (const token of [auth.token, agentAuth.token, otherAgentAuth.token]) {
    const presence = await fetch(
      `${appUrl}/api/organizations/${organization.id}/team-chat/presence`,
      { method: 'POST', headers: authHeaders(token) }
    );
    if (!presence.ok) throw new Error(`Presença no chat rejeitada: HTTP ${presence.status}`);
  }
  const directBody = `Mensagem privada E2E ${Date.now()}`;
  await json(await fetch(`${appUrl}/api/organizations/${organization.id}/team-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ recipientUserId: agentAuth.user.id, body: directBody })
  }));
  const agentChat = await json(await fetch(
    `${appUrl}/api/organizations/${organization.id}/team-chat`,
    { headers: authHeaders(agentAuth.token) }
  ));
  const otherAgentChat = await json(await fetch(
    `${appUrl}/api/organizations/${organization.id}/team-chat`,
    { headers: authHeaders(otherAgentAuth.token) }
  ));
  if (!agentChat.messages.some((message) => message.body === directBody)) {
    throw new Error('Destinatário não recebeu a mensagem privada do chat.');
  }
  if (otherAgentChat.messages.some((message) => message.body === directBody)) {
    throw new Error('Mensagem privada ficou visível para outro atendente.');
  }
  const broadcastBody = `Mensagem geral E2E ${Date.now()}`;
  await json(await fetch(`${appUrl}/api/organizations/${organization.id}/team-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ recipientUserId: null, body: broadcastBody })
  }));
  const broadcastChat = await json(await fetch(
    `${appUrl}/api/organizations/${organization.id}/team-chat`,
    { headers: authHeaders(otherAgentAuth.token) }
  ));
  if (!broadcastChat.messages.some((message) => message.body === broadcastBody)) {
    throw new Error('Mensagem para toda a equipe não foi entregue.');
  }

  const team = await json(await fetch(
    `${appUrl}/api/organizations/${organization.id}/members`,
    { headers }
  ));
  const agent = team.members.find((member) => member.role === 'AGENT' && member.active);
  if (!agent) throw new Error('Nenhum atendente ativo disponível para testar a remoção.');
  await json(await fetch(
    `${appUrl}/api/organizations/${organization.id}/members/${agent.id}`,
    { method: 'DELETE', headers }
  ));
  const teamAfterRemoval = await json(await fetch(
    `${appUrl}/api/organizations/${organization.id}/members`,
    { headers }
  ));
  if (teamAfterRemoval.members.find((member) => member.id === agent.id)?.active !== false) {
    throw new Error('O atendente continuou ativo após a remoção.');
  }
  await json(await fetch(`${appUrl}/api/organizations/${organization.id}/members`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: agent.user.name,
      email: agent.user.email,
      role: 'AGENT'
    })
  }));

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
    method: 'POST', headers: authHeaders(agentAuth.token)
  }));
  const blockedReply = await fetch(`${appUrl}/api/organizations/${organization.id}/messages`, {
    method: 'POST',
    headers: authHeaders(otherAgentAuth.token),
    body: JSON.stringify({
      channelId: received.channelId,
      contactId: received.contact.id,
      body: 'Outro atendente não pode responder'
    })
  });
  if (blockedReply.ok) throw new Error('Outro atendente respondeu um cliente bloqueado.');

  const sent = await json(await fetch(`${appUrl}/api/organizations/${organization.id}/messages`, {
    method: 'POST',
    headers: authHeaders(agentAuth.token),
    body: JSON.stringify({
      channelId: received.channelId,
      contactId: received.contact.id,
      body: 'Resposta enviada pelo FilaZap no teste Docker'
    })
  }));
  await json(await fetch(`${appUrl}/api/organizations/${organization.id}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      channelId: received.channelId,
      contactId: received.contact.id,
      body: 'Administrador pode responder qualquer atendimento'
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

  const queueAfterAssignment = await json(await fetch(
    `${appUrl}/api/organizations/${organization.id}/tickets`,
    { headers }
  ));
  const assignedTicket = queueAfterAssignment.queue.find((item) => item.ticketId === received.ticketId);
  if (assignedTicket?.assignedUserName !== agentAuth.user.name) {
    throw new Error('A fila não informou corretamente o atendente responsável.');
  }

  await json(await fetch(
    `${appUrl}/api/organizations/${organization.id}/tickets/${received.ticketId}/finish`,
    { method: 'POST', headers: authHeaders(agentAuth.token) }
  ));

  console.log('✓ Login da demo');
  console.log('✓ Chat interno com presença, mensagem privada e aviso para toda a equipe');
  console.log('✓ Atendente removido pelo administrador e reativado ao final do teste');
  console.log('✓ Webhook assinado recebido e ticket criado');
  console.log('✓ Ticket assumido e resposta enviada ao WhatsApp mock');
  console.log('✓ Cliente bloqueado ao responsável, com acesso global para administrador');
  console.log(`✓ Mensagem persistida: ${sent.message?.id ? 'sim' : 'não'}`);
  console.log('✓ Imagem, áudio e documento enviados e recebidos pelo mock');
  console.log('✓ Mídias persistidas e acessíveis após recarregar o histórico');
  console.log('✓ Download disponível para cada tipo de mídia');
  console.log('✓ Responsável identificado na fila e atendimento de teste finalizado');
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
