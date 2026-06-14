# Tasks — Políticas & Feature Toggles por Tenant (Story 11-3)

**short_name:** `feature-toggles-tenant`
**branch:** `feat/story-11-3-feature-toggles-tenant`
**gerado em:** 2026-06-14
**fase:** create-tasks

---

## Legenda de criticidade

- `[crit]` — bloqueador; story não entrega sem esta task
- `[imp]` — importante; degrada qualidade/cobertura se omitida
- `[opt]` — opcional nesta story; pode ser deferida

---

## Escopo Coberto

- Contratos Zod compartilhados (packages/types)
- Migration SQL + Prisma schema + `prisma generate`
- `PoliciesService` completo (defaults, merge, focusMonitoring, tier gating, write-through, audit, consent exemption, event)
- Estensão `tenants.controller.ts` (GET + PATCH `/me/policies` + `X-Policy-Version`)
- Estensão `tenants.module.ts` (DI: AuditModule + ConsentModule + PoliciesService)
- `ConsentDocumentType` — verificar/adicionar `'focus_monitoring'`
- Unit tests (`policies.service.spec.ts`) — 10 cenários
- RLS isolation spec (`tenant-policies.rls-spec.ts`) — 4 cenários
- Frontend: hook TanStack Query + página + 3 componentes + i18n PT-BR

## Escopo Excluído

- Notificações push/email para membros ao ativar toggle
- Histórico de versões de policies
- API pública de leitura para microserviços externos
- Enforcement de `expressMode` globalmente no FE (apenas salva o toggle)
- Enforcement de `sequentialTrailAccess` em criação de trilha
- `overflow policyVersion` (defer — CHK035)

---

## Matriz de Dependências

```
1.1 → 1.2 → 1.3
1.1 → 2.1 → 2.2 → 2.3
2.3 → 3.1 → 3.2 → 3.3 → 3.4
3.4 → 4.1 → 4.2 → 4.3
2.3 → 5.1
3.4 → 5.1
5.1 → 5.2
2.3 → 6.1
6.1 → 6.2 → 6.3 → 6.4 → 6.5
4.3 → 7.1
5.2 → 7.1
6.5 → 7.1
```

---

## Resumo

| FASE | Tasks | Criticidade |
|------|-------|-------------|
| FASE 1 — Contratos Zod | 1.1, 1.2, 1.3 | crit |
| FASE 2 — DB/ORM | 2.1, 2.2, 2.3 | crit |
| FASE 3 — Backend service + DI | 3.1, 3.2, 3.3, 3.4 | crit |
| FASE 4 — Controller | 4.1, 4.2, 4.3 | crit |
| FASE 5 — Testes unitários | 5.1, 5.2 | crit |
| FASE 6 — Frontend | 6.1, 6.2, 6.3, 6.4, 6.5 | imp |
| FASE 7 — Verificação final | 7.1 | crit |

**Total: 18 tasks**

---

## FASE 1 — Contratos Zod

### 1.1 Criar `tenant-policies.ts` em packages/types [crit]

**Arquivos:**
- `packages/types/src/policies/tenant-policies.ts` (NOVO)
- `packages/types/src/index.ts` (ESTENDER — re-exportar)

**Critério de done:**
- [x] Arquivo criado com os 3 schemas: `TenantPoliciesSchema`, `UpdatePoliciesSchema`, `PoliciesResponseSchema`
- [x] `TenantPoliciesSchema`: 5 campos boolean (focusMonitoring, mandatoryCamera, sequentialTrailAccess, autoPresenceTracking, expressMode)
- [x] `UpdatePoliciesSchema = TenantPoliciesSchema.partial()`
- [x] `PoliciesResponseSchema` inclui `policies: TenantPoliciesSchema`, `policyVersion: z.number().int().positive()`, `tierInfo` com `requiresPlan: z.literal('pro'|'free')` para cada toggle
- [x] `tierInfo`: focusMonitoring→'pro', mandatoryCamera→'pro', demais→'free'
- [x] Tipos inferidos exportados: `TenantPolicies`, `UpdatePoliciesDto`, `PoliciesResponse`
- [x] Re-exportado em `packages/types/src/index.ts`
- [x] `npx tsc --noEmit` verde em packages/types

