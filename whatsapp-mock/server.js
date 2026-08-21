import http from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';

const PORT = process.env.PORT ?? 4000;

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
  });
}

function sign(appSecret, rawBody) {
  const hash = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  return `sha256=${hash}`;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const messagesRe = /^\/graph\/[^/]+\/messages$/;
const mediaRe = /^\/graph\/[^/]+\/media$/;
const mediaDownloadRe = /^\/graph\/[^/]+$/;
const mockMediaFileRe = /^\/mock-media-file\/(image|audio|document)$/;

const mockFiles = {
  image: {
    mimeType: 'image/png', fileName: 'imagem-mock.png',
    data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  },
  audio: {
    mimeType: 'audio/wav', fileName: 'audio-mock.wav',
    data: Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=', 'base64')
  },
  document: {
    mimeType: 'application/pdf', fileName: 'documento-mock.pdf',
    data: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
  }
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok', service: 'whatsapp-mock' });
    return;
  }

  // Download de mídia recebida (usado pelo webhook para baixar anexos do cliente)
  if (req.method === 'GET' && mediaDownloadRe.test(url.pathname)) {
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    // Simula o retorno da Cloud API: { url, mimeType, fileName }
    const mediaId = url.pathname.split('/').pop() ?? '';
    const kind = mediaId.includes('audio') ? 'audio' : mediaId.includes('document') ? 'document' : 'image';
    const file = mockFiles[kind];
    sendJson(res, 200, {
      url: `${url.origin}/mock-media-file/${kind}`,
      mime_type: file.mimeType,
      file_name: file.fileName
    });
    return;
  }

  // Conteúdo binário da mídia simulada
  if (req.method === 'GET' && mockMediaFileRe.test(url.pathname)) {
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    const kind = url.pathname.split('/').pop();
    const file = mockFiles[kind];
    res.writeHead(200, { 'Content-Type': file.mimeType });
    res.end(file.data);
    return;
  }

  // Upload de mídia pela Cloud API (usado pelo SendMessage com anexo)
  if (req.method === 'POST' && mediaRe.test(url.pathname)) {
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    await readBody(req); // consomem o multipart mesmo sem armazenar de fato
    const fileId = `MOCK-${randomUUID()}`;
    sendJson(res, 200, { id: fileId });
    return;
  }

  // Envio de mensagem pela Cloud API (usado pelo SendMessage do app)
  if (req.method === 'POST' && messagesRe.test(url.pathname)) {
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    const body = await readBody(req);
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      sendJson(res, 400, { error: 'invalid_json' });
      return;
    }

    // Mensagem de mídia enviada após o upload
    if (parsed.type === 'image' || parsed.type === 'audio' || parsed.type === 'document') {
      const messageId = `wamid.MOCKMEDIA.${randomUUID().replace(/-/g, '')}`;
      sendJson(res, 200, {
        messaging_product: 'whatsapp',
        contacts: [{ input: parsed.to, wa_id: parsed.to }],
        messages: [{ id: messageId }]
      });
      return;
    }

    const messageId = `wamid.MOCK.${randomUUID().replace(/-/g, '')}`;
    sendJson(res, 200, {
      messaging_product: 'whatsapp',
      contacts: [{ input: parsed.to, wa_id: parsed.to }],
      messages: [{ id: messageId }]
    });
    return;
  }

  // Reencaminha um webhook assinado para o endpoint do app
  if (req.method === 'POST' && url.pathname === '/graph/webhook/forward') {
    const body = await readBody(req);
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      sendJson(res, 400, { error: 'invalid_json' });
      return;
    }
    const appUrl = parsed.appUrl;
    const appSecret = parsed.appSecret ?? '';
    const payload = parsed.payload;
    if (!appUrl || typeof payload !== 'object') {
      sendJson(res, 400, { error: 'missing_app_url_or_payload' });
      return;
    }
    const raw = JSON.stringify(payload);
    const signature = sign(appSecret, raw);

    const target = new URL('/api/webhooks/whatsapp', appUrl);
    let upstream;
    try {
      upstream = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': signature
        },
        body: raw
      });
    } catch (error) {
      sendJson(res, 502, {
        error: 'upstream_unreachable',
        message: error.message
      });
      return;
    }
    const upstreamBody = await upstream.text();
    sendJson(res, upstream.status, {
      upstream_status: upstream.status,
      upstream_body: (() => {
        try {
          return JSON.parse(upstreamBody);
        } catch {
          return upstreamBody;
        }
      })()
    });
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`[whatsapp-mock] ouvindo na porta ${PORT}`);
});
