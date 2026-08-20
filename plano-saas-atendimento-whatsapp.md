# Plano do SaaS de Atendimento e Fila para WhatsApp

## 1. Visão do produto

Criar um SaaS multiempresa para organizar atendimentos recebidos pelo WhatsApp em uma fila justa, preservar o histórico de cada cliente e permitir que uma ou várias atendentes trabalhem sem perder mensagens ou inverter prioridades.

O sistema terá aparência de uma central de atendimento/CRM, mas manterá a conversa simples como no WhatsApp.

### Problema resolvido

O WhatsApp ordena visualmente as conversas pela mensagem mais recente. Isso pode fazer um cliente que enviou muitas mensagens parecer mais urgente e esconder quem está esperando há mais tempo.

Neste sistema, a fila será ordenada pela **primeira mensagem pendente de atendimento**:

```text
queue_entered_at = horário da primeira mensagem recebida após o início do atendimento pendente
```

Novas mensagens atualizam a conversa, mas **não alteram `queue_entered_at`**. Portanto:

1. Maria entrou às 14:00.
2. Ana entrou às 14:05.
3. Carla entrou às 14:08.
4. Carla enviou mais 15 mensagens às 14:20.

A ordem continua sendo Maria → Ana → Carla.

## 2. Objetivos

- Evitar que clientes antigos sejam esquecidos.
- Distribuir atendimentos pela ordem real de espera.
- Mostrar claramente o estado de cada atendimento.
- Manter histórico, notas internas e dados do cliente.
- Dar uma visão operacional imediata por meio de contadores.
- Permitir crescimento de uma atendente para uma equipe.
- Oferecer o produto como assinatura mensal para múltiplas empresas.

## 3. Escopo do MVP

### 3.1 Funcionalidades essenciais

1. Cadastro da empresa e criação do primeiro administrador.
2. Login e recuperação de senha.
3. Convite de atendentes.
4. Conexão de um número por meio da WhatsApp Business Platform/Cloud API.
5. Recebimento de mensagens via webhook.
6. Envio de mensagens de texto pelo painel.
7. Fila ordenada por `queue_entered_at`.
8. Status do atendimento.
9. Botão **Próximo cliente**.
10. Cadastro e identificação automática do cliente pelo telefone.
11. Histórico de atendimentos.
12. Notas internas.
13. Busca por nome ou telefone.
14. Contadores operacionais em tempo real.
15. Auditoria das mudanças importantes.

### 3.2 Fora do primeiro MVP

- Chatbot com IA.
- Campanhas e disparos em massa.
- Integração com Instagram, Messenger ou Telegram.
- Funil comercial completo.
- Aplicativo nativo para Android/iOS.
- Integração financeira e agenda.
- Resumo automático de conversas.
- Distribuição sofisticada por habilidades.

Esses itens podem entrar depois que a fila e o atendimento estiverem validados com usuários reais.

## 4. Estados do atendimento

| Status | Cor | Significado | Entrada típica |
|---|---:|---|---|
| `WAITING` | 🟥 | Aguardando atendimento humano | Cliente escreveu e ninguém respondeu |
| `IN_PROGRESS` | 🟨 | Em atendimento | Atendente assumiu ou respondeu |
| `WAITING_CUSTOMER` | 🟦 | Aguardando cliente | Última mensagem relevante foi da atendente |
| `RETURNING` | 🟪 | Retorno | Cliente já teve atendimento finalizado e voltou |
| `FINISHED` | 🟩 | Finalizado | Atendente encerrou o atendimento |

### Regras de transição

- Novo telefone → cria cliente, atendimento e status `WAITING`.
- Cliente já conhecido, sem atendimento aberto → cria novo atendimento `RETURNING`.
- `WAITING` ou `RETURNING` → atendente clica em **Assumir** → `IN_PROGRESS`.
- Ao enviar resposta → pode mudar automaticamente para `WAITING_CUSTOMER`.
- Cliente responde enquanto está em `WAITING_CUSTOMER` → volta para `IN_PROGRESS`, preservando o mesmo atendimento.
- Atendente clica em **Finalizar** → `FINISHED`, preenchendo `finished_at`.
- Cliente envia nova mensagem depois da finalização → abre novo atendimento `RETURNING`, com novo `queue_entered_at`.
- Mudanças automáticas devem poder ser ajustadas manualmente pela atendente.

## 5. Regra da fila

### Ordenação principal

```sql
ORDER BY priority DESC, queue_entered_at ASC
```

