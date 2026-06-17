# Feature Spec: Relatório por Reunião (FR63)

**Short name**: `relatorio-reuniao`
**Feature ID**: FR-63
**Epic**: Epic 13 — Relatórios Avançados & Analytics
**Story**: 13.1
**Status**: Clarified
**Criado em**: 2026-06-17

---

## Sumário

Como **Líder de Grupo**, quero visualizar um relatório detalhado para cada reunião concluída — com métricas de presença, duração individual e engajamento — para acompanhar a dinâmica do grupo e identificar membros que precisam de cuidado pastoral.

---

## Clarifications

### Session 2026-06-17

- Q: Qual entidade é a fonte canônica de `participantDuration` para o engagement score? → A: **MeetingAttendance.totalDurationSeconds** — agregado final pós-reunião (Story 5.3). O `report.service.ts` existente já mapeia `a.totalDurationSeconds → durationSeconds` e calcula `presenceFrac = durationSeconds / meetingDurationSeconds`. (dec-006, score 3)
- Q: Como o endpoint `GET /meetings/:id/report` trata membros sem permissão de gestão? → A: **Response filtrada** (não 403). O mesmo endpoint inclui `Role.PARTICIPANTE` no `@Roles`; quando `canSeeFull=false` retorna `kind:'personal'` com apenas a própria linha. FR63 estende esse padrão. (dec-007, score 3)
- Q: Qual bucket MinIO e política de retenção para os CSV de export? → A: **Bucket único `metanoia-storage`** (CONTENT_BUCKET) com prefixo `exports/`; signed URL com `REPORTS_JOB_TTL_SECONDS=3600` (1h) é o mecanismo de TTL efetivo. Sem bucket separado nem lifecycle S3 no código. (dec-008, score 3)
- Q: Por quanto tempo o registro `ExportJob` é retido após conclusão/falha? → A: **TTL Redis alinhado à URL assinada** (`cache:reports:export-job:*`, `REPORTS_JOB_TTL_SECONDS`). ExportJob é Redis-only, sem persistência em DB. Valor concreto a confirmar no plan. (dec-009, score 2)
- Q: Admin Tenant acessa relatórios de todas as reuniões do tenant ou só dos grupos que administra? → A: **Todas as reuniões do tenant** — o controller usa `admin_tenant` como shortcut que bypassa a verificação de grupo (`adminShortcut → canSeeFull=true`); RLS/AsyncLocalStorage isola o tenant. (dec-010, score 3)

---

## User Scenarios & Testing

### P1: Visualizar relatório de presença de uma reunião concluída

**Ator**: Líder de Grupo / Admin Tenant

**Cenário (fluxo principal)**:
```
Dado que uma reunião está com status `completed`
Quando o líder acessa o relatório da reunião via API ou UI
Então vê: total de convidados, total de presentes, total de ausentes, percentual de presença
E para cada participante: nome, status (presente/ausente), hora de entrada, hora de saída, duração total na reunião
E um score de engajamento por participante (0.0–1.0) com classificação: alto (≥0.75), médio (0.50–0.74), baixo (<0.50)
E métricas agregadas: média de engajamento do grupo com badge de classificação
```

**Edge cases**:
- Reunião com status diferente de `completed` → erro claro indicando que o relatório não está disponível
- Reunião com zero dados de presença (criada mas nunca iniciada) → resposta 200 com lista vazia e mensagem "Nenhum dado de presença registrado"
- Participante convidado que nunca entrou → aparece como ausente com duração 0 e score 0.0
- Líder tenta acessar reunião de outro tenant → acesso negado (isolamento por tenant)

### P2: Exportar relatório em CSV de forma assíncrona

**Ator**: Líder de Grupo / Admin Tenant

**Cenário (fluxo principal)**:
```
Dado que o líder visualiza o relatório de uma reunião
Quando solicita exportação em CSV
Então recebe confirmação imediata (processamento em andamento) com um identificador de job
E pode consultar o status do job periodicamente
E quando o processamento concluir, recebe link de download temporário válido por 1 hora
```

