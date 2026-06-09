# Implementation Plan: 2-4-tenant-guard

**Feature**: `2-4-tenant-guard` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

## Summary

Implement the residual authorization gap for Story 2-4: (1) a `TenantGuard` that enforces per-request tenant isolation as NestJS Layer 3; (2) a canonical `Role` enum that replaces inline strings in `@Roles()` and `RolesGuard`; (3) structured Pino rejection logging in both `RolesGuard` and `TenantGuard`; and (4) integration tests validating all three authorization layers together.

Layers 1 (`KeycloakAuthGuard`) and 2 (`RolesGuard` + `@Roles()`) already exist and are production-ready. This plan touches them only for the Role enum refactor and logging addition — no behavioral changes to existing guard logic.

The `TenantGuard` comparison model: `user.tenantId` (from `request.user`, set by `KeycloakAuthGuard`) vs `requestContext.getStore().tenantId` (AsyncLocalStorage, authoritative active tenant). They are set from the same source by `KeycloakAuthGuard` but comparing both confirms no state drift.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: NestJS 11.1.17, Vitest 4.1.2, Pino (via NestJS Logger abstraction)
**Storage**: N/A (stateless feature; no new DB tables or migrations)
**Testing**: Vitest, NestJS `Test.createTestingModule`
**Target Platform**: Node.js 22 (Docker, local dev)
**Project Type**: NestJS API module (bounded context: auth)
**Performance Goals**: Guard execution < 1ms per request (pure synchronous logic)
**Constraints**: AsyncLocalStorage for tenant resolution — never function parameter
**Scale/Scope**: All API endpoints that use `@UseGuards` / `APP_GUARD`

---

## Constitution Check

*GATE: Passa antes do Phase 0. Re-checado após Phase 1.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | PASS | TenantGuard lê tenant via AsyncLocalStorage/RequestContext (nunca parâmetro); super_admin bypass explícito |
| II. Type-Safety & IDs Determinísticos | PASS | Role enum elimina strings livres; AuthenticatedUser atualizado; sem UUIDs novos (feature stateless) |
| III. Idioma & Vocabulário Pastoral | PASS | Código/logs em inglês; sem mensagens user-facing novas (403 body é técnico, não pastoral) |
| IV. Contratos de API Padronizados | PASS | 403 response `{ statusCode, error, message }` sem stack trace; Role enum em `auth/enums/`, não em `packages/types` (interno à API) |
| V. Separação de Estado Frontend | N/A | Feature backend-only |
| VI. Qualidade Verificável | PASS | Tests co-located `*.spec.ts` com `tenantId` em factories; testes de integração das 3 camadas |
| VII. Processo de Entrega Auditável | PASS | 1 branch `feat/story-2-4-tenant-guard`, 1 PR; conventional commits PT-BR |

**Violações MUST**: nenhuma. Pode prosseguir.

---

## Project Structure

### Documentation (this feature)

```
docs/specs/2-4-tenant-guard/
├── spec.md
├── plan.md          (este arquivo)
├── research.md      (decisões Phase 0)
├── data-model.md    (entidades TypeScript)
├── quickstart.md    (cenários de teste)
└── tasks.md         (gerado por /create-tasks)
```

### Source Code — Arquivos a criar/modificar

```
apps/api/src/auth/
├── enums/
│   └── role.enum.ts                    [NOVO] — Role enum canônico
├── guards/
│   └── tenant.guard.ts                 [NOVO] — TenantGuard Layer 3
│   └── tenant.guard.spec.ts            [NOVO] — unit tests TenantGuard
├── decorators/
│   └── roles.decorator.ts              [MODIFICAR] — tipo: Role | string
├── interfaces/
│   └── authenticated-user.interface.ts [MODIFICAR] — roles: (Role | string)[]
├── roles.guard.ts                      [MODIFICAR] — +Pino log, +Role enum
├── auth.module.ts                      [MODIFICAR] — +TenantGuard APP_GUARD
└── __tests__/
    ├── roles.guard.spec.ts             [MODIFICAR] — atualizar para Role enum
    └── auth-layers.integration.spec.ts [NOVO] — 3-layer integration test

# Callsites de @Roles() — migrar roles canônicas para enum:
apps/api/src/groups/groups.controller.ts
apps/api/src/group-members/group-members.controller.ts
apps/api/src/admin-invites/admin-invites.controller.ts
apps/api/src/admin-pastoral/admin-pastoral.controller.ts
apps/api/src/super-admin/super-admin-tenants.controller.ts
apps/api/src/admin-users/admin-users.controller.ts
apps/api/src/meetings/reflections.controller.ts
apps/api/src/meetings/meetings.controller.ts           # 'pastor'/'admin' → manter como string
apps/api/src/meetings/reports/report.controller.ts     # 'pastor'/'admin' → manter como string
apps/api/src/meetings/sse/attendance-live.controller.ts # 'pastor'/'admin' → manter como string
apps/api/src/meetings/telemetry/focus-heartbeat.controller.ts # 'pastor'/'admin' → manter como string
apps/api/src/pastoral/pastoral.controller.ts           # 'pastor' → manter como string
```

**Structure Decision**: `TenantGuard` vai em `auth/guards/` (sub-diretório novo), não em `auth/` raiz — agrupamento lógico por tipo de artefato. `Role` enum vai em `auth/enums/` (sub-diretório novo) — separação clara entre tipos de artefato.

---

## Convenções de Borda

> N/A — feature single-layer (NestJS API interno). Nenhuma fronteira FE↔BE atravessada; sem novos endpoints, sem schemas Zod novos.

A única "borda" é `AuthenticatedUser.roles` que muda de `string[]` para `(Role | string)[]`. Isso é backward-compatible e não afeta nenhum contrato Zod publicado em `packages/types`.

---

## Implementation Tasks (sumário)

| # | Task | Tipo | Dependência |
|---|------|------|-------------|
| 1 | Criar `Role` enum + subdir `auth/enums/` | Novo arquivo | — |
| 2 | Atualizar `@Roles()` decorator: `Role \| string` | Modificar | Task 1 |
| 3 | Atualizar `AuthenticatedUser.roles`: `(Role \| string)[]` | Modificar | Task 1 |
| 4 | Adicionar Pino logging ao `RolesGuard` | Modificar | Task 1 |
| 5 | Migrar callsites `@Roles()` → enum (canônicos) | Modificar | Task 2 |
| 6 | Criar `TenantGuard` + unit test | Novo arquivo | Task 1, 3 |
| 7 | Registrar `TenantGuard` como `APP_GUARD` em `auth.module.ts` | Modificar | Task 6 |
| 8 | Criar `auth-layers.integration.spec.ts` (3-layer) | Novo arquivo | Task 6, 7 |
| 9 | Atualizar `roles.guard.spec.ts` para usar `Role` enum | Modificar | Task 1, 4 |

**Estimativa**: 1 sessão de trabalho (feature pequena e bem-delimitada).

---

## Complexity Tracking

Sem violações de MUST. Nenhuma complexidade adicional a justificar.

**Nota sobre roles não-canônicas** (`'pastor'`, `'admin'`): 5 callsites usam roles fora do enum canônico. Esses são mantidos como `string` temporariamente com comentário `// TODO: migrate when canonical role for pastor/admin is defined (Epic 11)`. Não é violação — é débito técnico consciente documentado em research.md Decision 2. O `@Roles()` decorator é tipado como `(Role | string)[]` para permitir a coexistência.