No MVP, `priority` será normal para todos. O campo já pode existir para futura prioridade manual, sem permitir que a quantidade de mensagens mude a posição.

### Regras obrigatórias

- `queue_entered_at` é definido apenas quando um novo atendimento pendente é criado.
- Mensagens adicionais alteram `last_message_at`, mas não `queue_entered_at`.
- Um atendimento finalizado nunca volta a ser aberto; um retorno cria outro atendimento.
- A posição deve ser calculada no banco, nunca apenas no navegador.
- Datas devem ser armazenadas em UTC e exibidas no fuso da empresa.
- Para evitar duas atendentes assumirem o mesmo cliente, a operação de **Assumir** deve ser atômica no banco.

### Próximo cliente

O botão consulta o primeiro atendimento disponível por `queue_entered_at` e tenta atribuí-lo à atendente em uma única transação. Se outra atendente o assumir simultaneamente, o sistema tenta o próximo.

Exemplo de retorno:

```text
Próximo da fila: Ana — esperando há 18 minutos
```

O usuário ainda poderá abrir qualquer conversa manualmente, conforme suas permissões.

## 6. Experiência de uso

### Tela principal — Central de Atendimento

#### Barra superior

- Busca por nome ou telefone.
- Nome/número do canal conectado.
- Estado da conexão.
- Perfil da atendente.

#### Indicadores

- 12 aguardando atendimento.
- 4 em atendimento.
- 7 aguardando cliente.
- 31 finalizados hoje.
- Maior tempo de espera.
- Tempo médio até a primeira resposta.

#### Coluna esquerda

Filtros e listas agrupadas por status:

- Aguardando.
- Retornos.
- Em atendimento.
- Aguardando cliente.
- Finalizados.

Cada item mostra posição, nome, trecho da mensagem, tempo de espera, atendente e indicador de mensagens não lidas.

#### Área central

- Cabeçalho do cliente.
- Linha do tempo de mensagens.
- Campo para resposta.
- Anexos suportados.
- Botões **Assumir**, **Aguardar cliente**, **Finalizar** e **Próximo cliente**.

#### Painel lateral do cliente

- Nome e telefone.
- Etiquetas.
- Status atual.
- Primeira interação.
- Último atendimento.
- Total de atendimentos.
- Atendente responsável.
- Notas internas.
- Histórico completo.

### Histórico

```text
Cliente: Juliana
Primeiro contato: 03/07/2026
Último atendimento: 16/08/2026
Atendimentos: 7

Atendimento #7 — 16/08 — Finalizado
Atendimento #6 — 10/08 — Finalizado
Atendimento #5 — 02/08 — Finalizado
```

## 7. Arquitetura proposta

### Frontend e backend web

- Next.js com TypeScript.
- Deploy na Vercel.
- Interface responsiva para desktop e tablet.
- Rotas de API/Functions para comandos autenticados.
- Endpoint público dedicado ao webhook do WhatsApp.
- Código organizado com Clean Architecture, Clean Code, SOLID e separação clara de responsabilidades.

### Clean Architecture

A regra da fila e a máquina de estados não devem depender de Next.js, Supabase, Vercel ou da API do WhatsApp. O núcleo da aplicação precisa ser testável isoladamente e permitir a troca de infraestrutura sem reescrever as regras de negócio.

```text
src/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── services/
│   ├── events/
│   └── errors/
├── application/
│   ├── use-cases/
│   ├── ports/
│   ├── dto/
│   └── policies/
├── infrastructure/
│   ├── database/
│   ├── whatsapp/
│   ├── auth/
│   ├── storage/
│   ├── realtime/
│   └── observability/
├── presentation/
│   ├── api/
│   ├── webhooks/
│   ├── validators/
│   └── presenters/
└── app/
    ├── components/
    ├── pages/
    └── providers/
```

#### Responsabilidades das camadas

| Camada | Responsabilidade | Exemplos |
|---|---|---|
| Domínio | Regras puras e invariantes | Ticket, Contact, QueuePosition, estados e transições |
| Aplicação | Coordenação dos casos de uso | Receber mensagem, assumir ticket, finalizar, buscar próximo |
| Portas | Contratos necessários pela aplicação | Repositórios, WhatsAppGateway, EventPublisher, Clock |
| Infraestrutura | Implementações externas | Supabase/PostgreSQL, Meta Cloud API, Storage e Realtime |
| Apresentação | Entrada e saída | Rotas HTTP, webhooks, validação e ViewModels |
| Interface | Experiência do usuário | Central, fila, conversa, cliente e relatórios |

