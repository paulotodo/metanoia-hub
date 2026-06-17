# Tasks — Relatório por Reunião (FR63)

**Feature:** `relatorio-reuniao`
**Epic:** 13 — Relatório por Reunião
**Story:** 13.1
**Pipeline SDD:** create-tasks → execute-task → review-task
**Gerado em:** 2026-06-17 (onda-005, dec-022)

---

## Legenda de criticidade

| Tag | Significado |
|-----|-------------|
| `[crit]` | Crítica — bloqueia AC de segurança/multi-tenant/autorização; não pode ser pulada |
| `[alta]` | Alta prioridade — AC funcional obrigatório do MVP |
| `[media]` | Média — qualidade, a11y, testes de regressão |
| `[baixa]` | Baixa / nice-to-have — pode ficar fora do MVP |

---

## Escopo Coberto

- Tipos Zod para relatório FR63 (`packages/types`) com snapshot tests
- Extensão do `ReportService` / `ReportController` (Story 5.6) para visão líder FR63
- Mitigação S1 completa: chave Redis prefixada por tenant + bind `tenantId`/`requesterUserId` em `getJobStatus`/`setJobStatus` cobrindo `kind:meeting` E `kind:track` (CHK035)
- Endpoint `POST /api/v1/meetings/:id/report/export` → 202 + BullMQ job `export-meeting-csv`
- Worker `reports.processor.ts` — novo branch `export-meeting-csv`
- Endpoint de polling `GET /api/v1/reports/jobs/:jobId` endurecido (S1)
- CSV export com BOM UTF-8, colunas PT-BR, signed URL 1h
- UI acessível: badges ícone+texto, contraste WCAG AA, charts com aria-label+tabela, CTA pastoral, FormField (Story 12.5)
- Cadência de polling recomendada (CHK040) — documentação + header `Retry-After`
- Comportamento para reuniões acima do alvo ≤50/≤200 (CHK041) — limite documentado + resposta `X-Report-Truncated`
- ADMIN_TENANT vê todas as reuniões do tenant (CHK008, dec-010)
- Testes: RLS (se houver migration), autorização cross-tenant (SC-08), regressão polling trilhas (CHK035), snapshot Zod, unit service, E2E

## Escopo Excluído

- Nova migration Prisma (não há tabela nova; dados em Redis + `meeting_reports` existente)
- Relatório pessoal (Participante) — já implementado em Story 5.6, não é FR63
- Export pessoal CSV de 1 linha para Participante — fora do escopo FR63
- Nice-to-have: sparkline de tendência (FR-10) — task opcional marcada `[baixa]`
- Alias URL `/exports/:exportId` — fora do MVP
- Paginação para reuniões >50 participantes no MVP — limite documentado, paginação é tech debt R2

---

## Matriz de Dependências

```text
FASE 1 (Tipos Zod)
  1.1 → base: nada
  1.2 → requer 1.1

FASE 2 (Backend Report)
  2.1 → requer 1.1
  2.2 → requer 2.1
  2.3 → requer 2.1

FASE 3 (Backend Export + Mitigação S1)
  3.1 → requer 1.2  [CRÍTICO — S1]
  3.2 → requer 3.1  [CRÍTICO — S1]
  3.3 → requer 3.1, 1.2
  3.4 → requer 3.3, 3.2
  3.5 → requer 3.2  [CHK040]
  3.6 → requer 2.1  [CHK041]

FASE 4 (Frontend UI)
  4.1 → requer 2.2 (endpoint report)
  4.2 → requer 4.1
  4.3 → requer 3.3, 3.4 (export endpoint)
  4.4 → requer 4.1  [CHK024]
  4.5 → requer 4.1  [baixa — nice-to-have]

FASE 5 (Testes)
  5.1 → requer 1.1, 1.2
  5.2 → requer 2.1, 2.2, 2.3  [CRÍTICO — SC-08]
  5.3 → requer 3.1, 3.2  [CRÍTICO — S1 / CHK035]
  5.4 → requer 4.1, 4.2, 4.3, 4.4
  5.5 → requer 3.4 (E2E export)
```

