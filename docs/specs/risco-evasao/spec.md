# Spec — Story 13.3: Detecção de Risco de Evasão (FR66)

**Feature:** risco-evasao
**Épico:** Epic 13 — Relatórios Avançados & Analytics
**Referência autoritativa:** `_bmad-output/implementation-artifacts/13-3-deteccao-de-risco-de-evasao-fr66.md`
**Status:** clarify — concluído (todas as decisões resolvidas autonomamente, score 3)

---

## 1. Contexto e Motivação

Líderes de grupos de discipulado precisam cuidar proativamente de participantes que estão se desengajando, antes que o afastamento se torne definitivo. A detecção manual é impraticável à medida que o número de grupos cresce.

Esta story implementa a detecção automática de risco de evasão (FR66) como um job de background diário, integrado ao Radar Pastoral existente (Epic 7 — `ParticipantRadarStatus`). O resultado é visível para o líder no Radar UI com o motivo do risco destacado no card do participante.

### Decisões de Escopo Resolvidas

**DECISÃO-ESCOPO-01 — Notificação push deferida ao Epic 14 (RESOLVIDA, não reabrir):**
O Epic 14 (notificações) ainda não existe (em andamento, 0 stories entregues; módulo `notifications` e models ausentes). A notificação push ao líder fica **DEFERIDA ao Epic 14** via o domain event `pastoral.participant.risk-detected` que esta story emite. Não implementar nem chamar nenhum notification service. O líder visualiza o risco pelo Radar UI (implementado nesta story). O evento é o contrato de integração com o Epic 14.

**DECISÃO-ESCOPO-02 — `last_seen_at` como sub-dependência a resolver no Plan (SINALIZADA):**
O campo `User.last_seen_at (DateTime?)` está **ausente do schema atual** (confirmado via análise do `schema.prisma`). Este campo é pré-requisito para a detecção de inatividade ("2+ semanas sem acesso"). A migration que adiciona o campo é trivial; o ponto a decidir no Plan é o **mecanismo de população**: quem, quando e com qual debounce atualiza `last_seen_at` na vida real. Opções candidatas: (a) auth guard/middleware atualiza a cada request autenticado, debounced via Redis (ex.: TTL de 5 min); (b) atualização em eventos de presença/check-in. Sem esse mecanismo, o campo existe mas permanece `null` para todos os usuários, tornando a detecção de inatividade não funcional. **Item obrigatório de clarify/plan.**

---

## 2. User Story

**Como** Líder de Grupo,
**Quero** que o sistema detecte automaticamente participantes em risco de evasão,
**Para que** eu possa cuidar deles proativamente antes que se afastem do grupo.

---

## 3. Requisitos Funcionais (FR66)

### FR66-01 — Job de Detecção Diária

- **Queue:** `queue:reports`; **job name:** `detect-evasion-risk`; **cron:** `0 6 * * *` (06:00 UTC diariamente)
- O job itera sobre **todos os tenants ativos**, processando um tenant por vez para preservar isolamento RLS
- Para cada tenant, usa `RequestContext.run()` para injetar `tenant_id` via `AsyncLocalStorage` — **nunca** passa `tenant_id` como parâmetro de função
- Processa participantes em **batches de 100** para evitar picos de memória
- **SLA:** job completa em no máximo 30 minutos; métrica `job.duration_ms` emitida via Pino ao final
- Métricas ao final: `job.duration_ms`, `job.tenants_processed`, `job.participants_flagged`
- A avaliação de risco é **per-participant-per-group** (não global): um participante pode estar em risco em um grupo mas não em outro

### FR66-02 — Critérios de Detecção de Risco

Um participante é flagged como em risco se atender **qualquer** dos critérios abaixo, avaliados por grupo:

**Critério A — Ausências Consecutivas:**
- 3 ou mais ausências consecutivas nas reuniões do grupo específico
- Apenas reuniões do grupo (não globais) são contadas
- Ausências durante período de recesso do grupo **não contam** (ver FR66-05)

**Critério B — Inatividade na Plataforma:**
- 2 ou mais semanas sem qualquer acesso à plataforma (`User.last_seen_at`)
- Campo `last_seen_at` é global (por usuário, não por grupo)

### FR66-03 — Transição do Semáforo (ParticipantRadarStatus)

O sistema usa o modelo `ParticipantRadarStatus` existente com `RadarStatus` enum: `verde` / `amarelo` / `vermelho`.

**Regra de não-sobrescrita:** Se o líder alterou manualmente o semáforo nas últimas 24h, o job **não sobrescreve** a decisão pastoral manual.