**Dependências:** nenhuma

---

### 1.2 Snapshot test para schemas Zod [crit]

**Arquivos:**
- `packages/types/src/policies/tenant-policies.spec.ts` (NOVO)

**Critério de done:**
- [x] Arquivo criado com Vitest snapshot para `TenantPoliciesSchema` e `PoliciesResponseSchema`
- [x] `expect(TenantPoliciesSchema.shape).toMatchInlineSnapshot(...)` com snapshot commitado
- [x] `expect(PoliciesResponseSchema.shape).toMatchInlineSnapshot(...)` com snapshot commitado
- [x] `pnpm test` em packages/types passa com snapshots gravados

**Dependências:** 1.1

---

### 1.3 Adicionar `'policy_change'` a AUDIT_ACTIONS + snapshot [crit]

**Arquivos:**
- `packages/types/src/audit/index.ts` (ESTENDER)

**Critério de done:**
- [x] `'policy_change'` adicionado ao array `AUDIT_ACTIONS`
- [x] Snapshot inline de `AUDIT_ACTIONS` atualizado (quebra esperada — atualizar com `--update-snapshots`)
- [x] `pnpm test` em packages/types passa

**Dependências:** nenhuma (paralela a 1.1)

---

## FASE 2 — DB / ORM

### 2.1 Estender schema.prisma — model TenantPolicies [crit]

**Arquivos:**
- `apps/api/prisma/schema.prisma` (ESTENDER)

**Critério de done:**
- [x] Model `TenantPolicies` adicionado com campos exatos da spec §4.1:
  - `id String @id @db.Uuid` (sem `@default` — gerado via `uuidv7()` no service)
  - `tenantId String @unique @map("tenant_id") @db.Uuid`
  - `policies Json @map("policies")`
  - `policyVersion Int @default(1) @map("policy_version")`
  - `createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz`
  - `updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz`
  - `tenant Tenant @relation(fields:[tenantId], references:[id], onDelete:Cascade, onUpdate:Cascade)`
  - `@@map("tenant_policies")`
- [x] Model `Tenant` recebe `policies TenantPolicies?`
- [x] `npx prisma validate` sem erros

**Dependências:** nenhuma (paralela a FASE 1)

---

### 2.2 Criar migration SQL [crit]

**Arquivos:**
- `apps/api/prisma/migrations/<timestamp>_tenant_policies/migration.sql` (NOVO)

**Critério de done:**
- [x] `CREATE TABLE "tenant_policies"` com colunas exatas (snake_case) e tipos corretos
- [x] `CONSTRAINT "tenant_policies_pkey" PRIMARY KEY ("id")`
- [x] `CONSTRAINT "tenant_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE`
- [x] `ALTER TABLE "tenant_policies" ENABLE ROW LEVEL SECURITY`
- [x] `CREATE POLICY "tenant_policies_isolation" ON "tenant_policies" USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)`
- [x] SEM `trigger_set_timestamp()` — `updated_at` via Prisma `@updatedAt`
- [x] `policies` com `DEFAULT '{}'::jsonb`
- [x] Migration gerada com `prisma migrate dev --name tenant_policies` (ou criada manualmente e validada)

**Dependências:** 2.1

---

### 2.3 Executar `prisma generate` [crit]

**Arquivos:**
- `apps/api/node_modules/.prisma/client` (gerado)

**Critério de done:**
- [x] `npx prisma generate` executado em `apps/api` sem erros
- [x] Tipos Prisma `TenantPolicies` disponíveis via `@prisma/client`
- [x] `import { TenantPolicies } from '@prisma/client'` resolve sem erro de TS