---

## Resumo

| Fase | Descrição | Tasks | Críticas |
|------|-----------|-------|----------|
| FASE 1 | Tipos Zod + snapshot | 2 | — |
| FASE 2 | Backend relatório (estender Story 5.6) | 3 | — |
| FASE 3 | Backend export + mitigação S1 + gaps | 6 | 3.1, 3.2 |
| FASE 4 | Frontend UI acessível | 5 | — |
| FASE 5 | Testes (unit, integ, E2E, RLS) | 5 | 5.2, 5.3 |
| **Total** | | **21** | **4** |

---

## FASE 1 — Tipos Zod (packages/types)

### 1.1 Zod schemas para relatório FR63 [alta]

- [x] Criar `packages/types/src/meeting-report.ts` com:
  - `EngagementLevelSchema` — enum `z.enum(['low','medium','high'])`
  - `MeetingReportParticipantSchema` — campos: `userId`, `name`, `email`, `status` (Presente/Parcial/Ausente), `joinedAt` (ISO 8601 | null), `leftAt` (ISO 8601 | null), `durationSeconds` (int ≥ 0), `engagementScore` (0..1 | null), `engagementLevel` (EngagementLevel | null)
  - `MeetingReportMetricsSchema` — campos: `totalParticipants`, `presentCount`, `partialCount`, `absentCount`, `attendanceRate` (0..1), `avgEngagementScore` (0..1 | null), `avgEngagementLevel` (EngagementLevel | null)
  - `MeetingLeaderReportResponseSchema` — envelope: `{ data: { meetingId, metrics: MeetingReportMetrics, participants: MeetingReportParticipant[], generatedAt } }`
  - Exportar todos os tipos inferidos via `export type`
- [x] Adicionar re-exportação em `packages/types/src/index.ts`
- [x] Verificar que não há conflito com `MeetingReportSummary` existente (Story 5.6)

### 1.2 Estender ReportExportJobPayload + snapshot tests [alta]

- [x] Em `packages/types/src/reports/index.ts`, transformar `ReportExportJobPayload` em união discriminada:
  ```ts
  export type ReportExportJobPayload =
    | { kind: 'trail'; jobId: string; tenantId: string; trailId: string; trailName: string; requestedBy: string; userIds: string[] }
    | { kind: 'meeting'; jobId: string; tenantId: string; meetingId: string; requesterUserId: string; canSeeFull: boolean }
  ```
- [x] Atualizar todos os usos de `ReportExportJobPayload` no código existente para discriminar por `kind`:
  - `reports.processor.ts` — branch `export-trail-csv` deve fazer `(payload as Extract<..., {kind:'trail'}>)`
  - `reports.service.ts::processExportJob` — tipar como `Extract<ReportExportJobPayload, {kind:'trail'}>`
- [x] Criar `packages/types/src/__tests__/meeting-report.snapshot.spec.ts` com snapshot tests para todos os schemas novos (Vitest `expect(schema.parse(fixture)).toMatchSnapshot()`)
- [x] Criar `packages/types/src/__tests__/reports-payload.snapshot.spec.ts` — snapshot da união discriminada, fixture para `kind:'trail'` e `kind:'meeting'`

---

## FASE 2 — Backend: Extensão do relatório (meetings/reports/)

### 2.1 ReportService: mapear visão líder FR63 [alta]