**Escalonamento de risco:**
- `verde` → `amarelo` na 1ª detecção
- `amarelo` → `vermelho` se ainda flagged após +7 dias

**Retorno à normalidade (per-group):**
- `vermelho` → `amarelo` na 1ª atividade registrada (reunião ou acesso à plataforma)
- `amarelo` → `verde` após 2 presenças consecutivas nas **próximas 2 reuniões agendadas do grupo específico**

### FR66-04 — Domain Events

**Evento de risco detectado:** `pastoral.participant.risk-detected`

Envelope conforme convenção do projeto:
```
{
  eventId: string        // UUID v7
  eventType: 'pastoral.participant.risk-detected'
  version: 1
  tenantId: string
  timestamp: string      // ISO 8601
  data: {
    participantId: string
    groupId: string
    riskType: 'absence' | 'inactivity'
    details: {
      consecutiveAbsences?: number
      daysSinceLastAccess?: number
    }
    previousStatus: 'verde' | 'amarelo' | 'vermelho'
    newStatus: 'amarelo' | 'vermelho'
  }
  metadata: {
    jobId: string
    correlationId: string
  }
}
```

**Evento de risco resolvido:** `pastoral.participant.risk-resolved`
```
{
  eventId: string        // UUID v7
  eventType: 'pastoral.participant.risk-resolved'
  version: 1
  tenantId: string
  timestamp: string      // ISO 8601
  data: {
    participantId: string
    groupId: string
    resolvedBy: 'attendance' | 'platform_access'
    previousStatus: 'amarelo' | 'vermelho'
    newStatus: 'verde' | 'amarelo'
  }
  metadata: {
    jobId?: string
    correlationId: string
  }
}
```

> **Integração com Epic 14:** O domain event `pastoral.participant.risk-detected` é o **único contrato de integração** com o futuro módulo de notificações. O Epic 14 consumirá este evento para enviar notificação push ao líder com a mensagem "⚠️ {Nome} pode precisar de cuidado — {motivo}". Nesta story, o evento é emitido (publicado na fila/bus) mas não há consumer de notificação.

### FR66-05 — Grupo em Recesso

- Líder marca grupo como em recesso via `PATCH /api/v1/groups/:id` com `{ status: 'on_break', breakUntil: '2026-07-01' }`
- Enquanto `status === 'on_break'` e `breakUntil > now()`, ausências naquele grupo **não contam** para o Critério A
- Auto-resume: quando `breakUntil` passa, o grupo retorna automaticamente a `status === 'active'` na próxima execução do job (ou via check no request)

### FR66-06 — Radar UI — Motivo do Risco

- O card do participante no Radar UI exibe o motivo do risco (tooltip ou label)
- Formato PT-BR: "3 ausências consecutivas" ou "Sem acesso há 15 dias"
- O motivo é armazenado/derivado do `ParticipantRadarStatus` (mecanismo a confirmar em clarify — ver Seção 7 C2)

### FR66-07 — CelebrationBanner no Retorno

- Quando o status melhora (`vermelho`→`amarelo` ou `amarelo`→`verde`), exibir `CelebrationBanner` ao líder: "{Nome} voltou a participar!"
- Usar componente do Epic 7 se existir; caso contrário, implementar banner simples inline
- Banner: `aria-live="polite"`, vocabulário pastoral

### FR66-08 — Tratamento de Erros no Job

- Erro num tenant específico: skip + log com `correlation_id` + continua para próximo tenant
- 3 falhas consecutivas para o mesmo tenant: emitir alerta para Super Admin
- O job nunca falha globalmente por erro de tenant individual

### FR66-09 — Care Timeline

- A mudança de status por risco é registrada na care timeline do participante (`PastoralNote` / Epic 7)
- Registro inclui: tipo de evento (risco/resolução), motivo, status anterior/novo

---

## 4. Requisitos Não-Funcionais

| Atributo | Requisito |
|----------|-----------|
| Multi-tenancy | `tenant_id` via `AsyncLocalStorage`/`RequestContext`; RLS obrigatório; nunca como parâmetro |
| Performance | Batch de 100 participantes; SLA 30min; métricas Pino ao final |
| Segurança | Isolamento por tenant no job; sem vazamento cross-tenant |
| Confiabilidade | Falha por tenant: skip+log; 3 falhas consecutivas → alerta Super Admin |
| Observabilidade | `job.duration_ms`, `job.tenants_processed`, `job.participants_flagged`, `correlation_id` por tenant |
| Acessibilidade (a11y) | UI nova (Radar card + CelebrationBanner): contraste WCAG AA, ícone+texto, `aria-live`, `FormField`/`text-secondary` |
| Idioma | Código/logs em inglês; mensagens user-facing em PT-BR; vocabulário pastoral |

