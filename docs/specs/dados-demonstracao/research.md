# Research: dados-demonstracao (Story 10-2)

> Sondagens realizadas em 2026-06-13 sobre `dev @ cbb3b5f` (pós-merge Epic 9).

---

## Decision 1 — Tabelas que recebem `isDemoData` (11 confirmadas)

**Pergunta:** Quais modelos Prisma precisam de `is_demo_data` para que o `DELETE /onboarding/demo-data` limpe completamente sem deixar órfãos?

**Sondagem:** inspecionar schema.prisma + relações `onDelete`.

| Modelo | Tabela DB | Precisa isDemoData? | Motivo |
|--------|-----------|---------------------|--------|
| `User` | `users` | **SIM** | Raiz dos dados demo — sem cascade upstream |
| `Group` | `groups` | **SIM** | Raiz do grupo demo |
| `GroupMember` | `group_members` | **SIM** | FK para User e Group; sem cascade automático |
| `Trail` | `trails` | **SIM** | Raiz da trilha demo |
| `Module` | `modules` | **SIM** | FK para Trail — sem `onDelete: Cascade` explícito |
| `Lesson` | `lessons` | **SIM** | FK para Module — sem `onDelete: Cascade` explícito |
| `TrailProgress` | `trail_progress` | **SIM** | FK para User — SEM `@relation` com onDelete:Cascade |
| `ModuleProgress` | `module_progress` | **SIM** | FK para User — SEM `@relation` com onDelete:Cascade |
| `LessonProgress` | `lesson_progress` | **NÃO** | FK Lesson com `onDelete: Cascade` — coberta por deleção em cascata de Lesson |
| `Meeting` | `meetings` | **SIM** | Raiz da reunião demo |
| `MeetingAttendance` | `meeting_attendance` | **SIM** | `presenceType` (integral/parcial/ausente) — FK Meeting sem cascade global |
| `MeetingTelemetry` | `meeting_telemetry` | **SIM** | Engajamento da reunião — FK Meeting sem cascade |
| `PastoralAction` | `pastoral_actions` | **SIM** | Raiz das ações pastorais demo |

**Nota:** O artifact do clarify (dec-006) citou 11 tabelas mas incluiu `meeting_telemetry` como a "1 reunião passada com presença" — confirmado: o seed cria `Meeting` + `MeetingAttendance` (presença binária com `presenceType`) + `MeetingTelemetry` (engajamento). As 11 tabelas finais com `isDemoData` são: `users`, `groups`, `group_members`, `trails`, `modules`, `lessons`, `trail_progress`, `module_progress`, `meetings`, `meeting_attendance`, `meeting_telemetry`, `pastoral_actions` — **12 tabelas** (Meeting e MeetingAttendance foram omitidas do clarify; adicionadas após sondagem).

**Decision:** 12 tabelas recebem `is_demo_data`. `lesson_progress` fica fora (cascade via Lesson).

---

## Decision 2 — Nudge dismiss: `Tenant.metadata` JSONB (não `onboardingProgress`)

**Pergunta:** Onde persistir o estado "nudge dispensado"?

**Sondagem:** `Tenant` no schema não tem `onboardingProgress` — só `provisioningState` e `metadata` JSONB (default `{}`).

**Decision:** Usar `Tenant.metadata` JSONB com a chave `demoDismissedAt` (ISO string). Patch via `PATCH /api/v1/tenants/me` (que 10-1 cria) ou endpoint próprio. Para esta story, endpoint simples `POST /api/v1/onboarding/demo-dismiss` (204) que faz `prisma.tenant.update({ data: { metadata: { demoDismissedAt: now } } })` usando `getRequestContext().tenantId`. Alternativa: incluir no mesmo `DELETE /onboarding/demo-data` (dismiss ao limpar). Decisão: **endpoint separado `PATCH /api/v1/onboarding/demo-nudge-dismiss`** para que o dismiss sem limpeza seja possível.

---

## Decision 3 — Seed vs. 7-2: dois arquivos independentes, sem extração de helper

**Pergunta:** Vale extrair helper compartilhado para a lógica de geração de semáforo (reutilizada de 7-2)?

**Sondagem:** `apps/api/prisma/seeds/demo-seed.ts` já tem a distribuição verde/amarelo/vermelho. O novo seed (10-2) tem apenas 3 participantes (Ana/Pedro/Maria) vs 10 do 7-2. A lógica de semáforo é trivial (valores hardcoded, não algorítmica).

**Decision:** **Não extrair helper.** O seed de 10-2 é autocontido em `apps/api/src/onboarding/seed/demo-data.seed.ts`. O 7-2 permanece em `apps/api/prisma/seeds/demo-seed.ts`. UUIDs com prefixo distinto para evitar colisão: `01989b10-1002-7...` (vs. `019899a0-7002-...` do 7-2).

---

## Decision 4 — Hook no provisioning: Step 4 em `runSaga()`, try/catch isolado

