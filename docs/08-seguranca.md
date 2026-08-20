# 8. Segurança

O FilaZap possui uma **arquitetura de segurança bem estruturada** (RBAC no backbone,
criptografia de credenciais em repouso, verificação de assinatura de webhook e
validação de entradas). Os pontos críticos ficam em **configuração/teclado aberto**.

> 📎 Este documento resume os pontos-chave. O documento completo e detalhado com
> severidade, prova (arquivo/linha) e plano de remediação é o **`PLANO-SEGURANCA.md`**
> (raiz do repositório).

## 8.1 Pontos fortes (já implementados)

- **RBAC no backbone:** `OrganizationPolicy` é chamada dentro dos use-cases, verificando
  `actor.active` e o `Role` (OWNER/ADMIN/AGENT/VIEWER).
- **Escopo por organização:** a maioria dos use-cases resolve o ator via
  `findByUserAndOrganization`, evitando vazamento inter-organização.
- **Credenciais em repouso:** AES-256-GCM + IV por mensagem + auth tag.
- **Assinatura de webhook:** HMAC-SHA256 com `timingSafeEqual`.
- **Hash de senha:** bcrypt (cost 12).
- **Validação de entradas:** Zod em todas as rotas.
- **JWT:** HS256 fixo, expiração 7d, secret com tamanho mínimo validado, verificação
  server-side.
- **IDs não previsíveis:** `cuid()`/`randomUUID` (reduz IDOR).
- **Erros:** não vaziam stack trace no 500.

## 8.2 Achados críticos e prioritários

| ID | Categoria | Risco | Ação recomendada |
|----|-----------|-------|------------------|
| **S1** | Segredos padrão | JWT/criptografia com valores conhecidos | Remover defaults em `.env.example`; exigir segredos fortes no deploy. |
| **S2** | Seed fraco | Admin OWNER com senha trivial (`admin1234`) | Forçar alteração na primeira execução; não expor no `.env.example`. |
| **S3** | Self-signup público | `POST /api/organizations` sem autenticação nem rate limit | Autenticar criação; adicionar rate limiting/hCaptcha. |
| **S4** | Sessão no localStorage | XSS rouba JWT | Preferir cookie `httpOnly + secure + sameSite`. |
| **S5** | Sem rate limit no login | Brute-force | Throttling por e-mail/IP. |
| **S6** | `findById` sem scope de org | Leitura cruzada | Adicionar verificação de titularidade nos getters. |
| **S7** | JWT sem revogação | Token roubado válido 7d | Refresh token + blacklist (Redis). |

> 📎 Ver `PLANO-SEGURANCA.md` para os achados médios (S9–S13) e de baixo nível.

## 8.3 Prioridade de execução (sugestão do plano)

1. **Imediato (bloqueante de deploy):** S1, S2, S3.
2. **Curto prazo:** S5 (rate limit), S4 (gestão de sessão), S6 (scope de org).
3. **Médio prazo:** S7 (revogação), S8/S12 (exposição de serviços/endpoints), S9, S13.
4. **Continuidade:** testes de traversal inter-organização, `npm audit`, S10/S11.

## 8.4 Conceitos de implementação

- **RBAC:** `Role.canManageMembers/canSendMessages/canHandleTickets/...` +
  `OrganizationPolicy.*`.
- **Criptografia:** `Aes256GcmCredentialCipher` (chave mestra de plataforma).
- **Assinatura:** `MetaWebhookSignatureVerifier` (HMAC-SHA256 + `timingSafeEqual`).
- **Hash:** `BcryptPasswordHasher` (12 rounds).
- **Tokens:** `JwtTokenService` (HS256, 7d).

> 📎 Ver **[07-whatsapp.md](./07-whatsapp.md)** (segurança do webhook) e
> **[09-testes.md](./09-testes.md)** (testes de segurança sugeridos).
