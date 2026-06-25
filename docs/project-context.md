---
project_name: 'metanoia-hub'
user_name: 'Paulo'
date: '2026-04-05'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 47
optimized_for_llm: true
---

# Project Context for AI Agents

_Este arquivo contém regras críticas e padrões que agentes de IA devem seguir ao implementar código neste projeto. Foco em detalhes não-óbvios que agentes poderiam ignorar._

---

## Technology Stack & Versions

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| **Turborepo** | 2.5+ | Monorepo orchestration, remote cache CI |
| **Next.js** | 16.2 | Frontend — hybrid SSR (landing/SEO) + CSR (área auth) |
| **NestJS** | 11.1.17 | Backend REST API |
| **PostgreSQL** | latest + pgvector | Database com RLS multi-tenant |
| **Prisma** | v7 | ORM — schema + type-safe queries (RLS via SQL raw) |
| **Redis** | latest | Cache, BullMQ jobs, rate limiting, estado de reunião |
| **Keycloak** | latest | Auth centralizado — 3 camadas de autorização |
| **MinIO** | latest | Object storage (S3-compatible) |
| **Zod** | 4.3.6 | Contratos compartilhados FE+BE em `packages/types` |
| **TanStack Query** | 5.96.2 | Server state (Client Components only) |
| **Zustand** | 5.0.12 | Client/UI state |
| **React Hook Form** | 7.72.1 | Formulários + `@hookform/resolvers/zod` |
| **Tailwind CSS** | 4.2.2 | Styling — config compartilhada em `packages/config` |
| **shadcn/ui** | CLI v4 | Componentes UI — inicializado em `packages/ui` |
| **Vitest** | 4.1.2 | Unit + integration tests (FE + BE) |
| **Playwright** | 1.59.1 | E2E contra Docker Compose real |
| **Pino** | nestjs-pino 4.6.1 | Logging estruturado JSON |
| **Sentry** | latest | Error tracking (MVP) |
| **Resend** | latest | Email transacional (MVP) |
| **Traefik** | 3.6.x | Reverse proxy + auto-discovery Docker Swarm |
| **BullMQ** | latest | Job queue (flush presença, emails, notificações) |
| **pnpm** | 10.33.0 | Package manager |
| **@nestjs/swagger** | 11.2.6 | OpenAPI auto-gerada |

**Monorepo structure:** `apps/web` (Next.js), `apps/api` (NestJS), `packages/ui` (shadcn), `packages/types` (Zod schemas), `packages/config` (ESLint, TSConfig, Tailwind)

---

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

- **TypeScript strict** em todo o monorepo — `strict: true` sem exceções
- **Código** (variáveis, funções, logs, comentários): **inglês**
- **Mensagens de erro para o usuário**: **PT-BR**, centralizadas em `apps/web/messages/pt-BR.json`
- **Logs**: inglês (para observabilidade)
- **Swagger descriptions**: inglês (preparação API pública Phase 4)
- **UUID v7** gerado na aplicação com lib `uuidv7` — **nunca** usar `@default(uuid())` do Prisma (gera v4)
- **Zod 4.3.6** como padrão de contratos em `packages/types` — schemas compartilhados entre FE e BE
- **Snapshot tests** obrigatórios para schemas Zod — gate contra breaking changes silenciosas
- **Datas**: ISO 8601 string. **Booleans**: `true`/`false` (nunca `1`/`0`). **Nulls**: `null` explícito (nunca omitir campo)
- **Constantes de erro** em `packages/types` (ex: `ERRORS.TENANT_LIMIT_EXCEEDED`)

### Framework-Specific Rules

**Next.js 16.2:**
- **Server Components por padrão** — App Router
- SSR: landing, pricing, blog (SEO). CSR: área autenticada (interatividade)
- Server Components usam `fetch` nativo — **sem TanStack Query**
- Apenas Client Components usam TanStack Query — não colocar `QueryClientProvider` onde não é necessário
- Middleware Next.js verifica sessão antes de renderizar área autenticada

**NestJS 11.1:**
- Módulos organizados por **bounded context** (auth, tenant, groups, content, meetings, pastoral, analytics, notifications, audit, onboarding)
- **Core domains** (Pastoral, Meetings, Content): **repository pattern** para isolar queries Prisma da lógica de negócio
- **Supporting subdomains** (Groups, Onboarding, etc.): service direto com Prisma
- `ZodValidationPipe` custom em `apps/api/src/common/pipes/` (~20 linhas) — sem libs terceiras
- `ExceptionFilter` global → formato `ErrorResponseDto` padronizado
- `@nestjs/config` + validação fail-fast no boot com Zod — bootstrap falha se variáveis faltarem
- API versionada: prefixo `/api/v1/` desde o MVP

**Multi-tenancy (REGRA ABSOLUTA):**
- `tenant_id` em **todas** as tabelas desde o MVP (RLS)
- **Fluxo**: Request → Guard extrai tenant_id do token Keycloak → injeta em `RequestContext` via `AsyncLocalStorage`
- **Nunca** passar tenant_id como parâmetro de controller → service → repository
- Prisma extension/middleware injeta tenant_id automaticamente em todas as queries
- 3 camadas de autorização: Keycloak (roles) → NestJS Guards (endpoint + tenant + group) → RLS PostgreSQL