**Dependências:** 2.2

---

## FASE 3 — Backend Service + DI

### 3.1 Verificar/adicionar `'focus_monitoring'` em ConsentDocumentType [crit]

**Arquivos:**
- `apps/api/src/consent/consent.versions.ts` (verificar; ESTENDER se ausente)

**Critério de done:**
- [x] Ler `ConsentDocumentType` enum/array em `consent.versions.ts`
- [x] Se `'focus_monitoring'` ausente: adicionar ao enum/array e confirmar que `ConsentRepository.hasActiveWithdrawal` aceita o valor
- [x] Se já presente: task concluída (apenas documenta a verificação no commit)
- [x] `npx tsc --noEmit` em apps/api sem erros após alteração

**Dependências:** 2.3

**Nota (CHK044):** esta verificação é obrigatória antes de implementar `updatePolicies` que chama `hasActiveWithdrawal(userId, 'focus_monitoring')`.

---

### 3.2 Criar `policies.service.ts` — getPolicies [crit]

**Arquivos:**
- `apps/api/src/tenants/policies.service.ts` (NOVO — criar com getPolicies primeiro)

**Critério de done:**
- [x] Classe `PoliciesService` anotada com `@Injectable()`
- [x] Injeta via construtor: `PrismaService`, `RedisService`, `PlanLimitsService`, `AuditService`, `ConsentRepository`, `EventEmitter2`
- [x] `POLICY_DEFAULTS` definido como constante (focusMonitoring:false, mandatoryCamera:false, sequentialTrailAccess:false, autoPresenceTracking:true, expressMode:true)
- [x] Método `getPolicies(tenantId: string): Promise<PoliciesResult>`:
  1. Tenta `RedisService.get('cache:policies:{tenantId}')` → se hit: parse JSON e retorna
  2. Cache miss: lê `TenantPolicies` via `withTenantTx` (PrismaPg RLS)
  3. Lê `tenant.focusIndicatorEnabled` (mesma tx ou query separada)
  4. Merge: `{ ...POLICY_DEFAULTS, ...(row?.policies ?? {}), focusMonitoring: tenant.focusIndicatorEnabled }`
  5. Write-through Redis: `SET cache:policies:{tenantId} JSON.stringify({policies, policyVersion}) EX 3600`
  6. Retorna `{ policies, policyVersion, tierInfo }` (tierInfo estático por toggle)
- [x] `tierInfo` tipado e retornado com `requiresPlan` correto por toggle
- [x] `policyVersion`: se linha ausente retorna `1` (default lógico)

**Dependências:** 2.3, 3.1

---

### 3.3 Adicionar `updatePolicies` a `policies.service.ts` [crit]

**Arquivos:**
- `apps/api/src/tenants/policies.service.ts` (ESTENDER)

**Critério de done:**
- [x] Método `updatePolicies(dto: UpdatePoliciesDto): Promise<UpdatePoliciesResult>`:
  1. Chama `getPolicies()` para obter `previousState` e `currentVersion`
  2. Tier gating: para `focusMonitoring` e `mandatoryCamera` presentes em `dto` → `PlanLimitsService.getPlan(tenantId)`; se `=== 'free'` → `throw new ForbiddenException(...)` com mensagem i18n `upgradePrompt`
     - Tier values em **lowercase** (`'free'`, `'pro'` — não `'Free'`/`'Pro'`)
  3. Se `focusMonitoring` em `dto`: `UPDATE tenants SET focus_indicator_enabled = dto.focusMonitoring` via `withTenantTx`
  4. Restantes (`omit(dto, 'focusMonitoring')`): UPSERT `tenant_policies` com `newPolicies = { ...currentJSONB, ...rest }`; `id` via `uuidv7()` no create; `policyVersion = currentVersion + 1` (SEMPRE, dec-010 / CHK033 — sem condicional, PATCH `{}` vazio também incrementa)
  5. Write-through Redis fail-silent (CHK034): `SET cache:policies:{tenantId} ...` em try/catch; falha → `logger.warn(...)`, não propaga erro
  6. `audit.service.createEvent({ userId, action: 'policy_change', resource: 'tenant_policies', resourceId: tenantId, payload: { previousState, newState: merged } })`
  7. Se `dto.focusMonitoring === true` AND `previousState.focusMonitoring === false`: `eventEmitter.emit('focus-monitoring.enabled', { tenantId, focusMonitoring: true, changedBy: userId, timestamp: new Date().toISOString() })` (payload CHK007)
