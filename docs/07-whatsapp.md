# 7. Integração WhatsApp (Cloud API)

O FilaZap se integra à **WhatsApp Cloud API** da Meta. A camada de infraestrutura
conecta um port abstrato (`WhatsAppGateway`, `WhatsAppWebhookParser`,
`WebhookSignatureVerifier`) a implementações específicas da Meta.

## 7.1 Componentes

| Componente | Localização | Função |
|------------|-------------|--------|
| `WhatsAppGateway` (port) / `MetaWhatsAppGateway` | application/infrastructure | Envia mensagens via `POST /{phoneId}/messages`. |
| `WhatsAppWebhookParser` / `MetaWhatsAppWebhookParser` | application/infrastructure | Converte payload bruto da Meta em modelo interno. |
| `WebhookSignatureVerifier` / `MetaWebhookSignatureVerifier` | application/infrastructure | Verifica assinatura HMAC-SHA256 (`x-hub-signature-256`). |
| `channels.findByPhoneNumberId` | container/repositório | Resume o canal a partir do `phone_number_id`. |

## 7.2 Envio (agente → cliente)

`SendMessage` orquestra:

1. Resolve canal, contato e ticket do ator/organização.
2. Chama `MetaWhatsAppGateway.sendText`, que faz:
   ```
   POST {WHATSAPP_API_URL}/{phoneNumberId}/messages
   Authorization: Bearer {accessToken}
   Body: { messaging_product:'whatsapp', to, type:'text', text:{ body } }
   ```
3. Armazena a mensagem (`direction: OUTBOUND`) com o `providerMessageId` retornado.

O `WHATSAPP_API_URL` aponta para a Cloud API oficial em produção e para o mock em dev
(`http://localhost:4000/graph`).

## 7.3 Recebimento (cliente → agente) — Webhook

Endpoint: `POST /api/webhooks/whatsapp`. Fluxo (`ReceiveWhatsAppMessage`):

1. Cria um `WebhookEvent` (status `PROCESSING`).
2. **Deduplicação:** ignora mensagens já vistas (`findByWhatsappMessageId`).
3. **Mensagens inbound:**
   - Resolve/cria o `Contact` (E164 + canal).
   - Abre um novo `Ticket` (novo contato → `WAITING`; retorno → `RETURNING`) com
     próximo `sequenceNumber`, ou retoma o ativo.
   - Transições de status registradas em `TicketEvent`.
4. **Status (`statuses`):** atualiza `providerStatus` das mensagens (entrega/leitura).
5. Marca o `WebhookEvent` como processado/falhado e registra auditoria.

### Verificação de segurança do webhook

- **GET:** responde `hub.challenge` se `verifyToken` bater (`VerifyWebhook`).
- **POST:** exige assinatura HMAC-SHA256 válida com o `appSecret` do canal
  (descriptografado via `CredentialCipher`) — `401` caso contrário.

## 7.4 Credenciais em repouso

As credenciais do canal (`accessToken`, `appSecret`) são armazenadas **criptografadas**
com AES-256-GCM (IV por mensagem, auth tag) via `Aes256GcmCredentialCipher`, usando uma
`WHATSAPP_CREDENTIAL_ENCRYPTION_KEY` mestra (de plataforma).

## 7.5 Mock de desenvolvimento (`whatsapp-mock/`)

Servidor Node puro (`server.js`, porta 4000) que simula a Cloud API:

- `POST /graph/{phoneId}/messages` → responde com um `wamid.MOCK.*` (usado pelo `SendMessage`).
- `POST /graph/webhook/forward` → reencaminha um payload **assinado** para
  `/api/webhooks/whatsapp` do app (testando a verificação de assinatura).
- `GET /health` → health check.

Rode com `docker compose up whatsapp-mock` (ou `node whatsapp-mock/server.js`).

> 📎 Ver **[05-api.md](./05-api.md)** (rotas) e **[08-seguranca.md](./08-seguranca.md)**.
