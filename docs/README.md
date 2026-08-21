# Documentação — FilaZap

Este diretório concentra a documentação do **FilaZap**, um SaaS de atendimento e fila
justa para WhatsApp.

## Índice

- **[01-overview.md](./01-overview.md)** — Visão geral, objetivos e funcionalidades
- **[02-arquitetura.md](./02-arquitetura.md)** — Arquitetura (Clean Architecture/DDD), camadas e container
- **[03-configuracao.md](./03-configuracao.md)** — Como configurar e rodar o projeto localmente
- **[04-banco-de-dados.md](./04-banco-de-dados.md)** — Modelo de dados (Prisma), enums e migrações
- **[05-api.md](./05-api.md)** — Referências da API REST (rotas, autenticação, webhooks)
- **[06-casos-de-uso.md](./06-casos-de-uso.md)** — Casos de uso, políticas e regras de negócio
- **[07-whatsapp.md](./07-whatsapp.md)** — Integração com WhatsApp Cloud API e o mock
- **[08-seguranca.md](./08-seguranca.md)** — Modelo de segurança, RBAC e criptografia
- **[09-testes.md](./09-testes.md)** — Estratégia de testes e cobertura
- **[`diagrams/`](./diagrams/)** — Diagramas PlantUML do projeto:
  - [`backend.puml`](./diagrams/backend.puml) — Arquitetura do backend (camadas, ports, adapters e sistemas externos).
  - [`database.puml`](./diagrams/database.puml) — Schema do banco de dados (entidades e relacionamentos).

> Os diagramas acima também estão embutidos em [`02-arquitetura.md`](./02-arquitetura.md)
> e [`04-banco-de-dados.md`](./04-banco-de-dados.md) como blocos `plantuml`. Para
> renderizá-los em imagem: `java -jar plantuml.jar diagrams/*.puml` (requer Graphviz
> instalado) ou use [plantuml.com/plantuml](https://www.plantuml.com/plantuml/uml).

> 📎 O **`PLANO-SEGURANCA.md`** (auditoria de segurança estática) e o
> **`plano-saas-atendimento-whatsapp.md`** (planejamento do SaaS) ficam na raiz do
> repositório e são referenciados ao longo desta documentação.

## Público-alvo

- Desenvolvedores que vão manter ou estender o código.
- Revisores que precisam entender as decisões de arquitetura e segurança.

## Como contribuir com a documentação

Mantenha os docs sincronizados com o código: toda rota nova, use-case ou entidade
deve ter sua entrada atualizada neste diretório. A estrutura segue o padrão
`NN-nome-do-arquivo.md`, ordenado por ordem de leitura recomendada.