#### Regras de dependência

- Domínio não importa bibliotecas de banco, HTTP, framework ou provedor.
- Aplicação depende do domínio e de interfaces, nunca de implementações concretas.
- Infraestrutura implementa as portas definidas pela aplicação.
- Rotas e webhooks apenas validam a entrada, chamam um caso de uso e formatam a resposta.
- Entidades do domínio não são usadas diretamente como objetos de resposta da API.
- Datas são obtidas por uma abstração `Clock`, facilitando testes da fila e dos SLAs.
- Identificadores externos do WhatsApp ficam separados dos identificadores internos.

#### Casos de uso principais

- `ReceiveWhatsAppMessage`
- `CreateOrFindContact`
- `OpenTicket`
- `AssignTicket`
- `AssignNextTicket`
- `SendMessage`
- `MoveTicketToWaitingCustomer`
- `FinishTicket`
- `ReopenAsReturningTicket`
- `AddInternalNote`
- `ListQueue`
- `GetOperationalCounters`

#### Práticas de Clean Code

- Nomes que expressem a regra de negócio, evitando abreviações vagas.
- Funções pequenas e com uma responsabilidade.
- Validação de entrada nas bordas da aplicação.
- Erros de domínio explícitos, como `TicketAlreadyAssignedError`.
- Sem regras de negócio duplicadas em componentes React ou rotas HTTP.
- Sem acesso direto ao Supabase dentro de componentes de interface.
- Testes unitários para o domínio e casos de uso.
- Testes de integração para adaptadores, RLS, webhooks e banco.
- ESLint, Prettier, TypeScript em modo estrito e verificação automática no CI.

### Supabase

- PostgreSQL como fonte oficial dos dados.
- Supabase Auth para usuários.
- Row Level Security (RLS) para isolamento por empresa.
- Supabase Realtime para atualizar fila, mensagens e contadores sem recarregar.
- Supabase Storage para mídias que precisem ser armazenadas.
- Funções SQL/RPC para operações transacionais, como assumir o próximo cliente.

### WhatsApp

- Integração oficial via WhatsApp Business Platform/Cloud API ou BSP aprovado.
- Webhook recebe mensagens e atualizações de entrega/leitura.
- API oficial envia respostas.
- Templates aprovados serão usados quando as regras do WhatsApp exigirem mensagens iniciadas pela empresa fora da janela permitida.
- Tokens, app secret e demais credenciais ficam somente no servidor.

### Fluxo de uma mensagem recebida

1. WhatsApp chama o webhook.
2. Endpoint valida autenticidade e registra o evento bruto.
3. Sistema verifica idempotência pelo identificador da mensagem.
4. Localiza ou cria a empresa, canal e cliente.
5. Localiza atendimento aberto.
6. Se não existir, cria atendimento com `queue_entered_at = message_timestamp`.
7. Registra a mensagem.
8. Atualiza `last_message_at`, não a posição da fila.
9. Supabase Realtime atualiza os painéis conectados.

### Processamento desacoplado

O endpoint do webhook deve validar, persistir o evento e responder rapidamente. O processamento pesado deve acontecer de forma desacoplada e idempotente. No MVP, isso pode ser feito por uma tabela de eventos pendentes e uma função processadora; quando o volume crescer, a porta de fila poderá receber uma implementação de serviço de filas sem alterar os casos de uso.

## 7.1 Ambiente local com Docker Compose

O projeto deve possuir um `docker-compose.yml` próprio para desenvolvimento e testes locais. Ele não será usado na Vercel; servirá para subir dependências reproduzíveis na máquina do desenvolvedor e no CI.

### Serviços previstos

| Serviço | Finalidade |
|---|---|
| `app` | Aplicação Next.js/API em modo de desenvolvimento ou teste |
| `postgres` | Banco PostgreSQL compatível com o modelo usado no Supabase |
| `redis` | Fila/cache local opcional para testes de concorrência e jobs |
| `mailpit` | Captura local de e-mails de convite e recuperação de senha |
| `whatsapp-mock` | Simulador local de webhooks e respostas da API do WhatsApp |

O PostgreSQL e o mock do WhatsApp são obrigatórios no ambiente de testes. Redis e Mailpit podem ficar em profiles opcionais enquanto não forem necessários pelo MVP.

### Arquivos esperados

```text
docker-compose.yml
docker-compose.test.yml
Dockerfile
Dockerfile.test
.env.example
scripts/
├── wait-for-db.sh
├── migrate.sh
├── seed.sh
└── simulate-whatsapp-webhook.sh
```