- [x] Em `apps/api/src/meetings/reports/report.service.ts`, estender `findForUser` para o caminho `canSeeFull=true`:
  - Retornar `MeetingLeaderReportResponse` conforme contrato FR63:
    - `metrics`: calcular `totalParticipants`, `presentCount`, `partialCount`, `absentCount`, `attendanceRate`, `avgEngagementScore`, `avgEngagementLevel` a partir de `summary.attendees`
    - `participants`: mapear cada attendee para `MeetingReportParticipant` FR63, incluindo `name` e `email` (join com tabela de usuários — ver Decision 6 em research.md; buscar via `UserRepository` ou query direta com `withTenantTx`)
    - `generatedAt`: do `MeetingReport.generatedAt`
  - Manter backward compat para `kind:'personal'` (não alterar)
- [x] Calcular `engagementScore` por participante segundo FR-03:
  - `presenceFrac = durationSeconds / meetingDurationSeconds` (clamped 0..1)
  - `cameraFrac = cameraOnSeconds / durationSeconds` (0 se duration=0)
  - `score = 0.7 * presenceFrac + 0.3 * cameraFrac`
  - Classificar em `EngagementLevel`: low (<0.4), medium (0.4..0.75), high (>0.75)
- [x] Fonte de `meetingDurationSeconds`: campo `duration_seconds` da tabela `meetings` (via `MeetingsRepository`)
- [x] Garantir ADMIN_TENANT vê todos os participantes do tenant (CHK008, dec-010): `canSeeFull=true` sem bind por grupo — já garantido pelo `adminShortcut` em `report.controller.ts`, apenas confirmar que o service não filtra por groupId quando `canSeeFull=true`

### 2.2 ReportController: endpoint GET atualizado [alta]

- [x] Em `apps/api/src/meetings/reports/report.controller.ts`, adaptar resposta do `getReport` para retornar `MeetingLeaderReportResponse` quando `kind:'full'`:
  - Response body: `{ data: MeetingLeaderReportResponse, meta: { view: 'full' | 'personal', generatedAt } }`
  - Manter `kind:'personal'` sem alteração
- [x] Adicionar `@ApiResponse` / Swagger annotations com tipo correto (OpenAPI)
- [x] Adicionar endpoint `POST /api/v1/meetings/:id/report/export` neste controller (ou criar `report-export.controller.ts` no mesmo módulo):
  - `@Roles(Role.LIDER, Role.ADMIN_TENANT)` — Participante recebe 403
  - Calcular `canSeeFull` (mesmo helper); se `canSeeFull=false` → 403
  - Enfileirar job `export-meeting-csv` na fila `queue:reports` com payload `{kind:'meeting', jobId, tenantId, meetingId, requesterUserId, canSeeFull}`
  - Gravar status inicial `processing` via `ReportsService.setJobStatus` — APÓS S1 implementado (task 3.2)
  - Retornar `202 { data: { jobId, message: 'Export em processamento' } }`
  - Idempotência: se já existe job `processing` para o mesmo `(tenantId, meetingId, requesterUserId)` nos últimos 5min, retornar o `jobId` existente

### 2.3 Unit tests do ReportService FR63 [alta]

- [x] Em `apps/api/src/meetings/reports/__tests__/report.service.spec.ts`, adicionar testes:
  - `findForUser` com `canSeeFull=true` retorna `MeetingLeaderReportResponse` com campos corretos
  - Cálculo de `engagementScore` — 3 fixtures: presença total+câmera alta, presença parcial+câmera zero, ausente
  - `avgEngagementLevel` calculado corretamente para cada combinação
  - ADMIN_TENANT (`canSeeFull=true`) recebe todos os participantes do tenant sem filtro de grupo

---

## FASE 3 — Backend: Export CSV + Mitigação S1 [crit]

### 3.1 Mitigação S1 — Chave Redis prefixada por tenant (cobertura meeting+track) [crit]

**CRÍTICO — SC-08 + FR-07.1 + CHK035: cobre AMBOS `kind:meeting` e `kind:track`**

