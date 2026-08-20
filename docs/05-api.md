# 5. API REST

A API é construída com o **Next.js App Router** (rotas de servidor em
`src/app/api/**`). Cada `route.ts` expõe `GET`/`POST`/etc., é **fina** (autentica,
valida com Zod e delega a un use-case) e tem `export const runtime = 'nodejs'`.

## 5.1 Autenticação e sessão

- **JWT (HS256)** emitido pelo `Authenticate` (`JwtTokenService`, expiração 7d).
- A sessão é lida via `src/presentation/api/session.ts` (`getSession(req)`), que valida
  o token e resolve o **ator** (usuário + organização).
- Padrão de proteção em rotas protegidas:

```ts
const session = await getSession(req);
if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
```

> ⚠️ A sessão atual usa `localStorage` no cliente (achado S4). Para produção, preferir
> cookie `httpOnly + secure + sameSite`. Ver `[08-seguranca.md](./08-seguranca.md)`.

### Erros padronizados

`src/presentation/api/helpers.ts` (`toErrorResponse`) converte erros de domínio em
respostas JSON e **não** vazia o stack trace (500 → `"Erro interno."`).

## 5.2 Endpoints

### Auth

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Autentica e devolve JWT. |

### Organizations

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/organizations` | Cria organização (**self-signup público** — ver S3). |
| `GET` / `PATCH` | `/api/organizations/[organizationId]` | Lê/atualiza organização. |
| `GET` | `/api/organizations/[organizationId]/metrics` | Métricas de atendimento. |
| `GET` | `/api/organizations/[organizationId]/members` | Lista membros. |
| `POST` | `/api/organizations/[organizationId]/members` | Convida membro. |
| `GET` / `PATCH` | `/api/organizations/[organizationId]/channels[/{channelId}]` | Canais WhatsApp. |
| `GET`/`PATCH` | `/api/organizations/[organizationId]/contacts[/{contactId}][/history]` | Contatos e histórico. |
| `GET` | `/api/organizations/[organizationId]/notes` | Notas internas. |
| `GET` | `/api/organizations/[organizationId]/messages` | Mensagens. |

### Tickets & fila

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`/`POST` | `/api/organizations/[organizationId]/tickets` | Lista (fila) e cria tickets. |
| `GET` | `/api/.../tickets/counters` | Contadores operacionais. |
| `POST` | `/api/.../tickets/assign-next` | Atribuição automática (fila justa). |
| `POST` | `/api/.../tickets[/{ticketId}]/assign` | Atribui ticket a agente. |
| `POST` | `/api/.../tickets[/{ticketId}]/finish` | Conclude ticket. |
| `POST` | `/api/.../tickets[/{ticketId}]/waiting-customer` | Devolve cliente à espera. |
| `GET`/`POST` | `/api/.../tickets[/{ticketId}]/messages` | Lê/envia mensagens do ticket. |

### Webhooks

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/webhooks/whatsapp` | Confirmação de verificação (hub.challenge). |
| `POST` | `/api/webhooks/whatsapp` | Recebe e processa eventos do WhatsApp (assinado). |

## 5.3 Validação de entradas

Todas as rotas validam o body/query com **Zod** em `src/presentation/validators/`:
`authenticate`, `createOrganization`, `inviteMember`, `registerChannel`, `sendMessage`,
`updateChannelCredentials`, `tickets`, `searchContacts`.

## 5.4 Webhook do WhatsApp (fluxo)

1. Meta posta em `/api/webhooks/whatsapp`.
2. **GET:** responde ao `hub.challenge` (verificação).
3. **POST:**
   - Lê body bruto; valida `phone_number_id`.
   - Recupera canal e descriptografa `appSecret`.
   - Verifica assinatura HMAC-SHA256 (`x-hub-signature-256`) — `401` se inválida.
   - Executa `receiveWhatsAppMessage` (processa mensagens + status, com deduplicação).

> 📎 Ver **[07-whatsapp.md](./07-whatsapp.md)** para o detalhamento da integração.