- [x] Retorna `{ policies: merged, policyVersion: newVersion }`

**Dependências:** 3.2

---

### 3.4 Estender `tenants.module.ts` — DI [crit]

**Arquivos:**
- `apps/api/src/tenants/tenants.module.ts` (ESTENDER)

**Critério de done:**
- [x] `PoliciesService` adicionado a `providers` (e `exports` se necessário)
- [x] `AuditModule` adicionado a `imports` (se não presente)
- [x] `ConsentModule` adicionado a `imports` (se não presente)
- [x] `PlanLimitsModule` confirmado em `imports` (já deve existir — Story 11-1)
- [x] `RedisModule` confirmado em `imports` (global — confirmar)
- [x] `EventEmitter2` injetável via `EventEmitterModule.forRoot()` global (confirmar; não adicionar import duplicado)
- [x] `npx tsc --noEmit` em apps/api sem erros de DI

**Dependências:** 3.3

---

## FASE 4 — Controller

### 4.1 Estender `tenants.controller.ts` — GET /me/policies [crit]

**Arquivos:**
- `apps/api/src/tenants/tenants.controller.ts` (ESTENDER)

**Critério de done:**
- [x] Injetar `PoliciesService` no construtor (se não presente)
- [x] Método `getMyPolicies(@Res({ passthrough: true }) res: Response, @CurrentUser() user: AuthUser)`:
  - Decoradores: `@Get('me/policies')`, `@UseGuards(KeycloakAuthGuard, RolesGuard)`, `@Roles(Role.ADMIN_TENANT)`
  - Chama `policiesService.getPolicies(user.tenantId)` (tenantId via RequestContext/CurrentUser — nunca parâmetro)
  - `res.set('X-Policy-Version', String(result.policyVersion))` via `@Res({ passthrough: true })`
  - Retorna `{ data: { policies: result.policies, tierInfo: result.tierInfo } }`
- [x] Sem anotação `@Header()` estática para `X-Policy-Version` — usar `res.set` dinamicamente (CHK)

**Dependências:** 3.4

---

### 4.2 Estender `tenants.controller.ts` — PATCH /me/policies [crit]

**Arquivos:**
- `apps/api/src/tenants/tenants.controller.ts` (ESTENDER)

**Critério de done:**
- [x] Método `updateMyPolicies(@Body(new ZodValidationPipe(UpdatePoliciesSchema)) dto: UpdatePoliciesDto, @Res({ passthrough: true }) res: Response, @CurrentUser() user: AuthUser)`:
  - Decoradores: `@Patch('me/policies')`, `@UseGuards(KeycloakAuthGuard, RolesGuard)`, `@Roles(Role.ADMIN_TENANT)`
  - `ZodValidationPipe(UpdatePoliciesSchema)` no body (validação na borda)
  - Chama `policiesService.updatePolicies(dto)` (tenantId resolvido internamente pelo service via RequestContext)
  - `res.set('X-Policy-Version', String(result.policyVersion))`
  - Retorna `{ data: { policies: result.policies, policyVersion: result.policyVersion } }`
- [x] ADMIN_TENANT-only: super-admin recebe 403 (não tem contexto `/me` — CHK013)
- [x] `@HttpCode(200)` explícito (PATCH default pode variar)