### Requisitos do Compose

- Healthcheck do PostgreSQL antes da aplicação iniciar.
- Volume nomeado para dados de desenvolvimento.
- Banco de testes separado e descartável.
- Variáveis documentadas no `.env.example`, sem segredos reais.
- Migration e seed executáveis por comando.
- Rede interna para comunicação entre os containers.
- Porta do banco exposta apenas quando necessária ao desenvolvedor.
- Usuário de banco sem privilégios excessivos para a aplicação.
- Comando único para subir o ambiente.
- Comando único para executar testes e remover os dados descartáveis.

### Comandos-alvo

```bash
docker compose up -d
docker compose run --rm app npm run db:migrate
docker compose run --rm app npm run db:seed
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm app npm test
docker compose down
```

### Teste local do webhook

O script `simulate-whatsapp-webhook.sh` deve enviar payloads equivalentes aos eventos oficiais para o endpoint local. Os cenários mínimos serão:

- Nova mensagem de telefone desconhecido.
- Várias mensagens do mesmo cliente sem mudança na posição.
- Evento repetido para testar idempotência.
- Atualização de entregue, lido e falha.
- Cliente retornando depois de um ticket finalizado.
- Duas tentativas simultâneas de assumir o próximo ticket.

### Supabase local

Se forem usados recursos específicos de Auth, Storage, Realtime e RLS durante o desenvolvimento, o projeto também poderá utilizar a Supabase CLI, que executa a stack local em containers. O `docker-compose.yml` continuará sendo mantido para testes isolados da aplicação e do PostgreSQL, enquanto a Supabase CLI será usada nos testes de integração que precisarem reproduzir toda a plataforma.

## 8. Modelo multiempresa

Todo registro de negócio deve possuir `organization_id`. Nenhuma consulta de usuário pode acessar dados de outra empresa.

### Papéis

| Papel | Permissões principais |
|---|---|
| `OWNER` | Assinatura, configurações, números, usuários e todos os atendimentos |
| `ADMIN` | Usuários, configurações operacionais, relatórios e atendimentos |
| `AGENT` | Conversas, clientes e notas permitidas |
| `VIEWER` | Consulta e relatórios, sem enviar ou alterar |

## 9. Modelo de dados inicial

### `organizations`

- `id`
- `name`
- `slug`
- `timezone`
- `plan`
- `subscription_status`
- `created_at`

### `organization_members`

- `organization_id`
- `user_id`
- `role`
- `active`
- `created_at`

### `whatsapp_channels`

- `id`
- `organization_id`
- `phone_number_id`
- `business_account_id`
- `display_phone_number`
- `status`
- referências seguras às credenciais
- `created_at`

### `contacts`

- `id`
- `organization_id`
- `channel_id`
- `phone_e164`
- `name`
- `first_contact_at`
- `last_contact_at`
- `metadata jsonb`
- `created_at`

Restrição única: `(organization_id, channel_id, phone_e164)`.

### `tickets` (atendimentos)

- `id`
- `organization_id`
- `channel_id`
- `contact_id`
- `sequence_number`
- `status`
- `priority`
- `queue_entered_at`
- `assigned_user_id`
- `assigned_at`
- `first_response_at`
- `waiting_customer_since`
- `finished_at`
- `last_message_at`
- `created_at`
- `updated_at`

### `messages`

- `id`
- `organization_id`
- `ticket_id`
- `contact_id`
- `whatsapp_message_id` único
- `direction` (`INBOUND`/`OUTBOUND`)
- `type`
- `body`
- `media_path`
- `sender_user_id`
- `provider_status`
- `provider_timestamp`
- `created_at`

### `internal_notes`

- `id`
- `organization_id`
- `contact_id`
- `ticket_id` opcional
- `author_user_id`
- `body`
- `created_at`
- `updated_at`

### `ticket_events`

- `id`
- `organization_id`
- `ticket_id`
- `actor_user_id` opcional
- `event_type`
- `from_status`
- `to_status`
- `payload jsonb`
- `created_at`

### `webhook_events`

- `id`
- `organization_id` opcional durante a identificação
- `provider_event_id`
- `payload jsonb`
- `processing_status`
- `attempts`
- `received_at`
- `processed_at`
- `error_message`

## 10. Índices importantes

