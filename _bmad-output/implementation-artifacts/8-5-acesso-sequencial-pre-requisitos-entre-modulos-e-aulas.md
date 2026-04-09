# Story 8.5: Acesso Sequencial & Pré-requisitos entre Módulos e Aulas

Status: ready-for-dev

## Story

As a Admin/Líder,
I want to configure whether modules and lessons must be completed in sequence or can be accessed freely,
so that I can enforce learning paths or allow flexible exploration depending on the content.

## Acceptance Criteria

**Given** I am editing a trail
**When** I configure the trail's access mode
**Then** I can choose between: `sequential` (modules must be completed in order) or `free` (any module accessible)
**And** the setting is stored as `accessMode` field on the `Trail` model (enum: `sequential`, `free`, default: `free`)

**Given** a trail has `accessMode: sequential`
**When** a participant tries to access Module 3
**Then** access is granted only if Module 2 has `status: completed` in the participant's `ModuleProgress`
**And** if Module 2 is not complete, the API returns 403 with message: "Complete o módulo anterior para desbloquear este conteúdo"
**And** the UI shows locked modules with a lock icon and a tooltip explaining the prerequisite

**Given** a module has lessons
**When** the module has `lessonAccessMode: sequential` (configurable per module, independent of trail-level setting)
**Then** lessons within the module must be completed in order
**And** the same locking logic applies at lesson level

**Given** I configure prerequisites between modules
**When** I set Module C to require Module A and Module B as prerequisites via `PATCH /api/v1/trails/:trailId/modules/:moduleId/prerequisites`
**Then** a `ModulePrerequisite` join table stores the relationships
**And** the API validates that prerequisites don't create circular dependencies (returns 422 with explanation if detected)
**And** a participant can only access Module C when both A and B are completed

**Given** a trail has `accessMode: free`
**When** a participant navigates the trail
**Then** all modules are accessible regardless of completion status
**And** lesson-level `lessonAccessMode` within each module is still respected independently

## Tasks / Subtasks

- [ ] Task 1: Adicionar campos de access mode aos schemas (AC: #1, #3)
  - [ ] Trail: adicionar `accessMode` enum (sequential, free), default: free
  - [ ] Module: adicionar `lessonAccessMode` enum (sequential, free), default: free
  - [ ] Prisma migration
- [ ] Task 2: Criar tabela ModulePrerequisite (AC: #4)
  - [ ] Model ModulePrerequisite: moduleId, prerequisiteModuleId (composite PK)
  - [ ] @@map("module_prerequisites")
  - [ ] FK constraints para ambos moduleId
  - [ ] Migration com RLS policy
- [ ] Task 3: Implementar lógica de access control sequencial (AC: #2, #3)
  - [ ] Service method: verificar se módulo anterior está completed
  - [ ] Service method: verificar se lesson anterior está completed (module-level)
  - [ ] Retornar 403 com mensagem: "Complete o módulo anterior para desbloquear este conteúdo"
  - [ ] Guard/interceptor nos endpoints de acesso a conteúdo
- [ ] Task 4: Implementar validação de circular dependencies (AC: #4)
  - [ ] `PATCH /api/v1/trails/:trailId/modules/:moduleId/prerequisites`
  - [ ] Algoritmo de detecção de ciclos (DFS/BFS no grafo de prerequisitos)
  - [ ] Retornar 422 com explicação se ciclo detectado
  - [ ] Validar que prerequisitos pertencem à mesma trail
- [ ] Task 5: Implementar access mode free (AC: #5)
  - [ ] trail accessMode: free → todos módulos acessíveis
  - [ ] Lesson-level lessonAccessMode respeitado independentemente
  - [ ] Não aplicar locking quando accessMode = free
- [ ] Task 6: Criar componentes de lock UI (AC: #2)
  - [ ] Lock icon component para módulos/lessons bloqueados
  - [ ] Tooltip explicando prerequisito
  - [ ] Visual differentiation: locked vs unlocked
  - [ ] Accessible: aria-label para lock state
- [ ] Task 7: Testes (AC: #1, #2, #3, #4, #5)
  - [ ] Teste: sequential mode → módulo 3 bloqueado se módulo 2 incompleto
  - [ ] Teste: sequential mode → módulo 3 liberado após módulo 2 completo
  - [ ] Teste: free mode → todos módulos acessíveis
  - [ ] Teste: lesson-level sequential dentro de módulo
  - [ ] Teste: prerequisitos → Module C requer A e B
  - [ ] Teste: circular dependency detection → 422
  - [ ] Teste: free trail + sequential lesson mode
  - [ ] RLS isolation tests

## Dev Notes

- Default é `free` para ambos (trail e module) — convention over configuration
- Sequential locking é verificado no backend (guard/interceptor) — não confiar no frontend
- Circular dependency detection: usar DFS no grafo de prerequisitos
- ModulePrerequisite é N:N (um módulo pode ter múltiplos prerequisitos)
- Lesson-level access mode é independente do trail-level — flexibilidade

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Core domains (Pastoral, Meetings, Content): Repository pattern
- Supporting subdomains: Service direto com Prisma
- Events: { eventId, eventType, version, tenantId, timestamp, data, metadata }
- Testes: co-located *.spec.ts, RLS tests obrigatórios, factories com tenantId

### Dependencies
- Story 8.1: CRUD Trilhas/Módulos (Trail, Module schemas)
- Story 8.3: Progresso Individual (ModuleProgress para verificar completion)

### Project Structure Notes
```
apps/api/src/modules/content/
  ├── access/
  │   ├── access-control.service.ts
  │   ├── access-control.guard.ts
  │   └── circular-dependency.validator.ts
  └── prerequisites/
      └── prerequisites.controller.ts
apps/web/src/components/content/
  └── lock-indicator.tsx
packages/types/src/content/
  ├── access-mode.enum.ts
  └── module-prerequisite.schema.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.5
- `docs/project-context.md` — Convention over configuration
- `docs/architecture.md` — Content bounded context
