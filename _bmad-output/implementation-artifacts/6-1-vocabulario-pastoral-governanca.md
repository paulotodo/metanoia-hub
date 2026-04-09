# Story 6.1: Vocabulário Pastoral & Governança

Status: ready-for-dev

## Story

As a platform operator,
I want a centralized pastoral vocabulary with lint enforcement across frontend and backend,
so that all communication uses care-oriented language, never surveillance terms.

## Acceptance Criteria

**Given** the platform needs consistent pastoral language
**When** `vocabulary.ts` is created in `packages/types`
**Then** it exports typed constants for all pastoral terms: "cuidado", "acompanhamento", "presença", "atenção pastoral", etc.
**And** lint rules are configured in both `apps/web` and `apps/api` to block surveillance/corporate terms hardcoded outside vocabulary (ex: "vigilância", "tracking", "monitoramento")
**And** any change to `vocabulary.ts` requires PR review (enforced via CODEOWNERS)

**Given** a developer adds a new UI string related to monitoring
**When** they use a hardcoded term not from vocabulary.ts
**Then** the lint rule fails CI with a descriptive error pointing to vocabulary.ts as the source of truth

## Tasks / Subtasks

- [ ] Task 1: Criar vocabulary.ts em packages/types (AC: #1)
  - [ ] Criar `packages/types/src/vocabulary/vocabulary.ts`
  - [ ] Exportar typed constants para todos os termos pastorais
  - [ ] Incluir: "cuidado", "acompanhamento", "presença", "atenção pastoral", "visibilidade pastoral", "semáforo", etc.
  - [ ] Tipar com `as const` para type safety
  - [ ] Exportar index do package
- [ ] Task 2: Configurar lint rules para bloqueio de termos proibidos (AC: #1, #2)
  - [ ] Criar ESLint custom rule ou usar `no-restricted-syntax` em `packages/config`
  - [ ] Bloquear termos: "vigilância", "tracking", "monitoramento", "surveillance", "monitoring"
  - [ ] Configurar tanto em `apps/web/.eslintrc` quanto `apps/api/.eslintrc`
  - [ ] Mensagem de erro descritiva: "Use termos de vocabulary.ts. Consulte packages/types/src/vocabulary/vocabulary.ts"
- [ ] Task 3: Configurar CODEOWNERS (AC: #1)
  - [ ] Adicionar `packages/types/src/vocabulary/` ao `.github/CODEOWNERS`
  - [ ] Requerer review para qualquer alteração em vocabulary.ts
- [ ] Task 4: Testes (AC: #1, #2)
  - [ ] Teste: lint rule detecta termos proibidos e falha
  - [ ] Teste: termos do vocabulary.ts passam lint
  - [ ] Snapshot test dos termos exportados (prevenir mudanças silenciosas)

## Dev Notes

- vocabulary.ts é a source of truth para TODA linguagem pastoral da plataforma
- Lint rules devem funcionar no CI — falha de lint = PR bloqueado
- Termos proibidos específicos: vigilância, tracking, monitoramento, surveillance, monitoring, rastreamento
- Termos permitidos (via vocabulary.ts): cuidado, acompanhamento, presença, atenção pastoral, visibilidade
- CODEOWNERS garante governança — mudanças precisam de review

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
- Epic 1: Monorepo setup (packages/types, ESLint config)
- Nenhuma dependência de stories anteriores — pode ser desenvolvida em paralelo

### Project Structure Notes
```
packages/types/src/vocabulary/
  ├── vocabulary.ts
  └── index.ts
packages/config/eslint/
  └── no-surveillance-terms.js  (custom ESLint rule)
.github/
  └── CODEOWNERS  (adicionar entry para vocabulary)
```

### References
- `_bmad-output/planning-artifacts/epics/epic-06.md` — Story 6.1
- `docs/project-context.md` — Regra de vocabulário pastoral
- `docs/architecture.md` — packages/types shared contracts
