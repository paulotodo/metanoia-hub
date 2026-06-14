# Spec: Políticas & Feature Toggles por Tenant (Story 11-3)

**short_name:** `feature-toggles-tenant`
**epic:** 11 — Planos, Limites & Feature Gating
**status:** specified
**data:** 2026-06-14

---

## 1. Contexto e objetivo

O Admin Tenant precisa configurar políticas comportamentais da sua igreja na plataforma (ex.: ativar o indicador de foco em reuniões, exigir câmera, liberar acesso sequencial a trilhas). Hoje não existe esse mecanismo; comportamentos são fixos ou dependem de colunas avulsas no modelo `Tenant`.

Esta story cria:

1. Tabela `TenantPolicies` (JSONB + `policyVersion`) para os toggles novos.
2. Mapeamento `focusMonitoring ↔ tenant.focusIndicatorEnabled` (coluna existente — NÃO duplicar).
3. Endpoints `GET /api/v1/tenants/me/policies` e `PATCH /api/v1/tenants/me/policies`.
4. Cache Redis write-through `cache:policies:{tenantId}` com header `X-Policy-Version`.
5. UI de administração com vocabulário pastoral, tier badges e confirmação para toggles de privacidade.

---

## 2. Decisões arquiteturais fixadas (não reabrir)

| # | Decisão | Fonte |
|---|---------|-------|
| D1 | `focusMonitoring` NÃO vai para JSONB. A API de policies lê/escreve `tenant.focusIndicatorEnabled`. `TenantPolicies.policies` guarda só os 4 toggles novos. | RECONCILIACAO §10.5 |
| D2 | Endpoint usa `/me/policies`, não `/current/policies`. | RECONCILIACAO §1.5 |
| D3 | Sem módulo separado: estender `tenants.controller.ts` / `tenants.module.ts` + novo `policies.service.ts`. | Padrão Epic 11 (branding seguiu mesma rota) |
| D4 | Defaults em código (convention-over-config); linha em `TenantPolicies` é opcional. | RECONCILIACAO §3 |
| D5 | Cache write-through (`SET`, não `DEL`); mismatch de `policyVersion` dispara re-fetch no TanStack Query. | RECONCILIACAO §6 |
| D6 | Tier gating: toggles Pro → 403 acionável com mensagem de upgrade. Lógica via `PlanLimitsService.getPlan()`. | Epic 11, AC |
| D7 | Exempção por consent: reusar `consent.repository.hasActiveWithdrawal(userId, consentType)`. `consentType` para `focusMonitoring` = `'focus_monitoring'` (adicionar a `ConsentDocumentType` se ausente). | RECONCILIACAO §3 |
| D8 | Audit: novo action `'policy_change'` em `AUDIT_ACTIONS` + snapshot. `audit.service.createEvent` chamado no PATCH. | RECONCILIACAO §2, §4 |

---

## 3. Toggles e defaults

```ts
// Defaults aplicados quando não há linha TenantPolicies
const POLICY_DEFAULTS = {
  // ── Via coluna tenant.focusIndicatorEnabled (MAPEAR, não duplicar) ──
  focusMonitoring: false,         // NFR-L4 — privacidade, deve ser OFF por padrão

  // ── Via TenantPolicies.policies JSONB ──
  mandatoryCamera: false,         // exige câmera ligada em reuniões
  sequentialTrailAccess: false,   // novas trilhas geradas com acesso sequencial
  autoPresenceTracking: true,     // registro automático de presença em reuniões
  expressMode: true,              // UI simplificada (oculta funcionalidades avançadas)
};
```

### Tier gating por toggle

| Toggle | Tier mínimo | Justificativa |
|--------|------------|---------------|
| `focusMonitoring` | Pro | Funcionalidade de vigilância — só planos pagos |
| `mandatoryCamera` | Pro | Controle avançado de reuniões |
| `sequentialTrailAccess` | Free | Disponível a todos |
| `autoPresenceTracking` | Free | Disponível a todos |
| `expressMode` | Free | Disponível a todos |

### Vocabulário pastoral PT-BR