- [x] Em `apps/api/src/reports/reports.service.ts`:
  - Alterar `EXPORT_JOB_KEY_PREFIX` de `'cache:reports:export-job'` para manter o nome; alterar a construção da chave:
    - Chave nova: `cache:reports:export-job:<tenantId>:<jobId>`
    - Chave antiga (retrocompat): `cache:reports:export-job:<jobId>`
  - **`setJobStatus`**: adicionar parâmetro `tenantId: string`; construir chave com prefixo tenant: `${EXPORT_JOB_KEY_PREFIX}:${tenantId}:${jobId}`; armazenar `requesterUserId` no JSON do job para validação no `getJobStatus`
  - **`getJobStatus`**: adicionar lógica de autorização:
    ```
    1. Derivar tenantId do RequestContext (AsyncLocalStorage)
    2. Derivar userId do RequestContext
    3. Ler chave prefixada: cache:reports:export-job:<tenantId>:<jobId>
    4. Se não encontrar → NotFoundException('Job não encontrado') — não tentar chave sem prefixo
    5. Se job.requesterUserId !== userId E role não é ADMIN_TENANT → NotFoundException (não 403; não vaza existência)
    6. ADMIN_TENANT do mesmo tenant → pode ler qualquer job do tenant (sem bind por requester)
    ```
  - Expor `setJobStatus` como método público (necessário para o `ReportController` chamar ao enfileirar job meeting) — manter privado internamente se possível via método auxiliar público `enqueueJobStatus(jobId, tenantId, requesterUserId)`
- [x] Atualizar `processExportJob` (trilhas) para chamar `setJobStatus` com `tenantId` do payload (já presente em `ReportExportJobPayload.kind:'trail'`)
- [ ] **NÃO remover** suporte à chave antiga em produção sem migration script (registrar como tech debt se necessário); para MVP/teste, a chave nova é a canônica

### 3.2 ReportsController: endpoint polling endurecido [crit]

**CRÍTICO — S1: bind tenantId + requesterUserId + papel ADMIN_TENANT**

- [x] Em `apps/api/src/reports/reports.controller.ts`, no handler `GET /reports/jobs/:jobId`:
  - Remover (ou complementar) a leitura ingênua sem tenant; delegar ao `getJobStatus` endurecido (task 3.1)
  - O controller NÃO deve passar `tenantId`/`userId` como parâmetro ao service — o service deriva do `RequestContext`
  - Adicionar `@Roles(Role.LIDER, Role.ADMIN_TENANT)` se não presente
  - Response permanece `200 { data: ExportJobStatusInner }` (contrato existente intacto)
  - Adicionar header `Retry-After: 3` na resposta com status `processing` (CHK040 — cadência mínima de polling)
- [x] Adicionar `@ApiResponse(404)` no Swagger com descrição "Job não encontrado ou sem permissão de acesso"

### 3.3 BullMQ worker: branch export-meeting-csv [alta]

- [x] Em `apps/api/src/reports/reports.processor.ts`, adicionar branch no worker:
  ```ts
  if (job.name === 'export-meeting-csv') {
    await this.reportsService.processMeetingExportJob(
      job.data as Extract<ReportExportJobPayload, { kind: 'meeting' }>
    );
  }
  ```
- [x] Em `reports.service.ts`, implementar `processMeetingExportJob(payload)`:
  - Derivar participantes via `withTenantTx` sobre `meetingAttendance` + join `users` (nome+email)
  - Calcular `engagementScore` por participante (mesma lógica de task 2.1)
  - Mapear para CSV rows: `Nome, Email, Status, Hora de entrada, Hora de saída, Duração (min), Score de engajamento`
  - BOM UTF-8 (`REPORTS_CSV_BOM`), separador `,`, linhas `\r\n`; Status PT-BR: Presente/Parcial/Ausente
  - `upload` para `StorageService` com `objectKey = exports/meeting-<meetingId>-<dateStr>-<jobId>.csv`
  - `getSignedUrl` com TTL `REPORTS_JOB_TTL_SECONDS` (3600s = 1h)
  - `setJobStatus(jobId, tenantId, 'completed', signedUrl, expiresAt)`
  - Em caso de erro: `setJobStatus(jobId, tenantId, 'failed', null, null, err.message)`

