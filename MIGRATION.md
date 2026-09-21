# Migração para Java (Spring Boot) + React SPA

Este branch (`feat/migrate-backend-java`) substitui o backend original em
**Next.js/TypeScript (Prisma)** por um backend em **Java 21 + Spring Boot 3** e o
frontend por uma **React SPA (Vite)**.

## Nova estrutura

```
backend/                        → API Java (Spring Boot 3, Java 21, Maven)
  pom.xml
  src/main/java/com/filazap/
    domain/                     → entidades, value objects e erros (Clean Architecture)
    application/                → use-cases, ports (interfaces) e política RBAC
    infrastructure/             → repositórios JDBC, JWT, BCrypt, AES-GCM, WhatsApp, e-mail, storage
    presentation/               → controllers REST, filtro JWT e tratamento de erros
  src/main/resources/
    application.yml             → configuração (datasource, JWT, WhatsApp, storage)
    db/migration/V1__init.sql   → schema PostgreSQL via Flyway (espelha o Prisma original)

frontend/                       → React SPA (Vite + react-router-dom)
  src/pages/                    → login, dashboard, atendimento, equipe, configurações
  src/lib/                      → sessão e tema
  src/globals.css               → estilos (mesmos do projeto original)
  nginx.conf                    → serve a SPA e faz proxy /api → backend:8080
```

The legacy code (`src/`, `package.json`, `prisma/`, `tests/`, `next.config.mjs`, the Next.js
`Dockerfile`s and `scripts/migrate.sh`/`seed.sh`) has been **deleted** — the Java backend and the
React SPA are now the only implementations.

## Decisões técnicas

- **Spring Boot 3.4 + Java 21**, build com **Maven**.
- **Persistência**: Spring JDBC (`JdbcTemplate`/`NamedParameterJdbcTemplate`) com
  SQL explícito e `INSERT ... ON CONFLICT` (upsert) — espelha exatamente o
  comportamento dos repositórios Prisma originais, incluindo as consultas
  analíticas (métricas, contadores, fila) com `EXTRACT(EPOCH ...)`.
  O starter `spring-data-jdbc` está incluído; o mapeamento explícito por SQL foi
  escolhido por causa do modelo rico de domínio, das colunas JSONB e das
  operações de upsert/atribuição concorrente (o `save` do Spring Data JDBC com id
  definido pelo cliente faria UPDATE em registros novos).
- **Flyway** gerencia o schema (`db/migration/V1__init.sql`).
- **JWT** (HS256, jjwt) com a mesma semântica do `jose` original; BCrypt (custo 12);
  AES-256-GCM para credenciais do WhatsApp em repouso.
- **Contratos JSON** preservados 1:1 (rotas, códigos de status, formato de erro
  `{ "error": "..." }`), de modo que o frontend SPA continua funcionando sem
  mudanças de contrato.

## Como rodar localmente

Pré-requisitos: Java 21, Maven, Node 20+, PostgreSQL 16 (ou Docker).

```bash
# 1. Banco de dados (Postgres) + mock do WhatsApp
docker compose up -d postgres whatsapp-mock

# 2. Backend (sobe em http://localhost:8080; Flyway migra o schema)
cd backend
mvn spring-boot:run

# 3. Frontend (sobe em http://localhost:5173 com proxy /api → 8080)
cd ../frontend
npm install
npm run dev
```

Variáveis de ambiente necessárias (veja `.env.example`):
`JWT_SECRET`, `WHATSAPP_CREDENTIAL_ENCRYPTION_KEY`, `SPRING_DATASOURCE_URL`, etc.

## Docker (produção)

```bash
docker compose up --build
```

- `frontend` → nginx em `http://localhost:3000` (proxy `/api` → backend)
- `backend`  → Spring Boot em `http://localhost:8080`
- `postgres` + `whatsapp-mock` como dependências

## Testes (JUnit 5)

A suíte de testes original (Vitest) foi portada para **JUnit 5** e roda com
`mvn test` — **144 tests**, todos passando:

- `domain` (entidades + value objects): `OrganizationTest`, `TicketTest`, `ValueObjectsTest`
- `infrastructure`: `CredentialCipherTest` (AES-GCM), `WhatsAppParserVerifierTest` (parser + assinatura HMAC)
- `application` (use-cases com fakes em memória): `UseCasesTest`, `OrganizationAppearanceTest`,
  `PasswordResetTest`, `TeamChatTest`, `CrmUseCasesTest`, `QueueUseCasesTest`, `WhatsAppUseCasesTest`
- `infrastructure` (WAHA): `WahaWebhookParserTest` (envelope, `fromMe`, JIDs, timestamps, ack
  vocabulary, HMAC-SHA512), `WahaGatewayTest` (JID mapping and pre-flight guards)

Os fakes em memória ficam em `backend/src/test/java/com/filazap/test/TestFakes.java`
(port do `fakes.ts`).

## WAHA (second WhatsApp driver)

Added after the migration: a second implementation of the same `WhatsAppGateway` /
`WhatsAppWebhookParser` / `WebhookSignatureVerifier` ports, backed by
[WAHA](https://waha.devlike.pro). It pairs with **any** phone (personal or Business) over
WhatsApp Web, so tenants are not limited to Meta Business-Verified numbers.

- Selected once at startup by `filazap.whatsapp-driver` (`WHATSAPP_DRIVER`) in
  `InfrastructureConfig`; nothing else branches on the driver.
- `phoneNumberId` holds the WAHA **session name**, `accessToken` the WAHA API key,
  `appSecret` the webhook HMAC key — **no migration was needed** (all columns are `TEXT`).
- WAHA has no upload endpoint, so `uploadMedia` is a validated no-op returning `waha:inline` and
  the bytes ride inline as base64 in `SendMediaCommand.data()`.
- Webhooks are HMAC-**SHA512** (`X-Webhook-Hmac`) instead of Meta's SHA-256, so
  `WebhookSignatureVerifier` now takes the secret as a parameter (per-channel, stateless).
- Runs under a Compose profile: `docker compose --profile waha up -d`.

See **[docs/07-whatsapp.md](./docs/07-whatsapp.md)**.

## Pendências conhecidas

- Os testes de **HTTP do gateway** (`WahaWhatsAppGateway.sendText`/`sendMedia`/`fetchMedia` and
  the Meta equivalents) não foram portados — they need an embedded HTTP server; the send/media
  logic is covered indirectly by the use-cases with `FakeWhatsAppGateway`.
- ~~`git mv` do código legado para `legacy-nextjs/`~~ — done: the Next.js stack was deleted.