```sql
create index tickets_queue_idx
on tickets (organization_id, status, priority desc, queue_entered_at asc)
where status in ('WAITING', 'RETURNING');

create index tickets_agent_idx
on tickets (organization_id, assigned_user_id, status, last_message_at desc);

create index messages_ticket_time_idx
on messages (organization_id, ticket_id, provider_timestamp asc);

create unique index messages_whatsapp_id_uq
on messages (whatsapp_message_id);
```

## 11. Operações críticas

### Assumir atendimento

- Executada no servidor/RPC.
- Atualização condicional somente se ainda não houver responsável.
- Registra `assigned_user_id`, `assigned_at` e evento de auditoria.
- Em conflito, informa que outro agente assumiu.

### Finalizar e abrir o próximo

1. Finaliza o ticket atual.
2. Registra evento.
3. Consulta o mais antigo ainda disponível.
4. Tenta atribuí-lo de forma atômica.
5. Abre a conversa retornada.

### Idempotência do webhook

- Uma mensagem com o mesmo `whatsapp_message_id` não pode ser criada duas vezes.
- O webhook deve responder rapidamente e permitir processamento/repetição segura.
- Eventos com falha permanecem registrados para reprocessamento.

## 12. Segurança e LGPD

- RLS habilitado em todas as tabelas expostas.
- Políticas sempre filtradas por associação do usuário à `organization_id`.
- Service role somente no backend; nunca no navegador.
- Validação da assinatura/autenticidade dos webhooks.
- Segredos em variáveis protegidas da Vercel/Supabase.
- Logs sem tokens e com mascaramento de dados pessoais.
- Auditoria de leitura sensível e alterações importantes.
- Termos de uso, política de privacidade e contrato de operador/controlador.
- Retenção configurável e processo para exportar, anonimizar ou excluir dados.
- Backup e teste periódico de restauração.
- Limitação de tentativas, rate limiting e proteção contra abuso.

## 13. Indicadores e relatórios

### Operacionais

- Aguardando agora.
- Em atendimento agora.
- Aguardando cliente agora.
- Finalizados hoje.
- Maior espera atual.
- Tempo médio e mediano até a primeira resposta.
- Tempo médio de atendimento.
- Atendimentos por atendente.
- Taxa de retorno.

### Regra de medição

- Primeira resposta: `first_response_at - queue_entered_at`.
- Duração: `finished_at - queue_entered_at`.
- Espera atual: `now() - queue_entered_at` apenas para itens em fila.
- Métricas devem excluir eventos de teste e permitir filtro por período, canal e atendente.

## 14. Planos comerciais sugeridos

### Inicial

- 1 número.
- Até 2 atendentes.
- Fila, histórico, notas e métricas básicas.

### Profissional

- Mais atendentes.
- Relatórios avançados.
- Etiquetas, respostas rápidas e exportação.

### Empresa

- Múltiplos números/unidades.
- Permissões personalizadas.
- SLA, auditoria avançada e suporte prioritário.

O valor da assinatura deve ser separado dos custos cobrados pelo provedor/Meta pelo uso do WhatsApp. O sistema deve medir consumo por organização para permitir repasse transparente.

## 15. Roadmap de implementação

### Fase 0 — Descoberta e validação (3–5 dias)

- Entrevistar 2–5 atendentes.
- Confirmar volume diário, número de usuários e tipos de mídia.
- Validar estados e transições.
- Confirmar se o número atual poderá ser migrado/conectado oficialmente.
- Desenhar wireframes com base nas referências fornecidas.

**Entrega:** fluxo validado, decisões do MVP e protótipo navegável.

### Fase 1 — Fundação SaaS (1 semana)

- Next.js, Vercel e ambientes.
- Estrutura inicial baseada em Clean Architecture.
- Dockerfile, Docker Compose e ambiente local reproduzível.
- Supabase, migrations e seeds.
- Login, organizações, membros e papéis.
- RLS multiempresa.
- Layout principal responsivo.

**Entrega:** usuário cria empresa, entra no painel e convida atendente.

### Fase 2 — Integração WhatsApp (1–2 semanas)

- Cadastro do canal.
- Verificação e assinatura de webhook.
- Recebimento idempotente.
- Envio de texto.
- Status de entrega, leitura e erro.
- Armazenamento seguro de eventos.

**Entrega:** mensagens reais entram e saem pelo painel.

### Fase 3 — Fila e atendimento (1–2 semanas)

- Tickets e máquina de estados.
- Ordenação por `queue_entered_at`.
- Assumir de forma atômica.
- Próximo cliente.
- Finalização e retorno.
- Atualização em tempo real.

**Entrega:** fluxo Maria → Ana → Carla funciona mesmo com novas mensagens.