**Colunas do CSV**: nome, email, status (presente/ausente), hora de entrada, hora de saída, duração (minutos), score de engajamento.

**Edge cases**:
- Falha no processamento do job → status `failed` com motivo; lider pode tentar novamente
- Link expirado → erro com mensagem indicando expiração; novo export deve ser solicitado
- Reunião com zero participantes presentes → CSV gerado apenas com cabeçalho

### P3: Acompanhar participantes ausentes para ação pastoral

**Ator**: Líder de Grupo

**Cenário (fluxo principal)**:
```
Dado que o líder visualiza a lista de participantes do relatório
Quando identifica membros ausentes
Então esses membros estão visualmente destacados na interface
E há um call-to-action "Cuidar" que direciona para ação pastoral (quando módulo pastoral disponível)
E quando o módulo pastoral não está disponível, o CTA permanece desabilitado/oculto sem quebrar a página
```

**Edge cases**:
- Todos presentes → lista sem ausentes; nenhum CTA "Cuidar" exibido
- Epic 7 (Pastoral Radar) não ativo → CTA oculto graciosamente, sem erro

### P4 (Nice-to-have): Visualizar tendência de presença das últimas reuniões

**Ator**: Líder de Grupo

**Cenário**:
```
Dado que o grupo teve pelo menos 2 reuniões anteriores concluídas
Quando o líder visualiza o relatório da reunião atual
Então vê um mini-gráfico (sparkline) com o percentual de presença das últimas 5 reuniões do grupo
E pode identificar tendências de queda ou melhora na frequência
```

**Edge cases**:
- Grupo com menos de 2 reuniões históricas → sparkline não exibido (sem erro)
- Primeira reunião do grupo → apenas o valor atual exibido

---

## Requirements

### FR-01: Acesso ao relatório de reunião

O sistema deve **estender** o endpoint existente `GET /api/v1/meetings/:id/report` (Story 5.6, em `apps/api/src/meetings/reports/`) com a visão de líder/FR63 — sem duplicá-lo. Para cada reunião com status `completed`:
- **Líder do grupo / GroupMember com role `lider`|`admin`** → visão completa do relatório (todas as linhas + métricas agregadas).
- **Admin Tenant** (realm role `admin_tenant`) → visão completa de **todas** as reuniões do tenant, sem filtro por grupo (shortcut `adminShortcut → canSeeFull=true`); o isolamento é garantido por RLS/AsyncLocalStorage. (dec-010)
- **Membro comum (Participante)** → **resposta filtrada** (não 403): apenas a própria linha de presença (`kind:'personal'`), herança da Story 5.6. (dec-007)

### FR-02: Composição do relatório

O relatório deve conter:
- **Métricas agregadas**: total de convidados, total de presentes, total de ausentes, percentual de presença, score médio de engajamento do grupo com classificação (alto/médio/baixo)
- **Lista de participantes**: por participante — nome, email, status de presença (presente/ausente), horário de entrada, horário de saída, duração em minutos, score individual de engajamento (0.0–1.0), classificação de engajamento

### FR-03: Cálculo do score de engajamento

O score de engajamento de cada participante é calculado como a proporção de tempo que o participante permaneceu na reunião em relação à duração total da reunião (duração-do-participante ÷ duração-da-reunião), clamped entre 0.0 e 1.0.

A **fonte canônica** de `participantDuration` é o campo `MeetingAttendance.totalDurationSeconds` (agregado final pós-reunião, Story 5.3) — não os registros brutos de `MeetingParticipantRecord` nem os sinais de `MeetingTelemetry`. O `report.service.ts` existente já consome essa fonte. (dec-006)

**Classificações**:
- **Alto**: score ≥ 0.75
- **Médio**: 0.50 ≤ score < 0.75
- **Baixo**: score < 0.50

