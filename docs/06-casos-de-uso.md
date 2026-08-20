# 6. Casos de Uso e Políticas

Todos os casos de uso vivem em `src/application/use-cases/` e são expostas pelo
`container.ts` via objeto `useCases`. Cada um injeta seus dependências (ports) e tem
um método `execute(input)`.

## 6.1 Catálogo de use-cases

| Use-case | Responsabilidade |
|----------|------------------|
| `CreateOrganization` | Cria organização + membro OWNER + emitir token. |
| `Authenticate` | Valida e-mail/senha, emite JWT. |
| `InviteMember` | Cria usuário temporário e o vincula à organização. |
| `ListMembers` | Lista membros de uma organização. |
| `RegisterChannel` / `ListChannels` | Gerencia canais WhatsApp. |
| `UpdateChannelCredentials` | Criptografa/altera credenciais com `CredentialCipher`. |
| `VerifyWebhook` / `ReceiveWhatsAppMessage` | Verificação e processamento de webhook. |
| `SendMessage` | Envia mensagem via `WhatsAppGateway`. |
| `UpdateMessageStatus` | Atualiza status de entrega/leitura via webhook. |
| `AssignTicket` / `AssignNextTicket` | Atribuição manual e automática da fila. |
| `MoveTicketToWaitingCustomer` | Devolve o cliente à espera (aguardando resposta). |
| `FinishTicket` | Conclude um ticket. |
| `AddInternalNote` | Adiciona nota interna (auditável). |
| `ListQueue` / `GetOperationalCounters` | Lê a fila e contadores operacionais. |
| `ListMessages` / `GetContactProfile` / `ListContactHistory` / `SearchContacts` | Dados de mensagens/contatos. |
| `GetMetrics` | Métricas de atendimento. |
| `GetOrganizationAppearance` / `UpdateOrganizationAppearance` | Tema/cores da organização. |

## 6.2 Padrão de um use-case

```ts
class AssignTicket {
  constructor(private readonly deps: { tickets, contacts, channels, members, events, clock, logger, idGenerator }) {}

  async execute(input: AssignTicketInput): Promise<AssignTicketOutput> {
    // 1. resolve ator e escopa por organização
    // 2. valida transição de status / política
    // 3. persiste via repositório + registra TicketEvent
    // 4. regista auditoria e devolve output
  }
}
```

Os `ports` comuns injitados: `Clock` (`now()`), `AuditLogger`, `idGenerator`.

## 6.3 Políticas (RBAC)

`src/application/policies/OrganizationPolicy.ts` aplica controle de acesso **dentro dos
use-cases** (não só na UI):

- Verifica o `Role` do ator (`OWNER/ADMIN/AGENT/VIEWER`) e se está `active`.
- Restringe operações por permissão (ex.: só `ADMIN/OWNER` altera credenciais de canal).

## 6.4 Regras de negócio da fila (Ticket)

- **Sequence única:** `sequenceNumber` único por organização; gerado na abertura.
- **Fila justa:** ordenação por `priority` (desc) e, em empate, por `queueEnteredAt`
  (mais antigo primeiro). `AssignNextTicket` usa o índice
  `(organizationId, status, priority, queueEnteredAt)`.
- **Transições de status:** controladas pela entidade `Ticket` (ex.: cliente responde →
  `IN_PROGRESS`; conclusão marca `finishedAt`). Cada transição registra um `TicketEvent`.
- **Waiting customer:** quando o agente para de responder, o ticket volta a `WAITING_CUSTOMER`.

## 6.5 Auditoria

Cada operação significativa registra um evento via `AuditLogger` (`ConsoleAuditLogger`)
e, para tickets, um `TicketEvent` persistido (tipo, de-para status, payload).

> 📎 Ver **[02-arquitetura.md](./02-arquitetura.md)** e **[07-whatsapp.md](./07-whatsapp.md)**.