**Dependências:** 4.1

---

### 4.3 Swagger / OpenAPI annotations [imp]

**Arquivos:**
- `apps/api/src/tenants/tenants.controller.ts` (ESTENDER)

**Critério de done:**
- [x] `@ApiOperation`, `@ApiResponse(200)`, `@ApiResponse(403)` em ambas as rotas
- [x] `@ApiBearerAuth()` e `@ApiTags('tenants')` herdados do controller (confirmar)
- [x] Swagger descrições em inglês (convenção do projeto)

**Dependências:** 4.2

---

## FASE 5 — Testes

### 5.1 Criar `policies.service.spec.ts` — unit tests [crit]

**Arquivos:**
- `apps/api/src/tenants/policies.service.spec.ts` (NOVO)

**Critério de done (10 cenários obrigatórios):**
- [x] Setup: `TestingModule` com mocks de `PrismaService`, `RedisService`, `PlanLimitsService`, `AuditService`, `ConsentRepository`, `EventEmitter2`
- [x] `ConfigModule.forRoot({ isGlobal: true })` se necessário
- [x] Cenário 1 — **Defaults sem linha**: `TenantPolicies` ausente → retorna `POLICY_DEFAULTS` (focusMonitoring=false do tenant)
- [x] Cenário 2 — **Merge com linha**: linha parcial no JSONB → merge correto (defaults + JSONB + focusIndicatorEnabled)
- [x] Cenário 3 — **focusMonitoring GET**: lê `tenant.focusIndicatorEnabled`, NÃO lê JSONB para focusMonitoring
- [x] Cenário 4 — **focusMonitoring PATCH**: escreve `focus_indicator_enabled` na tabela `tenants`, não no JSONB
- [x] Cenário 5 — **Tier gating Free**: tenant Free tentando `{ mandatoryCamera: true }` → `ForbiddenException` (403)
- [x] Cenário 6 — **Tier gating Pro**: tenant Pro tentando toggle Pro → sem exceção, UPSERT ocorre
- [x] Cenário 7 — **Write-through Redis**: PATCH → mock Redis recebe `SET` com `policyVersion` incrementado
- [x] Cenário 8 — **Write-through Redis fail-silent**: Redis lança → PATCH não falha (CHK034)
- [x] Cenário 9 — **Audit log**: PATCH → `auditService.createEvent` chamado com `previousState`/`newState` e `action='policy_change'`
- [x] Cenário 10 — **policyVersion**: PATCH → `policyVersion = currentVersion + 1` (incluindo PATCH `{}` vazio — CHK033)
- [x] Cenário 11 — **Consent exemption**: `focusMonitoring ON` + `hasActiveWithdrawal` retorna true → `eventEmitter.emit` NÃO disparado para esse usuário (flag exempted)
- [x] `pnpm vitest run` em apps/api passa todos os cenários

**Dependências:** 3.4, 2.3

---

### 5.2 Criar `tenant-policies.rls-spec.ts` [crit]

**Arquivos:**
- `apps/api/test/rls/tenant-policies.rls-spec.ts` (NOVO)