Participantes ausentes têm score 0.0 e classificação "baixo".

### FR-04: Contrato de resposta da API

A resposta da API de relatório segue o envelope padrão do projeto:
```
{ data: { meetingId, date, groupName, metrics: {...}, participants: [...] }, meta: { generatedAt } }
```

Em caso de reunião sem dados de presença: resposta 200 com `participants: []` e métricas zeradas.

### FR-05: Isolamento multi-tenant

O relatório deve respeitar isolamento absoluto por tenant. Um líder nunca pode acessar relatórios de reuniões de outros tenants. O tenant é identificado automaticamente pelo contexto de autenticação, sem ser passado como parâmetro explícito.

### FR-06: Export CSV assíncrono

A exportação em CSV deve ser processada de forma assíncrona, através de uma fila de jobs. O líder solicita o export e recebe imediatamente um identificador de job com status "em processamento". Pode consultar o status periodicamente. Quando concluído, recebe URL de download temporária válida por 1 hora. O arquivo CSV deve incluir BOM UTF-8 para compatibilidade com Excel.

O CSV é gravado no bucket único `metanoia-storage` (CONTENT_BUCKET) sob o prefixo `exports/` — reutilizando o `StorageService` existente, sem bucket dedicado. O novo tipo de job `export-meeting-csv` é adicionado à fila compartilhada `queue:reports`. (dec-008)

### FR-07: Polling de status do export

O sistema deve expor um endpoint de consulta de status do job de export, retornando: identificador do job, status (em processamento / concluído / falhou), URL assinada (quando concluído, nula caso contrário), data de expiração da URL, e motivo de falha (quando falhou, nulo caso contrário).

O registro `ExportJob` é **Redis-only** (chave `cache:reports:export-job:*`), sem persistência em banco. Seu TTL acompanha `REPORTS_JOB_TTL_SECONDS`, mantendo o registro consultável pelo mesmo período da URL assinada. (dec-009)

### FR-08: Interface de relatório acessível

A página de relatório deve atender WCAG AA:
- Badges de classificação de engajamento devem comunicar o nível por texto + ícone (não apenas cor)
- Lista de participantes deve ter ícones de status acompanhados de texto legível
- Score médio de engajamento deve ter contexto textual além do número
- Token de cor para texto secundário deve garantir contraste mínimo 4.5:1 (WCAG AA)
- Gráficos/sparklines devem ter `aria-label` descritivo e equivalente em tabela acessível

### FR-09: Destaque de ausentes e CTA pastoral

Participantes ausentes devem ser visualmente diferenciados na lista. Para cada ausente, deve haver um call-to-action "Cuidar" que leva à ação pastoral. Quando o módulo pastoral (Epic 7) não está disponível, o CTA deve ser omitido ou desabilitado graciosamente — sem quebrar a interface.

### FR-10: Tendência de presença (nice-to-have)

O sistema pode exibir um mini-gráfico de tendência com os percentuais de presença das últimas 5 reuniões concluídas do mesmo grupo. Esse elemento é opcional: sua ausência não afeta o funcionamento do relatório principal.

---

## Key Entities

| Entidade | Papel |
|----------|-------|
| **Meeting** | Reunião com status `completed`; fornece duração total e grupo associado |
| **MeetingParticipantRecord** | Registro de confirmação + presença por participante (joinedAt/leftAt) |
| **MeetingAttendance** | Agregado final de presença pós-reunião (Story 5.3) |
| **MeetingTelemetry** | Sinais de engajamento capturados durante a reunião (Story 5.4) |
| **MeetingReport** | Cache do relatório agregado pós-reunião (Story 5.6) |
| **Group** | Grupo ao qual a reunião pertence; usado para escopo de acesso |
| **ExportJob** | Job de exportação CSV com rastreamento de status e URL de download |

---

## Success Criteria

