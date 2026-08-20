# Plano de Segurança — FilaZap

> **Escopo deste documento:** auditoria de segurança estática (leitura) e plano de
> remediação. **Nenhuma arquivo foi alterado.** As notas abaixo mapeiam achados reais
> encontrados na base de código (`src/`), configurações (`.env`, `docker-compose.yml`)
> e front-end. Cada item tem severidade, prova (arquivo/linha) e ação recomendada.

---

## 1. Resumo executivo

O projeto tem uma **arquitetura de segurança bem estruturada** (DDD + políticas em
use-cases, criptografia de credenciais em repouso, verificação de assinatura de
webhook e validação de entradas). Os pontos críticos ficam em **configuração/teclado
(defaults), exposição da API de criação de organização, ausência de limites de taxa e
gestão de sessão/cliente frágil**.

| Categoria | Severity | Qtd |
|-----------|----------|-----|
| Crítico   | 🔴 Alto  | 3 |
| Alto      | 🟠 Média  | 5 |
| Médio     | 🟡   | 6 |
| Baixo/Info| 🟢   | 4 |

---

## 2. Pontos fortes (manter)

- **RBAC aplicado no backbone**, não só na UI: `OrganizationPolicy` (`src/application/policies/OrganizationPolicy.ts`) é chamada dentro dos use-cases, com verificação de `actor.active`.
- **Resolução de ator por organização** (`findByUserAndOrganization`) evita vazamento inter-organização na maioria dos use-cases.
- **Credenciais em repouso** com AES-256-GCM + IV por mensagem + auth tag (`Aes256GcmCredentialCipher`).
- **Assinatura de webhook Meta** com HMAC-SHA256 + `timingSafeEqual` (`MetaWebhookSignatureVerifier`).
- **Hash de senha** com bcrypt (12 rounds).
- **Validação de entradas** com Zod em todas as rotas.
- **JWT**: validação de tamanho mínimo da secret, `HS256` fixo, expiração 7d, verificação server-side.
- **Tratamento de erros** não vazia stack traces (retorna `"Erro interno."` no 500).
- **IDs não previsíveis** (`randomUUID`) — reduz risco de IDOR por adivinhação.
- `.env` e credenciais no `.gitignore`.

---

## 3. Achados e plano de remediação

### 🔴 CRÍTICO

#### S1 — Segredos padrão/fracos no `.env.example` e `docker-compose.yml`
- **Prova:** `.env.example` → `JWT_SECRET=change-me-please-generate-a-random-secret`; `WHATSAPP_CREDENTIAL_ENCRYPTION_KEY=change-me-encryption-key`. `docker-compose.yml` → `JWT_SECRET: ${JWT_SECRET:-local-dev-secret-change-me}`.
- **Risco:** A secret JWT é usada para autenticar *todas* as sessões; com valor conhecido/fracos, um atacante falsifica tokens de qualquer usuário. A chave de criptografia de credenciais também é conhecida → expõe tokens/secret do WhatsApp de todos os clientes.
- **Ação:**
  1. Remover valores default úteis em `.env.example` (usar `JWT_SECRET=__CHANGE_ME_ON_DEPLOY__`).
  2. Exigir segredos reais em deploy (validação já existe p/ JWT; adicionar p/ chave de criptografia).
  3. Rodar `openssl rand -base64 32` e `openssl rand -hex 32`; rotacionar se já usado em produção.

#### S2 — Credenciais de admin padrão e fracas no seed
- **Prova:** `prisma/seed.ts` + `.env.example` → `SEED_ADMIN_PASSWORD=admin1234`, `admin@example.com`.
- **Risco:** Conta com permissão OWNER e senha trivial. Em ambiente de demo/prod não alterado, é entrada direta.
- **Ação:** Forçar alteração na primeira execução (ex.: seed só cria se `SEED_ADMIN_PASSWORD` estiver no placeholder); logar alerta; nunca expor senha no `.env.example`.

#### S3 — Criação de organização pública e sem controle (`POST /api/organizations`)
- **Prova:** `src/app/api/organizations/route.ts` → sem `getSession`, sem autenticação.
- **Risco:** Self-signup aberto a qualquer e-mail → abuso, spam, criação em massa, violação de termos. Não há rate limiting.
- **Ação:**
  1. Autenticar a criação (ou verificar domínio do e-mail).
  2. Adicionar rate limiting (ex.: `next-rate-limiter` / Redis + bucket) em `/api/organizations` e `/api/auth/login`.
  3. Considerar Terms/antibot (hCaptcha) no onboarding.

---

### 🟠 ALTO

#### S4 — Sessão do cliente armazenada em `localStorage` sem proteções
- **Prova:** `src/app/lib/session.ts` → `localStorage.setItem('filazap_session', ...)`.
- **Risco:** Token JWT acessível por qualquer script da página (XSS rouba o token). Sem flags de cookie, sem CSRF protection.
- **Ação:** Preferir cookie `httpOnly + secure + sameSite=strict` para o token; se manter no localStorage, adicionar sanitização rigorosa de saída (XSS) e revogação. Implementar logout que limpe a sessão.

