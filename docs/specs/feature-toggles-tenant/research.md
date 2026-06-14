# Research — feature-toggles-tenant (Story 11-3)

Resolução de unknowns empíricos antes do design. Todos os NEEDS CLARIFICATION
de spec já foram fechados na fase clarify (dec-008..012). Esta pesquisa grava
fatos do codebase real que ancoram decisões do plano (sondas executadas na
onda-003).

---

## Decision 1 — Valores de plano: `'free'` / `'pro'` (lowercase)

**Decisão:** `PlanLimitsService.getPlan(tenantId)` retorna `TenantPlan` com
valores **lowercase** `'free'` | `'pro'`, lendo `tenant.plan` via `withTenantTx`.

**Rationale:** Sonda em `apps/api/src/common/plan-limits/plan-limits.service.ts:205`:
```ts
async getPlan(tenantId: string): Promise<TenantPlan> {
  const tenant = await withTenantTx(this.prisma, (tx) =>
    tx.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }),
    { tenantId });
  return (tenant?.plan ?? 'free') as TenantPlan;
}
```
A spec §3 usa "Pro"/"Free" (Title Case) como rótulo legível, mas o tier gating
no service DEVE comparar contra `'pro'` lowercase. O `requiresPlan: z.literal('pro')`
da spec §5.1 (PoliciesResponseSchema) já está correto (lowercase).

**Alternatives considered:** nenhuma — valor é fixado pelo enum existente.

---

## Decision 2 — Audit action: adicionar `'policy_change'` a `AUDIT_ACTIONS`

**Decisão:** Estender o array `AUDIT_ACTIONS` em
`packages/types/src/audit/index.ts` com `'policy_change'` (conforme spec D8),
atualizando o snapshot inline. NÃO reusar `'config_change'`.

**Rationale:** Sonda confirmou que `AUDIT_ACTIONS` atual é:
`['create','update','delete','login','logout','auth_failure','config_change','export','import','plan_limits_override']`
— **não há** `policy_change` nem `branding_change`. A spec D8 e §5.2 exigem
ação dedicada `'policy_change'` + snapshot. `AuditActionSchema = z.enum(AUDIT_ACTIONS)`
deriva automaticamente; adicionar à lista propaga ao schema. `getAuditSeverity`
(audit.service) usa `(action, resource)` — `policy_change` cai em severidade
default (`info`), o que é adequado (não é mudança de role).

**Alternatives considered:** reusar `config_change` — rejeitado: spec exige
ação granular auditável e teste de snapshot `AUDIT_ACTIONS contém 'policy_change'`.

---

## Decision 3 — `createEvent` lê `tenantId` do RequestContext (não parâmetro)

**Decisão:** `AuditService.createEvent(dto)` com DTO
`{ userId, action, resource, resourceId, payload? }`. `tenantId` é resolvido
INTERNAMENTE via `requestContext.getStore()?.tenantId` (AsyncLocalStorage) —
NUNCA passado como parâmetro (Princípio I + anti-pattern do projeto).

**Rationale:** Sonda em `apps/api/src/audit/audit.service.ts:62`:
`const tenantId = requestContext.getStore()?.tenantId ?? '';` com guard
explícito (`if (!tenantId)` loga e retorna — fix pós-7-7 do `tenantId: ''`).
`AuditModule` exporta `AuditService` (audit.module.ts:23). O PATCH de policies
roda dentro do request autenticado, portanto o RequestContext já tem `tenantId`.

**Alternatives considered:** passar tenantId no DTO — proibido pela constituição.

---

## Decision 4 — Padrão de cache write-through reusa `RedisService` + chave dedicada

**Decisão:** `cache:policies:{tenantId}` via `RedisService.get/set` com
`'EX', 3600`. Write-through (`SET` do estado novo no PATCH), NÃO `DEL` (dec D5).

**Rationale:** `branding.service.ts` é o precedente direto (Story 11-2): usa
`RedisService`, chave `cache:branding:{tenantId}`, `withTenantTx`, TTL via
`'EX', CACHE_TTL_SECONDS`. Diferença: branding faz `del` no update (cold-path
re-fetch); policies usa write-through explícito porque carrega `policyVersion`
e o FE compara header `X-Policy-Version` (dec D5). `RedisModule` é `@Global()`
mas já importado explicitamente em `TenantsModule` (defesa em profundidade,
gotcha Story 11-1).