### 3.4 Endpoint POST export (enfileirar job) [alta]

- [x] Implementar `POST /api/v1/meetings/:id/report/export` (via task 2.2 se no mesmo controller, ou novo `ReportExportController`):
  - Autorização: `@Roles(Role.LIDER, Role.ADMIN_TENANT)`; `canSeeFull` calculado; se `false` → 403
  - Gerar `jobId = generateId()` (UUID v7)
  - Enfileirar `queue.add('export-meeting-csv', payload, { attempts:3, backoff:{type:'exponential',delay:2000} })`
  - Chamar `setJobStatus(jobId, tenantId, 'processing', null, null)` — via método público do `ReportsService`
  - Retornar `202 { data: { jobId, message: 'Export em processamento' } }`
- [x] Adicionar ao `ReportModule` (ou `ReportsModule`) a injeção de `ReportsService` se não presente
- [x] Swagger: `@ApiAcceptedResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse`

### 3.5 Documentar cadência de polling (CHK040) [media]

- [ ] Adicionar comentário JSDoc no endpoint `GET /reports/jobs/:jobId` e no contrato `contracts/export.md`:
  - Intervalo mínimo recomendado: **3 segundos** (header `Retry-After: 3` no status `processing`)
  - Backoff exponencial sugerido ao cliente: 3s → 6s → 12s → máx 30s
  - Máximo de tentativas sugerido: **20** (cobrindo até 10min de processamento)
  - Acima de 20 tentativas sem resultado, cliente deve considerar o job falho e exibir mensagem ao usuário
- [x] Adicionar header `Retry-After` na resposta `200` com `status:'processing'` (task 3.2)
- [ ] Documentar no `quickstart.md` o fluxo de polling recomendado para o cliente

### 3.6 Documentar limite de carga e comportamento acima do alvo (CHK041) [media]

- [ ] Definir e documentar nos artefatos (`spec.md`, `quickstart.md`, comments do service):
  - **Relatório GET**: suporta reuniões até **200 participantes** no MVP; acima disso, service retorna os primeiros 200 ordenados por `status asc, name asc` + header `X-Report-Truncated: true` e `meta.truncated: true`
  - **Export CSV**: sem limite no MVP (BullMQ processa assíncronamente; latência aumenta linearmente); documentar que reuniões >500 participantes podem levar >30s
  - **CHK042 (ADMIN_TENANT + limite)**: por decisão de produto (default MVP), ADMIN_TENANT vê todos os participantes do tenant na reunião sem paginação adicional; limite de 200 aplica igualmente para a visão do ADMIN_TENANT no GET síncrono; o export CSV não tem limite
- [ ] Implementar truncation no `ReportService.findForUser` para `canSeeFull=true`:
  - Se `participants.length > 200`, ordenar e fatiar; incluir `meta.truncated: true` na resposta

---

## FASE 4 — Frontend: UI acessível (apps/web)

### 4.1 Componente MeetingReportPage — estrutura e métricas [alta]

- [x] Criar página Server Component `apps/web/src/app/(authenticated)/meetings/[id]/report/page.tsx`:
  - Fetch via `GET /api/v1/meetings/:id/report` com `Authorization` do token Keycloak SSR
  - Renderizar seção de **métricas agregadas**: total de participantes, taxa de presença, score médio de engajamento
  - Renderizar tabela de participantes com colunas: Nome, Status, Duração, Score de Engajamento
  - Badge de status com **ícone + texto** (não somente ícone ou cor): ex. "Presente ✓", "Parcial ⚠", "Ausente ✗" — conformar com gate a11y permanente (Epic 12)
  - Usar tokens de cor semânticos (`text-primary`, `text-secondary`) — evitar `text-muted` (tech debt R2); contraste WCAG AA 4.5:1 mínimo para todos os pares texto/fundo (CHK018 — todos os pares, não só token secundário)
  - Destaque de ausentes: CTA pastoral "Entrar em contato" abaixo da lista de ausentes (FR-09); ver task 4.4 para a11y do CTA

