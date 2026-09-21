# 7. Integração WhatsApp

O FilaZap supports **two WhatsApp drivers**, selected by `filazap.whatsapp-driver`
(`WHATSAPP_DRIVER` in `.env`). Both implement the same ports, so no domain code changes.

| Driver | Provider | Phone requirement | Cost |
|--------|----------|-------------------|------|
| `meta` (default) | WhatsApp Cloud API (Meta) | Number **Business Verified** | Per-message pricing |
| `waha` | [WAHA](https://waha.devlike.pro) — self-hosted gateway | **Qualque celular** (personal ou Business), paired via QR | Free (you host the container) |

`waha` speaks the WhatsApp Web multi-device protocol, which is why it works with a personal
phone. The trade-off: you run and keep the container updated yourself, and WhatsApp can
break it on a protocol change.

## 7.1 Componentes

| Componente | Port | Meta impl | WAHA impl |
|-----------|------|-----------|-----------|
| Send / fetch media | `WhatsAppGateway` | `MetaWhatsAppGateway` | `WahaWhatsAppGateway` |
| Webhook payload → model | `WhatsAppWebhookParser` | `MetaWhatsAppWebhookParser` | `WahaWhatsAppWebhookParser` |
| HMAC verification | `WebhookSignatureVerifier` | `MetaWebhookSignatureVerifier` | `WahaWebhookSignatureVerifier` |

`InfrastructureConfig` selects the implementation once, at startup, from
`filazap.whatsapp-driver`. `WhatsAppWebhookController` receives the interface and never
branches on the driver.

### Column mapping (`WhatsAppChannel`)

The existing columns are reused — **no migration was needed**:

| Column | Meta | WAHA |
|--------|------|------|
| `phoneNumberId` | `phone_number_id` | **session name** (e.g. `acme-support`) |
| `accessTokenEncrypted` | Cloud API token | WAHA **API key** (`X-Api-Key`) |
| `appSecretEncrypted` | App secret (HMAC-SHA256) | Webhook HMAC key (HMAC-SHA512) |
| `apiBaseUrl` | unused | optional per-channel WAHA URL (multi-instance) |

All are `TEXT`, so a session name like `acme-support` and a WAHA message id like
`false_5511999990001@c.us_AAAA` both fit.

## 7.2 Envio (agente → cliente)

`SendMessage` resolves channel/contact/ticket, then calls the gateway.

**Meta**
```
POST {WHATSAPP_API_URL}/{phoneNumberId}/messages
Authorization: Bearer {accessToken}
Body: { messaging_product:'whatsapp', to, type:'text', text:{ body } }
```

**WAHA**
```
POST {WAHA_URL}/api/sendText
X-Api-Key: {accessToken}
Body: { session, chatId:"5511999990001@c.us", text }
→ 201 { id: "false_5511999990001@c.us_AAAA", ... }   # WAMessage
```

Media (`sendMedia`) differs more sharply:

| | Meta | WAHA |
|---|------|------|
| Step 1 | `POST /{phoneId}/media` → media `id` | *(no upload endpoint)* |
| Step 2 | `POST /{phoneId}/messages` referencing the id | `POST /api/sendImage\|sendVoice\|sendVideo\|sendFile` with `file.data` = base64 |

Because WAHA has no upload, `uploadMedia` on the WAHA adapter only **validates** the payload
and returns the sentinel handle `waha:inline`; the bytes travel in `SendMediaCommand.data()`.
`SendMessage` already holds the bytes it read from `MediaStorage`, so nothing is cached.

### The message id is not stable across engines

The OpenAPI spec types `sendText` as returning a `WAMessage` (with `id`), but declares
`sendImage`/`sendVoice`/`sendFile` as a bare `{"type":"object"}`. In practice the response shape
varies by engine and version: flat `{"id":...}`, or wrapped as `{"_data":{"id":...}}` / `{"key":{"id":...}}`
(upstream issues #760 and #1490).

So `requireMessageId` probes those containers, and if none carries an id it returns a synthetic
`waha-local-<uuid>` **instead of throwing**. A `2xx` means WAHA already accepted the message, and
`SendMessage` only persists the `Message` row after a successful return — throwing would drop the
row, show the agent an error, and a retry would send the customer the same message twice. The
cost of a synthetic id is only the delivery/read acks, which reference the provider id.

## 7.3 Recebimento (cliente → agente) — Webhook

Endpoint: `POST /api/webhooks/whatsapp`.

The controller accepts **both** signature headers and lets the injected verifier decide:

| Driver | Header | Algorithm |
|--------|--------|-----------|
| Meta | `X-Hub-Signature-256` | SHA-256, `sha256=<hex>` |
| WAHA | `X-Webhook-Hmac` | SHA-512, bare hex (`X-Webhook-Hmac-Algorithm: sha512`) |

Fluxo (`ReceiveWhatsAppMessage`):

1. Cria a `WebhookEvent` (status `PROCESSING`).
2. **Deduplicação:** ignores messages already seen (`findByWhatsappMessageId`).
3. **Mensagens inbound:** resolve/creates the `Contact` (E164 + canal), opens a `Ticket`
   (`WAITING` for a new contact, `RETURNING` on return) or resumes the active one, and
   records transitions in `TicketEvent`.
4. **Status (`statuses`):** updates `providerStatus` (delivered/read).
5. Marks the `WebhookEvent` processed/failed and logs an audit entry.

### WAHA envelope → port

WAHA posts `{ event, session, me, payload, engine, ... }`. The parser maps:

| WAHA | Port field |
|------|-----------|
| `session` | `phoneNumberId` (channel lookup key) |
| `me.id` | `businessAccountId` |
| `event: message` / `message.any` | `messages` |
| `event: message.ack` | `statuses` |
| `payload.media.url` | `mediaId` |

### Four WAHA details that would be silent bugs

1. **`fromMe`** — WAHA echoes messages sent by the paired phone itself. Messages with
   `fromMe == true` are dropped, otherwise the bot would open tickets from its own replies.
2. **`type` does not exist** — unlike Meta, WAHA's payload has no `type`. It is derived from
   `media.mimetype` (`image/*` → `image`, etc.), falling back to `text` when `hasMedia` is false.
3. **Timestamps** — WAHA mixes seconds (`payload.timestamp`) and milliseconds (envelope), and
   some engines emit floats (`1710481111.853`). `Long.parseLong` would throw or produce dates in
   year 55000; `epochSeconds()` normalizes all of them to integer seconds.
4. **Group JIDs** — `@g.us` is dropped rather than collapsed to a phone number, because the
   ticket model is one contact per conversation.

Ack vocabulary is translated to the app's (Meta-compatible) vocabulary:

| WAHA `ackName` | `ack` | `providerStatus` |
|----------------|-------|------------------|
| `ERROR` | -1 | `failed` |
| `PENDING` | 0 | `pending` |
| `SERVER` | 1 | `sent` |
| `DEVICE` | 2 | `delivered` |
| `READ` | 3 | `read` |
| `PLAYED` | 4 | `played` |

### Webhook GET verification

`GET /api/webhooks/whatsapp` answers Meta's `hub.challenge` handshake. WAHA does not perform
that handshake — it just POSTs — so the endpoint is inert under the `waha` driver.

## 7.4 Setup WAHA (pairing a phone)

```bash
cp .env.example .env
# in .env:
#   WHATSAPP_DRIVER=waha
#   WAHA_API_KEY=<long random string>
#   WAHA_WEBHOOK_SECRET=<long random string>

docker compose --profile waha up -d       # profile keeps it opt-in
```

Then pair the phone:

```bash
curl -H "X-Api-Key: $WAHA_API_KEY" \
  "http://localhost:3001/api/sessions" -X POST \
  -H 'Content-Type: application/json' \
  -d '{"name":"acme-support","config":{"webhooks":[{"url":"http://backend:8080/api/webhooks/whatsapp","events":["message","message.ack"],"hmac":{"key":"'$WAHA_WEBHOOK_SECRET'"}}]}}'

# QR code (image) — scan with WhatsApp > Linked devices:
curl -H "X-Api-Key: $WAHA_API_KEY" -o qr.png \
  "http://localhost:3001/api/acme-support/auth/qr"
```

Now register the channel in FilaZap with `phoneNumberId = "acme-support"` (the **session
name**), the WAHA API key as the access token, and the HMAC secret as the app secret.

**Gotchas**

- `WAHA_BASE_URL` defaults to `http://localhost:3000` and every `media.url` in a webhook is
  built from it. The backend container cannot resolve `localhost` (it points at itself), so
  incoming media downloads fail. The compose file pins it to `http://waha:3000`.
- Host port is **3001**, not 3000: the frontend already binds 3000.
- The image tag pins the **engine**, not just the version. On Apple Silicon use an `-arm` tag
  (`latest` is amd64 only). `arm-*` = WEBJS (headless Chromium, full features);
  `gows-arm-*` = GOWS (Go, no browser, much lighter, WAHA's recommended engine);
  `noweb-arm-*` = NOWEB.
- `waha_sessions:/app/.sessions` must be mounted or the QR has to be rescanned on every restart.

## 7.5 Credenciais em repouso

Canal credentials (`accessToken`, `appSecret`) are stored **encrypted** with AES-256-GCM
(IV per message, auth tag) via `Aes256GcmCredentialCipher`, using the platform master key
`WHATSAPP_CREDENTIAL_ENCRYPTION_KEY`.

The signature check **fails closed**: a missing header, a missing/empty secret, or a mismatch
all return `401`.

## 7.6 Mock de development (`whatsapp-mock/`)

Pure Node server (`server.js`, port 4000) that simulates the **Meta** Cloud API:

- `POST /graph/{phoneId}/messages` → returns a `wamid.MOCK.*` (used by `SendMessage`).
- `POST /graph/webhook/forward` → re-forwards a **signed** payload to the app's
  `/api/webhooks/whatsapp` (exercising signature verification).
- `GET /health` → health check.

Rode with `docker compose up whatsapp-mock` (or `node whatsapp-mock/server.js`). There is no
WAHA mock — the WAHA adapter is exercised against a real container.

> 📎 Ver **[05-api.md](./05-api.md)** (rotas), **[03-configuracao.md](./03-configuracao.md)**
> and **[08-seguranca.md](./08-seguranca.md)**.
