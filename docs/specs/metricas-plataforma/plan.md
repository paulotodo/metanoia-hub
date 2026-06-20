# Plano de Implementação — Métricas de Plataforma (Super Admin / FR67)

**Feature**: `metricas-plataforma` · **Story**: 13.4 · **FR**: FR67
**Branch alvo (execute-task)**: `feat/13-4-metricas-plataforma`
**Spec**: `docs/specs/metricas-plataforma/spec.md` (clarificada — 8 decisões)

## Summary

Prover ao Super Admin métricas agregadas **cross-tenant** da plataforma via dois
endpoints REST (`GET /api/v1/admin/platform-metrics/summary` e `.../tenants`),
servidos por uma **materialized view** `mv_platform_metrics` atualizada a cada 15min
como **child job BullMQ** do job pai `refresh-tenant-views` (Story 13.2b), com cache
Redis de 5min na API. Abordagem replica fielmente o padrão MV + `createPrivilegedClient`
já entregue na 13-2b (`relatorio-tenant-mv`).

## Technical Context

| Campo | Valor |
|-------|-------|
| Linguagem | TypeScript `strict: true` (NestJS 11 / Next 16) |
| DB | PostgreSQL + pgvector, Prisma v7, RLS multi-tenant |
| Jobs | BullMQ ^5.73.3 (suporta FlowProducer) |
| Cache | Redis via `RedisService` (ioredis nativo) |
| Validação | Zod 4 em `packages/types` |
| Auth | Keycloak → RolesGuard → RLS. `Role.SUPER_ADMIN = 'super_admin'` |
| Testes | Vitest, RLS isolation specs em `apps/api/test/rls/` |

## Constitution Check

*GATE: passou antes do Phase 0; re-checado pós-design (idêntico).*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | PASS | `tenant_storage_usage` tem `tenant_id` + RLS + isolation spec. MV cross-tenant é **exceção arquitetural justificada** (agregado de plataforma; barreira = `@Roles(SUPER_ADMIN)` + refresh privilegiado). Refresh nunca via `$transaction`. |
| II. Type-Safety & IDs | PASS | `strict:true`; `generateId()`/`uuidv7()`; datas ISO 8601; `null` explícito. |
| III. Idioma & Vocabulário | PASS | Código/logs em inglês; sem UI nesta story (somente API). |
| IV. Contratos de API | PASS | Zod em `packages/types`; `{data, meta}`; `/api/v1/`; `ZodValidationPipe`. |
| V. Estado Frontend | N/A | Story é backend-only (sem FE). |
| VI. Qualidade Verificável | PASS | RLS isolation spec p/ `tenant_storage_usage`; snapshot tests Zod; 403 spec. |

**Exceção registrada (Complexity Tracking)**: a MV `mv_platform_metrics` NÃO tem RLS
(viola a leitura literal do Princípio I "RLS em toda tabela"). Justificativa: é uma
**view agregada de plataforma** consumida exclusivamente por `super_admin` (operador
de plataforma, cross-tenant by design). A barreira de isolamento é o `RolesGuard`
(early-return para `super_admin`) + o fato de a MV conter apenas dados agregados, não
linhas tenant-scoped expostas individualmente sem o filtro de role. Padrão idêntico já
aceito na 13-2b para `mv_tenant_report` (que, embora tenha `tenant_id`, é refreshed via
privileged client). O endpoint `/tenants` expõe uma linha por tenant — mitigado porque
SÓ `super_admin` acessa.

## Project Structure

### Documentação (feature dir)
```
docs/specs/metricas-plataforma/
  spec.md            (existente)
  plan.md            (este)
  research.md        (SQL da MV + churn + FlowProducer)
  data-model.md      (mv_platform_metrics, tenant_storage_usage)
  contracts/
    platform-metrics-api.md
  quickstart.md
```

### Código-fonte (árvore real — arquivos a criar/modificar)
```
apps/api/prisma/
  migrations/<ts>_13-4-add-mv-platform-metrics/migration.sql   [CRIAR]
  schema.prisma                                                [MODIFICAR: + model TenantStorageUsage]
apps/api/src/bullmq/bullmq.service.ts                          [MODIFICAR: + createFlowProducer()]
apps/api/src/reports/jobs/
  refresh-tenant-views.processor.ts                            [MODIFICAR: enfileirar child via FlowProducer]
  refresh-platform-views.processor.ts                          [CRIAR: worker do child]
apps/api/src/storage/storage.service.ts                        [MODIFICAR: hook UPSERT em upload()]
apps/api/src/storage/storage.module.ts                         [MODIFICAR: import PrismaModule]
apps/api/src/super-admin/
  platform-metrics.controller.ts                               [CRIAR]
  platform-metrics.service.ts                                  [CRIAR]
  super-admin-tenants.module.ts                                [MODIFICAR: + controller/service]
apps/api/test/rls/tenant-storage-usage.rls-spec.ts             [CRIAR]
apps/api/src/super-admin/platform-metrics.controller.spec.ts   [CRIAR: 403 não-super_admin]
packages/types/src/platform-metrics.ts                         [CRIAR: schemas Zod]
packages/types/src/index.ts                                    [MODIFICAR: + re-export]
packages/types/src/__tests__/platform-metrics.snapshot.spec.ts [CRIAR]
```

## Convenções de Borda

| Camada | Case style | Validação | Fonte da verdade |
|--------|------------|-----------|------------------|
| DB columns (PostgreSQL) | snake_case | migration SQL + `@map` no Prisma | `migrations/*/migration.sql` |
| MV columns | snake_case | SELECT da MV | `migration.sql` |
| Backend DTO (TS) | camelCase | Zod parse na borda do service | `packages/types/src/platform-metrics.ts` |
| API payload (response) | camelCase | Zod (response shape) | `contracts/platform-metrics-api.md` |
| URL query params | camelCase (`page`,`limit`,`sortBy`,`sortDir`) | `ZodValidationPipe` | `contracts/*` |

**Mapper layer (DB ↔ DTO)**: o service lê a MV via `$queryRaw` (colunas snake_case) e
mapeia explicitamente para o DTO camelCase no `platform-metrics.service.ts` (sem ORM
auto-mapping para a MV — ela não é um model Prisma). `tenant_storage_usage` É model
Prisma (`TenantStorageUsage`) → Prisma faz o auto-mapping via `@map`.

**Validação Zod**: na resposta (response shape validado antes de retornar). Schema
compartilhado em `packages/types` (re-exportado FE+BE).

## Complexity Tracking

| Violação | Por que necessária | Alternativa rejeitada |
|----------|--------------------|-----------------------|
| MV sem RLS | Agregado cross-tenant de plataforma; RLS impediria o agregado | RLS com bypass por role → complexo e frágil; o padrão privileged-refresh + role-guard já é o aceito |
| `createFlowProducer()` novo no BullMqService | dec-008 exige child job encadeado ao pai; API atual só tem queue/worker | Job independente com cron próprio → perderia o "roda após o pai" e duplicaria janela de refresh |
| Hook de storage acopla StorageModule→Prisma | dec-007: contagem real de bytes em tempo de upload | Job periódico varrendo MinIO → latência alta, rejeitado no clarify (CLARIFY-02) |

## Próximos Passos
1. `/checklist` — quality gate
2. `/create-tasks` — backlog executável
3. `/analyze` — consistência cross-artifact
