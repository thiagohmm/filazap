# 2. Arquitetura

O FilaZap segue os princípios de **Clean Architecture** com elementos de **DDD**
(Domain-Driven Design). O objetivo é separar responsabilidades para que a regra de
negócio seja independente de framework, framework web, banco de dados ou infraestrutura.

## 2.1 Camadas

```
┌───────────────────────────────────────────────────────────────┐
│  presentation   rotas Next.js (API) + páginas (App Router)      │
│                validadores Zod + helpers de resposta            │
├───────────────────────────────────────────────────────────────┤
│  application    casos de uso (use-cases) + DTOs                 │
│                políticas (policies) + ports (interfaces)        │
├───────────────────────────────────────────────────────────────┤
│  domain         entidades, value objects, services, errors      │
│                (camada mais interna — sem dependências externas)│
├───────────────────────────────────────────────────────────────┤
│  infrastructure Prisma (repositórios), JWT, bcrypt, gateway     │
│                WhatsApp, criptografia de credenciais, logging    │
└───────────────────────────────────────────────────────────────┘
```

As dependências apontam **para dentro**: `presentation` depende de `application`, que
depende de `domain`. A camada interna (`domain`) não conhece nenhuma outra.

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

- **Database** (`database/`): `Prisma*Repository` (implementações dos ports de repositório)
  e o cliente Prisma (`prisma.ts`).
- **auth**: `BcryptPasswordHasher`, `JwtTokenService`.
- **security**: `Aes256GcmCredentialCipher` (criptografia de credenciais em repouso).
- **whatsapp**: `MetaWhatsAppGateway` (envio), `MetaWhatsAppWebhookParser`,
  `MetaWebhookSignatureVerifier`.
- **observability**: `ConsoleAuditLogger` (implementação do port `AuditLogger`).

### 2.1.4 `src/presentation` — Interface web/API

- **api**: rotas do Next.js (`app/api/**`) e helpers (`helpers.ts`, `session.ts`).
- **validators**: schemas Zod aplicados nas entradas das rotas.

## 2.2 Injeção de dependências e container

O **container** (`src/container.ts`) é o ponto de composição (composition root). Ele:

- Instancia os repositórios Prisma e os serviços de infraestrutura.
- Conecta cada **use-case** aos seus ports (repositórios, clock, logger, gerador de ID).
- Expõe o objeto `useCases`, consumido pelas rotas (`src/app/api/**`).

```ts
import { useCases } from '@/container';
// ...na rota: await useCases.assignTicket.execute({...})
```

Isso mantém as rotas finas: autenticam, validam e delegam ao use-case.

## 2.3 Ports (interfaces de infraestrutura)

Exemplos de ports em `src/application/ports/`:

| Port | Responsabilidade |
|------|------------------|
| `*Repository` | CRUD de entidades (contrato, não implementação). |
| `WhatsAppGateway` | Envio de mensagens. |
| `WhatsAppWebhookParser` | Converte payload bruto do WhatsApp em modelo interno. |
| `CredentialCipher` | Criptografia/criptografia reversa de credenciais em repouso. |
| `TokenService` | Emissão/validação de JWT. |
| `PasswordHasher` | Hash/verificação de senhas. |
| `WebhookSignatureVerifier` | Verifica assinatura HMAC do webhook. |
| `Clock` | Abstração do tempo (testável). |
| `AuditLogger` | Registro de eventos de auditoria. |

## 2.4 Convenções de importação

- `@/` → raiz do projeto (ex.: `@/container`, `@/application/use-cases`).
- Ver `tsconfig.json` para a configuração completa de paths.

> 📎 Ver **[05-api.md](./05-api.md)** e **[06-casos-de-uso.md](./06-casos-de-uso.md)**.