**Alternatives considered:** `DEL`+cold-path como branding — rejeitado: spec D5
fixa write-through para servir `policyVersion` sem round-trip extra.

---

## Decision 5 — Header `X-Policy-Version` via `@Res({ passthrough: true })`

**Decisão:** Controller seta o header com `@Res({ passthrough: true }) res: Response`
e `res.set('X-Policy-Version', String(version))`, mantendo o retorno
`{ data: ... }` (passthrough preserva o serializer do Nest e o envelope `{data}`).

**Rationale:** Não há precedente de header custom em `tenants.controller.ts`
(branding não seta header). `@Res({ passthrough: true })` é o padrão NestJS
para setar header SEM assumir controle total da resposta — compatível com o
envelope `{ data }` (Princípio IV). Alternativa `@Header()` decorator é estática
(valor fixo em compile-time) e NÃO serve para `policyVersion` dinâmico.

**Alternatives considered:** interceptor dedicado — overkill para 2 rotas;
`@Header()` estático — incompatível com valor dinâmico.

---

## Decision 6 — `TenantsModule` precisa importar `AuditModule` e `ConsentModule`

**Decisão:** Adicionar `AuditModule` e `ConsentModule` aos `imports` de
`TenantsModule`. `PlanLimitsModule` e `RedisModule` JÁ estão importados.

**Rationale:** Sonda em `tenants.module.ts`: imports atuais =
`[PrismaModule, StorageModule, PlanLimitsModule, RedisModule]`. **Faltam**
`AuditModule` (exporta `AuditService`) e `ConsentModule` (exporta
`ConsentRepository` — confirmado consent.module.ts:exports). `PoliciesService`
injeta `PrismaService, RedisService, PlanLimitsService, AuditService, ConsentRepository`.
Sem os 2 imports → erro de DI em runtime. `ConsentRepository` JÁ exportado
(dec-011 confirmado) — nenhuma alteração em `consent.module.ts`.

**Alternatives considered:** módulo próprio `PoliciesModule` — rejeitado por D3
(estender TenantsModule, padrão branding).

---

## Decision 7 — Transparency banner via EventEmitter2 (dec-009)

**Decisão:** `PoliciesService` emite `focus-monitoring.enabled` via
`EventEmitter2` quando `focusMonitoring` transita OFF→ON no PATCH. O consumo
(SSE/meeting → `transparency-banner.tsx`) já existe e é responsabilidade do
módulo de reuniões. Esta story NÃO altera o banner nem cria novo canal SSE.

**Rationale:** dec-009 (clarify) fixou EventEmitter2 como padrão de evento
interno do projeto. `transparency-banner.tsx` existe em
`apps/web/src/components/meetings/transparency-banner.tsx` (Story 5-5),
prop-driven. Fora de escopo: push/email (spec §11).

**Alternatives considered:** chamada direta cross-module — rejeitada (acoplamento);
push notification — fora de escopo §11.

---

## Decision 8 — Exemption por consent é runtime-side, não no GET (dec-008)

**Decisão:** `GET /me/policies` retorna SEMPRE o estado administrativo do tenant
(focusMonitoring = `tenant.focusIndicatorEnabled`), ignorando withdrawal do
usuário autenticado. A exemption (`hasActiveWithdrawal(userId, 'focus_monitoring')`)
é aplicada no runtime das features consumidoras (radar/heartbeat/banner), não no
endpoint de configuração. O PATCH apenas registra o estado; o flag de exemption
por usuário é resolvido onde a feature é efetivamente lida.

**Rationale:** dec-008/dec-012 (clarify). Endpoint é admin-only (`@ADMIN_TENANT`),
informativo. `consentType` para focusMonitoring = `'focus_monitoring'` — adicionar
a `ConsentDocumentType` SE ausente (verificar na implementação; spec D7).

**Alternatives considered:** filtrar no GET por usuário — rejeitado por dec-008
(GET reflete estado do tenant).