**State Management:**
- **Server state**: TanStack Query 5.96 (Client Components only) — cache, revalidação, optimistic updates
- **Client/UI state**: Zustand 5.0.12 — um store por concern (`useAuthStore`, `useMeetingStore`, `useUIStore`)
- **Nunca** misturar server state (TanStack Query) com client state (Zustand)

**Redis namespaces** (5 prefixos no MVP, single instance):
- `cache:*` — leitura (TTL 30-300s). `rt:*` — estado de reunião. `queue:*` — BullMQ. `rate:*` — rate limiting. `session:*` — se necessário

### Testing Rules

- **Vitest 4.1.2** como framework unificado FE + BE
- **Playwright 1.59.1** para E2E contra Docker Compose real no CI
- Unit tests: `*.spec.ts` (co-located com source)
- Integration tests: `*.integration-spec.ts`
- E2E tests: `*.e2e-spec.ts` em `apps/web/e2e/`
- **RLS isolation tests** em `apps/api/test/rls/` — obrigatórios desde o dia 1 para cada migration que toque policies
- **Factory pattern** em `apps/api/test/factories/` — cada factory **sempre** inclui `tenantId`
- **MSW** (Mock Service Worker) em `apps/web` para interceptar requests em testes de componente — handlers espelham OpenAPI spec
- E2E seed: tenant de teste + admin + líder + participante + grupo + trilha. Cleanup no `afterAll`
- Banco limpo entre suites via `docker-compose.test.yml`
- **Test util para logs Pino** — assertions sobre campos estruturados (`tenantId`, `userId`, `action`)

### Code Quality & Style Rules

**Naming:**

| Área | Padrão | Exemplo |
|------|--------|---------|
| Arquivos TS/TSX | kebab-case | `user-group.service.ts` |
| Classes/interfaces | PascalCase | `UserGroupService` |
| Funções/variáveis | camelCase | `findByTenantId` |
| Constantes | UPPER_SNAKE_CASE | `MAX_GROUPS_PER_TENANT` |
| Componentes React | PascalCase | `GroupCard` |
| Hooks | use + camelCase | `useGroupMembers` |
| Endpoints REST | plural, kebab-case | `/api/v1/trail-modules` |
| Query params | camelCase | `?pageSize=20` |
| JSON fields | camelCase | `tenantId` |
| DB tabelas | snake_case via @@map | `user_groups` |
| DB colunas | snake_case via @map | `tenant_id` |
| Índices DB | idx_{tabela}_{colunas} | `idx_users_email` |
| RLS policies | rls_{tabela}_{ação} | `rls_users_select` |
| Eventos | context.entity.action | `groups.member.added` |

**API Responses:**
- Sucesso: `{ "data": {...}, "meta?": {...} }` — lista paginada inclui `meta.page`, `meta.pageSize`, `meta.total`
- Erro: `ErrorResponseDto` → `{ statusCode, error, message, details? }`
- Criação: HTTP 201. Deleção: HTTP 204 (sem body). Async aceito: HTTP 202

**Eventos de domínio:**
- Payload: `{ eventId, eventType, version, tenantId, timestamp, data, metadata }`
- **Sempre** incluir `tenantId` e `version` — consumers devem ser idempotentes
- Schemas em Zod em `packages/types/events/`

### Development Workflow Rules

- **Branches**: kebab-case com prefixo de intenção (`feat/`, `fix/`, `docs/`, `refactor/`)
- **Commits**: conventional commits em português
- **CI (GitHub Actions)**: PR → lint + test + build (Turborepo remote cache). Merge main → build images + deploy
- **E2E**: Playwright em workflow separado contra Docker Compose completo
- **Snapshot tests de schemas Zod** no pipeline de PR — gate de qualidade
- **Docker Compose**: dev local (`docker-compose.yml`), CI (`docker-compose.test.yml`), prod (`docker-compose.prod.yml`)
- **Setup dev**: `git clone → ./scripts/setup.sh → docker compose up → pnpm dev`
- **`.env.example`** versionado com todas as variáveis documentadas

### Validation Gates (Definition of Done por onda / PR)

Gate obrigatório antes de abrir PR em **toda** onda `execute-task` da pipeline (PAI/humano). Origem: o CI verde exige mais do que `pnpm --filter @metanoia/api test` — uma feature backend/full-stack passa nos unit tests com deps mockadas e ainda quebra em runtime/integração que **só o CI pega** (Epic 14 custou ~6 ciclos de CI por pular este sweep).

**Sempre rodar (independe do que mudou):**

1. `pnpm turbo lint` — lint do monorepo completo (não `--filter` de um app só; lint de `packages/types`/`web` escapa do filtro do `api`).
2. `pnpm turbo test` — unit + integration + RLS specs (specs RLS rodam idempotentes 2× no CI).
3. `pnpm turbo build` — type-check completo (tsc); erros de tipo só aparecem no Build do CI, nunca no lint/test.

