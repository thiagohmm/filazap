# 3. Configuração e Como Rodar

## 3.1 Pré-requisitos

- **Java 21** (backend Spring Boot — see `.tool-versions` and `backend/pom.xml`).
- **Maven 3.9+**.
- **Node.js 20+** — only for the React SPA (`frontend/`, Vite) and the Node helper scripts.
- **Docker + Docker Compose** (Postgres, mock, WAHA).
- OpenSSL para gerar segredos.

The Next.js backend and Prisma were removed; there is no root `package.json` and no
`npm run db:*` anymore. Schema is managed by **Flyway** inside the Java app.

## 3.2 Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores.

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `SERVER_PORT` | Porta do backend Spring Boot. | `8080` |
| `SPRING_DATASOURCE_URL` | JDBC URL do PostgreSQL. | `jdbc:postgresql://localhost:5432/filazap` |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | Credentials do banco. | `filazap` / `filazap` |
| `JWT_SECRET` | Secret do JWT (HS256). **Gerar valor forte.** | `openssl rand -base64 32` |
| `WHATSAPP_DRIVER` | `meta` (Cloud API) ou `waha` (qualque celular via QR). | `meta` |
| `WHATSAPP_API_URL` | Base da Cloud API (use o mock em dev). | `http://localhost:4000/graph` |
| `WAHA_URL` | Base URL of the WAHA gateway. | `http://localhost:3000` |
| `WAHA_API_KEY` | API key of the WAHA instance (`X-Api-Key`). | `openssl rand -hex 32` |
| `WAHA_WEBHOOK_SECRET` | HMAC secret for WAHA webhooks (`X-Webhook-Hmac`). | `openssl rand -hex 32` |
| `WAHA_IMAGE` | Image + engine tag (see 07-whatsapp.md). | `devlikeapro/waha:arm-2026.8.2` |
| `WHATSAPP_CREDENTIAL_ENCRYPTION_KEY` | Chave-mestra de criptografia de credenciais (>= 32 bytes). | `openssl rand -hex 32` |
| `MEDIA_STORAGE_DRIVER` | `local` ou `supabase`. | `local` |
| `MEDIA_STORAGE_ROOT` | Raiz do storage local. | `./storage` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | Storage de media (opcional). | — |
| `APP_URL` | URL pública do frontend (link de e-mail de reset). | `http://localhost:3000` |
| `RESEND_API_KEY` / `EMAIL_FROM` | E-mail de recuperação de senha. | — |
| `ORGANIZATION_SIGNUP_ALLOWED_DOMAINS` | Domínios permitidos para cadastro (vazio = qualquer). | `exemplo.com` |

> 🔒 **Nunca** comite `.env`. Segredos padrão devem ser substituídos antes de qualquer
> deploy — ver **[08-seguranca.md](./08-seguranca.md)** and `PLANO-SEGURANCA.md`.

## 3.3 Instalação

```bash
cp .env.example .env
# fill in the secrets (JWT_SECRET, WHATSAPP_CREDENTIAL_ENCRYPTION_KEY at minimum)
```

## 3.4 Banco de dados

**Flyway** applies the schema automatically at startup (`backend/src/main/resources/db/migration/
V1__init.sql`). No separate migrate command exists.

### Ambiente com Docker (recommended)

```bash
docker compose up --build     # postgres + whatsapp-mock + backend + frontend
```

When the healthchecks are green, open `http://localhost:3000`.

### Bootstrap of the first admin

There is **no seeder** anymore (the old `prisma/seed.ts` was removed with the Next.js stack).
Create the first organization and admin through the public API:

```bash
curl -s -X POST http://localhost:8080/api/organizations \
  -H 'Content-Type: application/json' \
  -d '{"name":"Me Company","adminName":"Admin","adminEmail":"admin@example.com","adminPassword":"Str0ngPassw0rd"}'
```

Then log in at `POST /api/auth/login` (or through the SPA at `http://localhost:3000`).
Note `ORGANIZATION_SIGNUP_ALLOWED_DOMAINS` restricts the e-mail domain, and signup is rate
limited (3/min per IP).

To reset the database from scratch (including the volume):

```bash
docker compose down -v && docker compose up --build
```

## 3.5 Build and tests

| Command | Função |
|---------|--------|
| `cd backend && mvn spring-boot:run` | Backend in dev (port 8080). |
| `cd backend && mvn test` | Unit/integration tests (JUnit). |
| `cd backend && mvn -q package` | Executable JAR in `backend/target/`. |
| `cd frontend && npm install && npm run dev` | SPA in dev (Vite, port 5173). |
| `cd frontend && npm run build` | Static build in `frontend/dist/`. |

## 3.6 Scripts auxiliares (`scripts/`)

| Script | Função |
|--------|--------|
| `build-and-up.sh` | Builds and starts the compose stack. |
| `wait-for-db.sh` | Waits until PostgreSQL accepts connections. |
| `simulate-whatsapp-webhook.sh` | Sends a test **Meta Cloud API** webhook, signed by the mock. Meta driver only. |
| `test-docker-flow.mjs` | End-to-end flow against a running stack (login, ticket, reply). Needs Node. |

## 3.7 Compose profiles

Optional services are opt-in via profiles:

```bash
docker compose up --build                                   # core stack
docker compose --profile optional up -d                 # + redis, mailpit
docker compose --profile waha   up -d                   # + WAHA gateway (any phone, QR)
```

- `redis` (6379) — cache.
- `mailpit` (1025/8025) — SMTP testing.
- `whatsapp-mock` (4000) — simulates the Meta Cloud API.
- `waha` (host **3001**) — real WhatsApp gateway for any phone; see
  **[07-whatsapp.md](./07-whatsapp.md)**.

> 📎 Ver **[07-whatsapp.md](./07-whatsapp.md)** para the two drivers and **[08-seguranca.md](./08-seguranca.md)**.
