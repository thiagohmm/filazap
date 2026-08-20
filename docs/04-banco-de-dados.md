# 4. Banco de Dados

O banco é o **PostgreSQL**, modelado com **Prisma**. O schema está em
`prisma/schema.prisma` e as migrações em `prisma/migrations/`.

## 4.1 Diagrama (resumo das tabelas)

```
User 1───● OrganizationMember ●───1 Organization
            │                          │
            └── Role (OWNER/AGENT/…)   ├───● WhatsAppChannel
                                         ├───● Contact
                                         ├───● Ticket ───● Message
                                         ├───● InternalNote
                                         ├───● TicketEvent
                                         └───● WebhookEvent
```

### 4.1.1 Entidades principais

| Tabela | Descrição | Chaves / restrições notáveis |
|--------|-----------|------------------------------|
| `User` | Usuário autenticado. | `email` único. |
| `Organization` | Tenant multi-tenancy. | `slug` único; zona horária, plano e tema. |
| `OrganizationMember` | Vínculo usuário↔organização. | `unique(organizationId, userId)`; `role`; `active`. |
| `WhatsAppChannel` | Canal da Cloud API. | `phoneNumberId` único; credenciais **criptografadas**; `webhookVerifyToken` único. |
| `Contact` | Cliente por canal. | `unique(organizationId, channelId, phoneE164)`. |
| `Ticket` | Thread de atendimento. | `unique(organizationId, sequenceNumber)`; status/prioridade/`queueEnteredAt`. |
| `Message` | Mensagem enviada/recebida. | `whatsappMessageId` único; direção e status do provider. |
| `InternalNote` | Nota interna (auditável). | Autor (`authorUserId`) e vínculo a contato/ticket. |
| `TicketEvent` | Histórico de transições do ticket. | `eventType`, `fromStatus`, `toStatus`. |
| `WebhookEvent` | Evento de webhook recebido. | `providerEventId` único; `processingStatus`; contagem de `attempts`. |

## 4.2 Enums

- **`Role`**: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`. Define permissões (RBAC) — ver
  `OrganizationPolicy`.
- **`TicketStatus`** (value object): estados da fila (`WAITING`, `IN_PROGRESS`,
  `WAITING_CUSTOMER`, `FINISHED`, etc.) com transições controladas pela entidade.
- **`MessageDirection`**: `INBOUND`, `OUTBOUND`.
- **`ChannelStatus`** / **`WebhookEventStatus`**: status de canal e processamento.

## 4.3 Multi-tenancy

Todos os dados vinculados a uma organização carregam `organizationId`. Listagens e
relatórios são sempre escopados por `organizationId` do ator autenticado. IDs são
`cuid()` (Prisma) ou `randomUUID` (aplicações), evitando IDOR por adivinhação.

> ⚠️ Alguns `findById` (getters pontuais) recebem apenas o `id`. Use-cases devem
> passar IDs da própria organização — ver achado S6 no `PLANO-SEGURANCA.md`.

## 4.4 Migrações

```bash
npm run db:migrate     # dev: cria + aplica
npm run db:deploy      # produção: só aplica
npx prisma studio      # interface visual
```

Cada migração fica em `prisma/migrations/<timestamp>_nome/migration.sql`.

## 4.5 Seed

`prisma/seed.ts` cria, na primeira execução:

- Uma **organização** inicial (`SEED_ORG_SLUG`).
- Um **usuário admin** OWNER (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

> 🔒 Senhas padrão no seed são um risco (achado S2). Troque antes de prod — ver
> `PLANO-SEGURANCA.md`.
