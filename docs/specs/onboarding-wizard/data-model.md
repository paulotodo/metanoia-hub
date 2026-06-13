# Data Model — onboarding-wizard (Story 10-1)

> Phase 1. Modelo de dados derivado da spec (Key Entities + FR-02/03/04/08) e
> das clarifications dec-007..dec-011. Mudanças de schema são **aditivas e
> nullable** sobre tabelas com RLS já habilitada (`tenants`, `users`).

## Resumo das mudanças de schema (Prisma)

```prisma
model Tenant {
  // ... campos existentes (id, tenantId, name, slug, plan, status,
  //     adminEmail, provisioningState, isDemo, focusIndicatorEnabled,
  //     metadata, createdAt, updatedAt) ...

  // NOVOS (Story 10-1):
  onboardingProgress Json?   @map("onboarding_progress") @db.JsonB
  logoUrl            String? @map("logo_url")
}

model User {
  // ... campos existentes (id, email, name, status, tenantId,
  //     onboardingCompletedAt, createdAt, updatedAt, isDemoData) ...

  // NOVOS (Story 10-1):
  profilePhotoUrl String? @map("profile_photo_url")
  roleTitle       String? @map("role_title")
}
```

- `denomination`, `city`, `state` → dentro de `Tenant.metadata` (JSON
  existente), NÃO colunas (Decision 3 / research.md).
- `completedAt`, `skippedAt` → dentro de `Tenant.onboardingProgress` (JSONB),
  NÃO colunas (dec-011 / research.md Decision 2). **Sem `onboardingSkippedAt`.**
- `displayName` do admin → reusa coluna `User.name` (não cria coluna nova).

## Migration

- Nome sugerido: `add_onboarding_wizard_tenant_user_fields`.
- DDL: `ALTER TABLE "tenants" ADD COLUMN "onboarding_progress" JSONB`,
  `ADD COLUMN "logo_url" TEXT`; `ALTER TABLE "users"
  ADD COLUMN "profile_photo_url" TEXT`, `ADD COLUMN "role_title" TEXT`.
- **Sem** `CREATE POLICY` / `ALTER POLICY` (RLS já habilitada nas duas tabelas;
  colunas nullable não exigem nova policy).
- UUID: N/A (sem novas PKs). Nenhum uso de `@default(uuid())`.

---

## Entity: Tenant (estendido)

| Campo | Tipo | Null? | Map (DB) | Notas |
|-------|------|-------|----------|-------|
| onboardingProgress | `OnboardingProgress` (JSONB) | sim | `onboarding_progress` | shape validado por `OnboardingProgressSchema` (Zod) na borda de escrita |
| logoUrl | String | sim | `logo_url` | URL MinIO permanente do logo da comunidade |
| metadata.denomination | string (em JSON) | opcional | (dentro de `metadata`) | denominação livre |
| metadata.city | string (em JSON) | opcional | (dentro de `metadata`) | cidade |
| metadata.state | string (em JSON) | opcional | (dentro de `metadata`) | UF |

**Invariantes**:
- `tenant_id` presente (já é invariante da tabela; RLS aplica isolamento).
- `onboardingProgress.completedAt` e `onboardingProgress.skippedAt` são
  mutuamente exclusivos funcionalmente (FR-08): no máximo um preenchido.

### Sub-estrutura: OnboardingProgress (JSONB)

| Campo | Tipo | Null? | Notas |
|-------|------|-------|-------|
| currentStep | int (1..5) | não | etapa atual do wizard |
| completedSteps | int[] | não | etapas concluídas (subconjunto de 1..5) |
| stepData | objeto | não | dados parciais por etapa (ex.: `{ mode: 'demo' \| 'real-group' }` da Etapa 3); livre, sem URLs de mídia (essas vão em colunas) |
| completed | boolean | não | atalho de leitura (`completedAt != null`); usado pela condição de disparo (FR-01) |
| completedAt | string ISO 8601 | sim | conclusão via Etapa 5 (FR-08) |
| skippedAt | string ISO 8601 | sim | skip explícito (FR-08) |