| Toggle | Label (PT-BR) | Descrição curta |
|--------|--------------|-----------------|
| `focusMonitoring` | "Indicador de foco em reuniões" | Acompanha a presença ativa do participante durante a reunião |
| `mandatoryCamera` | "Câmera obrigatória em reuniões" | Participantes precisam manter a câmera ligada |
| `sequentialTrailAccess` | "Acesso sequencial padrão em trilhas" | Novas trilhas criadas já com ordem obrigatória de módulos |
| `autoPresenceTracking` | "Registro automático de presença" | Presença registrada ao entrar e sair da reunião |
| `expressMode` | "Modo Express" | Interface simplificada para líderes e membros iniciantes |

---

## 4. Modelo de dados

### 4.1 Nova tabela `tenant_policies`

```prisma
model TenantPolicies {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId      String   @unique @map("tenant_id") @db.Uuid
  policies      Json     @map("policies")           // JSONB — 4 toggles novos
  policyVersion Int      @default(1) @map("policy_version")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@map("tenant_policies")
}
```

**Notas:**
- `id` gerado via `uuidv7()` na camada de serviço (não `@default(uuid())`).
- `tenantId` é `@unique` — relação 0..1 com `Tenant`.
- `Tenant` recebe `policies TenantPolicies?` no schema.
- `onUpdate: Cascade` — invariante cascade-users-id não se aplica aqui (FK→tenants, não →users), mas manter o padrão.
- RLS obrigatória: `tenant_id` scoped.

### 4.2 `focusMonitoring` → mapeia `tenant.focusIndicatorEnabled`

A coluna `tenant.focusIndicatorEnabled Boolean @default(false)` já existe. Nenhuma migration toca nela. A camada de serviço:

- `GET policies` → lê `tenant.focusIndicatorEnabled` e adiciona ao payload como `focusMonitoring`.
- `PATCH policies` com `focusMonitoring` → `UPDATE tenants SET focus_indicator_enabled = $1`.

### 4.3 Migration

- Arquivo: `apps/api/prisma/migrations/<timestamp>_tenant_policies/migration.sql`
- Conteúdo mínimo:
  ```sql
  CREATE TABLE "tenant_policies" (
    "id"             uuid NOT NULL,
    "tenant_id"      uuid NOT NULL UNIQUE,
    "policies"       jsonb NOT NULL DEFAULT '{}'::jsonb,
    "policy_version" integer NOT NULL DEFAULT 1,
    "created_at"     timestamptz NOT NULL DEFAULT now(),
    "updated_at"     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "tenant_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_policies_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  );
  -- RLS
  ALTER TABLE "tenant_policies" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "tenant_policies_isolation" ON "tenant_policies"
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
  ```
- **SEM** `trigger_set_timestamp()` — `updatedAt` via `@updatedAt` do Prisma.

---

## 5. Contratos Zod — `packages/types`

### 5.1 Schema principal

```ts
// packages/types/src/policies/tenant-policies.ts

export const TenantPoliciesSchema = z.object({
  focusMonitoring:       z.boolean(),
  mandatoryCamera:       z.boolean(),
  sequentialTrailAccess: z.boolean(),
  autoPresenceTracking:  z.boolean(),
  expressMode:           z.boolean(),
});
export type TenantPolicies = z.infer<typeof TenantPoliciesSchema>;

export const UpdatePoliciesSchema = TenantPoliciesSchema.partial();
export type UpdatePoliciesDto = z.infer<typeof UpdatePoliciesSchema>;

export const PoliciesResponseSchema = z.object({
  policies:      TenantPoliciesSchema,
  policyVersion: z.number().int().positive(),
  tierInfo: z.object({
    focusMonitoring:       z.object({ requiresPlan: z.literal('pro') }),
    mandatoryCamera:       z.object({ requiresPlan: z.literal('pro') }),
    sequentialTrailAccess: z.object({ requiresPlan: z.literal('free') }),
    autoPresenceTracking:  z.object({ requiresPlan: z.literal('free') }),
    expressMode:           z.object({ requiresPlan: z.literal('free') }),
  }),
});
```

