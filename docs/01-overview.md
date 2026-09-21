# 1. Visão Geral — FilaZap

**FilaZap** é um SaaS de atendimento ao cliente e **fila justa (fair queue)** integrado
ao **WhatsApp**. Permite que organizações (empresas) recebam mensagens de clientes pelo
WhatsApp, organizem esses atendimentos em uma fila balanceada por prioridade e tempo de
entrada, atribua tickets a agentes e responda diretamente pela Cloud API da Meta.

## 1.1 Objetivos

- Centralizar atendimentos de WhatsApp em uma única plataforma multi-inquilino
  (multi-tenancy) por organização.
- Oferecer uma **fila justa** onde os tickets são ordenados por prioridade e, em caso de
  empate, pelo tempo de entrada na fila (`queueEnteredAt`).
- Permitir integração com o WhatsApp sem que o agente precise do WhatsApp Web.
- Garantir isolamento de dados entre organizações (multi-tenancy por `organizationId`).

## 1.2 Funcionalidades principais

| Área | Funcionalidade |
|------|----------------|
| **Organização** | Criação de organização, membros (RBAC) e aparência/tema personalizáveis. |
| **Autenticação** | Login por e-mail/senha, emissão de JWT (HS256), bootstrap de admin via seed. |
| **Canais** | Registro e gerenciamento de canais do WhatsApp Cloud API (credenciais criptografadas em repouso). |
| **Contatos** | Cadastro automático, perfil e histórico de atendimentos. |
| **Tickets / Fila** | Abertura automática por mensagem, atribuição manual/automática (`assign-next`), movimento entre status, conclusão. |
| **Mensagens** | Envio via Cloud API, recebimento via webhook, atualização de status (delivery/read). |
| **Anotações** | Notas internas vinculadas a contatos/tickets. |
| **Métricas** | Contadores operacionais e métricas de atendimento por organização. |
| **Webhooks** | Recebimento e processamento de webhooks do WhatsApp com verificação de assinatura e deduplicação. |

## 1.3 Termos do domínio

- **Organization** — tenant (quilômetro) isolado de dados.
- **User** — usuário autenticado (agente/admin/owner).
- **OrganizationMember** — vinculação entre usuário e organização com um `Role`.
- **Ticket** — thread de atendimento; Possui `sequenceNumber` único por organização,
  status de fila e prioridade.
- **Contact** — cliente (telefone E164) dentro de uma organização e canal.
- **Message** — mensagem enviada/recebida, com direção (`INBOUND`/`OUTBOUND`) e status do provider.

## 1.4 Stack tecnológica

- **Framework:** Spring Boot 3 (Java 21) — REST API.
- **Linguagem:** Java 21 (backend), TypeScript/React (SPA `frontend/`).
- **Banco de dados:** PostgreSQL (Spring JDBC + Flyway).
- **Cache/ filas opcionais:** Redis e Mailpit (profiles `optional` no docker-compose).
- **WhatsApp:** Cloud API da Meta **ou** WAHA (any phone, via QR) — selectable by driver.
- **Testes:** JUnit 5 + Spring Boot Test.

> 📎 Ver **[02-arquitetura.md](./02-arquitetura.md)** para os detalhes de arquitetura.
