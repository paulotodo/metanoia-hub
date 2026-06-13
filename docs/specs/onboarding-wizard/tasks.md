# Tasks — Wizard de Onboarding (Story 10-1, Epic 10)

**Spec**: `docs/specs/onboarding-wizard/spec.md`
**Plan**: `docs/specs/onboarding-wizard/plan.md`
**Branch**: `feat/onboarding-wizard`
**Gerado**: 2026-06-13

> Subtarefas de 1–4h. Toda tarefa de impl tem subtarefa de teste co-localizada.
> Seguir **NUNCA push direto em `dev`** (quickstart §Guardrails #1).

---

## Legenda de status

- `[ ]` Pendente
- `[x]` Concluída
- `[~]` Em progresso
- `[!]` Bloqueada

## Legenda de criticidade

- `[C]` Crítico — bloqueia CI/deploy; DEVE ser feito antes de PR
- `[A]` Avançado — requisito funcional obrigatório (FRs, segurança, RLS)
- `[M]` Melhoria — qualidade, UX, analytics (pode ser deferido sem bloquear CI)

---

## Matriz de Dependências

```text
FASE 0 → FASE 1 → FASE 2 → FASE 3 → FASE 4 → FASE 5 → FASE 6 → FASE 7
                       |         |         |         |
                       |    FASE 3 (endpoints BE) alimenta FASE 4 (FE)
                       |    FASE 4 (FE) alimenta FASE 5 (guard/rotas)
                  FASE 2 (Zod/types) alimenta FASE 3 (BE) e FASE 4 (FE)
                                                    FASE 5 alimenta FASE 6 (E2E/RLS)
```

Dependências críticas de bloqueio:
- `1.1` (migration Prisma) → antes de `2.x` e `3.x`
- `2.1`–`2.4` (Zod schemas) → antes de `3.x` e `4.x`
- `3.1`–`3.5` (endpoints BE) → antes de `5.1`–`5.2` (wire-up FE↔BE)
- `4.1`–`4.6` (componentes FE) → antes de `5.1` (guard + rota)
- `5.x` → antes de `6.x` (E2E e RLS isolation spec)

---

## Escopo Coberto

- Migration aditiva (4 colunas nullable) em `tenants` + `users`
- Zod schemas novos em `packages/types/src/onboarding.ts` + snapshot tests
- Endpoints novos: `PATCH /api/v1/tenants/me`, `PATCH /api/v1/users/me`, `GET /api/v1/onboarding/status`
- Evento de domínio `onboarding.wizard.step_completed` + `onboarding.wizard.completed` (CHK009, FR-10)
- Vocabulário pastoral wizard nas 5 etapas (CHK017) em `vocabulary.ts` + `pt-BR.json`
- Upload de mídia: allowlist content-type, tamanho máximo (5 MB foto / 2 MB logo), magic-bytes (CHK014)
- Log-scrub de PII nos novos endpoints PATCH + upload (CHK024)
- Anti-mass-assignment Zod `.strict()` nos 2 PATCH (dec-018 MUST)
- URL allowlist `logoUrl` / `profilePhotoUrl`: https + host MinIO (dec-018 MUST)
- FE wizard `OnboardingWizard` + Steps 1–5 como Client Components
- Rotas: `/app/admin/boas-vindas` (host do wizard) + `/app/admin/configuracoes/rever-tutorial` (replay)
- Guard `onboarding-redirect-guard.tsx` engatado (sem recriar)
- RLS isolation spec dos write paths novos (`PATCH /tenants/me`, `PATCH /users/me`, `GET /onboarding/status`)
- Testes: unit, integration, E2E Playwright, jest-axe WCAG AA

## Escopo Excluído

- Consumer do evento EventEmitter2 (Epic 13 futuro — sem worker/queue nesta story)
- BullMQ (evento é in-process via EventEmitter2, dec-009)
- Demo data provisioning (Story 10-2, já entregue — apenas reuso via GET endpoints)
- Grupos/Convites (Epic 4-1 / 4-3 — apenas reuso de endpoints existentes)
- Radar Pastoral (Epic 6 — apenas reuso de componentes existentes)
- `PATCH /api/v1/users/me/onboarding-complete` (Story 7-1 — não alterado)
- Novas policies RLS (migration é aditiva nullable; RLS já habilitada nas tabelas)
- Rate-limiting nos PATCHs, CSRF no upload (CHK031 — hardening posterior)

---

## Resumo Quantitativo

| FASE | Tarefas | `[C]` | `[A]` | `[M]` |
|------|---------|-------|-------|-------|
| FASE 0 — Sondagem Empírica | 2 | 2 | 0 | 0 |
| FASE 1 — Migration Prisma | 2 | 2 | 0 | 0 |
| FASE 2 — Tipos Zod | 4 | 3 | 1 | 0 |
| FASE 3 — Backend NestJS | 9 | 6 | 3 | 0 |
| FASE 4 — Frontend Next.js | 8 | 5 | 3 | 0 |
| FASE 5 — Integração/Guard | 3 | 2 | 1 | 0 |
| FASE 6 — Testes E2E + RLS | 4 | 2 | 2 | 0 |
| FASE 7 — Validação CI | 3 | 3 | 0 | 0 |
| **Total** | **35** | **25** | **10** | **0** |

---

## FASE 0 — Sondagem Empírica e Confirmação de Schema

### 0.1 Confirmar schema Prisma real (Tenant + User) antes da migration `[C]`

- [x] Ler `apps/api/prisma/schema.prisma` e confirmar campos existentes em `model Tenant` e `model User`
- [x] Verificar que `onboardingProgress`, `logoUrl`, `profilePhotoUrl`, `roleTitle` NÃO existem (colunas novas)
- [x] Confirmar que `onboarding_completed_at` existe em `User` (campo Story 7-1 — NÃO será tocado)
- [x] Confirmar que RLS já está habilitada nas tabelas `tenants` e `users` (sem `CREATE POLICY` necessário)
- [x] Confirmar nome da última migration para nomear a próxima corretamente (padrão: `<ts>_add_onboarding_wizard_tenant_user_fields`)
- [x] Registrar evidência: `grep -n "onboarding\|logoUrl\|logo_url\|profilePhoto\|role_title" apps/api/prisma/schema.prisma`

### 0.2 Confirmar endpoints existentes nos controllers `[C]`

- [x] Confirmar que `tenants.controller.ts` tem apenas `GET /me` (sem PATCH)
- [x] Confirmar que `users.controller.ts` tem `GET /me`, `PATCH /me/onboarding-complete`, `GET /me/onboarding-status` (sem PATCH /me genérico)
- [x] Confirmar que `onboarding.controller.ts` tem `GET /demo-radar`, `GET /demo-status`, `PATCH /demo-nudge-dismiss`, `DELETE /demo-data` (sem GET /status)
- [x] Confirmar presença e interface do `storage.service.ts` (método `upload`, parâmetros)

---

## FASE 1 — Migration Prisma

### 1.1 Criar migration aditiva: 4 colunas nullable `[C]`

- [x] Criar migration via `pnpm exec prisma migrate dev --name add_onboarding_wizard_tenant_user_fields`
- [x] DDL esperado em `tenants`: `ADD COLUMN "onboarding_progress" JSONB`, `ADD COLUMN "logo_url" TEXT`
- [x] DDL esperado em `users`: `ADD COLUMN "profile_photo_url" TEXT`, `ADD COLUMN "role_title" TEXT`
- [x] Adicionar em `schema.prisma` (model Tenant): `onboardingProgress Json? @map("onboarding_progress") @db.JsonB` e `logoUrl String? @map("logo_url")`
- [x] Adicionar em `schema.prisma` (model User): `profilePhotoUrl String? @map("profile_photo_url")` e `roleTitle String? @map("role_title")`
- [x] **PROIBIDO**: `CREATE POLICY`/`ALTER POLICY` (RLS já habilitada; colunas nullable não exigem nova policy)
- [x] **PROIBIDO**: `@default(uuid())` (sem novas PKs)
- [x] Validar: `pnpm exec prisma generate` sem erro

### 1.2 Smoke test da migration `[C]`

- [ ] Rodar `pnpm exec prisma migrate deploy` em ambiente de teste e confirmar sem erro
- [ ] Confirmar que `psql` mostra as 4 colunas nas tabelas corretas com default null
- [ ] Confirmar que tabelas `tenants` e `users` continuam com RLS habilitada após migration

---

## FASE 2 — Tipos Zod (packages/types)

### 2.1 OnboardingProgressSchema e OnboardingStatusResponseSchema `[C]`

- [x] Abrir `packages/types/src/onboarding.ts` e adicionar (sem quebrar schemas existentes):
  ```ts
  export const OnboardingProgressSchema = z.object({
    currentStep: z.number().int().min(1).max(5),
    completedSteps: z.array(z.number().int().min(1).max(5)),
    stepData: z.record(z.string(), z.unknown()),
    completed: z.boolean(),
    completedAt: z.string().datetime().nullable(),
    skippedAt: z.string().datetime().nullable(),
  }).strict().refine(
    d => !(d.completedAt && d.skippedAt),
    { message: 'completedAt e skippedAt são mutuamente exclusivos (FR-08)' }
  );
  export type OnboardingProgress = z.infer<typeof OnboardingProgressSchema>;
  ```
- [x] Adicionar `OnboardingStatusResponseSchema`: `z.object({ data: z.object({ progress: OnboardingProgressSchema, hasRealGroups: z.boolean() }) })`
- [x] Exportar ambos em `packages/types/src/index.ts`

### 2.2 UpdateTenantProfileSchema e UpdateUserProfileSchema com URL allowlist `[C]`

- [x] Adicionar `configureMinioAllowedHosts(hosts: string[])` (runtime injection, Zod v4 compatible — sem process.env no package)
- [x] Criar helper `MinioUrlSchema`:
  ```ts
  export const MinioUrlSchema = z.string().url()
    .refine(url => url.startsWith('https://'), { message: 'URL deve usar https' })
    .refine(_isMinioUrl, { message: 'URL deve originar do bucket MinIO configurado' });
  ```
- [x] Adicionar `UpdateTenantProfileSchema` (`.strict()`):
  campos: `name: z.string().min(1)`, `denomination?`, `city?`, `state?`, `logoUrl?: MinioUrlSchema`, `onboardingProgress?: OnboardingProgressSchema`
- [x] Adicionar `UpdateUserProfileSchema` (`.strict()`):
  campos: `name?: z.string().min(1)`, `profilePhotoUrl?: MinioUrlSchema`, `roleTitle?: z.string()`
- [x] Adicionar response schemas: `UpdateTenantProfileResponseSchema` e `UpdateUserProfileResponseSchema` com `{ data: {...} }` (nulls explícitos)
- [x] Confirmar que campos imutáveis (`status`, `tenantId`, `email`, `onboardingCompletedAt`) NÃO estão nos schemas de request

### 2.3 Snapshot tests dos schemas novos `[C]`

- [x] Criar `packages/types/src/__tests__/onboarding-wizard.snapshot.spec.ts` com:
  - `OnboardingProgressSchema` — snapshot do `.shape` + 7 casos (valid, FR-08, out-of-range, strict)
  - `UpdateTenantProfileSchema` — snapshot + 7 casos (logoUrl schemes, strict, FR-08 via progress)
  - `UpdateUserProfileSchema` — snapshot + 8 casos (optional fields, strict, imutáveis, URL schemes)
  - `OnboardingStatusResponseSchema` — snapshot + 2 casos
- [x] `pnpm turbo test --filter=@metanoia/types` → 425 testes passando (36 files), 6 snapshots written
- [x] Snapshots commitados em `packages/types/src/__tests__/__snapshots__/onboarding-wizard.snapshot.spec.ts.snap` (commit ec67a74)

### 2.4 Vocabulário pastoral para wizard nas 5 etapas (CHK017) `[A]`

- [x] Adicionado seção `// Wizard de Onboarding` em `packages/types/src/vocabulary/vocabulary.ts`:
  13 constantes WIZARD_* (5 step labels + 8 labels de ação/UI) em PT-BR
- [x] ESLint `no-surveillance-terms` não bloqueia: lint 0 warnings (commit ec67a74)
- [x] Exportados em `packages/types/src/vocabulary/index.ts` e `packages/types/src/index.ts`

---

## FASE 3 — Backend (NestJS)

### 3.1 PATCH /api/v1/tenants/me — atualização de perfil do tenant `[C]`

- [x] Criar DTO `UpdateTenantProfileDto` em `apps/api/src/tenants/dto/update-tenant-profile.dto.ts` importando `UpdateTenantProfileSchema` de `@metanoia/types`
- [x] Adicionar método `updateProfile(dto: UpdateTenantProfileDto)` em `tenants.service.ts`:
  - Resolver `tenantId` via `AsyncLocalStorage` / `RequestContext` (NUNCA por parâmetro)
  - Usar `withTenantTx` para escrita RLS-scoped
  - Atualizar `name`, `logoUrl` como colunas tipadas (Prisma field mapping)
  - Atualizar `metadata.denomination`, `metadata.city`, `metadata.state` via merge explícito (sem spread-merge do body cru)
  - Atualizar `onboardingProgress` JSONB quando presente no body (via `OnboardingProgressSchema.parse()`)
  - **NUNCA** `{...tenant, ...dto}` — campos mapeados explicitamente
  - Rejeitar 400 se `onboardingProgress.completedAt` E `onboardingProgress.skippedAt` simultâneos (FR-08)
  - Response: `{ data: { id, name, denomination, city, state, logoUrl, onboardingProgress } }` com nulls explícitos
- [x] Adicionar `@Patch('me')` em `tenants.controller.ts`:
  - `@UseGuards(KeycloakAuthGuard, RolesGuard)`, `@Roles('admin_tenant')`
  - `@UsePipes(new ZodValidationPipe(UpdateTenantProfileSchema))`
  - Swagger: `@ApiOperation({ summary: 'Update tenant profile and onboarding progress' })`

### 3.2 Evento `onboarding.wizard.step_completed` e `onboarding.wizard.completed` (FR-10, CHK009) `[C]`

- [x] Injetar `EventEmitter2` em `tenants.service.ts`
- [x] Emitir `onboarding.wizard.step_completed` a cada step concluído (quando `completedSteps` cresce):
  ```ts
  this.eventEmitter.emit('onboarding.wizard.step_completed', {
    eventId: uuidv7(),
    eventType: 'onboarding.wizard.step_completed',
    version: 1,
    tenantId,
    timestamp: new Date().toISOString(),
    data: { step: newStep, stepName: STEP_NAMES[newStep] },
    metadata: {},
  });
  ```
- [x] Emitir `onboarding.wizard.completed` quando `onboardingProgress.completed=true`:
  ```ts
  this.eventEmitter.emit('onboarding.wizard.completed', {
    eventId: uuidv7(), eventType: 'onboarding.wizard.completed',
    version: 1, tenantId, timestamp: new Date().toISOString(),
    data: { completedAt }, metadata: {},
  });
  ```
- [x] `eventId` gerado via `uuidv7()` (nunca `uuid()`)
- [x] Payload sem PII (sem nome, email, URLs — apenas step, stepName, tenantId, completedAt)

### 3.3 Testes de PATCH /tenants/me `[C]`

- [x] Criar/adicionar casos em `apps/api/src/tenants/tenants.service.spec.ts`:
  - Atualiza colunas tipadas (name, logoUrl) corretamente via Prisma
  - Atualiza metadata JSONB sem sobrescrever outras chaves de metadata existentes
  - Atualiza `onboardingProgress` sem spread-merge
  - Rejeita 400 em `completedAt + skippedAt` simultâneos (FR-08)
  - Emite `step_completed` no EventEmitter2 quando step cresce
  - Emite `wizard.completed` quando `completed=true`
  - Campo imutável (`status`, `tenantId`) rejeitado pelo Zod `.strict()` → 400 (coberto no snapshot spec de tipos)
  - Chave extra no body → 400 (coberto no snapshot spec de tipos)
  - `logoUrl` com scheme `javascript:` → 400 (coberto no snapshot spec de tipos)
  - `logoUrl` com scheme `http:` (não https) → 400 (coberto no snapshot spec de tipos)
  - `logoUrl` com host não-permitido → 400 (coberto no snapshot spec de tipos)

### 3.4 PATCH /api/v1/users/me — atualização de perfil do usuário `[C]`

- [x] Criar DTO `UpdateUserProfileDto` em `apps/api/src/users/dto/update-user-profile.dto.ts`
- [x] Adicionar método `updateProfile(dto: UpdateUserProfileDto)` em `users.service.ts`:
  - Resolver `userId` do token via `AsyncLocalStorage` (NUNCA id no body)
  - Usar `withTenantTx` para escrita RLS-scoped
  - Atualizar `name`, `profilePhotoUrl`, `roleTitle` como colunas tipadas (campos explícitos, sem spread-merge)
  - Campos imutáveis (`status`, `tenantId`, `onboardingCompletedAt`, `email`) NÃO atualizáveis
  - Response: `{ data: { id, name, profilePhotoUrl, roleTitle } }` com nulls explícitos
- [x] Adicionar `@Patch('me')` em `users.controller.ts` (distinguir de `PATCH /me/onboarding-complete`):
  - `@UsePipes(new ZodValidationPipe(UpdateUserProfileSchema))`
  - Rota exata: `@Patch('me')` — confirmar que não colide com `me/onboarding-complete`

### 3.5 Testes de PATCH /users/me `[C]`

- [x] Criar/adicionar casos em `apps/api/src/users/users.service.spec.ts`:
  - Atualiza `name`, `profilePhotoUrl`, `roleTitle` corretamente
  - Campo `email` não atualizável (Zod strict rejeita — coberto em snapshot spec)
  - Campo `tenantId` não atualizável (coberto em snapshot spec)
  - Chave extra no body → 400 (coberto em snapshot spec)
  - `profilePhotoUrl` com scheme não-https → 400 (coberto em snapshot spec)
  - `profilePhotoUrl` com host não-MinIO → 400 (coberto em snapshot spec)
  - Usuário só pode atualizar o próprio perfil (token-scoped, nunca por parâmetro de id)

### 3.6 GET /api/v1/onboarding/status — status do wizard tenant-scoped `[C]`

- [x] Adicionar método `getWizardStatus()` em `onboarding-wizard.service.ts` (novo serviço):
  - Resolver `tenantId` via `AsyncLocalStorage`
  - Consultar `Tenant.onboardingProgress` (JSONB) — se null, retornar default:
    `{currentStep:1, completedSteps:[], stepData:{}, completed:false, completedAt:null, skippedAt:null}`
  - Derivar `hasRealGroups = (await prisma.group.count({ where: { tenantId } })) > 0` (RLS-scoped)
  - **NUNCA** calcular `hasRealGroups` no FE (Decision 6)
  - Distinguir de `GET /me/onboarding-status` (user-scoped, `User.onboardingCompletedAt`)
- [x] Adicionar `@Get('status')` em `onboarding.controller.ts`:
  - `@UseGuards(KeycloakAuthGuard, RolesGuard)`, `@Roles('admin_tenant')`
  - Response parseado com `OnboardingStatusResponseSchema`
  - Swagger: `@ApiOperation({ summary: 'Get wizard status for current tenant' })`

### 3.7 Testes de GET /onboarding/status `[C]`

- [x] Casos em `apps/api/src/onboarding/onboarding-wizard.service.spec.ts`:
  - Tenant sem `onboardingProgress` → retorna default com `completed:false`, `skippedAt:null`
  - Tenant com progress persistido → retorna o JSONB real
  - `hasRealGroups=true` quando tenant tem grupos
  - `hasRealGroups=false` quando tenant sem grupos
  - 401 se sem token; 403 se não `admin_tenant` (cobertos pelo guard — testes de guard no controller)
  - Resposta parseável por `OnboardingStatusResponseSchema`

### 3.8 Upload de mídia — hardening de content-type, tamanho e magic-bytes (CHK014) `[A]`

- [x] Adicionar constantes em `apps/api/src/storage/upload-limits.ts`:
  ```ts
  export const UPLOAD_MAX_SIZE_PHOTO_BYTES = 5 * 1024 * 1024;   // 5 MB
  export const UPLOAD_MAX_SIZE_LOGO_BYTES  = 2 * 1024 * 1024;   // 2 MB
  export const UPLOAD_ALLOWED_MIME_TYPES   = ['image/png', 'image/jpeg', 'image/webp'] as const;
  ```
- [x] Adicionar validação de magic-bytes em `upload-limits.ts` (validateMagicBytes + validateUpload):
  - PNG: bytes `[0x89, 0x50, 0x4E, 0x47]` (primeiros 4)
  - JPEG: bytes `[0xFF, 0xD8, 0xFF]` (primeiros 3)
  - WebP: bytes `[0x52, 0x49, 0x46, 0x46]` pos 0-3 + `[0x57, 0x45, 0x42, 0x50]` pos 8-11
  - Fail-closed: rejeitar arquivo se magic-bytes não batem com mimeType declarado
- [x] Adicionar validação de tamanho (parâmetro `type: 'photo' | 'logo'` via validateUpload)
- [ ] URL retornada pelo upload: MinIO permanente, HTTPS, hostname próprio (integrado via endpoint de upload FE — FASE 5)

### 3.9 Log-scrub de PII nos novos endpoints (CHK024) `[A]`

- [x] Investigar se há interceptor global de logging que já scrub PII (não havia — `apps/api/src/common/interceptors/` não existia)
- [x] Criar `ScrubPiiInterceptor` em `apps/api/src/common/interceptors/scrub-pii.interceptor.ts` que redige campos `name`, `email`, `profilePhotoUrl`, `logoUrl`, `roleTitle` do body antes de logar
- [x] Aplicar o interceptor nos 2 endpoints PATCH novos (tenant + user) via `@UseInterceptors`
- [x] Confirmar que payload de EventEmitter2 NÃO contém nome/email (apenas `{step, stepName, tenantId}`)

---

## FASE 4 — Frontend (Next.js)

### 4.1 OnboardingWizard — container Client Component `[C]`

- [x] Criar `apps/web/src/components/onboarding/wizard/OnboardingWizard.tsx`:
  - `'use client'`
  - Props: `initialProgress: OnboardingProgress`, `hasRealGroups: boolean`, `readOnly?: boolean`
  - Estado interno: `currentStep` derivado de `initialProgress.currentStep`
  - Indicador de progresso visual com 5 etapas numeradas — P1 AC
  - Navegação por teclado completa (tab, enter, setas) — FR-11
  - Renders `Step1Profile`, `Step2Community`, `Step3Group`, `Step4Invite`, `Step5Radar` conforme step
  - Botão "Pular configuração" (`WIZARD_SKIP_LABEL`) como ação secundária — P8, `useMutation` para `PATCH /tenants/me` com `skippedAt=now`
  - Full-screen: sem fechar sem interação explícita — P1
  - Modo `readOnly=true`: passa prop para cada Step; sem botão "Pular"
- [x] Exportar `OnboardingWizard` em `apps/web/src/components/onboarding/index.ts`

### 4.2 Step 1 — Perfil Pastoral `[C]`

- [x] Criar `apps/web/src/components/onboarding/wizard/steps/Step1Profile.tsx`:
  - Labels via `WIZARD_DISPLAY_NAME_QUESTION`, `WIZARD_ROLE_TITLE_LABEL` (vocabulary.ts)
  - Campos: nome (obrigatório), roleTitle (opcional), foto (upload opcional)
  - `useMutation<undefined, Error, UpdateUserProfile>` para `PATCH /api/v1/users/me`
  - Upload de foto: `<input type="file" accept="image/png,image/jpeg,image/webp">` → POST storage → `profilePhotoUrl` cunhada
  - Falha de upload → mensagem acionável PT-BR (de `pt-BR.json`), avanço não bloqueado (FR-13)
  - Avança ao salvar com sucesso; actualiza `onboardingProgress.completedSteps` com step 1

### 4.3 Step 2 — Comunidade `[C]`

- [x] Criar `apps/web/src/components/onboarding/wizard/steps/Step2Community.tsx`:
  - Labels via `WIZARD_STEP_COMMUNITY_LABEL`, `WIZARD_COMMUNITY_NAME_LABEL`
  - Campos: nome da comunidade (obrigatório), denominação (opcional), cidade (opcional), UF (opcional), logo (upload opcional, 2 MB)
  - `useMutation` para `PATCH /api/v1/tenants/me`
  - Upload de logo: mesmo padrão de Step1 (allowlist content-type, limite 2 MB)
  - Avança ao salvar; `completedSteps` inclui 2

### 4.4 Step 3 — Primeiro Grupo ou Modo-Demo `[C]`

- [x] Criar `apps/web/src/components/onboarding/wizard/steps/Step3Group.tsx`:
  - Opção (a): formulário criar grupo (nome + dayOfWeek + time) → `POST /api/v1/groups`; admin marcado como líder automaticamente (regra Epic 4-1 existente)
  - Opção (b): "Explorar com dados de demonstração" — exibida SOMENTE se `GET /onboarding/demo-status` retornar `hasDemoData=true`
  - Opções mutuamente exclusivas (radio/selector)
  - Erro de grupo duplicado → mensagem acionável PT-BR, retentativa possível
  - Opção (b): salva `stepData.mode='demo'` e `currentStep=5` (skip Etapa 4)
  - Demo indisponível → degradação graciosa: só opção (a) visível (FR-13)

### 4.5 Step 4 — Convite de Líder (condicional) `[A]`

- [x] Criar `apps/web/src/components/onboarding/wizard/steps/Step4Invite.tsx`:
  - Exibida SOMENTE se `stepData.mode !== 'demo'`; auto-skip se modo-demo (não renderiza)
  - Campos: nome e e-mail do líder
  - Reusa mecanismo de convite existente (invites module, Epic 4-3)
  - Botão `WIZARD_SKIP_LATER_LABEL` → skip sem bloquear progresso
  - Validação inline de e-mail antes de submeter
  - E-mail já é usuário do tenant → mensagem informativa PT-BR (sem convite duplicado)

### 4.6 Step 5 — Radar Pastoral `[C]`

- [x] Criar `apps/web/src/components/onboarding/wizard/steps/Step5Radar.tsx`:
  - Explicação do semáforo pastoral: 3 cores e significado (PT-BR)
  - Preview modo-demo: `GET /api/v1/onboarding/demo-radar` com rótulo `WIZARD_DEMO_PREVIEW_LABEL`
  - Preview modo-real: dados reais do tenant (ou prompt "aguarde primeiros sinais")
  - Demo unavailable + modo-demo: exibe explicação sem prévia, sem erro (FR-13)
  - Botão `WIZARD_COMPLETE_BUTTON` → `PATCH /tenants/me` com `onboardingProgress.completed=true, completedAt=<now>`; redirect ao painel
  - `useMutation<undefined, Error, UpdateTenantProfile>` (padrão `mutationFn async` com `return undefined`)

### 4.7 Testes unitários e de acessibilidade dos componentes `[C]`

- [x] Criar `apps/web/src/components/onboarding/wizard/__tests__/OnboardingWizard.spec.tsx`:
  - `expect(await axe(container)).toHaveNoViolations()` para cada step (WCAG AA — SC-5)
  - Sem exceções suprimidas
  - Navegação por teclado: tab entre campos, enter para avançar
  - Modo `readOnly=true`: forms desabilitados, nenhum submit ao backend
- [x] Criar testes unitários para cada Step (`Step1Profile.spec.tsx`, `Step2Community.spec.tsx`, ...):
  - Render sem erro
  - Submit com dados válidos chama API correta
  - Erro de upload → mensagem PT-BR visível, botão avançar habilitado
  - Modo `readOnly=true`: sem submit

### 4.8 Chaves PT-BR em messages/pt-BR.json `[A]`

- [x] Adicionar seção `onboardingWizard` em `apps/web/messages/pt-BR.json`:
  - Labels das 5 etapas
  - Labels de ação: `concluir`, `pular`, `fazerDepois`, `rerverTutorial`
  - Mensagens de erro acionáveis: upload inválido, tamanho excedido, grupo duplicado, e-mail inválido
  - Confirmação de conclusão
  - Rótulo demo preview: `"Exemplo de como o radar funciona"`
- [x] Confirmar que todas as strings user-facing dos Steps referenciam `pt-BR.json` (sem strings hardcoded)

---

## FASE 5 — Integração, Guard e Rotas

### 5.1 Engatar guard existente com condição TRIPLA + rota /app/admin/boas-vindas `[C]`

- [x] Modificar `apps/web/app/(authenticated)/_components/onboarding-redirect-guard.tsx`:
  - Adicionar chamada a `GET /api/v1/onboarding/status` via `useWizardStatus` (TanStack Query)
  - Checar condição TRIPLA (FR-01): `progress.completed === false AND progress.skippedAt === null AND hasRealGroups === false`
  - `super_admin` NÃO redireciona ao wizard (condição de role verificada do token)
  - Loop prevention: não redireciona se já em `/app/admin/boas-vindas`
- [x] `apps/web/app/(authenticated)/app/admin/boas-vindas/page.tsx` já existia da FASE 4:
  - Server Component que busca `GET /onboarding/status` e passa dados ao wizard
  - Renderiza `<OnboardingWizard initialProgress={...} hasRealGroups={...} />` ✓

### 5.2 Rota de replay /app/admin/configuracoes/rever-tutorial `[A]`

- [x] `apps/web/app/(authenticated)/app/admin/configuracoes/rever-tutorial/page.tsx` já existia da FASE 4:
  - Renderiza `<OnboardingWizard readOnly={true} initialProgress={...} hasRealGroups={...} />` ✓
  - `readOnly=true`: forms desabilitados, sem submit ao backend
  - `onboardingProgress` NÃO alterado (dec-010, FR-09)
- [x] Link "Rever tutorial" (`replayTutorial`) já presente em `apps/web/messages/pt-BR.json` ✓

### 5.3 Testes de integração guard + rotas `[C]`

- [x] Adicionados casos em `onboarding-redirect-guard.spec.tsx` (13 testes):
  - Condição TRIPLA verdadeira → redireciona a `/app/admin/boas-vindas`
  - `progress.completed=true` → não redireciona
  - `progress.skippedAt=<date>` → não redireciona
  - `hasRealGroups=true` → não redireciona
  - `super_admin` → não redireciona
  - Já em `/app/admin/boas-vindas` → não redireciona (loop prevention)
  - lider/participante: lógica legada mantida
- [x] Teste de página `/app/admin/boas-vindas` renderiza `OnboardingWizard` (3 casos)
- [x] Teste de página `/app/admin/configuracoes/rever-tutorial` renderiza wizard com `readOnly=true` (3 casos)

---

## FASE 6 — Testes E2E, RLS e Roundtrip

### 6.1 RLS isolation spec — write paths novos `[C]`

- [x] Criar `apps/api/test/rls/onboarding-wizard.rls-spec.ts`:
  - Tenant A não pode atualizar dados de Tenant B via `PATCH /tenants/me`
  - Tenant A não pode ler `onboardingProgress` de Tenant B via `GET /onboarding/status`
  - `hasRealGroups` conta apenas grupos do tenant correto (RLS-scoped)
  - `PATCH /users/me` atualiza apenas User do tenant correto
  - Padrão: `PrismaPg({connectionString: DATABASE_APP_URL})`, UUIDs fixos hex, users globais
  - Cleanup apenas de tabelas mutáveis (`tenants`, `users`, `groups`, `group_members`)
  - Re-grants `metanoia_app` conforme quickstart §Pré-requisitos

### 6.2 Testes E2E Playwright — happy path (P1, P7, P8) `[A]`

- [x] Criar `apps/web/e2e/tests/onboarding-wizard.e2e-spec.ts`:
  - Cenário 1: wizard dispara no primeiro login (P1, FR-01)
  - Cenário 6: Etapas 1+2+5 + "Concluir Setup" → redirect ao painel; wizard não reaparece
  - Cenário 7: skip explícito → `skippedAt` gravado; não reaparece
  - Cenário 8: retomada após reload (`currentStep` persistido)
  - WCAG AA: coberto por jest-axe nos unit specs (Step*.spec.tsx); E2E axe adiado (sem @axe-core/playwright instalado)
  - Usa `demo-seed-keycloak` via E2E_DEMO_ADMIN_EMAIL/E2E_DEMO_PASSWORD

### 6.3 Teste roundtrip End-to-End anti-drift (Cenário 10) `[C]`

- [x] Implementar `apps/api/src/onboarding/onboarding-roundtrip.spec.ts` (in-process, sem MSW):
  - `PATCH /api/v1/users/me` → resposta camelCase + banco snake_case confirmado
  - `PATCH /api/v1/tenants/me` com `onboardingProgress` JSONB → roundtrip sem perda
  - `GET /api/v1/onboarding/status` → `OnboardingStatusResponseSchema.parse()` sem erro
  - Confirmar: `profile_photo_url` ↔ `profilePhotoUrl`, `logo_url` ↔ `logoUrl`, `onboarding_progress` ↔ `onboardingProgress`

### 6.4 Teste de evento de domínio EventEmitter2 `[A]`

- [x] Criar `apps/api/src/onboarding/onboarding-events.spec.ts`:
  - `PATCH /tenants/me` com step concluído → EventEmitter2 emite `onboarding.wizard.step_completed` com payload correto
  - `eventId` é UUID v7 válido
  - `completed=true` → emite `onboarding.wizard.completed` (CHK009)
  - Payload NÃO contém nome, email, URL (sem PII — CHK024, A09)
  - Formato: `{eventId, eventType, version:1, tenantId, timestamp, data:{step,stepName}, metadata:{}}`

---

## FASE 7 — Validação e CI

### 7.1 Build, lint e testes pré-PR `[C]`

- [ ] `pnpm exec prisma generate` — sem erro
- [ ] `pnpm turbo build` — sem erro
- [ ] `pnpm turbo lint` — `--max-warnings 0` (zero warnings, inclui `no-surveillance-terms`)
- [ ] `pnpm turbo test` — todos os testes verdes (unit + integration + snapshot + jest-axe)
- [ ] Confirmar `pnpm-lock.yaml` atualizado e commitado se houve novas deps
- [ ] Confirmar `pnpm install` rodado após migration/dep nova

### 7.2 Verificação de segurança pós-implementação (smoke) `[C]`

- [ ] `PATCH /tenants/me` com campo extra (`hacked: true`) → 400 (Zod strict)
- [ ] `PATCH /users/me` com `tenantId` no body → 400 (Zod strict)
- [ ] `PATCH /tenants/me` com `logoUrl: "javascript:alert(1)"` → 400
- [ ] `PATCH /tenants/me` com `logoUrl: "http://..."` → 400 (não https)
- [ ] `PATCH /tenants/me` com `completedAt` E `skippedAt` preenchidos → 400 (FR-08)
- [ ] Upload foto > 5 MB → 400/413
- [ ] Upload com magic-bytes de PNG mas mimeType `image/jpeg` → 400

### 7.3 Checklist de conformidade final `[C]`

- [ ] `tenant_id` nunca como parâmetro de função — sempre via `AsyncLocalStorage`
- [ ] `uuidv7()` para `eventId` — nunca `@default(uuid())`
- [ ] Datas ISO 8601; nulls explícitos; sem `undefined` em JSON responses
- [ ] Create (grupos) retorna 201; PATCH retorna 200; 401/403/400 conforme spec
- [ ] Mensagens user-facing em PT-BR centralizadas em `pt-BR.json`
- [ ] Swagger descriptions em inglês; código/logs/comentários em inglês
- [ ] Conventional commits PT-BR; rotas em kebab-case e `/me`
- [ ] **NUNCA push direto em `dev`** — sempre feature-branch → PR → CI verde → squash-merge
