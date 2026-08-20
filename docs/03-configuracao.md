# 3. Configuração e Como Rodar

## 3.1 Pré-requisitos

- Node.js 20+ (ver ``.tool-versions`).
- PostgreSQL 16+ (recomendado: via Docker Compose).
- OpenSSL para gerar segredos.

## 3.2 Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores. Principais variáveis:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NODE_ENV` | Ambiente (`development`, `test`). | `development` |
| `PORT` | Porta do servidor Next. | `3000` |
| `DATABASE_URL` | URI do PostgreSQL. | `postgresql://filazap:filazap@localhost:5432/filazap` |
| `TEST_DATABASE_URL` | Banco usado pelos testes. | `postgresql://...:5433/filazap_test` |
| `JWT_SECRET` | Secret do JWT (HS256). **Gerar valor forte.** | `openssl rand -base64 32` |
| `SEED_ADMIN_*` / `SEED_ORG_*` | Bootstrap do admin e organização inicial. | — |
| `WHATSAPP_API_URL` | Base da Cloud API (use o mock em dev). | `http://localhost:4000/graph` |
| `WHATSAPP_CREDENTIAL_ENCRYPTION_KEY` | Chave-mestra de criptografia de credenciais. | `openssl rand -hex 32` |
| `SEED_DEMO_DATA` | Cria dados demonstrativos no seed (`true`/`false`). | `false` |

> 🔒 **Nunca** comite `.env`. Segredos padrão devem ser substituídos antes de qualquer
> deploy — ver **[08-seguranca.md](./08-seguranca.md)** e `PLANO-SEGURANCA.md`.

## 3.3 Instalação

```bash
npm install          # instala dependências
npx prisma generate  # gera o cliente Prisma
```

## 3.4 Banco de dados (ambiente de desenvolvimento)

A forma mais rápida é subir o ambiente completo com Docker Compose:

```bash
docker compose up --build        # compila e sobe postgres, whatsapp-mock e o app
npm run db:migrate               # cria/altera as migrações (se não usar compose)
npm run db:seed                  # popula admin + organização inicial
```

> No `docker-compose.yml`, o serviço `app` compila o Next.js durante o build e
> executa migrações, seed demonstrativo e `next start`. Quando os healthchecks
> estiverem saudáveis, acesse `http://localhost:3000`.

### Ambiente demonstrativo

O Compose define `SEED_DEMO_DATA=true` e cria, de forma idempotente:

- organização e administrador configurados pelas variáveis `SEED_ADMIN_*`;
- canal conectado ao WhatsApp mock;
- atendentes, contatos, conversas, notas e tickets em diferentes estados.

Entre usando `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` do seu `.env`. Para
recriar a demonstração do zero, removendo também o volume local do banco:

```bash
docker compose down -v
docker compose up --build
```

Com o ambiente saudável, valide o ciclo completo de recebimento e resposta:

```bash
npm run test:docker-flow
```

### Comandos de banco (`package.json`)

| Comando | Função |
|---------|--------|
| `npm run db:generate` | Gera o cliente Prisma. |
| `npm run db:migrate` | Modo dev: cria e aplica migrações. |
| `npm run db:deploy` | Aplica migrações em produção. |
| `npm run db:seed` | Popula dados iniciais (`prisma/seed.ts`). |
| `npm run db:studio` | Abre o Prisma Studio (interface visual). |

## 3.5 Executando

| Comando | Função |
|---------|--------|
| `npm run dev` | Servidor de desenvolvimento (porta 3000). |
| `npm run build` | Build de produção. |
| `npm run start` | Servidor de produção. |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`). |
| `npm run lint` | ESLint. |

## 3.6 Scripts auxiliares (`scripts/`)

- `migrate.sh` — aplica migrações.
- `seed.sh` — roda o seed.
- `wait-for-db.sh` — aguarda o banco ficar pronto.
- `simulate-whatsapp-webhook.sh` — envia um webhook de teste ao app.

## 3.7 Ambiente com Docker

```bash
docker compose up --build              # ambiente completo (dev)
docker compose -f docker-compose.test.yml up --build   # sobe só p/ rodar os testes
```

O `docker-compose.yml` inclui serviços opcionais (habilitados por perfil):
- `redis` (6379) — cache/file.
- `mailpit` (1025/8025) — teste de e-mails.
- `whatsapp-mock` (4000) — simula a Cloud API.

> 📎 Ver **[07-whatsapp.md](./07-whatsapp.md)** para detalhes do mock.