**Critério de done (4 cenários — padrão group-members.rls-spec.ts):**
- [x] Setup: `PrismaPg({ connectionString: process.env.DATABASE_APP_URL })` (não `DATABASE_URL`)
- [x] UUIDs hex fixos (não `uuidv7()` no spec — hardcoded para reproductibilidade)
- [x] Users globais (`INSERT INTO users`) antes do bind RLS
- [x] Tenants de teste criados antes das linhas `tenant_policies`
- [x] Cenário 1 — **Isolamento leitura**: Tenant A não vê linha de Tenant B (`findFirst` com tenant B's `app.current_tenant_id`)
- [x] Cenário 2 — **Isolamento escrita**: Tenant A não consegue fazer UPDATE na linha de Tenant B
- [x] Cenário 3 — **Insert cross-tenant bloqueado**: insert com `tenant_id` de outro tenant é rejeitado pelo RLS
- [x] Cenário 4 — **Sem SET LOCAL → resultado vazio**: sem `SET LOCAL app.current_tenant_id` → `findFirst` retorna null (não erro 500)
- [x] Cleanup: só deletar dados mutáveis de teste (não tenants/users base — padrão do projeto)
- [x] `pnpm vitest run` em `apps/api/test/rls/` passa

**Dependências:** 2.3

---

## FASE 6 — Frontend

### 6.1 Criar `use-policies.ts` — hooks TanStack Query [imp]

**Arquivos:**
- `apps/web/src/hooks/use-policies.ts` (NOVO)

**Critério de done:**
- [x] Hook `usePolicies()`: `useQuery({ queryKey: ['policies'], queryFn: async () => { const r = await fetch('/api/v1/tenants/me/policies'); return r.json(); } })` com tipagem `PoliciesResponse` (do packages/types)
- [x] Hook `useUpdatePolicies()`: `useMutation<PoliciesResponse, Error, UpdatePoliciesDto>` com tipagem explícita (CHK — spec guardrail 6)
- [x] `onSuccess` no mutation: lê `X-Policy-Version` do header da response; se difere do cache → `queryClient.invalidateQueries({ queryKey: ['policies'] })`
- [x] Sem `useEffect` desnecessário; fetch direto no `queryFn`

**Dependências:** 1.1

---

### 6.2 Criar página `policies/page.tsx` [imp]

**Arquivos:**
- `apps/web/src/app/(authenticated)/app/admin/settings/policies/page.tsx` (NOVO)
- Criar diretório `policies/` e `_components/` se não existirem

**Critério de done:**
- [x] `'use client'` no topo (Client Component — usa TanStack Query)
- [x] Usa `usePolicies()` e `useUpdatePolicies()`
- [x] Renderiza `<PolicyToggleList>` com dados e handlers
- [x] Estado de loading (skeleton/spinner)
- [x] Estado de erro com mensagem PT-BR (i18n key `saveError`)
- [x] Sem TanStack Query em Server Component (regra do projeto)

**Dependências:** 6.1

---

### 6.3 Criar componentes `PolicyToggleList` e `PolicyToggleItem` [imp]

**Arquivos:**
- `apps/web/src/app/(authenticated)/app/admin/settings/policies/_components/policy-toggle-list.tsx` (NOVO)
- `apps/web/src/app/(authenticated)/app/admin/settings/policies/_components/policy-toggle-item.tsx` (NOVO)

**Critério de done:**
- [x] `PolicyToggleList`: lista os 5 toggles em ordem; recebe `policies`, `tierInfo`, `onToggle(key, value)` como props
- [x] `PolicyToggleItem`: recebe `toggleKey`, `label`, `description`, `value: boolean`, `requiresPlan`, `onToggle`
  - Renderiza Switch (shadcn/ui) com label e description
  - Tier badge (badge "Pro" / "Free") derivado de `requiresPlan`
  - Toggle Pro em tenant Free: disabled + upgrade prompt (i18n `upgradePrompt`)
  - Toggles de privacidade (`focusMonitoring`, `mandatoryCamera`): ao ativar, abre `PrivacyConfirmDialog` antes de chamar `onToggle`
- [x] WCAG AA: `aria-label` nos switches; `role="dialog"` no confirm dialog; foco gerenciado
- [x] Vocabulário pastoral PT-BR nos labels via i18n (não hardcoded)

**Dependências:** 6.2

---

### 6.4 Criar `PrivacyConfirmDialog` [imp]

**Arquivos:**
- `apps/web/src/app/(authenticated)/app/admin/settings/policies/_components/privacy-confirm-dialog.tsx` (NOVO)

**Critério de done:**
- [x] Dialog (shadcn/ui `Dialog` ou `AlertDialog`) com mensagem `policies.privacyWarning`
- [x] Botões: "Confirmar" (chama `onConfirm`) e "Cancelar" (fecha dialog, não altera toggle)
- [x] Abre apenas ao ATIVAR toggle de privacidade (`focusMonitoring`, `mandatoryCamera`); ao desativar, não abre dialog
- [x] `aria-modal="true"`, trap de foco, fechar com Escape (WCAG AA)
- [x] Acessível via teclado

**Dependências:** 6.3

---

### 6.5 Adicionar bloco `policies` em `pt-BR.json` [imp]

**Arquivos:**
- `apps/web/messages/pt-BR.json` (ESTENDER)

**Critério de done:**
- [x] Bloco `"policies"` adicionado com todas as chaves da spec §8.4:
  - `title`, `description`
  - `toggles.{key}.label`, `toggles.{key}.description` para todos os 5 toggles
  - `requiresPlan`, `privacyWarning`, `upgradePrompt`, `saveSuccess`, `saveError`
- [x] Sem chaves duplicadas no JSON
- [x] `{plan}` e `{planName}` como placeholders de interpolação (compatível com next-intl)

**Dependências:** nenhuma (pode ser paralela a 6.1)

---

## FASE 7 — Verificação Final

### 7.1 Lint + tests + build + roundtrip empírico [crit]

**Arquivos:** todos os criados/modificados nas fases anteriores

**Critério de done:**
- [x] `pnpm lint` sem erros (apps/api + apps/web + packages/types)
- [x] `pnpm test` ou `pnpm vitest run` — todos os testes passam (unit + RLS spec + snapshots)
- [x] `pnpm build` verde (apps/api + apps/web compilam sem erros de TS)
- [ ] Roundtrip empírico (quickstart §"Roundtrip") — requer Docker CI
- [x] RLS spec criada (rodará contra `DATABASE_APP_URL` real no CI)
- [x] Nenhum `@default(uuid())` no schema.prisma (usar `uuidv7()` no service)
- [x] Tier values lowercase confirmados (`'free'`, `'pro'`) no code do service

**Dependências:** 4.3, 5.2, 6.5

---

## Notas de implementação (load-bearing)

1. **tier lowercase** (research D1): `getPlan() === 'free'`, nunca `=== 'Free'`.
2. **SEM `trigger_set_timestamp`** na migration: `updated_at` via Prisma `@updatedAt`.
3. **FK ON UPDATE CASCADE**: `REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE`.
4. **`X-Policy-Version` via passthrough**: `@Res({ passthrough: true })` + `res.set(...)` — nunca `@Header()` estático.
5. **`policyVersion` PATCH `{}` vazio**: incrementa mesmo sem campo alterado (dec-010/CHK033).
6. **Redis fail-silent** (CHK034): `try/catch` em write-through; falha → warn, não erro 500.
7. **evento `focus-monitoring.enabled`** payload (CHK007): `{ tenantId, focusMonitoring: true, changedBy: userId, timestamp: ISO8601 }`.
8. **ADMIN_TENANT-only / super-admin 403** (CHK013): `@Roles(Role.ADMIN_TENANT)` — super-admin não tem `/me` context.
9. **`uuidv7()`**: no `create` do UPSERT (`TenantPolicies`), nunca `@default(uuid())` no Prisma model.
10. **`ConsentDocumentType 'focus_monitoring'`** (CHK044): verificar/adicionar antes de implementar `updatePolicies`.
11. **Testes service-level** (não supertest): `TestingModule` isolado com mocks — sem HTTP server.
12. **`withTenantTx`**: toda query DB passa por `withTenantTx` para RLS funcionar.
13. **RLS spec**: seguir EXATAMENTE `group-members.rls-spec.ts` (UUIDs hex fixos, users globais, `DATABASE_APP_URL`).