State machine do progresso:
```text
[ausente/null] --primeiro acesso--> { currentStep:1, completedSteps:[], completed:false }
   --conclui etapa N--> completedSteps += N, currentStep = próxima
   --Etapa 3 modo-demo--> stepData.mode='demo', pula Etapa 4 (currentStep=5)
   --"Concluir Setup" (Etapa 5)--> completed:true, completedAt=now  [TERMINAL]
   --"Pular configuração"--> skippedAt=now  [TERMINAL]
```
Transições terminais (`completedAt` ou `skippedAt`) impedem reapresentação do
wizard em logins futuros (FR-08, P7, P8). Replay ("Rever tutorial") NÃO altera
o progresso (read-only, dec-010).

---

## Entity: User / Admin Tenant (estendido)

| Campo | Tipo | Null? | Map (DB) | Notas |
|-------|------|-------|----------|-------|
| name | String | não | `name` (existente) | reusado como display name (Etapa 1) |
| profilePhotoUrl | String | sim | `profile_photo_url` | URL MinIO permanente da foto de perfil |
| roleTitle | String | sim | `role_title` | título pastoral livre (ex.: "Pastor", "Coordenador") |
| onboardingCompletedAt | DateTime | sim | `onboarding_completed_at` (existente) | gate user-scoped (Story 7-1); NÃO alterado por 10-1 |

**Invariantes**:
- `name` obrigatório (Etapa 1 exige display name para avançar — FR-03).
- `profilePhotoUrl`/`roleTitle` opcionais; etapa conclui sem eles.

---

## Entity: Group (reuso — sem mudança de schema)

Etapa 3 opção (a) cria um grupo via `POST /groups` (Epic 4-1); o admin é
marcado automaticamente como líder (membership via group-members). Nenhuma
coluna nova. Edge case: nome duplicado no tenant → erro acionável (regra
existente de grupos).

## Entity: Invite (reuso — sem mudança de schema)

Etapa 4 usa o mecanismo de convite admin-side existente (`apps/api/src/invites/`
+ `packages/types/src/admin-invites.ts`, Epic 4-3). Nenhuma coluna nova. Edge
case: e-mail já pertence a usuário do tenant → mensagem informativa, sem convite
duplicado.

## Entity: DemoData (reuso — Story 10-2, sem mudança de schema)

Etapas 3 (opção b) e 5 (preview) consultam demo data via `GET /onboarding/demo-radar`
e `GET /onboarding/demo-status`. Degradação graciosa se `hasDemoData=false`
(FR-13): opção (b) oculta, Etapa 5 sem preview de demo.

---

## Zod schemas (packages/types/src/onboarding.ts — estende arquivo existente)

Adicionar (sem quebrar os schemas DemoRadar/DemoStatus/OnboardingComplete já
presentes; snapshot test obrigatório):

- `OnboardingProgressSchema` — `{ currentStep, completedSteps[], stepData,
  completed, completedAt: string().datetime().nullable(),
  skippedAt: string().datetime().nullable() }`.
- `OnboardingStatusResponseSchema` — `{ progress: OnboardingProgressSchema,
  hasRealGroups: boolean }` (tenant-scoped; alimenta a condição de disparo FR-01).
- `UpdateTenantProfileSchema` (request `PATCH /tenants/me`) — `{ name (req),
  denomination?, city?, state?, logoUrl?, onboardingProgress? }`.
- `UpdateUserProfileSchema` (request `PATCH /users/me`) — `{ name?,
  profilePhotoUrl?, roleTitle? }`.
- Response schemas correspondentes (`{ data: ... }`), nulls explícitos.

Convenção de borda: campos camelCase nos schemas/DTO; `@map` snake_case no
Prisma. Ver plan.md §Convenções de Borda.