### 4.2 Tabela de participantes com a11y completa [media]

- [x] Implementar `<table>` HTML semântico com `<caption>`, `<thead>`, `<tbody>`:
  - `scope="col"` em cada `<th>`
  - Cada badge de status: `<span aria-label="Presente">✓ Presente</span>` (texto visível)
  - Score de engajamento: `<span aria-label="Score de engajamento: 0.82">0.82</span>` ou célula descritiva
  - Linha de ausente: `aria-label` descritivo na célula de ação
- [ ] Reusar `FormField` de Story 12.5 para inputs de filtro (se houver campo de busca/filtro na página)
- [x] Garantir navegação por teclado na tabela (sem interceptação de teclas)
- [ ] Verificar contraste de todos pares texto/fundo (CHK018): usar Storybook ou axe-core local antes de PR

### 4.3 Fluxo de export CSV no cliente [alta]

- [x] Criar `ExportReportButton` (Client Component) com:
  - Botão "Exportar CSV" — dispara `POST .../report/export` → recebe `jobId`
  - Estado de polling: exibe progress indicator acessível (`role="status"`, `aria-live="polite"`)
  - Polling a cada **3s** (conformar com CHK040); backoff: se `Retry-After` presente no header, respeitar
  - Máximo 20 tentativas; após timeout → mensagem de erro
  - Ao completar (`status:'completed'`): exibir link para download (`signedUrl`) com texto "Baixar CSV" + atributo `download`
  - Ao falhar: mensagem de erro em PT-BR com `role="alert"`
- [x] Usar TanStack Query (Client Component) para gerenciar polling com `refetchInterval`
- [x] Guardar `jobId` em estado local (não em Zustand — escopo de componente)

### 4.4 A11y CTA pastoral (CHK024) [media]

- [x] Seção de ausentes com CTA "Entrar em contato":
  - Se nenhum ausente: ocultar CTA completamente (`hidden` ou não renderizar) — não usar `disabled` para elemento desnecessário
  - Se há ausentes mas usuário não tem permissão: usar `aria-disabled="true"` + `tabIndex={-1}` no botão para remover do tab order + `aria-describedby` apontando para `<span id="cta-hint">Você não tem permissão para esta ação</span>` (anúncio para leitor de tela); NÃO apenas mudar opacidade/cor
  - Se há ausentes e usuário tem permissão: botão normal com `aria-label="Iniciar contato pastoral com N ausentes"`
- [ ] Testar com leitor de tela (VoiceOver/NVDA) e documentar achado nos PR notes

### 4.5 Sparkline de tendência de presença (FR-10) [baixa]

**Nice-to-have — pode ser entregue em iteração posterior ao MVP.**

- [ ] (Opcional) Se FR-10 for renderizado, implementar mini-gráfico de tendência das últimas N reuniões do grupo:
  - Dados do endpoint (extensão futura — não existe no MVP)
  - Sparkline (chart library ou SVG puro) com `aria-label="Tendência de presença: últimas N reuniões"` + tabela acessível equivalente (CHK021 — obrigatória se o gráfico renderizar)
  - Tabela equivalente: colunas Data, Taxa de Presença — visível ou via `<details>` acessível
- [ ] Se FR-10 não for implementado no MVP, remover o componente placeholder

---

## FASE 5 — Testes

### 5.1 Snapshot tests dos schemas Zod [alta]