### SC-01: Cobertura de relatório
100% das reuniões com status `completed` devem ter relatório acessível. Reuniões em outros status não devem expor relatório.

### SC-02: Precisão de engajamento
O score de engajamento deve ser calculado consistentemente para todos os participantes. Participantes com duração zero têm score exatamente 0.0. Participantes com duração igual ou maior que a duração da reunião têm score exatamente 1.0.

### SC-03: Tempo de resposta do relatório
O relatório de uma reunião típica (até 50 participantes) deve estar disponível para visualização em menos de 3 segundos após a requisição.

### SC-04: Export completo e correto
O CSV exportado deve conter todas as colunas especificadas para todos os participantes da reunião, sem perda de dados. Linhas com dados ausentes usam valores nulos explícitos (não colunas omitidas).

### SC-05: Isolamento garantido
Zero dados de um tenant aparecem em relatórios de outro tenant — verificável por testes de isolamento RLS com dois tenants distintos.

### SC-06: Acessibilidade WCAG AA
Todos os elementos de classificação de engajamento (badges) e status de presença (ícones) devem ser compreensíveis sem depender exclusivamente de cor — verificável por auditoria automatizada e inspeção manual.

### SC-07: Disponibilidade do export
O link de download do export deve estar disponível em menos de 60 segundos após a solicitação para reuniões com até 200 participantes.

---

## Decisões de Infraestrutura

**Decisão de scheduling**: N/A — o export é disparado on-demand pelo usuário, sem agendamento periódico.

**Decisão de fila assíncrona**: Jobs de export são enfileirados na fila `queue:reports` (BullMQ, padrão Epic 8). A fila já existe no projeto — esta feature adiciona um novo tipo de job (`export-meeting-csv`) à fila compartilhada.

**TTL de URL assinada**: 3600 segundos (1 hora, `REPORTS_JOB_TTL_SECONDS`) — alinhado com o padrão existente de exports de trilhas.

**Storage do CSV**: bucket único `metanoia-storage` (CONTENT_BUCKET) com prefixo `exports/`, via `StorageService` existente. Sem bucket dedicado nem lifecycle S3; a expiração da signed URL é o mecanismo de controle de acesso. (dec-008)

**Retenção do ExportJob**: registro Redis-only (`cache:reports:export-job:*`) com TTL `REPORTS_JOB_TTL_SECONDS`, alinhado à URL assinada; sem persistência em DB. (dec-009)

**Fonte de duração para engagement**: `MeetingAttendance.totalDurationSeconds` (agregado Story 5.3). (dec-006)

**Idempotência de export**: Múltiplas solicitações do mesmo líder para a mesma reunião podem gerar múltiplos jobs independentes. Não há deduplicação automática — o líder recebe um jobId único por solicitação.

---

## Fora do Escopo

- Relatório consolidado por líder (Story 13.2a) — feature separada
- Detecção de risco de evasão (Story 13.3) — feature separada  
- Relatório em PDF — não especificado no epic; export CSV é o único formato
- Envio automático de relatório por email — não especificado
- Edição ou anotação do relatório pelo líder
- Comparação de reuniões lado a lado

---

## Dependências

| Dependência | Tipo | Detalhe |
|-------------|------|---------|
| Epic 5 (Meetings) | Obrigatória | Modelos Meeting, MeetingAttendance, MeetingParticipantRecord, MeetingTelemetry, MeetingReport já existem |
| Epic 7 (Pastoral Radar) | Opcional | CTA "Cuidar" linka para ação pastoral quando disponível; ausência não bloqueia esta feature |
| Epic 8 (BullMQ/exports) | Obrigatória | Fila `queue:reports` e padrão de polling já existem; esta feature reutiliza a infraestrutura |
| Story 5.6 (GET /meetings/:id/report) | Pré-existente | Endpoint já existe com visão pessoal/completa; Story 13.1 adiciona a visão de líder com métricas de engajamento FR63 |