---

## 5. Migrations Necessárias

### Migration 1 — `User.last_seen_at`

**Status:** AUSENTE no schema atual — migration necessária.

```prisma
model User {
  // ... campos existentes ...
  lastSeenAt DateTime? @map("last_seen_at") @db.Timestamptz
}
```

> **Sub-dependência crítica:** O campo `last_seen_at` precisa ser **populado** para que a detecção de inatividade funcione. Sem um mecanismo de atualização, o campo permanece `null` para todos os usuários e o Critério B nunca dispara. O mecanismo de população é um item de clarify/plan (ver Seção 7, C1).

### Migration 2 — `Group.status` e `Group.breakUntil`

**Status:** Campo `status` presente no schema mas sem o valor `on_break` e sem `breakUntil` — migration necessária.

```prisma
enum GroupStatus {
  active
  on_break
}

model Group {
  // ... campos existentes ...
  status     GroupStatus @default(active)
  breakUntil DateTime?   @map("break_until") @db.Timestamptz
}
```

> **Nota RLS:** Migration tocando `groups` requer teste RLS em `apps/api/test/rls/`.

### Migration 3 — `ParticipantRadarStatus.riskReason` (a confirmar em clarify)

Para exibir o motivo do risco no Radar UI (FR66-06), pode ser necessário adicionar campo `riskReason: string?` ao `ParticipantRadarStatus`. A confirmar em clarify (C2) se o motivo é persistido no modelo ou derivado on-demand.

---

## 6. Schemas Zod (packages/types)

Novos arquivos:

- `packages/types/src/pastoral/risk-events.ts` — `RiskDetectedEventSchema` + `RiskResolvedEventSchema`
- `packages/types/src/__tests__/risk-events.snapshot.spec.ts` — snapshot tests (obrigatórios pelo CLAUDE.md)

---

## 7. Itens para Clarify

### C1 — Mecanismo de população de `last_seen_at` (OBRIGATÓRIO resolver no Plan)

A detecção de inatividade (Critério B) depende de `User.last_seen_at` ser atualizado. Opções candidatas:

1. **Auth guard / middleware:** Atualiza `last_seen_at` a cada request autenticado, com debounce via Redis (TTL ~5 min)
2. **Evento de presença/check-in:** Atualiza apenas quando participante registra presença ou acessa conteúdo
3. **Keycloak session event webhook:** Atualiza via webhook do Keycloak em eventos de login

Impacto: opção (1) maximiza precisão; opção (2) minimiza writes mas reduz cobertura para usuários que apenas "lêem" conteúdo sem registrar presença.

### C2 — Campo `riskReason` em `ParticipantRadarStatus`

Para mostrar o motivo no Radar UI (FR66-06):
1. Adicionar `riskReason: string?` ao `ParticipantRadarStatus` (persistência, 1 migration extra)
2. Derivar on-demand a partir dos dados de attendance/lastSeenAt (sem migration, mas query extra no UI)

### C3 — Endpoint `PATCH /api/v1/groups/:id` — infraestrutura existente?

Confirmar se há controller de grupos já implementado ou se o endpoint precisa ser criado do zero.

### C4 — Trigger da resolução de risco

O fluxo de resolução (retorno do participante) precisa de um ponto de trigger:
- O job diário também verifica resolução (polling)?
- Ou é evento síncrono (presença registrada → resolução imediata)?
- Ou ambos (resolução síncrona no registro de presença + job diário como backstop)?

---

## 8. Estrutura de Arquivos (proposta)

```
apps/api/src/
  modules/reports/
    services/
      evasion-detection.service.ts      (novo)
    jobs/
      detect-evasion-risk.processor.ts  (novo)
  pastoral/
    radar/
      radar-status.repository.ts        (estender para transição de risco)

packages/types/src/
  pastoral/
    risk-events.ts                      (novo)
    index.ts                            (atualizar exports)
  __tests__/
    risk-events.snapshot.spec.ts        (novo)

apps/api/prisma/
  migrations/
    YYYYMMDD_add_user_last_seen_at/
    YYYYMMDD_add_group_status_on_break/

apps/api/test/rls/
  groups-status.rls.spec.ts             (novo — migration tocando groups)
```

---

## 9. Success Criteria

