# 4. Banco de Dados

O banco é o **PostgreSQL**. The schema lives in
`backend/src/main/resources/db/migration/V1__init.sql` and is applied by **Flyway** at startup.

## 4.1 Diagrama (schema completo)

```plantuml
@startuml
!theme plain
skinparam shadowing false
skinparam defaultFontSize 11
skinparam linetype ortho

title FilaZap — Schema do Banco de Dados (PostgreSQL)

entity "User" as user {
  * id : String <<PK, cuid>>
  --
  * email : String <<unique>>
  * name : String
  * passwordHash : String
  * createdAt : DateTime
  * updatedAt : DateTime
}

entity "PasswordResetToken" as prt {
  * id : String <<PK, cuid>>
  --
  * userId : String <<FK, unique, ON DELETE CASCADE>>
  * tokenHash : String <<unique>>
  * expiresAt : DateTime
  * usedAt : DateTime?
  * createdAt : DateTime
}

entity "Organization" as org {
  * id : String <<PK, cuid>>
  --
  * name : String
  * slug : String <<unique>>
  * timezone : String
  * plan : String
  * subscriptionStatus : String
  * theme : String
  * brandColor : String
  * createdAt : DateTime
  * updatedAt : DateTime
}

entity "OrganizationMember" as om {
  * id : String <<PK, cuid>>
  --
  * organizationId : String <<FK, ON DELETE CASCADE>>
  * userId : String <<FK, ON DELETE CASCADE>>
  * role : Role (OWNER/ADMIN/AGENT/VIEWER)
  * active : Boolean
  * createdAt : DateTime
  * updatedAt : DateTime
  --
  <<unique>> (organizationId, userId)
}

entity "TeamPresence" as tp {
  * id : String <<PK, cuid>>
  --
  * organizationId : String <<FK, ON DELETE CASCADE>>
  * userId : String <<FK, ON DELETE CASCADE>>
  * lastSeenAt : DateTime
  * createdAt : DateTime
  * updatedAt : DateTime
  --
  <<unique>> (organizationId, userId)
}

entity "TeamChatMessage" as tcm {
  * id : String <<PK, cuid>>
  --
  * organizationId : String <<FK, ON DELETE CASCADE>>
  * senderUserId : String <<FK, ON DELETE CASCADE>>
  * recipientUserId : String? <<FK, ON DELETE CASCADE>>
  * body : String
  * createdAt : DateTime
  --
  recipientUserId NULL = mensagem para o time (broadcast)
}

entity "WhatsAppChannel" as wa {
  * id : String <<PK, cuid>>
  --
  * organizationId : String <<FK, ON DELETE CASCADE>>
  * phoneNumberId : String <<unique>>
  * businessAccountId : String
  * displayPhoneNumber : String
  * status : String
  * accessTokenEncrypted : String?
  * appSecretEncrypted : String?
  * webhookVerifyToken : String? <<unique>>
  * apiBaseUrl : String?
  * createdAt : DateTime
  * updatedAt : DateTime
  --
  credenciais criptografadas (AES-256-GCM)
}

entity "Contact" as contact {
  * id : String <<PK, cuid>>
  --
  * organizationId : String <<FK, ON DELETE CASCADE>>
  * channelId : String <<FK, ON DELETE CASCADE>>
  * phoneE164 : String
  * name : String?
  * metadata : Json?
  * firstContactAt : DateTime
  * lastContactAt : DateTime
  * createdAt : DateTime
  * updatedAt : DateTime
  --
  <<unique>> (organizationId, channelId, phoneE164)
}

entity "Ticket" as ticket {
  * id : String <<PK, cuid>>
  --
  * organizationId : String <<FK, ON DELETE CASCADE>>
  * channelId : String <<FK, ON DELETE CASCADE>>
  * contactId : String <<FK, ON DELETE CASCADE>>
  * sequenceNumber : Int
  * status : String
  * priority : Int
  * queueEnteredAt : DateTime
  * assignedUserId : String? <<FK, ON DELETE SET NULL>>
  * assignedAt : DateTime?
  * firstResponseAt : DateTime?
  * waitingCustomerSince : DateTime?
  * finishedAt : DateTime?
  * lastMessageAt : DateTime
  * createdAt : DateTime
  * updatedAt : DateTime
  --
  <<unique>> (organizationId, sequenceNumber)
}

entity "Message" as msg {
  * id : String <<PK, cuid>>
  --
  * organizationId : String <<FK, ON DELETE CASCADE>>
  * ticketId : String <<FK, ON DELETE CASCADE>>
  * contactId : String <<FK, ON DELETE CASCADE>>
  * whatsappMessageId : String? <<unique>>
  * direction : String (INBOUND/OUTBOUND)
  * type : String
  * body : String?
  * mediaPath : String?
  * senderUserId : String? <<FK, ON DELETE SET NULL>>
  * providerStatus : String?
  * providerTimestamp : DateTime?
  * createdAt : DateTime
}

entity "InternalNote" as note {
  * id : String <<PK, cuid>>
  --
  * organizationId : String <<FK, ON DELETE CASCADE>>
  * contactId : String <<FK, ON DELETE CASCADE>>
  * ticketId : String? <<FK, ON DELETE SET NULL>>
  * authorUserId : String <<FK, ON DELETE CASCADE>>
  * body : String
  * createdAt : DateTime
  * updatedAt : DateTime
}

entity "TicketEvent" as tevent {
  * id : String <<PK, cuid>>
  --
  * organizationId : String <<FK, ON DELETE CASCADE>>
  * ticketId : String <<FK, ON DELETE CASCADE>>
  * actorUserId : String? <<FK, ON DELETE SET NULL>>
  * eventType : String
  * fromStatus : String?
  * toStatus : String?
  * payload : Json?
  * createdAt : DateTime
}

entity "WebhookEvent" as wevent {
  * id : String <<PK, cuid>>
  --
  * organizationId : String? <<FK, ON DELETE SET NULL>>
  * providerEventId : String? <<unique>>
  * payload : Json
  * processingStatus : String
  * attempts : Int
  * receivedAt : DateTime
  * processedAt : DateTime?
  * errorMessage : String?
}

' Relacionamentos
user ||--o{ prt : "reset tokens"
org ||--o{ om : "membros"
user ||--o{ om : "vínculos"
org ||--o{ tp : "presenças"
user ||--o{ tp : "presenças"
org ||--o{ tcm : "chat"
user ||--o{ tcm : "envia"
user |o--o{ tcm : "recebe"
org ||--o{ wa : "canais"
org ||--o{ contact : "contatos"
wa ||--o{ contact : "contatos"
org ||--o{ ticket : "tickets"
wa ||--o{ ticket : "tickets"
contact ||--o{ ticket : "threads"
user |o--o{ ticket : "atribuído a"
org ||--o{ msg : "mensagens"
ticket ||--o{ msg : "mensagens"
contact ||--o{ msg : "mensagens"
user |o--o{ msg : "envia"
org ||--o{ note : "notas"
contact ||--o{ note : "notas"
ticket |o--o{ note : "notas"
user ||--o{ note : "autor"
org ||--o{ tevent : "eventos"
ticket ||--o{ tevent : "histórico"
user |o--o{ tevent : "ator"
org |o--o{ wevent : "webhooks"
@enduml
```

