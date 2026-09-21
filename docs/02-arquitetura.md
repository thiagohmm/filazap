# 2. Arquitetura

O FilaZap segue os princípios de **Clean Architecture** com elementos de **DDD**
(Domain-Driven Design). O objetivo é separar responsabilidades para que a regra de
negócio seja independente de framework, framework web, banco de dados ou infraestrutura.

## 2.1 Camadas

```plantuml
@startuml
!theme plain
skinparam componentStyle rectangle
skinparam shadowing false
skinparam linetype ortho

title FilaZap — Arquitetura do Backend (Clean Architecture + DDD)

actor "Cliente\n(Dashboard Web)" as Browser
actor "Meta WhatsApp\nCloud API" as Meta
actor "WAHA\ngateway (self-hosted)" as Waha
actor "Resend\n(e-mail)" as Resend
actor "Supabase Storage\n/ Local FS" as Storage

package "Presentation (Spring MVC)" as Presentation {
  [Controllers\n`presentation/web/*Controller`] as Routes
  [JwtAuthenticationFilter\n`presentation/security`] as JwtFilter
  [GlobalExceptionHandler\n`presentation/error`] as ErrorHandler

  Routes -[hidden]right- JwtFilter
  JwtFilter -[hidden]right- ErrorHandler
}

package "Application" as Application {
  package "Use-cases (`use-cases/`)" as UseCases {
    [Authenticate] as ucAuth
    [CreateOrganization] as ucOrg
    [RegisterChannel] as ucChannel
    [ReceiveWhatsAppMessage] as ucReceive
    [SendMessage] as ucSend
    [AssignNextTicket] as ucAssignNext
    [AssignTicket] as ucAssign
    [FinishTicket / ReopenTicket / MoveTicketToWaitingCustomer] as ucTicket
    [ListQueue / ListMessages / GetMetrics] as ucQuery
    [InviteMember / RemoveMember] as ucMember
    [RequestPasswordReset / ResetPassword] as ucReset
    [SendTeamChatMessage / HeartbeatTeamChat] as ucTeam
    [VerifyWebhook / UpdateMessageStatus] as ucWebhook
  }

  [Policies\n`OrganizationPolicy` (RBAC)] as Policies
  [DTOs\n`src/application/dto`] as DTOs

  package "Ports (interfaces)" as Ports {
    [ContactRepository\nTicketRepository\nMessageRepository\n... *Repository] as RepoPorts
    [WhatsAppGateway] as PortGateway
    [WhatsAppWebhookParser] as PortParser
    [WebhookSignatureVerifier] as PortVerifier
    [CredentialCipher] as PortCipher
    [TokenService\nPasswordHasher] as PortAuth
    [PasswordResetMailer] as PortMailer
    [MediaStorage] as PortStorage
    [Clock\nAuditLogger] as PortMisc
  }
}

package "Domain (núcleo — sem dependências externas)" as Domain {
  package "Entities" as Entities {
    [User\nOrganization\nOrganizationMember] as EntIdentity
    [WhatsAppChannel\nContact\nTicket] as EntChannel
    [Message\nInternalNote\nTicketEvent\nWebhookEvent] as EntFlow
  }
  package "Value Objects" as VOs {
    [Email\nPhoneNumberE164\nSlug] as VO1
    [Role\nTicketStatus\nMessageDirection\nChannelStatus\nWebhookEventStatus] as VO2
  }
  [Errors\n`DomainError` + derivados] as Errors
  [Services\n`Clock`] as DomainServices
}

package "Infrastructure (adapters)" as Infrastructure {
  package "Database (Spring JDBC)" as InfraDB {
    [Jdbc*Repository\n`infrastructure/persistence`] as JdbcRepos
    [JdbcTemplate\nNamedParameterJdbcTemplate] as JdbcClient
  }
  package "Auth" as InfraAuth {
    [JwtTokenService] as Jwt
    [BcryptPasswordHasher] as Bcrypt
  }
  package "Security" as InfraSec {
    [Aes256GcmCredentialCipher] as Cipher
  }
  package "WhatsApp" as InfraWa {
    [MetaWhatsAppGateway\nWahaWhatsAppGateway] as WaGateway
    [MetaWhatsAppWebhookParser\nWahaWhatsAppWebhookParser] as WaParser
    [MetaWebhookSignatureVerifier\nWahaWebhookSignatureVerifier] as WaVerifier
  }
  package "Email" as InfraEmail {
    [ResendPasswordResetMailer] as Mailer
  }
  package "Storage" as InfraStorage {
    [SupabaseMediaStorage\nLocalMediaStorage] as Media
  }
  package "Observability" as InfraObs {
    [ConsoleAuditLogger] as Audit
  }
}

database "PostgreSQL" as PG

[Container\n`config/InfrastructureConfig.java`\n(composition root / injeção de dependências)] as Container

' Fluxo de requisição (dependências apontam para dentro)
Browser --> Routes : HTTP + JWT
Routes --> Validators : valida entrada
Routes --> Helpers : sessão / resposta
Routes --> UseCases : delega `execute()`

UseCases --> Policies : aplica RBAC
UseCases --> DTOs : contratos in/out
UseCases --> RepoPorts : usa abstrações
UseCases --> PortGateway
UseCases --> PortMailer
UseCases --> PortStorage
UseCases --> PortMisc

Policies --> EntIdentity : lê entidade
UseCases --> EntChannel : manipula entidades
UseCases --> EntFlow
EntChannel ..> Errors : lança erros de domínio
EntChannel ..> VO1 : contém VOs
EntChannel ..> VO2

' Inversão de dependência: infra implementa os ports
JdbcRepos ..> RepoPorts : implementa
WaGateway ..> PortGateway : implementa
WaParser ..> PortParser : implementa
WaVerifier ..> PortVerifier : implementa
Cipher ..> PortCipher : implementa
Jwt ..> PortAuth : implementa
Bcrypt ..> PortAuth : implementa
Mailer ..> PortMailer : implementa
Media ..> PortStorage : implementa
Audit ..> PortMisc : implementa

' Container conecta use-cases aos adapters
Container ..> UseCases : instancia
Container ..> JdbcRepos : injeta
Container ..> WaGateway : injeta
Container ..> Mailer : injeta
Container ..> Media : injeta
Container ..> Jwt : injeta
Container ..> Cipher : injeta

' Infra → sistemas externos
JdbcRepos --> JdbcClient
JdbcClient --> PG
WaGateway --> Meta : envia (driver=meta)
WaGateway --> Waha : envia (driver=waha)
Meta --> Routes : webhook\n(POST /api/webhooks/whatsapp)
Waha --> Routes : webhook\n(POST /api/webhooks/whatsapp)
Mailer --> Resend : e-mail de reset
Media --> Storage : mídia
@enduml
```

> 📎 Versão standalone do diagrama (renderizável com PlantUML):
> [`docs/diagrams/backend.puml`](./diagrams/backend.puml).

As dependências apontam **para dentro**: `presentation` depende de `application`, que
depende de `domain`. A camada interna (`domain`) não conhece nenhuma outra. A
`infrastructure` **implementa** os ports definidos em `application` (inversão de
dependência) e é conectada aos use-cases pelo **container** (`src/container.ts`).

### 2.1.1 `src/domain` — Regra de negócio pura

- **Entidades** (`entities/`): `User`, `Organization`, `OrganizationMember`,
  `Ticket`, `Contact`, `Message`, `InternalNote`, `TicketEvent`, `WebhookEvent`,
  `WhatsAppChannel`. Contêm lógica e invariantes de negócio (ex.: transições de status
  do ticket).
- **Value objects** (`value-objects/`): `Email`, `PhoneNumberE164`, `Slug`, `Role`,
  `TicketStatus`, `MessageDirection`, `ChannelStatus`, `WebhookEventStatus`.
- **Errors** (`errors/`): exceções de domínio tipadas (`TicketNotFoundError`,
  `ForbiddenRoleError`, etc.), estendendo `DomainError`.
- **Services** (`services/`): lógica reutilizável de domínio, ex.: `Clock`.

Padrão comum das entidades: factory `create(...)`, método `restore(...)` (para
reconstruir a partir de JSON) e `toJSON()`.

### 2.1.2 `src/application` — Casos de uso

- **Use-cases** (`use-cases/`): cada caso de uso orquestra uma operação, injeta seus
  dependências e aplica políticas. Implementado como classe com método `execute()`.
- **DTOs** (`dto/`): contratos de entrada/saída dos casos de uso.
- **Policies** (`policies/`): `OrganizationPolicy` aplica RBAC dentro dos use-cases.
- **Ports** (`ports/`): interfaces (abstrações) que definem o contrato dos repositórios
  e serviços externos (`ContactRepository`, `WhatsAppGateway`, `CredentialCipher`, etc.).

### 2.1.3 `src/infrastructure` — Adaptação ao externo

- **persistence**: `Jdbc*Repository` (implementações dos ports de repositório) usando
  `JdbcTemplate`/`NamedParameterJdbcTemplate` con SQL explícito e `ON CONFLICT` (upsert).
- **auth**: `BcryptPasswordHasher`, `JwtTokenService`.
- **security**: `Aes256GcmCredentialCipher` (criptografia de credenciais em repouso).
- **whatsapp**: `MetaWhatsAppGateway` / `WahaWhatsAppGateway` (envio),
  `MetaWhatsAppWebhookParser` / `WahaWhatsAppWebhookParser`,
  `MetaWebhookSignatureVerifier` / `WahaWebhookSignatureVerifier`. Selected once by
  `filazap.whatsapp-driver`.
- **email**: `ResendPasswordResetMailer` (implementação do port `PasswordResetMailer`).
- **storage**: `SupabaseMediaStorage` / `LocalMediaStorage` (implementações do port
  `MediaStorage` — mídia de mensagens).
- **observability**: `ConsoleAuditLogger` (implementação do port `AuditLogger`).

### 2.1.4 `presentation` — Interface web/API

- **web**: `@RestController`s (`AuthController`, `TicketController`, `WhatsAppWebhookController`,
  ...) plus helpers `Req`/`HttpUtil`.
- **security**: `JwtAuthenticationFilter` (`OncePerRequestFilter`) populates the actor.
- **error**: `GlobalExceptionHandler` maps domain errors to `{ "error": "..." }`.

## 2.2 Injeção de dependências e container

The composition root is `config/InfrastructureConfig.java` (Spring `@Configuration`), driven by
`FilazapProperties` (`@ConfigurationProperties(prefix = "filazap")`). It:

- Instancia the JDBC repositories and the infrastructure services.
- Binds each **use-case** to its ports (constructor injection via `@Service`/`@Bean`).
- Chooses the WhatsApp **driver** once, at startup, so no other layer branches on it.

```java
@Bean
public WhatsAppGateway whatsAppGateway(FilazapProperties props) {
    return useWaha(props) ? new WahaWhatsAppGateway(...) : new MetaWhatsAppGateway(...);
}
```

This keeps the controllers thin: authenticate, validate, delegate to the use-case.

## 2.3 Ports (interfaces de infraestrutura)

Exemplos de ports em `application/port/`:

| Port | Responsabilidade |
|------|------------------|
| `*Repository` | CRUD de entidades (contrato, não implementação). Inclui `UserRepository`, `OrganizationRepository`, `OrganizationMemberRepository`, `WhatsAppChannelRepository`, `ContactRepository`, `TicketRepository`, `MessageRepository`, `InternalNoteRepository`, `TicketEventRepository`, `WebhookEventRepository`, `PasswordResetRepository`, `TeamChatRepository`. |
| `WhatsAppGateway` | Envio de mensagens. |
| `WhatsAppWebhookParser` | Converte payload bruto do WhatsApp em modelo interno. |
| `CredentialCipher` | Criptografia/criptografia reversa de credenciais em repouso. |
| `TokenService` | Emissão/validação de JWT. |
| `PasswordHasher` | Hash/verificação de senhas. |
| `WebhookSignatureVerifier` | Verifica assinatura HMAC do webhook. |
| `PasswordResetMailer` | Envio de e-mail de redefinição de senha. |
| `MediaStorage` | Armazenamento de mídia (Supabase Storage ou disco local). |
| `Clock` | Abstração do tempo (testável). |
| `AuditLogger` | Registro de eventos de auditoria. |

## 2.4 Convenções de importação

- `@/` → raiz do projeto (ex.: `@/container`, `@/application/use-cases`).
- Ver `tsconfig.json` para a configuração completa de paths.

> 📎 Ver **[05-api.md](./05-api.md)** e **[06-casos-de-uso.md](./06-casos-de-uso.md)**.