- Snapshot test obrigatório (gate de breaking change silencioso).
- Exportar em `packages/types/src/index.ts`.

### 5.2 Audit action nova

Adicionar `'policy_change'` ao array `AUDIT_ACTIONS` em `packages/types/src/audit/index.ts` e atualizar o snapshot inline.

---

## 6. Backend — API

### 6.1 Fluxo `GET /api/v1/tenants/me/policies`

```
1. KeycloakAuthGuard + RolesGuard(@ADMIN_TENANT)
2. PoliciesService.getPolicies(tenantId):
   a. Tenta Redis: GET cache:policies:{tenantId} → se hit, retorna (parse JSON)
   b. Cache miss: lê TenantPolicies do banco via withTenantTx
   c. Lê tenant.focusIndicatorEnabled (mesma tx ou query separada)
   d. Merge: { ...POLICY_DEFAULTS, ...(row?.policies ?? {}), focusMonitoring: tenant.focusIndicatorEnabled }
   e. Write-through: SET cache:policies:{tenantId} JSON.stringify({policies, policyVersion}) EX 3600
   f. Retorna {policies, policyVersion, tierInfo}
3. Controller: response.set('X-Policy-Version', String(policyVersion))
4. Return { data: {policies, tierInfo} }
```

### 6.2 Fluxo `PATCH /api/v1/tenants/me/policies`

```
1. KeycloakAuthGuard + RolesGuard(@ADMIN_TENANT)
2. ZodValidationPipe(UpdatePoliciesSchema)
3. PoliciesService.updatePolicies(dto):
   a. getPolicies() para obter estado atual (previousState)
   b. Para cada toggle em dto que exige Pro: PlanLimitsService.getPlan() → se Free → throw ForbiddenException
   c. Separa: focusMonitoring → UPDATE tenants SET focus_indicator_enabled = dto.focusMonitoring
   d. Restantes → UPSERT TenantPolicies: newPolicies = { ...currentJSONB, ...omit(dto, 'focusMonitoring') }
   e. policyVersion = currentVersion + 1 → gravar no banco
   f. Write-through Redis: SET cache:policies:{tenantId} JSON.stringify({policies: merged, policyVersion: new}) EX 3600
   g. audit.service.createEvent({ action: 'policy_change', resource: 'tenant_policies',
        payload: { previousState, newState: merged } })
   h. Se focusMonitoring ON no dto E era OFF antes:
      i. Emitir evento interno para notificar usuários via transparency banner
      ii. Usuários com hasActiveWithdrawal(userId, 'focus_monitoring') → flag exempted (NÃO ativar para eles)
4. Controller: response.set('X-Policy-Version', String(newPolicyVersion))
5. Return { data: {policies: merged, policyVersion: new} }
```

### 6.3 Arquivos novos/modificados (backend)

| Arquivo | Ação |
|---------|------|
| `apps/api/src/tenants/policies.service.ts` | NOVO — getPolicies / updatePolicies |
| `apps/api/src/tenants/policies.service.spec.ts` | NOVO — unit tests |
| `apps/api/src/tenants/tenants.controller.ts` | ESTENDER — 2 rotas novas me/policies |
| `apps/api/src/tenants/tenants.module.ts` | ESTENDER — importar PoliciesService |
| `apps/api/prisma/schema.prisma` | ESTENDER — model TenantPolicies + relação |
| `apps/api/prisma/migrations/.../migration.sql` | NOVO |
| `apps/api/test/rls/tenant-policies.rls-spec.ts` | NOVO |
| `packages/types/src/policies/tenant-policies.ts` | NOVO |
| `packages/types/src/audit/index.ts` | ESTENDER — 'policy_change' |
| `packages/types/src/index.ts` | ESTENDER — re-exportar policies |

### 6.4 DI e módulo

- `PoliciesService` injeta: `PrismaService`, `RedisService`, `PlanLimitsService`, `AuditService`, `ConsentRepository`.
- `TenantsModule` importa `PlanLimitsModule`, `AuditModule`, `ConsentModule` (já deve estar importado — confirmar).
- `ConsentRepository` deve ser EXPORTADO de `ConsentModule`.

---