> 📎 Versão standalone do diagrama (renderizável com PlantUML):
> [`docs/diagrams/database.puml`](./diagrams/database.puml).

### 4.1.1 Entidades principais

| Tabela | Descrição | Chaves / restrições notáveis |
|--------|-----------|------------------------------|
| `User` | Usuário autenticado. | `email` único. |
| `PasswordResetToken` | Token de redefinição de senha. | `userId` único (1 por usuário); `tokenHash` único; `expiresAt`, `usedAt`. |
| `Organization` | Tenant multi-tenancy. | `slug` único; zona horária, plano, status de assinatura, tema e cor da marca. |
| `OrganizationMember` | Vínculo usuário↔organização. | `unique(organizationId, userId)`; `role`; `active`. |
| `TeamPresence` | Presença do agente no chat interno. | `unique(organizationId, userId)`; `lastSeenAt`. |
| `TeamChatMessage` | Mensagem do chat interno do time. | `senderUserId`; `recipientUserId` (NULL = broadcast para o time). |
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
`UUID.randomUUID()` (`IdGenerator` bean in `AppConfig`), evitando IDOR por adivinhação.

> ⚠️ Alguns `findById` (getters pontuais) recebem apenas o `id`. Use-cases devem
> passar IDs da própria organização — ver achado S6 no `PLANO-SEGURANCA.md`.

## 4.4 Migrações

**Flyway** runs automatically when the Spring Boot app starts; there is no separate CLI.

```bash
cd backend && mvn -o spring-boot:run   # applies pending migrations on startup
```

Each migration lives in `backend/src/main/resources/db/migration/V<N>__<name>.sql`.

## 4.5 Seed

There is **no seeder** — the old `prisma/seed.ts` went away with the Next.js stack. The first
organization and admin are created through the public API:

```bash
curl -s -X POST http://localhost:8080/api/organizations \
  -H 'Content-Type: application/json' \
  -d '{"name":"Me Company","adminName":"Admin","adminEmail":"admin@example.com","adminPassword":"Str0ngPassw0rd"}'
```

`CreateOrganization` hashes the admin password with BCrypt (cost 12) before storing it.