- [ ] `packages/types/src/__tests__/meeting-report.snapshot.spec.ts`:
  - Snapshot de `MeetingReportParticipantSchema.parse(fixture)` com fixture de presença completa
  - Snapshot de `MeetingReportMetricsSchema.parse(fixture)` com fixture de grupo de 10 membros
  - Snapshot de `MeetingLeaderReportResponseSchema.parse(fixture)` com fixture completa
  - Snapshot de `ReportExportJobPayload` variante `kind:'meeting'`
  - Snapshot de `ReportExportJobPayload` variante `kind:'trail'` (regressão — garantir que trilha não quebrou)
- [x] Rodar `pnpm --filter @metanoia/types test` para confirmar snapshots gerados

### 5.2 Testes de autorização cross-tenant — SC-08 [crit]

**CRÍTICO — SC-08 + FR-07.1: teste determinístico de isolamento**

- [x] Em `apps/api/src/reports/reports.service.spec.ts` ou arquivo dedicado `reports.auth.spec.ts`:
  - **Cenário A — cross-tenant**: líder A (tenantT1) cria job → líder A de tenantT2 tenta ler → espera `NotFoundException` (404 semântico)
  - **Cenário B — intra-tenant cross-requester**: líder A (tenantT1) cria job → líder B (mesmo tenantT1, grupo diferente) tenta ler → espera `NotFoundException`
  - **Cenário C — ADMIN_TENANT mesmo tenant**: ADMIN_TENANT do tenantT1 lê job de líder A do tenantT1 → espera `200` com dados corretos
  - **Cenário D — proprietário**: líder A lê seu próprio job → espera `200`
  - Usar mocks de `RedisService` e `getRequestContext` para simular contextos diferentes por teste
- [x] Garantir que a chave Redis prefixada por tenant é usada em todos os cenários (assert `redis.get` chamado com `cache:reports:export-job:<tenantId>:<jobId>`)

### 5.3 Regressão polling de trilhas (CHK035) [crit]

**CRÍTICO — CHK035: garantir que a mudança de chave Redis não quebra export de trilhas**

- [x] Em `apps/api/src/reports/reports.service.spec.ts`:
  - Cenário: enfileirar `export-trail-csv` → `processExportJob` grava status com chave `cache:reports:export-job:<tenantId>:<jobId>` (nova chave com tenant)
  - `getJobStatus` pelo proprietário do job de trilha → espera `200` com dados corretos
  - Verificar que a chave gravada contém o `tenantId` correto (assert no mock Redis)
- [ ] Em `apps/api/src/reports/reports.processor.spec.ts` (criar se não existir):
  - Testar que `job.name === 'export-trail-csv'` despacha para `processExportJob`
  - Testar que `job.name === 'export-meeting-csv'` despacha para `processMeetingExportJob`
  - Testar que job name desconhecido não dispara nenhum dos dois (no-op seguro)
- [x] Confirmar que nenhum teste existente de trilhas quebrou após a mudança da assinatura de `setJobStatus`

### 5.4 Testes de UI acessível (axe-core + E2E) [media]

- [ ] Em `apps/web/e2e/meetings/report.e2e-spec.ts` (criar):
  - Navegar para `/app/meetings/:id/report` como líder → validar que página renderiza métricas e tabela
  - Rodar `axe(page)` (gate a11y permanente Epic 12) → nenhuma violação `critical` ou `serious`
  - Verificar que badge de status contém texto visível (não somente ícone)
  - Verificar que CTA pastoral tem `aria-label` com contagem de ausentes
- [ ] Adicionar `report.e2e-spec.ts` ao manifesto de testes E2E do CI (`a11y-checks.yml`)

### 5.5 Teste E2E do fluxo de export [media]

- [ ] Em `apps/web/e2e/meetings/report-export.e2e-spec.ts` (criar):
  - Mock do BullMQ (retornar job completed imediato em CI)
  - Clicar "Exportar CSV" → verificar `202` recebido → polling → verificar link de download aparece
  - Verificar que Participante comum recebe `403` ao tentar exportar
  - Verificar mensagem de erro quando polling atinge 20 tentativas (mock `processing` indefinido)
