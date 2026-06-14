# Contract: Zod Schemas (Story 11-1)

Localização: `packages/types/src/plans/subscription.ts`. Re-export em
`packages/types/src/index.ts`. Snapshot tests obrigatórios (gate contra breaking
change — constitution VI). Reusa `TenantPlanSchema` de `super-admin-tenant.ts`
(FR-INFRA-08 — não recriar enum).

## Schemas exportados

```ts
// limites de PLANO (default do tier) — null = ilimitado
export const PlanLimitsSchema = z.object({
  maxGroups: z.number().int().positive().nullable(),
  maxMembersPerGroup: z.number().int().positive().nullable(),
  maxLeadersPerTenant: z.number().int().positive().nullable(),
});

// OVERRIDE — persistência/leitura (shape salvo em tenants.plan_limits_override)
// cada campo number>0 OU null (null = usar default do plano). objeto parcial.
export const PlanLimitsOverrideSchema = z.object({
  maxGroups: z.number().int().positive().nullable().optional(),
  maxMembersPerGroup: z.number().int().positive().nullable().optional(),
  maxLeadersPerTenant: z.number().int().positive().nullable().optional(),
});

// OVERRIDE — input do PATCH (validação de borda; negativos/não-numéricos → erro→422)
// {} permitido (zera override → null). Reaproveita as mesmas regras de borda.
export const PlanLimitsOverrideInputSchema = PlanLimitsOverrideSchema;
// (separado por contrato C1/dec-008 mesmo que regra coincida hoje — permite
//  divergir futuramente sem refactor de callsites; create-tasks cria os dois nomes.)

// PLANO completo
export const SubscriptionPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  tier: TenantPlanSchema,            // REUSO — free/pro/enterprise
  limits: PlanLimitsSchema,
  features: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean(),
});

// DTO de listagem (GET /plans) — + tenantCount derivado
export const SubscriptionPlanListItemSchema = SubscriptionPlanSchema.extend({
  tenantCount: z.number().int().nonnegative(),
});

export type PlanLimits = z.infer<typeof PlanLimitsSchema>;
export type PlanLimitsOverride = z.infer<typeof PlanLimitsOverrideSchema>;
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
```

> Nota: `int().positive()` rejeita 0 e negativos. `nullable` permite o sentinela
> "usar default do plano" (override) / "ilimitado" (plano). A distinção semântica
> de `null` é por contexto (override vs limits) — documentada no data-model.

## AUDIT_ACTIONS (FR-INFRA-09)

`packages/types/src/audit/index.ts` — adicionar `'plan_limits_override'` ao array:

```ts
export const AUDIT_ACTIONS = [
  'create','update','delete','login','logout',
  'auth_failure','config_change','export','import',
  'plan_limits_override',   // NOVO
] as const;
```

Regenerar snapshot que cobre `AUDIT_ACTIONS`/`AuditActionSchema`.

## TenantPatchInputSchema (estendido)

`packages/types/src/super-admin-tenant.ts`:

```ts
export const TenantPatchInputSchema = z.object({
  name: z.string().optional(),
  status: TenantStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  planLimitsOverride: PlanLimitsOverrideInputSchema.optional(),  // NOVO
});
```

`TenantDetailSchema` ganha `planLimitsOverride: PlanLimitsOverrideSchema.nullable()`
para leitura no GET de detalhe.

## Snapshot tests

- `packages/types/src/__tests__/plans-subscription.snapshot.spec.ts` — `toMatchSnapshot()`
  de `SubscriptionPlanSchema`, `PlanLimitsSchema`, `PlanLimitsOverrideSchema`,
  `PlanLimitsOverrideInputSchema`.
- Snapshot de `AUDIT_ACTIONS` atualizado (novo membro).
- Mudar um campo → snapshot falha (gate funciona — US6 Independent Test).
