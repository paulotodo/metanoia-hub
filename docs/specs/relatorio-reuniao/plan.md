# Plano de Implementação — Relatório por Reunião (FR63)

**Feature**: relatorio-reuniao | **Épico**: epic-13 | **Spec**: `spec.md` (Clarified)
**Story autoritativa**: `_bmad-output/implementation-artifacts/13-1-relatorio-por-reuniao-fr63.md`

## Summary

Entregar o **Relatório por Reunião (FR63)**: o líder/admin visualiza, por
reunião concluída, métricas de presença e um **score de engajamento** por
participante (`participantDuration / meetingDuration`, clamp 0..1; classificado
alto≥0.75 / médio 0.50–0.74 / baixo<0.50), com export CSV assíncrono.

**Abordagem técnica** (validada por sonda empírica do código real):
- **ESTENDER** o módulo existente `apps/api/src/meetings/reports/` (Story 5.6),
  que já tem o endpoint `GET /api/v1/meetings/:id/report`, autorização
  role-shaped (full/personal, admin shortcut) e o summary persistido
  `MeetingReport.summary`. FR63 adiciona: enriquecimento de nomes/email (join
  User), campos derivados `engagementScore`/`engagementLevel`, e o agregado de
  métricas do relatório de líder.
- **REUSAR** a infraestrutura de export assíncrono de `apps/api/src/reports/`
  (fila BullMQ `queue:reports`, `processExportJob`, Redis
  `cache:reports:export-job:*`, `StorageService.upload`+`getSignedUrl`,
  `REPORTS_CSV_BOM`, `REPORTS_JOB_TTL_SECONDS=3600`), adicionando o job
  `export-meeting-csv` ao worker existente.
- **NÃO** há migration nem nova tabela; novos artefatos de dados são apenas
  DTOs Zod em `packages/types` com snapshot tests.
- **Frontend**: criar a página acessível `/app/gestao/meetings/:id/report`.

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript (`strict:true`) — Next.js 16.2 (web), NestJS 11 (api) |
| Persistência | PostgreSQL + Prisma v7, RLS multi-tenant (sem migration nesta feature) |
| Cache/Jobs | Redis + BullMQ (fila `reports` existente) |
| Storage | MinIO via `StorageService` (bucket `metanoia-storage`, prefixo `exports/`) |
| Auth | Keycloak (roles) → NestJS Guards → RLS; `AsyncLocalStorage`/`RequestContext` |
| Contratos | Zod em `packages/types` (`meeting-report.ts`, `reports/index.ts`) + snapshot |
| Testing | Vitest (unit/integration), Playwright (e2e), RLS specs em `apps/api/test/rls/` |
| Frontend state | Server Components + `fetch` nativo; Client Components com TanStack p/ polling |
| NEEDS CLARIFICATION restantes | 0 |

## Constitution Check

*GATE: passou antes do Phase 0; re-checado pós Phase 1 (ver §Re-check).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | PASS | `tenant_id` via `AsyncLocalStorage`/`withTenantTx`; RLS isola leitura e export; teste de isolamento C12 em `apps/api/test/rls/`. Sem migration → sem alteração de policy. |
| II. Type-safety & UUID v7 | PASS | TS strict; `jobId` via `generateId()`; sem novos `@default(uuid())`. Datas ISO 8601, nulls explícitos. |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs em inglês; user-facing PT-BR em `apps/web/messages/pt-BR.json` (chaves `postMeetingReport` já existem); CTA "Cuidar", vocabulário pastoral. |
| IV. Contratos API padronizados | PASS | Envelope `{data,meta?}`; export 202; polling 200; Zod em `packages/types`; prefixo `/api/v1/`. |
| V. Separação de estado FE | PASS | Página relatório SSR via `fetch`; polling do export em Client Component com TanStack Query (server state); sem mistura com Zustand. |
| VI. Qualidade Verificável | PASS | unit + integration + RLS spec + snapshot Zod; WCAG AA (axe-core, C13); CI verde antes de done. |
| VII. Entrega Auditável | PASS | 1 story = 1 branch = 1 PR; conventional commits PT-BR. |

Nenhuma violação de princípio MUST. **Complexity Tracking**: N/A (sem violações).

## Project Structure

### Documentação (feature dir)
```
docs/specs/relatorio-reuniao/
├── spec.md            (Clarified)
├── plan.md            (este arquivo)
├── research.md        (Phase 0 — 6 decisões)
├── data-model.md      (Phase 1 — entidades reusadas + DTOs novos)
├── quickstart.md      (Phase 1 — 15 cenários de teste)
└── contracts/
    ├── meeting-report.md   (GET report — visão líder/personal)
    └── export.md           (POST export + polling + worker + CSV)
```