## 7. RLS spec

Arquivo: `apps/api/test/rls/tenant-policies.rls-spec.ts`

Pattern: `group-members.rls-spec.ts` (PrismaPg + `DATABASE_APP_URL`, UUIDs hex fixos, users globais antes do bind, cleanup só mutável).

Cenários obrigatórios:
1. Tenant A não vê linha de Tenant B (`findFirst`).
2. Tenant A não consegue fazer `UPDATE` na linha de Tenant B (`updateRaw`).
3. Insert com tenant_id errado é bloqueado pelo RLS.
4. Sem `SET LOCAL app.current_tenant_id` → resultado vazio (não erro).

---

## 8. Frontend

### 8.1 Página de configuração

```
apps/web/src/app/(authenticated)/app/admin/settings/policies/page.tsx
```

- Client Component (usa TanStack Query para mutação).
- Consumo: `GET /api/v1/tenants/me/policies` via hook `usePolicies()`.
- Mutação: `PATCH /api/v1/tenants/me/policies` via `useMutation<TenantPolicies, Error, Partial<TenantPolicies>>`.

### 8.2 Componentes

| Componente | Localização |
|-----------|-------------|
| `PoliciesSettingsPage` | `page.tsx` (default export) |
| `PolicyToggleList` | `_components/policy-toggle-list.tsx` |
| `PolicyToggleItem` | `_components/policy-toggle-item.tsx` |
| `PrivacyConfirmDialog` | `_components/privacy-confirm-dialog.tsx` |

### 8.3 Lógica policyVersion

```ts
// Hook usePolicies — após mutação bem-sucedida
onSuccess: (_data, _vars, _ctx) => {
  const newVersion = Number(response.headers.get('X-Policy-Version'));
  const cachedVersion = queryClient.getQueryData<{policyVersion: number}>(['policies'])?.policyVersion;
  if (newVersion !== cachedVersion) {
    queryClient.invalidateQueries({ queryKey: ['policies'] });
  }
}
```

### 8.4 i18n — chaves PT-BR novas em `apps/web/messages/pt-BR.json`

```json
"policies": {
  "title": "Políticas e Funcionalidades",
  "description": "Configure como a plataforma se comporta para todos os membros da sua comunidade.",
  "toggles": {
    "focusMonitoring": {
      "label": "Indicador de foco em reuniões",
      "description": "Acompanha a presença ativa do participante durante a reunião"
    },
    "mandatoryCamera": {
      "label": "Câmera obrigatória em reuniões",
      "description": "Participantes precisam manter a câmera ligada"
    },
    "sequentialTrailAccess": {
      "label": "Acesso sequencial padrão em trilhas",
      "description": "Novas trilhas criadas já com ordem obrigatória de módulos"
    },
    "autoPresenceTracking": {
      "label": "Registro automático de presença",
      "description": "Presença registrada ao entrar e sair da reunião"
    },
    "expressMode": {
      "label": "Modo Express",
      "description": "Interface simplificada para líderes e membros iniciantes"
    }
  },
  "requiresPlan": "Requer plano {plan}",
  "privacyWarning": "Esta configuração afeta a privacidade dos membros. Eles serão notificados automaticamente.",
  "upgradePrompt": "Esta funcionalidade requer o plano {planName}. [Ver upgrade]",
  "saveSuccess": "Políticas atualizadas com sucesso.",
  "saveError": "Erro ao salvar políticas. Tente novamente."
}
```

### 8.5 Transparency banner (reusar 5-5)

Quando `focusMonitoring` é ativado via PATCH, o backend emite evento interno que aciona a `transparency-banner.tsx` existente com mensagem:
> "Seu líder ativou o indicador de foco nas reuniões"

Usuários com withdrawal ativo para `'focus_monitoring'` **não** recebem o banner e o toggle não tem efeito para eles.

### 8.6 Arquivos novos/modificados (frontend)