#### S5 — Sem rate limiting / proteção contra brute-force no login
- **Prova:** `src/app/api/auth/login/route.ts` sem limite.
- **Risco:** Tentativas infinitas de senha. O use-case já retorna `InvalidCredentialsError` genérico (bom), mas não limita taxa.
- **Ação:** Throttling por e-mail/IP (ex.: 5 tentativas/min); delay progressivo; bloqueio temporário.

#### S6 — Consultas por `id` sem scope de organização em alguns repositórios
- **Prova:** `PrismaMessageRepository.findById`, e padrão similar em `findById` de contacts/tickets. Recebem apenas `id`.
- **Risco:** Se um use-case passar um `id` de outra organização (via parâmetro), pode haver leitura cruzada. A maioria dos use-cases escopa por `organizationId` nas listagens, mas os getters pontuais (`findById`) não verificam pertinência organizacional.
- **Ação:** Rever cada `findById`/getter usado com id externo; adicionar verificação de titularidade (`organizationId`) ou retornar `null` se não pertencer ao ator. Escrever teste de integração cruzada.

#### S7 — Tokens JWT sem revogação/rotação (sem refresh)
- **Prova:** `JwtTokenService` — token único, 7d, sem blacklisting nem refresh token.
- **Risco:** Token roubado permanece válido por até 7d; sem forma de invalidar (ex.: demissão/lock de membro inativo não revoga tokens emitidos).
- **Ação:** Implementar refresh token (curto prazo, rotativo) e blacklist server-side (Redis) para logout/bloqueio. Validar `actor.active` também na validação de token ou revalidar membership.

#### S8 — `whatsapp-mock` e serviços expostas em portas locais
- **Prova:** `docker-compose.yml` → porta `4000` (mock graph), `8025` (Mailpit UI).
- **Risco:** Serviços de dev expostos facilitam enumeração/explitação em redes compartilhadas.
- **Ação:** Bind a `127.0.0.1` em dev; remover portas de serviços opcionais (Mailpit/redis) da exposição pública.

---

### 🟡 MÉDIO

#### S9 — Body sem limite de tamanho / enforcement de Content-Type
- **Prova:** rotas usam `await req.json()` sem limite.
- **Risco:** DoS por payload gigante.
- **Ação:** Limitar tamanho (ex.: 100KB) e validar `Content-Type: application/json`.

#### S10 — Chave de criptografia derivada com SHA256 simples
- **Prova:** `Aes256GcmCredentialCipher` → `createHash('sha256').update(masterKey).digest()`.
- **Risco:** Aceitável se `masterKey` for alta entropia, mas sem KDF (PBKDF2/argon2) é vulnerável a ataques de dicionário se a secret vazar em forma de texto.
- **Ação:** Documentar que a chave deve ser alta entropia; considerar bcrypt/PBKDF2 apenas se a chave for uma passphrase.

#### S11 — Log de erros com `console.error` (log injection)
- **Prova:** `toErrorResponse` em `helpers.ts`.
- **Risco:** Mensagens de erro de cliente (ex.: Zod) logadas podem injetar quebras de linha em logs.
- **Ação:** Sanitizar mensagens antes de logar (remover `\n`, `\r`); usar logger estruturado (JSON).

#### S12 — Meta WhatsApp API URL configurável (`WHATSAPP_API_URL`)
- **Prova:** `.env.example`.
- **Risco:** Apontar para endpoint malicioso em dev pode exporar tokens de saída.
- **Ação:** Em produção, fixar URL oficial e bloquear override por env; validar host.

#### S13 — Ausência de CORS configurado / cabeçalhos de segurança
- **Prova:** `next.config.mjs` (verificar). Rotas REST sem headers de segurança.
- **Ação:** Definir `next.config.mjs` `headers` com `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e CORS restrito ao origin do front-end.

---

### 🟢 BAIXO / INFO

- **S14** — `bcrypt` cost 12 adequado; manter (reavaliar conforme hardware).
- **S15** — Verificar `next.config.mjs` se há exposição de variáveis de ambiente cliente (`NEXT_PUBLIC_*`).
- **S16** — Adicionar `Cache-Control` apropriado em rotas autenticadas.
- **S17** — Documentar política de retenção de logs de auditoria (`AuditLogger`).

---

## 4. Prioridade de execução (sugestão)

1. **Imediato (bloqueante de deploy):** S1, S2, S3 — segredos, seed e self-signup.
2. **Curto prazo:** S5 (rate limit login), S4 (gestão de sessão), S6 (scope de org).
3. **Médio prazo:** S7 (revogação/refresh), S8/S12 (exposição de serviços/endpoints), S9, S13.
4. **Continuidade:** testes de integração de traversal inter-organização, scanner de dependências (`npm audit`), S10/S11.

---

## 5. Verificações automatizadas recomendadas

- `npm audit` e `npm audit --production` — dependências conhecidas.
- `git log -p -- .env.example` e busca por `secret|password|key` no versionamento.
- Script de lint que impede `NEXT_PUBLIC_` exporando segredos.
- Testes de integração: (a) usuário sem membership não acessia org; (b) `findById` de outra org retorna null; (c) webhook com assinatura inválida é rejeitado.
- Verificar `.next/` e `tsconfig.tsbuildinfo` fora do versionamento (não vazar build).

> Observação: este é um plano baseado em revisão estática do código-fonte disponível.
> Nenhuma alteração foi aplicada neste repositório.