### Código-fonte (árvore real — pontos de toque)
```
apps/api/src/meetings/reports/        # ESTENDER (Story 5.6)
├── report.controller.ts              # + POST :id/report/export (202); GET enriquecido
├── report.service.ts                 # + deriveEngagement(); + buildLeaderReport(); join User
├── report.repository.ts              # + leitura join User/GroupMember (nome/email)
└── __tests__/report.service.spec.ts  # + casos engagementLevel, métricas, personal enriquecido

apps/api/src/reports/                 # REUSAR (export trilhas)
├── reports.processor.ts              # + branch job.name==='export-meeting-csv'
└── reports.service.ts                # + processMeetingExportJob() (ou método dedicado)

packages/types/src/
├── meeting-report.ts                 # + EngagementLevel, MeetingReportParticipant,
│                                     #   MeetingReportMetrics, MeetingLeaderReportResponse,
│                                     #   attendee enriquecido
├── reports/index.ts                  # + variante meeting no ReportExportJobPayload
└── __tests__/meeting-report.snapshot.spec.ts  # + snapshots dos novos schemas

apps/web/app/(authenticated)/app/gestao/reunioes/[meetingId]/relatorio/   # CRIAR
├── page.tsx                          # Server Component (fetch report) + summary card + lista
│                                     # URL real: /app/gestao/reunioes/:meetingId/relatorio
│                                     # (espelha o padrao existente .../relatorios/trilhas/[trailId])
└── _components/                      # participant-list, export-button (Client, polling), sparkline

apps/web/messages/pt-BR.json          # + chaves do relatório de líder (reusa postMeetingReport)
apps/api/test/rls/meeting-report-leader.rls-spec.ts   # CRIAR (espelha meeting-reports.rls-spec.ts)
apps/web/e2e/...meeting-report.spec.ts  # rota /app/gestao/reunioes/:meetingId/relatorio                 # CRIAR (acessibilidade C13/C15)
```

## Decisões de Plano (resumo — detalhe em research.md)

1. Estender `meetings/reports/`, não duplicar (dec-001 read-back / Decision 1).
2. `engagementScore`/`engagementLevel` são **derivados no read-path**, não
   persistidos no summary JSON (Decision 2). Preserva o `avgEngagementScore`
   blend da Story 5.6.
3. Export reusa `queue:reports` + Redis + StorageService (dec-008/009, Decision 3).
4. Polling reusa `GET /api/v1/reports/jobs/:jobId` existente; sem novo endpoint
   `/exports/:id` no MVP (Decision 4).
5. Export restrito a gestão (403 p/ Participante); CSV é visão completa com PII
   (Decision 5).
6. Nomes/email via join User; fallback `MeetingParticipantRecord.name` (Decision 6).

## Convenções de Borda

Feature multi-camada (DB ↔ NestJS ↔ Next.js ↔ CSV). Fonte da verdade por convenção:

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | `@map`/`@@map` no Prisma | `apps/api/prisma/schema.prisma` |
| Prisma model fields (TS) | camelCase | tipos gerados Prisma | `@prisma/client` |
| Backend DTO / API payload | camelCase | Zod parse | `packages/types/src/meeting-report.ts`, `reports/index.ts` |
| Frontend DTO | camelCase | Zod parse no fetch | re-export de `@metanoia/types` |
| URL path/params | kebab-case (`/report/export`) | NestJS router | `report.controller.ts` |
| CSV header | rótulos PT-BR | layout fixo | `contracts/export.md` |
| Redis key | `cache:reports:export-job:<jobId>` | constante | `reports.service.ts` |

**Mapper layer (DB ↔ DTO)**: ORM auto-mapping = SIM (Prisma `@map`/`@@map`).
Não há mapper manual; o serviço transforma `MeetingReportSummary` (persistido) +
attendance em DTOs FR63 (derivação de engagement + join de nomes).

**Validação Zod**: response validada em ambos os lados (NestJS na escrita do
summary já usa `MeetingReportSummarySchema`; o consumidor web faz `.parse` no
fetch — C14). Schema compartilhado em `packages/types` (`@metanoia/types`).

## Riscos & Mitigações

| Risco | Mitigação |
|-------|-----------|
| Drift snake_case↔camelCase BE↔FE | Roundtrip E2E obrigatório (C14) com `.parse` do payload real. |
| PII no CSV (nome/email/horários) | Export só para gestão (403 Participante); signed URL 1h; sem ACL pública; link local. |
| **IDOR no polling `/reports/jobs/:jobId` (HIGH — A01/API1 BOLA)** | **Finding confirmado por sonda**: `ReportsService.getJobStatus(jobId)` lê `cache:reports:export-job:<jobId>` **sem prefixo de tenant e sem bind ao requester** — só o `@Roles(ADMIN_TENANT,LIDER)` protege. Qualquer líder pode pollar QUALQUER jobId e obter a `signedUrl` de um CSV com PII de outro grupo/tenant. **Mitigação OBRIGATÓRIA no MVP (não diferível)**: gravar `tenantId` + `requesterUserId` no payload do job status e validar no `getJobStatus` contra o `RequestContext` (tenant) + `ctx.userId`; chave Redis com prefixo de tenant (`cache:reports:export-job:<tenantId>:<jobId>`). Sem isso, FR63 herda a vulnerabilidade. |
| `avgEngagementScore` confundido (blend vs ratio FR63) | FR63 usa ratio simples derivado; o blend Story 5.6 permanece separado e não é exposto como engagement FR63. |
| Usuário removido (join vazio) | Fallback `MeetingParticipantRecord.name`; email pode ser null. |
| Reunião sem presença / sem report | 200 vazio (C4) / 404 (C5) — comportamentos já especificados. |