| # | Critério | Verificação |
|---|----------|-------------|
| SC-01 | Job `detect-evasion-risk` executa diariamente às 06:00 UTC sem falhas | Log Pino `job.duration_ms` < 1.800.000 ms |
| SC-02 | Participante com 3+ ausências consecutivas → `amarelo` na 1ª detecção | Unit test: fixture 3 ausências |
| SC-03 | Participante com 2+ semanas sem acesso → `amarelo` na 1ª detecção | Unit test: `last_seen_at` = 15 dias atrás |
| SC-04 | Decisão manual do líder (últimas 24h) não é sobrescrita pelo job | Race condition test |
| SC-05 | `amarelo` → `vermelho` após +7 dias sem resolução | Unit test: flaggedAt = 8 dias atrás |
| SC-06 | Ausências em recesso não contam | Unit test: grupo `on_break` |
| SC-07 | Retorno: `vermelho` → `amarelo` na 1ª atividade | Unit test |
| SC-08 | Retorno: `amarelo` → `verde` após 2 presenças consecutivas | Unit test |
| SC-09 | Domain event `pastoral.participant.risk-detected` emitido com envelope correto | Integration test + snapshot Zod |
| SC-10 | Domain event `pastoral.participant.risk-resolved` emitido | Integration test |
| SC-11 | Falha em 1 tenant não para o job (outros processados) | Integration test |
| SC-12 | 3 falhas consecutivas num tenant → alerta Super Admin | Integration test |
| SC-13 | RLS: job não vaza dados entre tenants | RLS isolation test |
| SC-14 | Motivo do risco visível no card do participante no Radar UI | Playwright |
| SC-15 | `CelebrationBanner` exibido no retorno | Playwright |
| SC-16 | Snapshot tests dos schemas Zod passam | vitest |
| SC-17 | Gate a11y: contraste WCAG AA, `aria-live`, ícone+texto no UI novo | axe-core via CI |

---

## 10. Dependências

### Dependências Satisfeitas (Epic 7)

- `ParticipantRadarStatus` model com `RadarStatus` enum (`verde`/`amarelo`/`vermelho`)
- `PastoralNote` para care timeline
- Infraestrutura BullMQ em `queue:reports` (existente via histórico Epic 13)
- `RequestContext` / `AsyncLocalStorage` para multi-tenancy

### Dependências Ausentes — Migrations Necessárias

- `User.last_seen_at` — ausente, migration necessária (+ mecanismo de população)
- `Group.status ('active'|'on_break')` + `Group.breakUntil` — ausente, migration necessária

### Dependência Futura — Epic 14 (Notificações)

O consumer do evento `pastoral.participant.risk-detected` para envio de push ao líder é responsabilidade do Epic 14. Esta story entrega apenas o **produtor** do evento.

### Referências de Código Existente

- `apps/api/src/pastoral/radar/` — `radar-status.repository.ts`, `radar-calculator.service.ts`
- `apps/api/src/pastoral/pastoral.service.ts`, `pastoral.repository.ts`
- `apps/api/src/reports/reports.processor.ts` — padrão de job BullMQ existente
- `packages/types/src/pastoral/radar-constants.ts`, `alert.schema.ts`

---

## 11. Clarifications

### C1 — Mecanismo de população de `last_seen_at` (RESOLVIDO, score 3)

**Decisão:** Interceptor/middleware no ponto de saída do `KeycloakAuthGuard` atualiza `User.last_seen_at` de forma **assíncrona (fire-and-forget)** com debounce via Redis TTL 15 min (chave `cache:last-seen:{userId}`).

**Mecanismo:**
- Um NestJS interceptor global (ou hook no final do `KeycloakAuthGuard.canActivate()`) verifica se existe a chave Redis para o userId autenticado.
- Se a chave **não existir** (ou seja, passaram >15 min desde o último update): executa  de forma assíncrona ( — best-effort, não bloqueia a request).
- Se a chave **existir**: skip (debounce ativo).
- Grava a chave Redis com TTL de 15 min após cada write bem-sucedido.

**Alternativas rejeitadas:**
- Keycloak session event webhook: adiciona dependência externa não estabelecida na arquitetura
- Evento de presença/check-in apenas: perde cobertura para usuários que apenas lêem conteúdo sem registrar presença formal

**Impacto no Plan:** Migration 1 () + implementação do interceptor  (novo arquivo ) + registro global no .

---

### C2 — Campo `riskReason` em `ParticipantRadarStatus` (RESOLVIDO, score 3)

**Decisão:** Adicionar coluna `riskReason VARCHAR(500) NULL` ao modelo `ParticipantRadarStatus` (Migration 3). O job grava o motivo junto com o status no mesmo upsert.

**Formato do motivo:** String descritiva em PT-BR gerada pelo job, ex:
- 
- 

