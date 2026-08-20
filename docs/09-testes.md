# 9. Testes

Os testes rodam com **Vitest** e são executados via `npm test` (e variantes no
`package.json`).

## 9.1 Comandos

| Comando | Função |
|---------|--------|
| `npm test` | Vitem rodando sobre `src`. |
| `npm run test:watch` | Modo watch. |
| `npm run test:all` | Tudo (`vitest run`). |
| `npm run test:integration` | Somente testes de integração (`tests/integration`). |

## 9.2 Camadas de teste

### Unitários (domain) — `src/domain/entities/__tests__/` e `value-objects/`
Validam invariantes de entidades (`Ticket`, `Organization`) e value objects
(transições de status, validação de email/telefone/slug). Focados em **regra de
negócio pura**, sem infraestrutura.

### Casos de uso — `src/application/__tests__/`
Testam os use-cases com **fakes** (`fakes.ts`) dos repositórios/ports:
- CRM (`crm-use-cases`), filas (`queue-use-cases`), WhatsApp, organização e use-cases
  gerais.
- Verificam aplicação de políticas (RBAC), deduplicação, transições e auditoria.

### Value objects — `src/domain/value-objects/__tests__/`
Garantem a validade/invalidade de `Email`, `PhoneNumberE164`, `Slug`, `Role`, etc.

### WhatsApp — `src/infrastructure/whatsapp/__tests__/`
Testam parser e verificação de assinatura da Cloud API.

### Segurança — `src/infrastructure/security/__tests__/`
Testam o `Aes256GcmCredentialCipher` (criptografia/descriptografia).

### Integração — `tests/integration/`
Rodam contra um PostgreSQL real (via `docker-compose.test.yml`, banco na porta 5433):
- `repositories.test.ts`, `whatsapp-repositories.test.ts`,
  `queue-repositories.test.ts`, `crm-repositories.test.ts`.

## 9.3 Fakes e ports

`src/application/__tests__/fakes.ts` implementa versões em memória dos ports de
repositório e serviços, permitindo testar use-cases sem banco de dados nem API real.

## 9.4 Testes sugeridos (do plano de segurança)

Recomendados para fechar as lacunas identificadas (S6, S7):

- Usuário **sem membership** não acessia organização.
- `findById` de outra organização retorna `null` (sem traversal inter-tenancy).
- Webhook com **assinatura inválida** é rejeitado (`401`).
- Revogação/rotação de token (logout/bloqueio inativo).

## 9.5 Cobertura e manutenibilidade

A estrutura espelha a arquitetura: cada camada tem seus próprios testes, o que facilita
testes rápidos de domínio/use-case e testes mais lentos (integração) apenas onde a
infraestrutura é relevante.

> 📎 Ver **[02-arquitetura.md](./02-arquitetura.md)** (camadas) e
> **[08-seguranca.md](./08-seguranca.md)** (testes de segurança).