## Gate de Segurança (owasp-security) — resultado

Gate executado sobre o design (OWASP Top 10:2025 A01/A04, API1 BOLA, API3 BOPLA,
exposição de PII). Findings:

| # | Sev | OWASP | Finding | Mitigação (acceptance criterion do MVP) |
|---|-----|-------|---------|------------------------------------------|
| S1 | HIGH | A01 / API1 (BOLA) | `getJobStatus` existente não binda job ao tenant/requester (vide §Riscos). Reuso direto no FR63 herda IDOR de signed URL com PII. | Bindar `tenantId`+`requesterUserId` no status e validar no polling; chave Redis prefixada por tenant. BLOQUEIO HUMANO emitido. |
| S2 | MED | A01 | Export deve ser deny-by-default para Participante. | Plano já mandata 403 p/ `canSeeFull=false` no POST export (Decision 5). PASS by design. |
| S3 | MED | A04 / data exposure | CSV com PII (nome/email/horários) + signed URL. | Signed URL 1h (dec-008), sem ACL pública, link local apenas, sem upload a terceiros. PASS by design. |
| S4 | LOW | A05 (CSV injection) | Campos de texto (nome) no CSV podem conter `=`/`+`/`-`/`@` → fórmula no Excel. | Acceptance: prefixar célula com `'` quando iniciar com metacaractere de fórmula, além do escape de aspas existente. |
| S5 | INFO | A01 | RLS multi-tenant via `withTenantTx`/`AsyncLocalStorage`, sem `tenant_id` como parâmetro. | Conforme constitution I. PASS. |

S1 é HIGH de controle de acesso → bloqueio humano OBRIGATÓRIO pela política de
gate (segurança é princípio MUST). A mitigação é clara e foi incorporada como
acceptance criterion; o bloqueio confirma a direção antes de `create-tasks`.

## Re-check de Constitution (pós Phase 1)

Design não introduziu serviço/camada nova (reusa 2 módulos existentes + 1
página web). Sem migration → princípio I intacto. Polling reusa endpoint
existente → sem inflar superfície de API. Todos os MUST permanecem PASS. **Sem
complexidade não justificada.**

## Saída do Checklist (gate de requisitos — onda-004, dec-019/dec-020)

Checklists em `checklists/{security,a11y,api,performance}.md`. A mitigação S1 (dec-017) foi promovida de risco a requisito testável (FR-07.1 + SC-08 + contrato endurecido + critério S4). Gaps abertos a cobrir no `create-tasks`:

| Item | Tipo | Ação no create-tasks |
|------|------|----------------------|
| CHK035 (api) | Gap | A chave Redis prefixada por tenant é COMPARTILHADA com export de trilhas (`kind:'track'`). A task da mitigação S1 deve cobrir AMBOS os kinds (meeting+track) no `getJobStatus`/`setJobStatus`, ou isolar a chave do meeting — senão quebra o polling de trilhas existente. |
| CHK040 (perf) | Gap | Definir cadência de polling recomendada (intervalo mínimo / backoff / máx tentativas) para evitar busy-poll no `GET /reports/jobs/:jobId`. |
| CHK041 (perf) | Gap | Definir comportamento acima do alvo (relatório >50, export >200): paginação ou limite explícito. |
| CHK024 (a11y) | Gap | Especificar tratamento a11y do estado disabled do CTA pastoral (aria-disabled vs. remoção do tab order, anúncio para leitor de tela). |
| CHK018 (a11y) | Ambiguity | Clarificar escopo do contraste 4.5:1 — todos os pares texto/fundo vs. só token secundário. |
| CHK021 (a11y) | Ambiguity | Fixar: se a tendência FR-10 renderizar, a tabela equivalente acessível é obrigatória. |
| CHK008 / CHK042 | {humano} | Decisões de produto (não-bloqueantes): apetite ADMIN_TENANT ler qualquer job do tenant; limite superior de participantes por reunião. |

## Próximos passos (pipeline)

1. `/checklist` — quality gate de requisitos (foco: security, a11y, api).
2. `/create-tasks` — decompor em backlog (fases: types/Zod → backend report →
   backend export → frontend → testes RLS/e2e).
3. `/analyze` — consistência cross-artifact após tasks.