| Arquivo | Ação |
|---------|------|
| `apps/web/src/app/(authenticated)/app/admin/settings/policies/page.tsx` | NOVO |
| `apps/web/src/app/(authenticated)/app/admin/settings/policies/_components/policy-toggle-list.tsx` | NOVO |
| `apps/web/src/app/(authenticated)/app/admin/settings/policies/_components/policy-toggle-item.tsx` | NOVO |
| `apps/web/src/app/(authenticated)/app/admin/settings/policies/_components/privacy-confirm-dialog.tsx` | NOVO |
| `apps/web/src/hooks/use-policies.ts` | NOVO |
| `apps/web/messages/pt-BR.json` | ESTENDER — bloco "policies" |

---

## 9. Testes obrigatórios

| Teste | Tipo | Cenário |
|-------|------|---------|
| Defaults sem linha | Unit (PoliciesService) | `TenantPolicies` ausente → retorna `POLICY_DEFAULTS` |
| Merge com linha | Unit | Linha parcial no JSONB → merge correto com defaults |
| focusMonitoring GET | Unit | Lê `tenant.focusIndicatorEnabled`, não JSONB |
| focusMonitoring PATCH | Unit | Escreve `focusIndicatorEnabled` na tabela `tenants` |
| Tier gating Free | Unit | Toggle Pro em tenant Free → 403 ForbiddenException |
| Write-through Redis | Unit | PATCH → Redis recebe SET com policyVersion incrementado |
| Audit log | Unit | PATCH → `audit.service.createEvent` chamado com previousState/newState |
| Consent exemption | Unit | focusMonitoring ON + usuário com withdrawal → `hasActiveWithdrawal` retorna true → feature OFF para ele |
| RLS isolation | RLS spec | Linha de Tenant A invisível para Tenant B |
| policyVersion mismatch | Unit | policyVersion incrementa a cada PATCH |
| Zod snapshot | Snapshot | `TenantPoliciesSchema` + `PoliciesResponseSchema` não mudam silenciosamente |
| AUDIT_ACTIONS snapshot | Snapshot | `'policy_change'` presente no enum |

---

## 10. Guardrails CI (não negociáveis)

1. **Migration**: sem `trigger_set_timestamp()`. FK→tenants com `ON DELETE CASCADE ON UPDATE CASCADE`.
2. **RLS spec**: `PrismaPg({ connectionString: process.env.DATABASE_APP_URL })`. UUIDs hex fixos. Users globais inseridos antes do bind RLS. Cleanup só de dados mutáveis (não tenants/users base). Nomes reais de coluna (ex.: `tenant_id`, não `tenantId`).
3. **Testes service-level**: `TestingModule` isolado. `ConfigModule.forRoot({ isGlobal: true })` se necessário. Usar `withTenantTx`.
4. **DI**: `PoliciesService` exportado de `TenantsModule` (ou módulo próprio se necessário). `ConsentRepository` exportado de `ConsentModule`.
5. **import default CJS**: Redis, PrismaPg → `import default` se Vitest reclamar de ESM/CJS.
6. **`useMutation`**: tipagem explícita `useMutation<TResult, Error, TVariables>`. Callback `async/await` com retorno explícito.
7. **`uuidv7()`**: nunca `@default(uuid())` no Prisma. Id gerado via `uuidv7()` no service antes do `create`.

---

## 11. Fora de escopo (não implementar nesta story)

- Notificações push/email para membros ao ativar toggle (apenas banner inline).
- Histórico de versões de policies (audit log é suficiente).
- API pública de leitura de policies para uso em outros microserviços (fora do MVP).
- `expressMode` aplicado globalmente no FE (apenas toggle salvo; enforcement em story futura).
- `sequentialTrailAccess` aplicado em criação de trilha (apenas toggle salvo; enforcement em story de trilhas).

---

## 12. Acceptance Criteria (mapeamento spec → AC)

| AC (epic-11 Story 11.3) | Coberto por |
|-------------------------|-------------|
| Lista de toggles com tier badge | §8.1, §8.2, §3 |
| Defaults convention-over-config | §3, §9 (teste defaults) |
| PATCH salva, Redis write-through, X-Policy-Version | §6.2, §9 |
| 403 acionável no Free para toggle Pro | §6.2, §9 |
| Audit log previousState/newState | §6.2, §9 |
| Transparency banner ao ativar focusMonitoring | §8.5 |
| Consent exemption para withdrawn | §6.2d.ii, §9 |
| policyVersion mismatch → TanStack Query re-fetch | §8.3, §9 |
| RLS isolation | §7 |