**Condicional ao que a mudança toca:**

4. **Tocou `packages/types` (schemas Zod / enums)** → `pnpm --filter @metanoia/types test` (snapshot tests; gate contra breaking change) **e** `pnpm turbo build --filter=@metanoia/web` (um enum é contrato FE+BE: `Record<...Type, ...>` exaustivo ou `switch` no FE quebra o build do web).
5. **Tocou frontend (`apps/web`)** → `pnpm --filter @metanoia/web test` + `pnpm turbo build --filter=@metanoia/web`.
6. **Tocou módulo da API / `onModuleInit` / env vars / assets não-`.ts`** → boot real: `pnpm --filter @metanoia/api start:e2e` + `curl -s http://localhost:3001/api/health` (deve responder 200). `onModuleInit` não é coberto por unit tests mockados. Pegou no Epic 14: env var obrigatória sem default trava o boot (adicionar ao bloco `env:` dos jobs E2E/Axe com `${{ secrets.X || 'dummy' }}`); asset `.lua`/`.sql`/`.html` não copiado para `dist/` → `ENOENT` (declarar em `compilerOptions.assets` do `nest-cli.json`); nome de fila BullMQ **não pode conter `:`** (usar nome "bare", o `BullMqService` injeta o prefixo).
7. **Tocou `schema.prisma`** → `pnpm exec prisma generate` (no `apps/api`) antes de buildar, senão o tsc local diverge do CI; e validação Postgres local da migration (subir `docker-compose.test.yml`, `prisma migrate deploy`, conferir RLS).

> Nota CI: o evento `synchronize` **não** dispara run neste repo — após push numa PR aberta, forçar com `gh pr close <n> && gh pr reopen <n>`. Runs cancelados pela `concurrency` aparecem como fails em 0–40s; olhar sempre o run mais recente.

### Critical Don't-Miss Rules

**Multi-tenancy & RLS:**
- RLS obrigatório desde o MVP — sem exceções
- Testes automatizados de isolamento de tenant em cada migration que toque policies
- Tenant pai vê **apenas dados agregados** via materialized views — queries que vazem dados individuais são **proibidas por design**
- Hierarquia de tenants: tenant local = controlador dos seus dados; tenant pai = controlador apenas dos agregados

**LGPD Compliance:**
- Exportação de dados pessoais ≤ 72h
- Exclusão de dados pessoais ≤ 30 dias
- Consentimento prévio obrigatório
- Retenção diferenciada: gravações 90d, auditoria 1 ano, notificações 6 meses
- Dados pessoais inativos: purgação após período definido

**Acessibilidade:**
- **WCAG AA obrigatório** em todas as interfaces — sem exceções

**Vocabulário:**
- Usar vocabulário **pastoral** (não corporativo) em toda a UI e comunicação com o usuário
- Contexto: plataforma de discipulado cristão — linguagem deve refletir isso

**Feature Gating:**
- **Dual control**: Subscription Tiers (Free/Pro/Enterprise) definem o que está **disponível**; Feature Toggles por tenant definem o que está **ativo**
- Toggle só pode ativar o que o tier permite

**Complexidade Progressiva:**
- Express mode como padrão — configuração mínima para onboarding rápido
- Admin → primeiro grupo ≤ 10 min, Líder → dashboard ≤ 3 min, Participante → primeira trilha ≤ 2 min

**Anti-patterns (PROIBIDO):**
- ❌ Passar `tenant_id` como parâmetro de função — usar AsyncLocalStorage
- ❌ Usar `@default(uuid())` do Prisma — usar `uuidv7()` na aplicação
- ❌ Criar `packages/utils` genérico — packages com nomes semânticos sob demanda
- ❌ Misturar server state (TanStack Query) com client state (Zustand)
- ❌ TanStack Query em Server Components — usar `fetch` nativo
- ❌ Libs terceiras para validação NestJS (ex: `nestjs-zod`) — usar ZodValidationPipe custom
- ❌ Queries diretas que vazem dados entre tenants — sempre via RLS + materialized views para agregados
- ❌ Omitir `tenantId` em eventos de domínio ou factories de teste
- ❌ `undefined` em JSON responses — usar `null` explícito
- ❌ Stack traces na resposta ao frontend — apenas `message` + `error` code

---

## Usage Guidelines

**Para Agentes de IA:**
- Leia este arquivo antes de implementar qualquer código
- Siga TODAS as regras exatamente como documentado
- Em caso de dúvida, prefira a opção mais restritiva
- Atualize este arquivo se novos padrões emergirem
- Consulte o Quick Reference da architecture.md para dúvidas de naming

**Para Humanos:**
- Mantenha este arquivo enxuto e focado nas necessidades dos agentes
- Atualize quando a stack tecnológica mudar
- Revise trimestralmente para remover regras que se tornaram óbvias
- Remova regras que o código já enforça via linting/CI

Last Updated: 2026-04-05