**Sondagem:** `apps/api/src/super-admin/super-admin-tenants.service.ts` tem `runSaga()` com 3 steps. Step 3 é o último antes de marcar `active`. Estrutura atual:
```
Step 1 — DB row
Step 2 — Keycloak (mocked)
Step 3 — invite email (mocked)
→ updateStatus('active')
```

**Decision:** Inserir Step 4 ANTES de `updateStatus('active')`:
```typescript
// Step 4 — Demo data seed (best-effort)
try {
  await this.demoDataService.seedDemoData(id);
  this.logger.log(`Demo data seeded for tenant ${id}`);
} catch (err) {
  this.logger.error(`Demo seed failed for tenant ${id}: ${err.message}`);
  // intentionally non-fatal — provisioning continues
}
```
`DemoDataService` injetado via constructor no `SuperAdminTenantsService`. `OnboardingModule` exporta `DemoDataService`; `SuperAdminTenantsModule` importa `OnboardingModule`.

---

## Decision 5 — Transação de limpeza: ordem de deleção evita FK violations

**Pergunta:** Qual ordem deletar nas 12 tabelas para não violar FK constraints?

**Análise de dependências:**
```
Meeting → MeetingAttendance, MeetingTelemetry (FK meetingId)
User    → GroupMember, TrailProgress, ModuleProgress (FK userId)
Group   → GroupMember (FK groupId)
Trail   → Module → Lesson (FK moduleId)
```

**Ordem de deleção (filhos antes de pais):**
1. `lesson_progress` (coberta por cascade, mas limpar explicitamente por segurança — NÃO tem isDemoData, limpa via Lesson cascade)
2. `meeting_attendance` (FK meetingId)
3. `meeting_telemetry` (FK meetingId)
4. `meetings` (agora sem filhos com isDemoData)
5. `module_progress` (FK moduleId/userId)
6. `trail_progress` (FK trailId/userId)
7. `pastoral_actions` (FK userId)
8. `group_members` (FK userId + groupId)
9. `lessons` (FK moduleId — cascade remove lesson_progress)
10. `modules` (FK trailId)
11. `trails`
12. `groups`
13. `users`

Tudo em `prisma.$transaction()` com `withTenantTx` para RLS.

---

## Decision 6 — Scripts Turbo: estender `db:seed:demo` com `--tenant-id`, não criar novo

**Sondagem:** `apps/api/package.json` já tem `db:seed:demo` apontando para `prisma/seeds/demo-seed.ts` (7-2). O novo seed de 10-2 é executável manualmente via script separado.

**Decision:** Adicionar `"db:seed:demo-data": "tsx src/onboarding/seed/demo-data.seed.ts"` em `apps/api/package.json`. Não alterar o `db:seed:demo` existente (7-2). Adicionar entrada no `turbo.json` como `"db:seed:demo-data": { "cache": false }`. O script aceita `--tenant-id <uuid>` via `process.argv`.

---

## Decision 7 — `DemoOverlay` badge: componente Client em `apps/web/src/components/onboarding/`

**Sondagem:** Já existe `apps/web/app/(authenticated)/app/admin/boas-vindas/_components/demo-participant-card.tsx` e `demo-radar-card.tsx` (onboarding wizard step 5). O diretório canônico de componentes reutilizáveis é `apps/web/src/components/onboarding/`.

**Decision:** Criar `demo-overlay.tsx` em `apps/web/src/components/onboarding/demo-overlay.tsx`. É um `'use client'` wrapper que recebe `isDemoData: boolean` e renderiza badge shadcn/ui + `useMutation` para limpeza. Exportado via `index.ts` do diretório.

---

## Decision 8 — Nudge "primeiro grupo real": detectado via query, não evento de domínio

**Pergunta:** Como detectar criação do primeiro grupo real (não-demo)?

**Opções:**
- A) Evento de domínio em `groups.service.ts` → NestJS EventEmitter → onboarding listener
- B) Client Component chama `GET /api/v1/groups` ao criar e verifica se `total_real > 0`
- C) Endpoint `GET /api/v1/onboarding/demo-status` retorna `{ hasDemoData, hasRealData, nudgeDismissed }`

**Decision:** Opção C — endpoint `GET /api/v1/onboarding/demo-status` (204 com corpo JSON). Evita acoplamento de domínio e é consultável pelo FE sem modificar `groups.service.ts`. O FE faz polling depois de criar grupo ou usa React Query com invalidação após mutação.

---

## Decision 9 — RLS spec: verificar que `isDemoData` não vaza entre tenants

**Tabela de testes necessários:**
- `demo-data-isolation.rls-spec.ts`: seed demo tenant A, verificar que tenant B não vê `isDemoData=true` via SELECT
- `demo-data-cleanup.rls-spec.ts`: DELETE endpoint só remove dados do tenant corrente; dados de outro tenant intactos

Padrão: `PrismaPg({ connectionString: DATABASE_APP_URL })`, UUIDs fixos hex, `users` globais, cleanup só mutável.