### Fase 4 — CRM leve (1 semana)

- Perfil do cliente.
- Histórico por atendimento.
- Notas internas.
- Busca.
- Contadores e métricas básicas.

**Entrega:** central utilizável diariamente.

### Fase 5 — Cobrança e lançamento piloto (1 semana)

- Assinaturas e limites por plano.
- Página de planos.
- Onboarding.
- Observabilidade e alertas.
- Política de privacidade e rotinas LGPD.
- Piloto controlado com uma empresa.

**Entrega:** MVP comercializável.

Estimativa inicial: **5 a 8 semanas** para um MVP sólido, dependendo da aprovação/configuração da conta oficial do WhatsApp e do suporte a mídias no primeiro lançamento.

## 16. Critérios de aceite do MVP

1. Maria entra antes de Ana e permanece antes dela, mesmo se Ana enviar novas mensagens.
2. Duas atendentes não conseguem assumir o mesmo atendimento simultaneamente.
3. Uma mensagem repetida pelo webhook não aparece duplicada.
4. Cliente finalizado que retorna gera outro ticket e preserva o histórico anterior.
5. Notas internas nunca são enviadas ao WhatsApp.
6. Usuário de uma organização não acessa dados de outra, inclusive alterando URLs ou chamadas de API.
7. Contadores mudam em tempo real após receber, assumir, responder ou finalizar.
8. O botão **Próximo cliente** atribui o ticket elegível mais antigo.
9. Falha no envio é visível e pode ser repetida com segurança.
10. Todas as mudanças de status e responsável ficam auditadas.
11. Domínio e casos de uso executam testes sem depender de Next.js, Supabase ou WhatsApp.
12. `docker compose up -d` inicia o ambiente local e seus serviços obrigatórios com healthchecks válidos.
13. A suíte de integração pode criar um banco descartável, executar migrations e limpar o ambiente ao terminar.

## 17. Testes prioritários

- Testes unitários da máquina de estados.
- Testes SQL da ordenação da fila.
- Teste concorrente com duas atendentes clicando em **Próximo cliente**.
- Testes de idempotência do webhook.
- Testes de isolamento RLS entre organizações.
- Testes de retorno após finalização.
- Testes E2E: receber → assumir → responder → aguardar cliente → finalizar → próximo.
- Testes de timezone e horário de verão.
- Testes de indisponibilidade temporária do WhatsApp e do banco.
- Testes unitários do domínio sem acesso à rede ou ao banco.
- Testes de contrato dos adaptadores de PostgreSQL e WhatsApp.
- Teste completo do ambiente criado pelo Docker Compose em CI.

## 18. Riscos e decisões pendentes

| Tema | Risco/decisão |
|---|---|
| WhatsApp oficial | Verificar elegibilidade, número, conta comercial, templates e custos atuais |
| Número existente | Confirmar processo de conexão/migração e impacto no uso pelo celular |
| Retorno | Definir se entra em fila separada ou compartilha a fila com sinalização visual |
| Automação de status | Confirmar se responder muda automaticamente para “Aguardando cliente” |
| Várias atendentes | Definir fila única, por equipe ou por unidade |
| Mídia | Decidir se áudio, imagem, vídeo e documento entram no MVP |
| SLA | Definir alertas quando a espera ultrapassar determinado tempo |
| Cobrança | Escolher cobrança por atendente, número, volume ou combinação |
| Retenção | Definir por quanto tempo mensagens e mídias serão guardadas |

## 19. Evoluções após o MVP

- Etiquetas e campos personalizados.
- Respostas rápidas e templates.
- Lembretes e retornos agendados.
- Distribuição round-robin ou por habilidade.
- Horário de funcionamento e mensagem automática.
- SLA com alertas.
- Pesquisa de satisfação.
- Agenda e cobrança.
- IA para resumo, classificação de assunto e sugestão de resposta, sempre com revisão humana.
- API pública e integrações via webhook.
- Importação/exportação de contatos.
- Dashboard executivo e comparação entre períodos.

## 20. Referências técnicas oficiais

- [WhatsApp Cloud API — documentação da Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Realtime — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

## 21. Decisão recomendada

Começar com **um único número, uma empresa piloto e até duas atendentes**, implementando muito bem a fila justa, o botão **Próximo cliente**, os cinco estados, histórico e notas. Não iniciar pelo chatbot ou por campanhas. O diferencial inicial do produto é tornar o atendimento humano organizado, mensurável e impossível de “furar fila” por excesso de mensagens.
