# Story 8.8: Busca Full-Text por Conteúdo

Status: ready-for-dev

## Story

As a Participante/Líder/Admin,
I want to search for content across trails, modules and lessons using free-text search,
so that I can quickly find relevant discipleship material without browsing through the entire trail hierarchy.

## Acceptance Criteria

**Given** the content database has trails, modules, and lessons with populated `title`, `description`, and `tags` fields
**When** a Prisma migration is applied
**Then** a `tsvector` column `search_vector` is added to the `lessons` table (and optionally `trails` and `modules`)
**And** a PostgreSQL trigger automatically updates `search_vector` on INSERT and UPDATE using `to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))`
**And** a GIN index `idx_lessons_search_vector` is created on the `search_vector` column
**And** the migration includes `CREATE EXTENSION IF NOT EXISTS unaccent;` before creating the tsvector infrastructure
**And** the migration is a raw SQL migration (not Prisma schema-only, since tsvector + trigger + extension require raw SQL)
**And** the migration is wrapped in a transaction. The rollback migration drops the GIN index, trigger, tsvector column, and extension cleanly (in reverse order)
**And** soft-deleted records (`deletedAt IS NOT NULL`) are excluded from the tsvector trigger — the trigger includes a `WHERE deletedAt IS NULL` condition, preventing "ghost" results in search

**Given** I am authenticated and search via `GET /api/v1/search?q={term}`
**When** I enter a search term
**Then** results are returned from lessons matching the `ts_query` against `search_vector`
**And** results include: lesson title, trail name, module name, content type, and a text snippet with highlighted match
**And** results are ranked by `ts_rank` relevance score
**And** results are scoped to my tenant via RLS (no cross-tenant results)
**And** the search endpoint responds within 500ms for up to 10,000 lessons per tenant

**Given** I search with Portuguese diacritics (e.g., "oração" vs "oracao")
**When** the search executes
**Then** both forms return the same results (the `portuguese` text search configuration handles diacritics via `unaccent` extension installed in the migration)
**And** partial terms are supported via prefix matching (e.g., "disc" matches "discipulado")
**And** when no matches are found, the API returns an empty array `{ "data": [], "meta": { "total": 0 } }` (not an error)

**Given** I search for content
**When** a trail is in `draft` status
**Then** draft content does NOT appear in search results for Participantes
**And** Admin/Líder can see draft content in results (with a "Rascunho" badge)

## Tasks / Subtasks

- [ ] Task 1: Criar raw SQL migration para full-text search (AC: #1)
  - [ ] `CREATE EXTENSION IF NOT EXISTS unaccent;`
  - [ ] Adicionar coluna `search_vector tsvector` em lessons (e opcionalmente trails, modules)
  - [ ] Criar trigger para atualizar search_vector em INSERT/UPDATE
  - [ ] `to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))`
  - [ ] WHERE condition: `deletedAt IS NULL` no trigger
  - [ ] Criar GIN index `idx_lessons_search_vector`
  - [ ] Rollback: drop index → drop trigger → drop column → drop extension
  - [ ] Migration wrapped in transaction
- [ ] Task 2: Implementar search endpoint (AC: #2)
  - [ ] `GET /api/v1/search?q={term}`
  - [ ] Converter term em ts_query com `plainto_tsquery('portuguese', term)` ou `to_tsquery`
  - [ ] JOIN com trails e modules para contexto
  - [ ] Retornar: lesson title, trail name, module name, content type, text snippet
  - [ ] Ranking via `ts_rank(search_vector, query)`
  - [ ] RLS scoping por tenant
  - [ ] Performance: ≤ 500ms para 10,000 lessons
- [ ] Task 3: Implementar prefix matching e diacritics (AC: #3)
  - [ ] Prefix matching: "disc" → "disc:*" na ts_query
  - [ ] unaccent extension para diacritics ("oração" = "oracao")
  - [ ] Empty results: `{ "data": [], "meta": { "total": 0 } }` (não erro)
- [ ] Task 4: Implementar draft filtering por role (AC: #4)
  - [ ] Participante: excluir trails com status: draft dos resultados
  - [ ] Admin/Líder: incluir draft com badge "Rascunho"
  - [ ] Adicionar campo `isDraft` no response para frontend renderizar badge
- [ ] Task 5: Criar UI de busca (AC: #2, #3, #4)
  - [ ] Criar `apps/web/src/components/content/search-bar.tsx`
  - [ ] Criar `apps/web/src/components/content/search-results.tsx`
  - [ ] Input com debounce (300ms)
  - [ ] Results com snippet highlighted
  - [ ] Badge "Rascunho" para draft content (Admin/Líder)
  - [ ] Empty state quando sem resultados
  - [ ] TanStack Query para fetching
- [ ] Task 6: Testes (AC: #1, #2, #3, #4)
  - [ ] Teste: migration cria tsvector, trigger, GIN index
  - [ ] Teste: rollback limpa tudo na ordem correta
  - [ ] Teste: search retorna resultados ranked
  - [ ] Teste: diacritics ("oração" = "oracao")
  - [ ] Teste: prefix matching ("disc" → "discipulado")
  - [ ] Teste: empty results retorna array vazio (não erro)
  - [ ] Teste: soft-deleted records excluídos dos resultados
  - [ ] Teste: draft invisible para Participante
  - [ ] Teste: draft visível para Admin/Líder
  - [ ] Performance test: ≤ 500ms para 10,000 lessons
  - [ ] RLS isolation tests: no cross-tenant results

## Dev Notes

- Migration é RAW SQL — Prisma schema não suporta tsvector/trigger nativamente
- PostgreSQL `portuguese` text search config handle diacritics com unaccent
- GIN index é essencial para performance de full-text search
- Soft-deleted records excluídos via trigger condition — previne "ghost results"
- Draft filtering é role-based no backend — nunca confiar no frontend
- Performance target: 500ms para 10k lessons — GIN index + ts_rank

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
- Story 8.1: CRUD Trilhas/Módulos/Aulas (schemas)
- Story 8.2: Tipos de Conteúdo (title, description, tags fields)
- Story 8.6: Publicação (draft/published status)

### Project Structure Notes
```
apps/api/prisma/migrations/
  └── YYYYMMDD_add_fulltext_search/
      └── migration.sql              (raw SQL)
apps/api/src/modules/content/
  └── search/
      ├── search.controller.ts
      └── search.service.ts
apps/web/src/components/content/
  ├── search-bar.tsx
  └── search-results.tsx
packages/types/src/content/
  └── search.schema.ts
```

### References
- `_bmad-output/planning-artifacts/epics/epic-08.md` — Story 8.8
- `docs/project-context.md` — Raw SQL migrations, PostgreSQL extensions
- `docs/architecture.md` — Content bounded context, full-text search strategy