**Alternativa rejeitada:** Derivar on-demand exigiria query adicional de attendance + lastSeenAt a cada render do Radar UI — inconsistente com o padrão de modelo materializado do projeto e impacto desnecessário na latência do UI.

**Impacto no Plan:** Migration 3 (nova coluna + RLS test), atualização do  para incluir , atualização do schema Zod de resposta do Radar UI.

---

### C3 — Endpoint `PATCH /api/v1/groups/:id` para recesso (RESOLVIDO, score 3)

**Decisão:** O  **já existe** e **já implementa**  com , ,  e .

**Escopo da implementação (apenas extensão):**
1. Adicionar campos opcionais  e  ao  em 
2. Atualizar  para persistir  e  no banco
3. Adicionar validação:  é obrigatório quando 
4. **Não** criar novo controller, novo endpoint ou novo router

**Nota sobre Roles:** O endpoint existente usa . O líder de grupo () também deve poder marcar recesso — verificar se  cobre líderes ou se é necessário adicionar  ao método específico de recesso.

---

### C4 — Trigger de resolução de risco (RESOLVIDO, score 3)

**Decisão:** A resolução de risco é avaliada **no mesmo job diário ** (cron ). O job processa todos os participantes com status não-verde e verifica retorno de atividade.

**Lógica de resolução (no mesmo job):**
1. Para cada participante com : verificar se houve presença em reunião OU  recente (< 7 dias)
2. Se houve retorno: aplicar transição gradual:
   -  →  na 1ª atividade detectada
   -  →  após 2 presenças consecutivas verificadas
3. Emitir evento  quando  retorna a 
4. Exibir  ao líder (via domain event ou estado de UI)

**Alternativa rejeitada:** Real-time via event listener separado aumentaria complexidade arquitetural sem benefício UX claro — líderes consultam o Radar periodicamente, não em tempo-real.

---

## Histórico

| Data | Evento |
|------|--------|
| 2026-06-19 | Spec criada a partir de `13-3-deteccao-de-risco-de-evasao-fr66.md` + análise do `schema.prisma` |
| 2026-06-19 | Decisão: notificação deferida ao Epic 14 via domain event (operador delegou, não reabrir) |
| 2026-06-19 | Sub-dependência `last_seen_at` sinalizada como item de clarify/plan obrigatório (C1) |
| 2026-06-19 | Clarify concluído: C1-C4 resolvidos autonomamente (todos score 3/3) — nenhum bloqueio humano |
| 2026-06-19 | C1: interceptor Last-Seen + Redis debounce 15min via KeycloakAuthGuard |
| 2026-06-19 | C2: riskReason VARCHAR(500) NULL persistido em ParticipantRadarStatus (Migration 3 confirmada) |
| 2026-06-19 | C3: PATCH /api/v1/groups/:id já existe — extensão do UpdateGroupRequestSchema apenas |
| 2026-06-19 | C4: resolução de risco no mesmo job diário detect-evasion-risk (batch, não real-time) |

## 12. Clarificações Técnicas (resolvidas em checklist — 2026-06-19)

### CHK011-RES — Definição de "ausência" no Critério A (presenceType)

**Decisão:** Para o Critério A, **qualquer registro de `MeetingAttendance` com `presenceType` não-nulo conta como presença**, incluindo `presenceType='partial'` (presença parcial). A ausência é definida como: (a) ausência de linha em `MeetingAttendance` para o par `(userId, meetingId)`, OU (b) linha existente com `presenceType IS NULL`.

**Racional:** Presença parcial indica engajamento com o grupo — excluí-la da contagem de "presente" seria pastoralmente incorreto e geraria falsos positivos de risco para participantes que compareceram mesmo que parcialmente.

**Critério de teste (adição ao SC-02):** Fixture com participante que tem `presenceType='partial'` na reunião mais recente após 2 ausências consecutivas → NÃO deve ser flagged (2 ausências < 3).

### CHK030-RES — Granularidade de correlation_id

**Decisão:** `correlation_id` = **1 UUID v7 por execução de job** (não por tenant). Gerado no início do `processDetection()`. Incluso em TODOS os logs Pino daquela execução, independente do tenant sendo processado. Mapeado a `metadata.jobRunId` no envelope do domain event.

**Estrutura de log:** `{ level, msg, jobRunId: "<uuid-v7>", tenantId?: "<uuid>", ... }`

**Racional:** O `jobRunId` permite correlacionar todos os logs e eventos de uma execução específica do job — essencial para debug de falhas cross-tenant. O log de erro por tenant inclui ambos (`jobRunId` + `tenantId`) para isolamento.