---

## Clarifications

> Decisões tomadas na fase clarify (onda-002). Ref: dec-008 a dec-012.

### Q1 — GET /tenants/me/policies: estado do tenant ou personalizado por usuário? (dec-008, score 3)

**Decisão: A — GET reflete sempre o estado administrativo do tenant.**

O endpoint é admin-only (`@ADMIN_TENANT`). O campo `focusMonitoring` retorna o valor de `tenant.focusIndicatorEnabled` sem considerar se o usuário autenticado tem withdrawal ativo. A exemption por consent withdrawal (§6.2.h.ii) é enforcement de runtime aplicado nas próprias features (radar, heartbeat, banner) — não neste endpoint de configuração. Usuários com withdrawal não recebem o banner (§8.5), mas isso é responsabilidade do consumer da feature, não do endpoint de políticas.

### Q2 — Mecanismo para disparar transparency banner ao ativar focusMonitoring (dec-009, score 2)

**Decisão: A — EventEmitter2 interno (NestJS).**

Spec §6.2.h.i especifica "evento interno". O padrão do projeto para eventos internos NestJS é EventEmitter2 (já usado em tenants.service.ts, meetings.service.ts, groups.service.ts, onboarding). O transparency-banner.tsx (Story 5-5) é prop-driven, exibido no meeting room — não é notificação push cross-session. `PoliciesService` emite `focus-monitoring.enabled` via `EventEmitter2`; o módulo de reuniões/SSE já consome eventos internos por esse canal.

### Q3 — policyVersion incrementa em todo PATCH ou apenas em toggles Pro? (dec-010, score 3)

**Decisão: A — incrementa em todo PATCH.**

Spec §6.2 passo 3.e define `policyVersion = currentVersion + 1` sem qualquer condicional. §9 tabela de testes confirma: "policyVersion incrementa a cada PATCH". §8.3 usa mismatch de policyVersion para disparar re-fetch via TanStack Query — comportamento correto exige incremento consistente independente do toggle alterado.

### Q4 — ConsentRepository já exportado de ConsentModule? (dec-011, score 3)

**Decisão: B — já exportado.**

Evidência direta: `apps/api/src/consent/consent.module.ts` exporta explicitamente `[ConsentService, ConsentGuard, ConsentRepository]`. Esta story apenas importa `ConsentModule` em `TenantsModule` — nenhuma alteração em `consent.module.ts` necessária.

### Q5 — GET /tenants/me/policies: 200 com tierInfo completo ou 403 para campos Pro? (dec-012, score 3)

**Decisão: A — GET retorna sempre 200 com tierInfo completo.**

Spec §5.1 `PoliciesResponseSchema` define `tierInfo` com todos os toggles sem condicional por tier. Fluxo GET §6.1 passo 2f retorna `{policies, policyVersion, tierInfo}` sem exceção. O 403 está exclusivamente no PATCH (§6.2 passo 3b): tenant Free tentando ativar toggle Pro recebe `ForbiddenException`. O GET é informativo — expõe `tierInfo` para que a UI renderize tier badges e upgrade prompts.

---

## Referências

- `_bmad-output/implementation-artifacts/RECONCILIACAO-EPIC11.md` — §3, §4, §5, §6, §8, §10
- `_bmad-output/planning-artifacts/epics/epic-11.md` — Story 11.3
- `_bmad-output/implementation-artifacts/11-3-feature-toggles-tenant.md`
- `apps/api/src/tenants/tenants.controller.ts` — padrão endpoints `/me`
- `apps/api/src/tenants/branding.service.ts` — padrão de serviço de extensão
- `apps/api/test/rls/group-members.rls-spec.ts` — padrão RLS spec
- `apps/api/src/common/plan-limits/plan-limits.service.ts` — `getPlan()`
- `packages/types/src/audit/index.ts` — `AUDIT_ACTIONS` + snapshot
