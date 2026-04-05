---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-05.md'
  - '_bmad-output/planning-artifacts/metanoia-hub-prd-validation-report.md'
  - 'docs/prd.md'
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-04-05'
project_name: 'metanoia-hub'
user_name: 'Paulo'
date: '2026-04-05'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
82 FRs distribuídos em 9 módulos, com entrega incremental em 3 releases MVP + 3 fases pós-MVP:

| Módulo | FRs | Release | Peso Arquitetural |
|--------|-----|---------|-------------------|
| Identidade & Acesso (FR01-FR11) | 11 | 1a | Alto — fundação de auth/authz |
| Tenant & Configuração (FR12-FR19) | 8 | 1a/1b | Alto — multi-tenancy core |
| Grupos & Membros (FR20-FR28) | 9 | 1a/1b | Médio — CRUD com isolamento |
| Trilhas & Conteúdo (FR29-FR42) | 14 | 1a/1b/2 | Alto — multiformato, progresso, busca |
| Reuniões ao Vivo (FR43-FR53) | 11 | 2 | Muito Alto — real-time, presença, engajamento |
| Visibilidade Pastoral (FR54-FR62) | 9 | 2 | Muito Alto — **core domain** (Radar Pastoral) |
| Relatórios & Analytics (FR63-FR68) | 6 | 1b/2 | Médio — agregações, dashboards |
| Onboarding & Adoção (FR69-FR75) | 7 | 1a/1b | Alto — constraint de product-market fit |
| Capabilities Transversais (FR76-FR82) | 7 | 1b/2/Post | Médio — busca, notificações, auditoria |

**Distribuição por release:** 24 FRs (Release 1a) + 23 FRs (Release 1b) + 27 FRs (Release 2) + 8 FRs (Post-MVP)

**Non-Functional Requirements:**
52 NFRs que direcionam decisões arquiteturais críticas:

- **Performance (11)**: LCP ≤ 2,5s, INP ≤ 200ms, entrada na reunião < 3s, dashboard ≤ 2s (cache quente), player de vídeo visível ≤ 2s
- **Segurança (10)**: Autenticação centralizada (Keycloak), autorização 3 camadas (Keycloak → NestJS Guards → RLS), criptografia in transit (TLS) + at rest (MinIO SSE, PostgreSQL TDE/column-level), URLs assinadas com expiração
- **Escalabilidade (3+targets)**: Multi-tenant RLS → database-per-tenant, horizontal scaling preparado
- **Confiabilidade (7)**: RPO ≤ 1h, RTO ≤ 4h, backups com segregação geográfica, teste trimestral de restore
- **Acessibilidade (6)**: WCAG AA obrigatório em todas as interfaces
- **Integração & Resiliência (5)**: Circuit breaker, retry com backoff, fallback graceful
- **Observabilidade (5)**: Logs estruturados + Sentry (MVP), Grafana/Prometheus/Loki (Phase 3+) — **concern arquitetural, não afterthought**
- **LGPD (5)**: Exportação ≤ 72h, exclusão ≤ 30 dias, consentimento prévio, retenção diferenciada por tipo de dado
- **Onboarding (3)**: Admin → primeiro grupo ≤ 10 min, Líder → dashboard ≤ 3 min, Participante → primeira trilha ≤ 2 min — **constraint arquitetural** que limita complexidade do provisionamento

**Scale & Complexity:**

- Primary domain: Full-stack web SaaS B2B (EdTech)
- Complexity level: Alta (EdTech + real-time + multi-tenant + compliance LGPD)
- Estimated architectural components: ~12-15

### Bounded Contexts (DDD)

Mapeamento dos bounded contexts identificados para guiar modularização e futura separação de serviços:

| Bounded Context | Classificação DDD | Justificativa |
|----------------|-------------------|---------------|
| **Pastoral Visibility (Radar)** | Core Domain | Diferenciador único do produto — sistema semáforo, alertas de engajamento, acompanhamento pastoral. Merece o maior investimento em design, testes e resiliência |
| **Live Meetings** | Core Domain | Pipeline real-time de presença/engajamento alimenta o Radar. Componente mais complexo tecnicamente |
| **Content & Trails** | Core Domain | Trilhas de discipulado multiformato com progresso — segundo pilar de valor do produto |
| **Identity & Access** | Generic Subdomain | Autenticação/autorização delegada ao Keycloak + guards — padrão de mercado |
| **Tenant Management** | Supporting Subdomain | Provisionamento, configuração, feature toggles, tiers — essencial mas não diferenciador |
| **Groups & Members** | Supporting Subdomain | CRUD com isolamento de tenant — padrão com regras de negócio específicas |
| **Notifications** | Supporting Subdomain | SSE, in-app, WhatsApp (futuro) — canal de entrega, não lógica de negócio |
| **Audit & Compliance** | Supporting Subdomain | Trilha de auditoria, LGPD, retenção — obrigatório mas transversal |
| **Analytics & Reporting** | Supporting Subdomain | Dashboards, relatórios agregados — consome dados dos core domains |
| **Onboarding** | Supporting Subdomain | Wizards, templates, guided setup — otimizado para time-to-value |

### Componentes Essenciais por Release

**Release 1a (Core Loop — essenciais para validar product-market fit):**
- Auth/IAM (Keycloak), Tenant Management (básico), Groups & Members, Content & Trails (básico), Onboarding
- Foco: velocidade de entrega, setup simples, time-to-value mínimo

**Release 1b (Polish + Operacional — preparação):**
- Tiers & limites, branding, auditoria, busca em conteúdo, relatórios básicos
- Foco: operacionalidade para primeiros clientes reais

**Release 2 (Reunião + Radar — core domains ativados):**
- Live Meetings, Pastoral Visibility (Radar), notificações in-app, analytics avançado
- Foco: diferenciação de produto, ativação dos core domains

**Post-MVP (Growth/Enterprise/IA):**
- WhatsApp (ChatMaster Veloz), NATS JetStream, observabilidade completa, API pública, hierarquia de tenants, IA/Copiloto Pastoral

### Technical Constraints & Dependencies

**Stack definido no PRD:**
- Frontend: Next.js (hybrid SSR/CSR) — SSR para landing/SEO, CSR para área autenticada
- Backend: NestJS
- Database: PostgreSQL + pgvector (extensão instalada no MVP, **zero modelagem de embeddings** até Phase 5)
- Auth: Keycloak (autenticação centralizada + roles base)
- Cache/Jobs/Real-time state: Redis + BullMQ — **dívida técnica consciente**: cache, sessões, BullMQ e estado de reunião no mesmo Redis no MVP. Em escala, separar instâncias por concern (cache vs. pub/sub vs. jobs)
- Storage: MinIO (mídia, documentos, gravações)
- Event bus: NATS JetStream (Release 2+ — quando houver 3+ serviços)
- Browser support: Chrome, Edge, Firefox, Safari (últimas 2 versões) + mobile browsers

**Isolamento de dados:**
- RLS (Row-Level Security) com `tenant_id` em todas as tabelas desde o MVP
- Sem schema separation no MVP (simplifica migrations e operação)
- Evolução para database-per-tenant em tiers enterprise quando houver demanda real

**Real-time pipeline (SSE → Redis → PostgreSQL):**
- SSE para dashboard ao vivo e notificações in-app
- WebSocket do provedor de vídeo para chat em reunião
- Cache de reunião ativa em Redis com flush para PostgreSQL no encerramento
- **Failure modes documentados:** se o flush falhar, dados de presença da sessão podem ser perdidos. Mitigação: write-ahead log em Redis com retry, alerta de falha de flush, reconciliação assíncrona

**Segurança em profundidade (3 camadas):**
1. Keycloak — autenticação + roles base
2. NestJS Guards — autorização por endpoint (role + tenant_id + group_id)
3. RLS no PostgreSQL — última linha de defesa, mesmo com bug no backend
- **Requisito arquitetural:** testes automatizados de isolamento de tenant em cada migration que toque policies de RLS

**Retenção diferenciada:**
- Gravações de reunião: 90 dias (configurável por tenant)
- Logs de auditoria: mínimo 1 ano
- Dados de presença/engajamento: alinhados ao ciclo do programa
- Notificações enviadas: 6 meses
- Dados pessoais inativos: purgação após período definido

### Constraint Arquitetural: Hierarquia de Tenants

> **Promovido de cross-cutting concern para constraint arquitetural de primeira classe** — esta decisão governa modelagem de dados em toda a plataforma.

- Tenant pai (rede de igrejas) vê **apenas dados agregados** dos sub-tenants, nunca dados individuais
- Cada tenant local é controlador dos seus dados; tenant pai é controlador apenas dos agregados
- **Decisão arquitetural:** materialized views para dados agregados do tenant pai, com refresh periódico. Queries diretas que possam vazar dados individuais são **proibidas por design**
- Isolamento de dados pessoais entre níveis hierárquicos
- Configuração de visibilidade por nível hierárquico

### Feature Gating: Interação entre Toggles e Tiers

O sistema possui dois mecanismos de feature control que interagem:

1. **Subscription Tiers (Free/Pro/Enterprise):** definem limites numéricos (grupos, participantes, storage, reuniões simultâneas) e acesso a features por plano
2. **Feature Toggles por Tenant:** configurações booleanas dentro do tier (monitoramento de foco on/off, câmera obrigatória on/off, políticas de retenção)

**Regra:** Tiers determinam **o que está disponível**; toggles determinam **o que está ativo** dentro do disponível. Um toggle só pode ativar o que o tier permite.

### Cross-Cutting Concerns

1. **Multi-tenancy & isolamento de dados** — permeia toda a arquitetura, cada query, cada endpoint
2. **Auditoria completa** — trilha de auditoria desde o MVP para todos os eventos críticos
3. **LGPD & privacidade** — consentimento, retenção, exportação, exclusão, minimização de dados
4. **Feature gating (tiers + toggles)** — controle dual em todas as features configuráveis
5. **Acessibilidade WCAG AA** — impacta toda a camada de UI/frontend
6. **Observabilidade como concern arquitetural** — logs estruturados, métricas e tracing em todos os componentes desde o MVP
7. **Autorização granular** — RBAC + ABAC leve por escopo em 3 camadas
8. **Testabilidade de isolamento** — testes automatizados de RLS como gate de qualidade em migrations
9. **Performance testing contínuo** — NFRs mensuráveis precisam de validação automatizada, não apenas targets documentados

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web SaaS B2B (EdTech) — monorepo com frontend (Next.js) e backend (NestJS) no mesmo repositório, com packages compartilhados para tipos, componentes UI e configurações.

### Versões Atuais Verificadas (Abril 2026)

| Tecnologia | Versão | Nota |
|-----------|--------|------|
| Turborepo | 2.5+ | Mantido pela Vercel, cache remoto, task orchestration |
| Next.js | 16.2 | Adapter API estável, Server Fast Refresh, Turbopack |
| NestJS | 11.1.17 | CacheModule v6, ParseDatePipe |
| Prisma | v7 | Query compilers redesenhados, Prisma Studio rebuild |
| Tailwind CSS | 4.2.2 | Engine 5x mais rápido, zero config, CSS-first |
| shadcn/ui | CLI v4 | Radix UI unificado, skills para agents, monorepo support |
| Vitest | 4.1.2 | Vite 8 beta support, async leak detection |
| Playwright | 1.59.1 | Timeline no HTML report, agent support |
| pnpm | 10.33.0 | v11 em beta, usar stable |

### Starters Avaliados

| Opção | Descrição | Veredito |
|-------|-----------|---------|
| `create-turbo` oficial | Scaffold básico Turborepo + Next.js. Não inclui backend | Base sólida, requer customização |
| nestjs-turbo (comunidade) | Monorepo Next.js + NestJS pronto | Risco de versões desatualizadas e opiniões do autor |
| nest-turbo-starter (comunidade) | NestJS monorepo com Turborepo + pnpm | Mesmo risco de manutenção irregular |

### Starter Selecionado: `create-turbo` oficial + scaffold manual NestJS

**Racional:** Templates da comunidade tendem a ficar desatualizados rapidamente. Com Turborepo 2.x + pnpm workspaces, o scaffold manual do NestJS como segundo app é trivial e garante controle total sobre versões e configurações.

### Comando de Inicialização

```bash
# 1. Scaffold Turborepo
pnpm dlx create-turbo@latest metanoia-hub --package-manager pnpm

# 2. Adicionar NestJS como app (scaffold base — reorganizar por bounded context na mesma story)
cd metanoia-hub/apps
npx @nestjs/cli new api --package-manager pnpm --skip-git

# 3. Inicializar shadcn/ui em packages/ui (não em apps/web — componentes compartilháveis)
cd ../packages/ui
pnpm dlx shadcn@latest init

# 4. Adicionar Prisma ao backend
cd ../apps/api
pnpm add prisma @prisma/client
pnpm dlx prisma init

# 5. Adicionar Tailwind CSS ao frontend
cd ../apps/web
pnpm add tailwindcss @tailwindcss/postcss

# 6. Setup automatizado via script
cd ../..
chmod +x scripts/setup.sh
```

**Nota:** Um script `scripts/setup.sh` deve automatizar todos os passos acima para que um dev novo precise apenas de: `git clone → ./scripts/setup.sh → docker compose up → pnpm dev`.

### Estrutura do Monorepo

```
metanoia-hub/
├── apps/
│   ├── web/                        # Next.js 16.2 (frontend)
│   │   ├── app/                    # App Router (SSR landing, CSR área auth)
│   │   ├── components/             # Componentes locais (page-specific)
│   │   └── lib/                    # Utilitários frontend
│   └── api/                        # NestJS 11.x (backend)
│       ├── src/
│       │   ├── modules/            # Módulos NestJS por bounded context
│       │   │   ├── auth/           # Identity & Access
│       │   │   ├── tenant/         # Tenant Management
│       │   │   ├── groups/         # Groups & Members
│       │   │   ├── content/        # Content & Trails
│       │   │   ├── meetings/       # Live Meetings
│       │   │   ├── pastoral/       # Pastoral Visibility (Radar) — core domain
│       │   │   ├── analytics/      # Analytics & Reporting
│       │   │   ├── notifications/  # Notifications
│       │   │   ├── audit/          # Audit & Compliance
│       │   │   └── onboarding/     # Onboarding
│       │   ├── common/             # Guards, interceptors, pipes, RLS middleware
│       │   └── prisma/             # PrismaService + PrismaModule
│       ├── prisma/
│       │   ├── schema.prisma       # Schema (models, relations)
│       │   └── migrations/         # Inclui SQL raw para RLS policies
│       └── test/
│           └── rls/                # RLS isolation test utils (desde o dia 1)
├── packages/
│   ├── ui/                         # shadcn/ui inicializado aqui (componentes compartilhados)
│   ├── types/                      # Tipos/contratos entre frontend e backend
│   └── config/                     # ESLint, TSConfig, Tailwind config compartilhados
├── docker/
│   ├── docker-compose.yml          # Dev local (PostgreSQL, Redis, Keycloak, MinIO)
│   ├── docker-compose.test.yml     # CI — estado limpo por run (PostgreSQL + Redis)
│   ├── docker-compose.prod.yml     # Produção (Hetzner VPS + Docker Swarm/Portainer)
│   └── keycloak/
│       └── realm-export.json       # Realm pré-configurado (roles, client, admin teste)
├── scripts/
│   └── setup.sh                    # 1 comando: scaffold + install + docker up + ready
├── turbo.json
├── pnpm-workspace.yaml
└── .github/
    └── workflows/
        ├── ci.yml                  # PR: lint + test + build (com Turborepo cache)
        ├── deploy.yml              # Merge em main: build images + deploy
        └── e2e.yml                 # E2E Playwright contra Docker Compose completo
```

**Nota:** `packages/utils` intencionalmente não incluído. Packages compartilhados devem ser criados sob demanda com nomes semânticos (ex: `packages/validation`, `packages/date-helpers`) para evitar dumping ground.

### Decisões Arquiteturais do Starter

**Language & Runtime:**
- TypeScript strict em todo o monorepo, Node.js LTS
- Configuração TSConfig compartilhada via `packages/config`

**Styling:**
- Tailwind CSS 4.2 + shadcn/ui CLI v4 (Radix UI unificado)
- shadcn/ui inicializado em `packages/ui` para compartilhamento entre apps

**Build Tooling:**
- Turbopack (Next.js dev), SWC (NestJS compilation)
- Turborepo para orquestração de tasks com remote caching no CI

**Testing:**
- Vitest 4.1 como framework unificado para frontend e backend (avaliar suporte experimental do NestJS 11 com Vitest; fallback para Jest no backend apenas se houver incompatibilidade)
- Playwright 1.59 para E2E contra ambiente Docker Compose real no CI
- `docker-compose.test.yml` separado para testes de integração com estado limpo
- RLS isolation test utils em `apps/api/test/rls/` desde o dia 1

**ORM & Database:**
- Prisma v7 para schema definition e queries type-safe
- **SQL raw migrations para RLS policies** — Prisma não tem suporte nativo a RLS; policies gerenciadas manualmente em migration files SQL
- PostgreSQL com extensão pgvector instalada no MVP, **zero modelagem de embeddings** até Phase 5

**Code Organization:**
- Monorepo com `apps/` e `packages/`
- Módulos NestJS organizados por bounded context (não pela estrutura default do `nest new`)
- A reorganização por bounded context é parte da story de inicialização

**Auth & Storage:**
- Keycloak mantido (não substituir por Auth.js) — multi-tenant B2B com 6 roles e RBAC complexo requer auth centralizado desde o MVP; custo de migração futura > custo de setup
- Realm export pré-configurado versionado em `docker/keycloak/realm-export.json`
- MinIO no Docker Compose local para dev, S3-compatible storage em produção (SDK MinIO é compatível com S3, sem lock-in)

**Infrastructure:**
- Docker Compose para dev local (PostgreSQL, Redis, Keycloak, MinIO)
- Hetzner VPS + Docker Swarm/Portainer para produção inicial
- GitHub Actions para CI/CD com Turborepo remote cache

**Developer Experience:**
- `scripts/setup.sh` automatiza setup completo em 1 comando
- Hot reload via Turbopack (frontend) e SWC (backend)
- Keycloak sobe pré-configurado com realm, roles e admin de teste

**Nota:** A inicialização do projeto usando estes comandos e estrutura deve ser a primeira story de implementação.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Bloqueiam Implementação):**
- API pattern: REST + OpenAPI (@nestjs/swagger 11.2.6)
- Validação: Zod 4.3.6 como padrão de contratos compartilhados em `packages/types`
- Auth: Keycloak com 3 camadas de autorização (decidido Step 2/3)
- ORM: Prisma v7 para schema/queries + SQL raw para RLS policies (decidido Step 3)
- Multi-tenancy: RLS com tenant_id em todas as tabelas (decidido Step 2)

**Important Decisions (Moldam a Arquitetura):**
- State management: TanStack Query 5.96 + Zustand 5.0.12
- Caching: Redis com namespaces separados por concern
- Logging: Pino via nestjs-pino 4.6.1 (estruturado, JSON)
- Reverse proxy: Traefik 3.6.x com Docker Swarm auto-discovery
- Email transacional: Resend (MVP), evolução para Amazon SES em escala
- Formulários: React Hook Form 7.72 + @hookform/resolvers/zod

**Deferred Decisions (Post-MVP):**
- NATS JetStream — quando houver 3+ serviços (Release 2+)
- Database-per-tenant — quando enterprise exigir
- Observabilidade completa Grafana/Prometheus/Loki — Phase 3+
- API pública versionada — Phase 4
- Busca semântica com pgvector — Phase 5

### Data Architecture

**API Pattern: REST + OpenAPI**
- Decisão: REST com documentação OpenAPI auto-gerada via `@nestjs/swagger` 11.2.6
- Rationale: API pública planejada para Phase 4; Swagger grátis com NestJS decorators; compatibilidade com clients externos
- Afeta: todos os módulos backend, frontend API client
- Versão: @nestjs/swagger 11.2.6

**Preparação para API Pública:**
- Desde o MVP, separar controllers em módulos `internal` e `public-ready`
- Controllers que eventualmente serão parte da API pública devem ter documentação mais rica nos decorators `@ApiOperation`, `@ApiResponse`
- Custo quase zero de preparação; evita retrabalho na Phase 4

**Contrato de Erro Padronizado:**
- Definir `ErrorResponseDto` com Zod em `packages/types`:
  - `statusCode: number` — HTTP status code
  - `error: string` — código máquina (ex: `TENANT_LIMIT_EXCEEDED`)
  - `message: string` — mensagem humana em português
  - `details?: unknown[]` — erros de validação Zod, se aplicável
- Todos os módulos devem usar este formato; NestJS ExceptionFilter global garante consistência

**Validação: Zod 4.3.6 Compartilhado**
- Decisão: Zod como padrão de contratos em `packages/types`, compartilhado entre frontend e backend
- Backend: custom `ZodValidationPipe` em `apps/api/src/common/pipes/` (~20 linhas) — sem dependência de libs terceiras como `nestjs-zod`
- Frontend: React Hook Form 7.72 + `@hookform/resolvers/zod`
- Versão: Zod 4.3.6 (JSON Schema support, template literal types, 6.7M ops/s)
- **Disciplina de versionamento:** schemas em `packages/types` devem ter **snapshot tests** que falham se a shape mudar — gate de qualidade para prevenir breaking changes silenciosas em ambos os lados
- Pin React Hook Form na v7 até v8 sair stable + resolver atualizado

**Caching Strategy: Redis com Namespaces**
- Decisão: Redis single instance no MVP com 5 namespaces lógicos separados por prefixo
- Namespaces:
  - `cache:*` — cache de leitura (dashboard líder TTL 30-60s, lista grupos TTL 60-300s)
  - `rt:*` — estado efêmero de reunião (presença, TTL curto renovado por heartbeat)
  - `queue:*` — BullMQ jobs (flush de presença, notificações, async tasks)
  - `rate:*` — rate limiting por tenant/endpoint
  - `session:*` — apenas se necessário; JWT stateless minimiza necessidade
- Invalidation: por evento de domínio, não só por expiração de TTL
- **Threshold de migração documentado:** quando Redis atinge >70% CPU consistentemente, separar em instâncias por concern (cache vs. pub/sub vs. jobs). Monitorar `redis_commands_processed_total` desde o dia 1 via métricas custom no Pino

**Email Transacional: Resend**
- Decisão: Resend como provedor de email no MVP (SDK Node.js, REST, SMTP)
- Use cases: convites, reset de senha, notificações por email
- Free tier: 100 emails/dia, 3.000/mês
- **Threshold de migração para Amazon SES:** quando custo mensal Resend > $50 ou volume > 10K emails/mês
- Abstração via service layer no NestJS (interface `EmailService`) torna troca transparente

### Authentication & Security

(Já decidido nos Steps 2 e 3 — referência cruzada)

- **Autenticação:** Keycloak com e-mail/senha e Google OAuth
- **Autorização 3 camadas:** Keycloak (roles) → NestJS Guards (endpoint + tenant + group) → RLS PostgreSQL
- **6 Roles RBAC:** Super Admin, Admin Tenant, Editor de Conteúdo, Líder, Participante, Auditor
- **ABAC leve por escopo:** tenant_id, group_id, ownership, granted_permissions
- **Criptografia:** TLS in transit, server-side encryption MinIO, column-level/TDE PostgreSQL para dados sensíveis
- **Upload seguro:** URLs assinadas com expiração (MinIO/S3)

### API & Communication Patterns

**REST + OpenAPI com Padrões NestJS:**
- Documentação automática via decorators `@ApiTags`, `@ApiOperation`, `@ApiResponse`
- Swagger UI disponível em dev; Scalar como UI alternativa (drop-in replacement)
- Versionamento: prefixo `/api/v1/` desde o MVP; período de deprecação definido para v2
- Rate limiting: por tier de assinatura e por endpoint, usando Redis namespace `rate:*`

**Error Handling:**
- `ErrorResponseDto` global via ExceptionFilter
- Códigos de erro como constantes em `packages/types` (ex: `ERRORS.TENANT_LIMIT_EXCEEDED`)
- Erros de validação Zod incluem `details[]` com campo e mensagem específicos

**Comunicação Interna (MVP):**
- Chamadas diretas entre módulos NestJS (mesmo processo)
- BullMQ para tarefas assíncronas (flush presença, envio de email, notificações)
- SSE para push ao frontend (dashboard ao vivo, notificações in-app)
- **Evolução:** NATS JetStream quando houver 3+ serviços (Release 2+)

### Frontend Architecture

**State Management:**
- **Server state:** TanStack Query 5.96.2 para Client Components — cache, revalidação, optimistic updates, loading/error states
- **Client/UI state:** Zustand 5.0.12 para estado de interface leve (sidebar, modals, preferências locais)
- **Regra documentada:** Server Components usam `fetch` nativo do Next.js (sem TanStack Query); apenas Client Components usam TanStack Query. Não colocar `QueryClientProvider` onde não é necessário

**Formulários:**
- React Hook Form 7.72.1 + `@hookform/resolvers/zod`
- Schemas Zod de `packages/types` reutilizados como validação de formulário
- Pin na v7 até v8 stable

**Component Architecture:**
- shadcn/ui em `packages/ui` (componentes compartilhados, Radix UI unificado)
- Componentes page-specific em `apps/web/components/`
- Tailwind CSS 4.2 com config compartilhada em `packages/config`

**Rendering Strategy:**
- SSR: landing page, pricing, blog, recursos (SEO)
- CSR: área autenticada, dashboard, reunião, trilhas (interatividade)
- Next.js 16.2 App Router com Server Components por padrão

**Testes Frontend:**
- Vitest 4.1.2 para unit/component tests
- **MSW (Mock Service Worker)** como devDependency em `apps/web` para interceptar requests em testes de componente — handlers espelham a OpenAPI spec
- Playwright 1.59.1 para E2E contra Docker Compose real

### Infrastructure & Deployment

**Hosting:**
- Produção MVP: Hetzner VPS + Docker Swarm + Portainer
- Reverse proxy: Traefik 3.6.x com auto-discovery de containers, Let's Encrypt automático
- **Evolução HA:** quando escalar para 2+ nodes, Traefik em modo replicated com healthcheck + Swarm ingress routing mesh. No MVP com 1 VPS, Traefik como SPOF é aceitável

**Observabilidade:**
- Logging: Pino via nestjs-pino 4.6.1 com JSON structured logs
- **Middleware automático:** extrai `tenant_id` e `user_id` do token Keycloak e injeta no contexto Pino — todo log subsequente na request já inclui tenant_id e user_id sem intervenção manual
- **Test util para logs:** captura logs Pino durante testes e permite assertions sobre campos estruturados (tenant_id, action, etc.)
- Error tracking: Sentry (MVP)
- Métricas: custom metrics via Pino (ex: `redis_commands_processed_total`) no MVP; Grafana/Prometheus/Loki na Phase 3+

**CI/CD: GitHub Actions**
- PR: lint + test + build (com Turborepo remote cache)
- Merge em main: build de imagens Docker + deploy
- E2E: Playwright contra Docker Compose completo em workflow separado
- Snapshot tests de schemas Zod no pipeline de PR

**Environment Configuration:**
- `@nestjs/config` + validação fail-fast no boot com Zod
- Se variáveis obrigatórias estiverem ausentes, bootstrap falha imediatamente com mensagem clara
- `.env.example` versionado com todas as variáveis documentadas

### Decision Impact Analysis

**Sequência de Implementação:**
1. Scaffold monorepo (Turborepo + pnpm) + Docker Compose (infra local)
2. Setup Keycloak com realm export + NestJS auth module
3. Prisma schema base + RLS policies + test utils
4. `packages/types` com Zod schemas + ErrorResponseDto + snapshot tests
5. ZodValidationPipe custom + ExceptionFilter global
6. Módulos NestJS por bounded context (começando pelos Release 1a)
7. Frontend Next.js com TanStack Query + shadcn/ui
8. CI/CD GitHub Actions com Turborepo cache

**Cross-Component Dependencies:**
- `packages/types` (Zod schemas) → usado por `apps/api` (ZodValidationPipe) e `apps/web` (React Hook Form)
- Keycloak token → consumido por NestJS Guards, RLS middleware, e Pino context middleware
- Redis → consumido por BullMQ (jobs), cache service, e rate limiter — todos no mesmo NestJS app
- OpenAPI spec gerada → base para MSW handlers em testes frontend
- Docker Compose → base para dev local, testes de integração, e E2E no CI

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Prisma → PostgreSQL):**
- Models Prisma: `PascalCase`, mapeado para `snake_case` via `@@map` (ex: `model UserGroup` → `@@map("user_groups")`)
- Campos Prisma: `camelCase`, mapeado para `snake_case` via `@map` (ex: `tenantId` → `@map("tenant_id")`)
- Foreign keys: `{entidade}Id` no Prisma → `{entidade}_id` no banco (ex: `tenantId` → `tenant_id`)
- Índices: `idx_{tabela}_{colunas}` (ex: `idx_users_email`, `idx_groups_tenant_id`)
- RLS policies: `rls_{tabela}_{ação}` (ex: `rls_users_select`, `rls_groups_insert`)
- **IDs: UUID v7** gerado na aplicação com lib `uuidv7` — nunca usar `@default(uuid())` do Prisma (gera v4). UUID v7 é ordenável por tempo, melhor para índices B-tree

**API REST:**
- Endpoints: **plural**, kebab-case (ex: `/api/v1/groups`, `/api/v1/trail-modules`)
- Route params: `:id` (NestJS default) (ex: `/api/v1/groups/:groupId/members/:memberId`)
- Query params: `camelCase` (ex: `?pageSize=20&sortBy=createdAt`)
- Headers custom: `X-Tenant-Id`, `X-Request-Id`

**Código TypeScript:**
- Arquivos: `kebab-case.ts` (ex: `user-group.service.ts`, `create-trail.dto.ts`)
- Classes/interfaces: `PascalCase` (ex: `UserGroupService`, `CreateTrailDto`)
- Funções/variáveis: `camelCase` (ex: `findByTenantId`, `isActive`)
- Constantes: `UPPER_SNAKE_CASE` (ex: `MAX_GROUPS_PER_TENANT`, `ERRORS.TENANT_LIMIT_EXCEEDED`)
- Enums: `PascalCase` membro `PascalCase` (ex: `enum Role { SuperAdmin, AdminTenant }`)

**React Components:**
- Arquivo: `kebab-case.tsx` (ex: `group-card.tsx`, `trail-progress.tsx`)
- Componente: `PascalCase` (ex: `GroupCard`, `TrailProgress`)
- Hooks custom: `use` prefix + camelCase (ex: `useGroupMembers`, `useTenantConfig`)

**Padrão de i18n:**
- **Código** (variáveis, funções, comentários): inglês
- **Mensagens de erro para o usuário**: português (PT-BR), centralizadas em `apps/web/messages/pt-BR.json`
- **Logs**: inglês (para ferramentas de observabilidade parsearem facilmente)
- **Swagger descriptions**: inglês (preparação para API pública Phase 4)

### Structure Patterns

**Testes — naming por tipo:**
- Unit test: `*.spec.ts` (NestJS convention)
- Integration test: `*.integration-spec.ts`
- E2E test: `*.e2e-spec.ts`

**Testes — localização:**
- Backend unit/integration: co-located, mesmo diretório do source (ex: `groups.service.spec.ts`)
- Frontend unit: co-located (ex: `group-card.test.tsx`)
- E2E: `apps/web/e2e/`
- RLS isolation: `apps/api/test/rls/`
- Factories: `apps/api/test/factories/`

**Módulo NestJS — CRUD simples (ex: Groups, Onboarding):**
```
modules/groups/
├── groups.module.ts
├── groups.controller.ts
├── groups.service.ts
├── groups.service.spec.ts
├── dto/
│   ├── create-group.dto.ts
│   └── update-group.dto.ts
└── entities/
    └── group.entity.ts
```

**Módulo NestJS — Core domain (ex: Pastoral, Meetings):**
```
modules/pastoral/
├── pastoral.module.ts
├── pastoral.controller.ts
├── pastoral.service.ts          # lógica de negócio
├── pastoral.repository.ts       # queries Prisma isoladas
├── pastoral.service.spec.ts
├── pastoral.repository.spec.ts
├── dto/
├── entities/
└── events/
    └── pastoral-alert.event.ts
```
**Regra:** core domains (Pastoral Visibility, Live Meetings, Content & Trails) usam repository pattern para isolar queries Prisma da lógica de negócio. Supporting subdomains (Groups, Onboarding, etc.) podem usar service direto com Prisma.

**Componente React:**
```
components/group-card/
├── group-card.tsx
├── group-card.test.tsx
└── index.ts
```
Ou flat para componentes simples: `group-card.tsx` direto em `components/`.

### Format Patterns

**API Response — sucesso:**
```json
// Entidade única
{ "data": { "id": "uuid-v7", "name": "Grupo Alpha", ... } }

// Lista paginada
{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 42 } }

// Criação: HTTP 201
{ "data": { "id": "uuid-v7", ... } }

// Deleção: HTTP 204 (sem body)

// Ação assíncrona aceita: HTTP 202
{ "data": { "status": "accepted", "jobId": "uuid" } }

// Operação em lote
{ "data": { "succeeded": 5, "failed": 1, "errors": [...] } }

// Health check (sem wrapper)
{ "status": "ok", "version": "1.0.0" }
```

**API Response — erro (ErrorResponseDto):**
```json
{
  "statusCode": 422,
  "error": "VALIDATION_FAILED",
  "message": "Os dados fornecidos são inválidos",
  "details": [
    { "field": "email", "message": "Email já está em uso" }
  ]
}
```

**Data formats:**
- JSON fields: `camelCase` (consistente com TypeScript)
- Datas: ISO 8601 string (ex: `"2026-04-05T14:30:00.000Z"`)
- Booleans: `true`/`false` (nunca `1`/`0`)
- Nulls: `null` explícito (nunca `undefined` em JSON, nunca omitir campo)
- IDs: UUID v7 (string)

### Communication Patterns

**Eventos de domínio (BullMQ / futuro NATS):**
- Naming: `{bounded-context}.{entity}.{action}` kebab-case (ex: `groups.member.added`, `meetings.presence.flushed`, `pastoral.alert.triggered`)
- Payload padrão:
```json
{
  "eventId": "uuid-v7",
  "eventType": "groups.member.added",
  "version": 1,
  "tenantId": "uuid",
  "timestamp": "2026-04-05T14:30:00.000Z",
  "data": { ... },
  "metadata": { "userId": "uuid", "source": "api" }
}
```
- **Sempre** incluir `tenantId` no payload (isolamento)
- Campo `version` obrigatório — quando payload mudar, incrementar version
- Consumers devem lidar com versões que conhecem e logar/ignorar as que não conhecem
- Schemas de eventos em Zod em `packages/types/events/` para type-safety e validação
- Idempotency: `eventId` único; consumers devem ser idempotentes

**Multi-tenancy — fluxo do tenant_id no código:**
- **Request → Guard extrai tenant_id do token Keycloak → injeta em RequestContext via AsyncLocalStorage**
- **Service acessa tenant_id via RequestContext — nunca como parâmetro de função**
- **Prisma extension/middleware injeta tenant_id automaticamente em todas as queries**
- **Regra absoluta:** nunca passar tenant_id como parâmetro de controller → service → repository. É propenso a esquecimento. O padrão via AsyncLocalStorage + Prisma extension torna **impossível** fazer query sem isolamento de tenant

**Zustand stores:**
- Um store por concern: `useAuthStore`, `useMeetingStore`, `useUIStore`
- Nunca misturar server state (TanStack Query) com client state (Zustand)
- Actions definidas dentro do store

### Process Patterns

**Error Handling:**
- Backend: `HttpException` subclasses com códigos de `packages/types` → interceptado por `ExceptionFilter` global → formato `ErrorResponseDto`
- Frontend: TanStack Query `onError` para erros de API → toast notification padrão. Error boundaries do React para crashes de componente
- Logging vs user error: backend loga stack trace completo (Pino); frontend recebe apenas `message` + `error` code (nunca stack trace)

**Loading States:**
- TanStack Query: usar `isLoading`, `isFetching`, `isError` nativos — não criar estado duplicado
- Skeletons: componentes skeleton do shadcn/ui para carregamento inicial
- Optimistic updates: via TanStack Query `onMutate` para ações do usuário (ex: marcar presença)

**Auth Flow:**
- Keycloak redirect flow (não embedded login)
- Token refresh automático via Keycloak JS adapter
- NestJS Guard verifica token em cada request + extrai tenant_id + user_id → RequestContext
- Frontend: middleware Next.js verifica sessão antes de renderizar área autenticada

**Validação:**
- Frontend: Zod schema no `onSubmit` do React Hook Form (ao submeter, não em cada keystroke)
- Backend: `ZodValidationPipe` custom no controller (na entrada do endpoint)
- Banco: RLS como última linha de defesa (não valida shape, valida acesso)

### Test Patterns

**Factory Pattern para dados de teste:**
```typescript
// apps/api/test/factories/group.factory.ts
import { uuidv7 } from 'uuidv7';
import { DEFAULT_TEST_TENANT_ID } from '../constants';

export const groupFactory = {
  build: (overrides = {}) => ({
    id: uuidv7(),
    tenantId: DEFAULT_TEST_TENANT_ID,
    name: 'Grupo de Teste',
    createdAt: new Date(),
    ...overrides,
  }),
};
```
- Uma factory por entidade em `apps/api/test/factories/`
- Factory **sempre** inclui `tenantId` — reforça padrão multi-tenant nos testes
- Defaults sensatos; testes sobrescrevem apenas o que precisam

**E2E Seed Strategy:**
- Seed global cria: tenant de teste, admin, líder, participante, grupo, trilha básica
- Cada suite pode adicionar dados específicos
- Cleanup no `afterAll` de cada suite
- Banco sempre em estado limpo entre suites via `docker-compose.test.yml`

**Testes de SSE (real-time):**
- Integration test: `EventSource` mock para verificar que endpoint SSE emite eventos corretos quando estado muda no Redis
- E2E (Playwright): `page.evaluate` para ouvir SSE e verificar atualização de UI

**Testes de logs (Pino):**
- Test util que captura logs Pino durante teste e permite assertions sobre campos estruturados (`tenantId`, `userId`, `action`)

### Quick Reference (Cheat Sheet)

| Área | Padrão | Exemplo |
|------|--------|---------|
| **DB tabelas** | snake_case via @@map | `user_groups` |
| **DB colunas** | snake_case via @map | `tenant_id` |
| **IDs** | UUID v7 gerado na app | `uuidv7()` |
| **Endpoints** | plural, kebab-case | `/api/v1/trail-modules` |
| **Query params** | camelCase | `?pageSize=20` |
| **JSON fields** | camelCase | `tenantId` |
| **Datas** | ISO 8601 | `2026-04-05T14:30:00.000Z` |
| **Arquivos TS** | kebab-case | `user-group.service.ts` |
| **Classes** | PascalCase | `UserGroupService` |
| **Funções** | camelCase | `findByTenantId` |
| **Constantes** | UPPER_SNAKE_CASE | `MAX_GROUPS_PER_TENANT` |
| **Componentes** | PascalCase | `GroupCard` |
| **Hooks** | use + camelCase | `useGroupMembers` |
| **Eventos** | context.entity.action | `groups.member.added` |
| **RLS policies** | rls_tabela_ação | `rls_users_select` |
| **Unit tests** | *.spec.ts | `groups.service.spec.ts` |
| **Integration** | *.integration-spec.ts | `rls.integration-spec.ts` |
| **E2E** | *.e2e-spec.ts | `login.e2e-spec.ts` |
| **Response ok** | `{ data, meta? }` | `{ "data": {...} }` |
| **Response erro** | ErrorResponseDto | `{ statusCode, error, message }` |
| **Tenant flow** | AsyncLocalStorage | Nunca como parâmetro |
| **Server state** | TanStack Query | Client Components only |
| **Client state** | Zustand | UI state only |
| **Validação** | Zod em packages/types | Compartilhado FE + BE |
| **Código** | Inglês | variáveis, logs |
| **UI messages** | PT-BR centralizado | `messages/pt-BR.json` |
| **Core domains** | Repository pattern | Pastoral, Meetings |
| **CRUD simples** | Service direto | Groups, Onboarding |

### Enforcement Guidelines

**Todos os agentes de IA DEVEM:**
1. Consultar este Quick Reference antes de criar qualquer arquivo, endpoint ou schema
2. Gerar UUID v7 na service layer, nunca delegar ao banco
3. Usar RequestContext (AsyncLocalStorage) para tenant_id, nunca parâmetros
4. Incluir `tenantId` em todo evento de domínio e toda factory de teste
5. Usar `ErrorResponseDto` para toda resposta de erro, sem exceção
6. Manter código em inglês e mensagens do usuário em PT-BR centralizado
7. Usar repository pattern para core domains, service direto para CRUD simples
8. Incluir campo `version` em todo evento de domínio

**Verificação de padrões:**
- ESLint rules customizadas para naming conventions
- Snapshot tests para schemas Zod em `packages/types`
- CI pipeline falha se naming conventions forem violadas
- Code review checklist inclui verificação de padrões multi-tenant

## Project Structure & Boundaries

### Complete Project Directory Structure

```
metanoia-hub/
├── .github/
│   └── workflows/
│       ├── ci.yml                          # PR: lint + test + build (Turborepo cache)
│       ├── deploy.yml                      # Merge main: build images + deploy Hetzner
│       └── e2e.yml                         # Playwright contra Docker Compose completo
├── docker/
│   ├── docker-compose.yml                  # Dev local: PostgreSQL, Redis, Keycloak, MinIO
│   ├── docker-compose.test.yml             # CI: estado limpo por run
│   ├── docker-compose.prod.yml             # Produção: Hetzner + Swarm
│   ├── keycloak/
│   │   ├── realm-export.json               # Realm pré-configurado (roles, client, admin teste)
│   │   └── Dockerfile                      # Keycloak com realm import
│   ├── postgres/
│   │   └── init.sql                        # Extensões (pgvector, uuid-ossp) — conveniência dev local
│   └── traefik/
│       └── traefik.yml                     # Config estática (entrypoints, certs)
├── scripts/
│   ├── setup.sh                            # 1 comando: scaffold + install + docker up
│   ├── apply-rls.sh                        # Aplica RLS policies após migrations
│   ├── seed.ts                             # Seed de dados para dev local
│   └── seed-e2e.ts                         # Seed mínimo para E2E (inclui estado Redis para reunião)
├── apps/
│   ├── web/                                # ── NEXT.JS 16.2 (FRONTEND) ──
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.local
│   │   ├── .env.example
│   │   ├── middleware.ts                   # Auth check + redirect para área autenticada
│   │   ├── app/
│   │   │   ├── layout.tsx                  # Root layout
│   │   │   ├── globals.css                 # Tailwind base imports
│   │   │   ├── (public)/                   # Grupo de rotas SSR (SEO)
│   │   │   │   ├── page.tsx                # Landing page
│   │   │   │   ├── pricing/page.tsx
│   │   │   │   └── layout.tsx              # Layout público (header, footer)
│   │   │   └── (authenticated)/            # Grupo de rotas CSR (área auth)
│   │   │       ├── layout.tsx              # Layout autenticado (importa AppProviders)
│   │   │       ├── dashboard/
│   │   │       │   └── page.tsx            # Dashboard por role
│   │   │       ├── groups/
│   │   │       │   ├── page.tsx            # Lista de grupos
│   │   │       │   └── [groupId]/
│   │   │       │       ├── page.tsx        # Detalhe do grupo
│   │   │       │       └── members/page.tsx
│   │   │       ├── trails/
│   │   │       │   ├── page.tsx            # Lista de trilhas
│   │   │       │   └── [trailId]/
│   │   │       │       ├── page.tsx        # Detalhe da trilha
│   │   │       │       └── [moduleId]/page.tsx
│   │   │       ├── meetings/
│   │   │       │   ├── page.tsx            # Agenda de reuniões
│   │   │       │   └── [meetingId]/
│   │   │       │       └── page.tsx        # Sala de reunião (real-time)
│   │   │       ├── pastoral/
│   │   │       │   ├── page.tsx            # Radar Pastoral (dashboard semáforo)
│   │   │       │   └── [participantId]/page.tsx
│   │   │       ├── reports/
│   │   │       │   └── page.tsx            # Relatórios e analytics
│   │   │       ├── settings/
│   │   │       │   ├── page.tsx            # Config tenant (admin)
│   │   │       │   ├── branding/page.tsx
│   │   │       │   ├── policies/page.tsx   # Feature toggles
│   │   │       │   └── users/page.tsx      # Gestão de usuários
│   │   │       ├── onboarding/
│   │   │       │   └── page.tsx            # Wizard de setup
│   │   │       └── admin/                  # Super Admin only
│   │   │           ├── tenants/
│   │   │           │   ├── page.tsx        # Lista de tenants
│   │   │           │   └── [tenantId]/page.tsx  # Detalhe do tenant
│   │   │           ├── platform/
│   │   │           │   ├── page.tsx        # Health, métricas
│   │   │           │   └── audit/page.tsx  # Logs de auditoria global
│   │   │           └── users/page.tsx      # Gestão de super admins
│   │   ├── components/                     # Componentes page-specific
│   │   │   ├── dashboard/
│   │   │   │   ├── leader-dashboard.tsx
│   │   │   │   └── participant-dashboard.tsx
│   │   │   ├── meetings/
│   │   │   │   ├── meeting-room.tsx
│   │   │   │   ├── presence-indicator.tsx
│   │   │   │   └── engagement-monitor.tsx
│   │   │   ├── pastoral/
│   │   │   │   ├── radar-semaphore.tsx     # Core: semáforo do Radar Pastoral
│   │   │   │   ├── alert-card.tsx
│   │   │   │   └── participant-timeline.tsx
│   │   │   └── trails/
│   │   │       ├── trail-progress.tsx
│   │   │       ├── module-viewer.tsx
│   │   │       └── content-player.tsx
│   │   ├── providers/                      # Providers compostos para layouts
│   │   │   ├── app-providers.tsx           # Compose todos os providers
│   │   │   ├── query-provider.tsx          # TanStack Query
│   │   │   ├── auth-provider.tsx           # Keycloak
│   │   │   └── toast-provider.tsx          # shadcn toast
│   │   ├── lib/
│   │   │   ├── api-client.ts              # Fetch wrapper com auth headers
│   │   │   ├── keycloak.ts                # Keycloak JS adapter config
│   │   │   ├── query-client.ts            # TanStack Query config
│   │   │   └── sse-client.ts              # SSE connection manager
│   │   ├── hooks/
│   │   │   ├── infra/                     # Hooks de infraestrutura (reutilizáveis)
│   │   │   │   ├── use-auth.ts
│   │   │   │   ├── use-tenant.ts
│   │   │   │   └── use-sse.ts
│   │   │   └── domain/                    # Hooks de domínio (feature-specific)
│   │   │       ├── use-meeting-presence.ts
│   │   │       ├── use-group-members.ts
│   │   │       └── use-trail-progress.ts
│   │   ├── stores/                         # Zustand stores (client state only)
│   │   │   ├── use-ui-store.ts
│   │   │   └── use-meeting-store.ts
│   │   ├── messages/
│   │   │   └── pt-BR.json                 # Mensagens de UI em português
│   │   ├── test/
│   │   │   ├── msw/
│   │   │   │   ├── handlers/              # Handlers por módulo
│   │   │   │   │   ├── auth.handlers.ts
│   │   │   │   │   ├── groups.handlers.ts
│   │   │   │   │   ├── trails.handlers.ts
│   │   │   │   │   └── meetings.handlers.ts
│   │   │   │   ├── server.ts              # MSW server setup
│   │   │   │   └── browser.ts             # MSW browser setup (Storybook futuro)
│   │   │   └── test-utils.tsx             # Render helpers com providers
│   │   ├── e2e/                            # Playwright E2E tests (browser only)
│   │   │   ├── playwright.config.ts
│   │   │   ├── auth.setup.ts
│   │   │   ├── login.e2e-spec.ts
│   │   │   ├── groups.e2e-spec.ts
│   │   │   ├── trails.e2e-spec.ts
│   │   │   └── meetings.e2e-spec.ts
│   │   └── public/
│   │       └── assets/
│   │
│   └── api/                                # ── NESTJS 11.x (BACKEND) ──
│       ├── nest-cli.json
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── .env
│       ├── .env.example
│       ├── Dockerfile
│       ├── src/
│       │   ├── main.ts                     # Bootstrap + validação fail-fast com Zod
│       │   ├── app.module.ts               # Root module
│       │   ├── common/
│       │   │   ├── pipes/
│       │   │   │   └── zod-validation.pipe.ts
│       │   │   ├── filters/
│       │   │   │   └── http-exception.filter.ts
│       │   │   ├── guards/
│       │   │   │   ├── keycloak-auth.guard.ts
│       │   │   │   ├── roles.guard.ts
│       │   │   │   └── tenant.guard.ts
│       │   │   ├── interceptors/
│       │   │   │   ├── response-wrapper.interceptor.ts
│       │   │   │   └── logging.interceptor.ts
│       │   │   ├── middleware/
│       │   │   │   └── request-context.middleware.ts
│       │   │   ├── decorators/
│       │   │   │   ├── current-user.decorator.ts
│       │   │   │   ├── current-tenant.decorator.ts
│       │   │   │   └── roles.decorator.ts
│       │   │   ├── context/
│       │   │   │   └── request-context.ts
│       │   │   └── constants/
│       │   │       ├── pagination.constants.ts     # DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
│       │   │       ├── upload.constants.ts         # MAX_UPLOAD_SIZE_MB per type
│       │   │       └── redis-namespaces.constants.ts # cache:, rt:, queue:, rate:, session:
│       │   ├── prisma/
│       │   │   ├── prisma.module.ts
│       │   │   ├── prisma.service.ts
│       │   │   └── prisma.extension.ts             # Auto-inject tenant_id
│       │   ├── modules/
│       │   │   ├── auth/                           # Identidade & Acesso (FR01-FR11)
│       │   │   │   ├── auth.module.ts
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── auth.service.spec.ts
│       │   │   │   ├── dto/
│       │   │   │   │   ├── login.dto.ts
│       │   │   │   │   └── register.dto.ts
│       │   │   │   └── strategies/
│       │   │   │       └── keycloak.strategy.ts
│       │   │   ├── tenant/                         # Tenant & Configuração (FR12-FR19)
│       │   │   │   ├── tenant.module.ts
│       │   │   │   ├── tenant.controller.ts
│       │   │   │   ├── tenant.service.ts
│       │   │   │   ├── tenant.service.spec.ts
│       │   │   │   └── dto/
│       │   │   │       ├── create-tenant.dto.ts
│       │   │   │       ├── update-tenant-config.dto.ts
│       │   │   │       └── tenant-branding.dto.ts
│       │   │   ├── groups/                         # Grupos & Membros (FR20-FR28)
│       │   │   │   ├── groups.module.ts
│       │   │   │   ├── groups.controller.ts
│       │   │   │   ├── groups.service.ts
│       │   │   │   ├── groups.service.spec.ts
│       │   │   │   └── dto/
│       │   │   │       ├── create-group.dto.ts
│       │   │   │       └── add-member.dto.ts
│       │   │   ├── content/                        # Trilhas & Conteúdo (FR29-FR42) — Core Domain
│       │   │   │   ├── content.module.ts
│       │   │   │   ├── content.controller.ts
│       │   │   │   ├── content.service.ts
│       │   │   │   ├── content.repository.ts
│       │   │   │   ├── content.service.spec.ts
│       │   │   │   ├── content.repository.spec.ts
│       │   │   │   ├── dto/
│       │   │   │   │   ├── create-trail.dto.ts
│       │   │   │   │   ├── create-module.dto.ts
│       │   │   │   │   └── update-progress.dto.ts
│       │   │   │   └── entities/
│       │   │   │       └── trail-progress.entity.ts
│       │   │   ├── meetings/                       # Reuniões ao Vivo (FR43-FR53) — Core Domain
│       │   │   │   ├── meetings.module.ts
│       │   │   │   ├── meetings.controller.ts
│       │   │   │   ├── meetings.service.ts
│       │   │   │   ├── meetings.repository.ts
│       │   │   │   ├── meetings.service.spec.ts
│       │   │   │   ├── meetings.repository.spec.ts
│       │   │   │   ├── dto/
│       │   │   │   │   ├── create-meeting.dto.ts
│       │   │   │   │   └── meeting-presence.dto.ts
│       │   │   │   ├── events/
│       │   │   │   │   ├── presence.event.ts
│       │   │   │   │   └── meeting-ended.event.ts
│       │   │   │   ├── processors/
│       │   │   │   │   └── presence-flush.processor.ts
│       │   │   │   └── gateways/
│       │   │   │       └── meeting-sse.gateway.ts  # SSE em /api/v1/sse/meetings/:id
│       │   │   ├── pastoral/                       # Visibilidade Pastoral (FR54-FR62) — ★ CORE DOMAIN
│       │   │   │   ├── pastoral.module.ts
│       │   │   │   ├── pastoral.controller.ts
│       │   │   │   ├── pastoral.service.ts
│       │   │   │   ├── pastoral.repository.ts
│       │   │   │   ├── pastoral.service.spec.ts
│       │   │   │   ├── pastoral.repository.spec.ts
│       │   │   │   ├── dto/
│       │   │   │   │   └── radar-query.dto.ts
│       │   │   │   ├── entities/
│       │   │   │   │   ├── semaphore-status.entity.ts
│       │   │   │   │   └── pastoral-alert.entity.ts
│       │   │   │   └── events/
│       │   │   │       └── pastoral-alert.event.ts
│       │   │   ├── analytics/                      # Relatórios & Analytics (FR63-FR68)
│       │   │   │   ├── analytics.module.ts
│       │   │   │   ├── analytics.controller.ts
│       │   │   │   ├── analytics.service.ts
│       │   │   │   ├── analytics.service.spec.ts
│       │   │   │   └── dto/
│       │   │   │       └── report-query.dto.ts
│       │   │   ├── onboarding/                     # Onboarding & Adoção (FR69-FR75)
│       │   │   │   ├── onboarding.module.ts
│       │   │   │   ├── onboarding.controller.ts
│       │   │   │   ├── onboarding.service.ts
│       │   │   │   ├── onboarding.service.spec.ts
│       │   │   │   └── dto/
│       │   │   │       └── onboarding-step.dto.ts
│       │   │   ├── notifications/                  # Transversal: Notificações (FR77-FR78)
│       │   │   │   ├── notifications.module.ts
│       │   │   │   ├── notifications.controller.ts
│       │   │   │   ├── notifications.service.ts
│       │   │   │   ├── notifications.service.spec.ts
│       │   │   │   ├── channels/
│       │   │   │   │   ├── in-app.channel.ts
│       │   │   │   │   └── email.channel.ts        # Resend SDK
│       │   │   │   └── processors/
│       │   │   │       └── notification-send.processor.ts
│       │   │   ├── audit/                          # Transversal: Auditoria (FR80)
│       │   │   │   ├── audit.module.ts
│       │   │   │   ├── audit.service.ts
│       │   │   │   ├── audit.interceptor.ts
│       │   │   │   └── audit.service.spec.ts
│       │   │   └── storage/                        # Transversal: Mídia & Storage
│       │   │       ├── storage.module.ts
│       │   │       ├── storage.service.ts          # MinIO/S3 abstraction + StoragePolicy
│       │   │       ├── storage.service.spec.ts
│       │   │       ├── storage-policies.ts         # Políticas: conteúdo (permanente), gravação (90d), branding (público)
│       │   │       └── dto/
│       │   │           └── upload-url.dto.ts
│       │   └── config/
│       │       ├── app.config.ts                   # Zod validation de env vars
│       │       ├── database.config.ts
│       │       ├── redis.config.ts
│       │       ├── keycloak.config.ts
│       │       └── storage.config.ts
│       ├── prisma/
│       │   ├── schema.prisma                       # Models + relations
│       │   ├── migrations/                         # Prisma auto-generated migrations
│       │   │   └── 20260405000000_initial/
│       │   │       └── migration.sql               # Schema DDL + CREATE EXTENSION IF NOT EXISTS
│       │   └── rls/                                # RLS policies (SQL raw, versionadas)
│       │       ├── 001_base_policies.sql           # RLS base para todas as tabelas
│       │       ├── 002_group_policies.sql          # Policies específicas de grupo
│       │       └── README.md                       # Como criar e aplicar novas policies
│       └── test/
│           ├── factories/
│           │   ├── user.factory.ts
│           │   ├── tenant.factory.ts
│           │   ├── group.factory.ts
│           │   ├── trail.factory.ts
│           │   ├── meeting.factory.ts
│           │   └── index.ts
│           ├── rls/
│           │   ├── tenant-isolation.integration-spec.ts
│           │   └── rls-test-utils.ts
│           ├── helpers/
│           │   ├── pino-test-utils.ts
│           │   ├── sse-test-utils.ts
│           │   └── test-app.ts                     # ★ Primeiro arquivo de teste a implementar
│           └── seed/
│               ├── seed-e2e.ts
│               └── cleanup.ts
│
├── packages/
│   ├── types/                              # ── CONTRATOS COMPARTILHADOS ──
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── schemas/
│   │   │   │   ├── auth.schema.ts
│   │   │   │   ├── tenant.schema.ts
│   │   │   │   ├── group.schema.ts
│   │   │   │   ├── trail.schema.ts
│   │   │   │   ├── meeting.schema.ts
│   │   │   │   └── common.schema.ts
│   │   │   ├── events/
│   │   │   │   ├── groups.events.ts
│   │   │   │   ├── meetings.events.ts
│   │   │   │   ├── pastoral.events.ts
│   │   │   │   └── base-event.schema.ts
│   │   │   ├── enums/
│   │   │   │   ├── roles.enum.ts
│   │   │   │   ├── semaphore-status.enum.ts
│   │   │   │   └── subscription-tier.enum.ts
│   │   │   └── errors/
│   │   │       └── error-codes.ts
│   │   └── __tests__/
│   │       └── schemas.snapshot.test.ts
│   │
│   ├── ui/                                 # ── SHADCN/UI COMPONENTES ──
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── components.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── components/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── form.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── data-table.tsx
│   │   │   └── lib/
│   │   │       └── utils.ts
│   │   └── tailwind.config.ts
│   │
│   └── config/                             # ── CONFIGURAÇÕES COMPARTILHADAS ──
│       ├── package.json
│       ├── eslint/
│       │   ├── base.js
│       │   ├── nestjs.js
│       │   └── nextjs.js
│       ├── tsconfig/
│       │   ├── base.json
│       │   ├── nestjs.json
│       │   └── nextjs.json
│       └── tailwind/
│           └── base.config.ts
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── .env.example
└── .nvmrc
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Tipo | Descrição |
|----------|------|-----------|
| `/api/v1/auth/*` | Public | Login, register, refresh token |
| `/api/v1/tenants/*` | Admin/Super Admin | CRUD tenants, config, branding |
| `/api/v1/groups/*` | Tenant-scoped | CRUD grupos, membros |
| `/api/v1/trails/*` | Tenant-scoped | CRUD trilhas, módulos, progresso |
| `/api/v1/meetings/*` | Tenant-scoped | CRUD reuniões, presença |
| `/api/v1/pastoral/*` | Tenant-scoped | Radar, alertas, perfil pastoral |
| `/api/v1/analytics/*` | Tenant-scoped | Relatórios, dashboards |
| `/api/v1/notifications/*` | Tenant-scoped | Preferências, histórico |
| `/api/v1/storage/*` | Tenant-scoped | Upload URLs assinadas |
| `/api/v1/onboarding/*` | Tenant-scoped | Wizard steps, progresso |
| `/api/v1/admin/*` | Super Admin only | Gestão plataforma |
| `/api/v1/sse/meetings/:id` | Real-time (versionado) | SSE presença + semáforo |
| `/api/v1/sse/notifications` | Real-time (versionado) | SSE notificações in-app |
| `/health` | Public | Health check (sem wrapper) |

### Data Flow

**Request Lifecycle:**
```
Browser → Next.js middleware (auth check)
  → Client Component → TanStack Query → fetch(/api/v1/...)
    → Traefik (reverse proxy)
      → NestJS → RequestContext middleware (AsyncLocalStorage: tenant_id, user_id → Pino)
        → Keycloak Auth Guard (token validation)
          → Roles Guard (RBAC check)
            → ZodValidationPipe (input validation)
              → Controller → Service → Repository → Prisma (+ tenant extension)
                → PostgreSQL (RLS: última linha de defesa)
```

**Real-time (Reunião):**
```
Participante → POST /api/v1/meetings/:id/presence
  → NestJS → Redis (rt:meeting:{id}:presence)
  → BullMQ job → flush Redis → PostgreSQL

Dashboard Líder → SSE /api/v1/sse/meetings/:id
  → NestJS lê Redis → push SSE → UI atualiza semáforo
```

**Notificações:**
```
Evento de domínio → BullMQ queue:notifications
  → Notification Processor → Channel Router
    → In-app: SSE push | Email: Resend | WhatsApp (Phase 3): ChatMaster Veloz
```

### Requirements to Structure Mapping

| FR Category | Backend Module | Frontend Route | Core Domain? |
|-------------|---------------|----------------|-------------|
| Identidade & Acesso (FR01-FR11) | `modules/auth/` | middleware, `(public)/` | Não |
| Tenant & Config (FR12-FR19) | `modules/tenant/` | `settings/*` | Não |
| Grupos & Membros (FR20-FR28) | `modules/groups/` | `groups/*` | Não |
| Trilhas & Conteúdo (FR29-FR42) | `modules/content/` | `trails/*` | Sim (repository) |
| Reuniões ao Vivo (FR43-FR53) | `modules/meetings/` | `meetings/*` | Sim (repository) |
| Visibilidade Pastoral (FR54-FR62) | `modules/pastoral/` | `pastoral/*` | ★ Sim (repository) |
| Relatórios & Analytics (FR63-FR68) | `modules/analytics/` | `reports/*` | Não |
| Onboarding & Adoção (FR69-FR75) | `modules/onboarding/` | `onboarding/*` | Não |
| Capabilities Transversais (FR76-FR82) | `notifications/`, `audit/`, `storage/` | — | Não |

### Cross-Cutting Concerns Mapping

| Concern | Localização |
|---------|-------------|
| Multi-tenancy (RLS) | `common/middleware/request-context.middleware.ts` + `prisma/prisma.extension.ts` + `prisma/rls/*.sql` + `scripts/apply-rls.sh` |
| Auditoria | `modules/audit/audit.interceptor.ts` |
| Auth/AuthZ | `common/guards/keycloak-auth.guard.ts` + `roles.guard.ts` + `tenant.guard.ts` |
| Validação | `common/pipes/zod-validation.pipe.ts` + `packages/types/schemas/*` |
| Error handling | `common/filters/http-exception.filter.ts` + `packages/types/errors/error-codes.ts` |
| Response format | `common/interceptors/response-wrapper.interceptor.ts` |
| Logging | `common/middleware/request-context.middleware.ts` (Pino context) |
| Constants | `common/constants/*.constants.ts` |
| i18n | `apps/web/messages/pt-BR.json` |
| Feature toggles | `modules/tenant/` + guards |
| Storage policies | `modules/storage/storage-policies.ts` |
| Providers (frontend) | `apps/web/providers/app-providers.tsx` |
| MSW (frontend tests) | `apps/web/test/msw/` |

### Test Scope Separation

| Tipo | Localização | Escopo |
|------|-------------|--------|
| Unit (backend) | `apps/api/src/modules/*/*.spec.ts` | Lógica isolada, mocks |
| Unit (frontend) | `apps/web/components/*/*.test.tsx` | Componentes + MSW |
| Integration (backend) | `apps/api/test/rls/*.integration-spec.ts` | DB real, RLS real |
| Integration (backend) | `apps/api/src/modules/*/*.integration-spec.ts` | Módulos + DB |
| E2E (browser) | `apps/web/e2e/*.e2e-spec.ts` | Sistema completo via Playwright |
| Snapshot (contracts) | `packages/types/__tests__/schemas.snapshot.test.ts` | Schemas Zod |

### Implementation Priority Notes

- **`apps/api/test/helpers/test-app.ts`** é o primeiro arquivo de teste a implementar — toda a infra de teste depende dele
- **`prisma/rls/`** policies devem ser aplicadas via `scripts/apply-rls.sh` após cada `prisma migrate deploy`
- **Extensões PostgreSQL** (`pgvector`, `uuid-ossp`) devem estar tanto no `docker/postgres/init.sql` (conveniência dev local) quanto na primeira Prisma migration (source of truth)
- **`seed-e2e.ts`** deve incluir seed de estado Redis para reunião ativa, não apenas dados PostgreSQL

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** Todas as tecnologias são compatíveis entre si. Next.js 16.2 + NestJS 11.x + Prisma v7 + PostgreSQL é stack maduro. Turborepo 2.5 + pnpm 10.33 têm integração nativa. Zod 4.3 + React Hook Form 7.72 + TanStack Query 5.96 + Zustand 5.0 não têm overlap nem conflito. Keycloak + NestJS Guards + RLS são camadas complementares.

**Pattern Consistency:** Naming conventions são coerentes em toda a stack (camelCase TS → snake_case DB via Prisma @map). UUID v7, tenant_id via AsyncLocalStorage, ErrorResponseDto, e eventos versionados são padrões uniformes documentados no Quick Reference.

**Structure Alignment:** Monorepo apps/ + packages/ alinha com decisões de compartilhamento. Módulos NestJS por bounded context alinham com classificação DDD. Repository pattern apenas para core domains é consistente.

### Requirements Coverage Validation ✅

**Functional Requirements (82/82 cobertos):**

| FR Category | FRs | Módulo Backend | Status |
|-------------|-----|---------------|--------|
| Identidade & Acesso (FR01-FR11) | 11 | `modules/auth/` + Keycloak + Guards | ✅ |
| Tenant & Config (FR12-FR19) | 8 | `modules/tenant/` + toggles + tiers | ✅ |
| Grupos & Membros (FR20-FR28) | 9 | `modules/groups/` + RLS | ✅ |
| Trilhas & Conteúdo (FR29-FR42) | 14 | `modules/content/` (repository) + storage | ✅ |
| Reuniões ao Vivo (FR43-FR53) | 11 | `modules/meetings/` (repository) + SSE + Redis | ✅ |
| Visibilidade Pastoral (FR54-FR62) | 9 | `modules/pastoral/` (repository) + semáforo | ✅ |
| Relatórios & Analytics (FR63-FR68) | 6 | `modules/analytics/` + materialized views | ✅ |
| Onboarding & Adoção (FR69-FR75) | 7 | `modules/onboarding/` + constraint ≤10 min | ✅ |
| Capabilities Transversais (FR76-FR82) | 7 | `notifications/` + `audit/` + `storage/` | ✅ |

**Non-Functional Requirements (52/52 cobertos):**

| NFR Category | Cobertura Arquitetural | Status |
|-------------|----------------------|--------|
| Performance (11) | Turbopack, Redis cache, SSE | ✅ |
| Segurança (10) | Keycloak + Guards + RLS + TLS + encryption | ✅ |
| Escalabilidade (3+) | RLS → db-per-tenant, NATS futuro | ✅ |
| Confiabilidade (7) | Backup strategy + Redis WAL + DR plan | ✅ |
| Acessibilidade (6) | WCAG AA via shadcn/ui (Radix primitives) | ✅ |
| Integração & Resiliência (5) | BullMQ retry, circuit breaker | ✅ |
| Observabilidade (5) | Pino + Sentry + métricas custom | ✅ |
| LGPD (5) | Audit trail + retenção + exportação tenant | ✅ |
| Onboarding (3) | Wizard + constraint arquitetural | ✅ |

### Gaps Identificados e Resolvidos

**Resolvidos durante validação (Party Mode):**

| Gap | Resolução | Prioridade |
|-----|-----------|------------|
| Backup & DR sem implementação concreta | Seção dedicada adicionada (ver abaixo) | Crítico |
| Rate limiting sem estratégia explícita | @nestjs/throttler + Redis sliding window | Importante |
| Health check indefinido | Endpoint com checks de dependências | Importante |
| RLS não aplicado automaticamente em dev | Turborepo pipeline `db:setup` | DX |
| Env vars duplicadas entre apps | Hierarquia root + apps | DX |
| Teste de auth Keycloak indefinido | Mock JWT para CI + Keycloak real nightly | Test |
| E2E seed incompleto | Seed com todos os roles, idempotente | Test |
| Future enhancements sem priorização | Roadmap técnico priorizado | Clareza |
| Exportação de dados (LGPD portabilidade) | Job BullMQ → ZIP no `modules/tenant/` | Compliance |

**Gaps não-bloqueantes (deferred):**
- FR82 (funcionalidade offline): Post-MVP, service worker strategy adiada
- Monitoramento de foco: detalhes de implementação (Page Visibility API) na story

### Backup & DR Strategy

**PostgreSQL:**
- WAL archiving para S3-compatible storage (MinIO em dev, S3/R2 em produção)
- `pg_dump` full backup diário + WAL continuous archiving
- Segregação geográfica: backups em região diferente da produção
- Teste de restore trimestral (alinhado com PRD)
- RPO ≤ 1h atingido via WAL archiving contínuo

**Redis:**
- RDB snapshots a cada 15 min para persistent volume
- Para dados efêmeros (rt:*), perda aceitável em restart — reunião pode re-sincronizar
- Para BullMQ jobs (queue:*), Redis AOF garante durabilidade de jobs pendentes

**MinIO/S3:**
- Produção: S3-compatible com versionamento habilitado
- Cross-region replication para bucket de backup
- Gravações de reunião com lifecycle policy (90 dias default)

**RTO ≤ 4h:**
- Docker Swarm restart automático de containers falhos
- Traefik health checks detectam container morto
- Restore de PostgreSQL a partir de WAL: ~30 min para DB até 50GB
- Runbook documentado para DR cenários

### Rate Limiting Strategy

**MVP — @nestjs/throttler + Redis store:**
- Login/Register: 5 tentativas / 15 min por IP (proteção brute force)
- API autenticada: 100 req / min por tenant (fairness entre tenants)
- Upload: 10 req / min por usuário (proteção de storage)
- SSE connections: 5 conexões simultâneas por usuário

**Phase 4 — API pública:**
- Rate limiting por tier de assinatura + por API key
- Free: 60 req/min, Pro: 300 req/min, Enterprise: custom
- Headers padrão: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Health Check Pattern

**Endpoint: GET /health (público, sem auth)**

```json
// Healthy
{
  "status": "ok",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "keycloak": "ok",
    "storage": "ok"
  }
}

// Degraded (HTTP 503)
{
  "status": "degraded",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "keycloak": "timeout",
    "storage": "ok"
  }
}
```

Docker Swarm + Traefik usam este endpoint para auto-recovery. Se retornar 503, Swarm reinicia o container.

### Turborepo Pipeline: Database Setup

```json
{
  "db:migrate": { "cache": false },
  "db:rls": { "dependsOn": ["db:migrate"], "cache": false },
  "db:setup": { "dependsOn": ["db:migrate", "db:rls"], "cache": false },
  "db:seed": { "dependsOn": ["db:setup"], "cache": false }
}
```

`pnpm turbo db:setup` = migrate + apply RLS policies automaticamente. Impossível esquecer.

### Environment Variables Hierarchy

```
/.env                    → Variáveis compartilhadas (KEYCLOAK_URL, DATABASE_URL, REDIS_URL)
/apps/api/.env           → Exclusivas backend (JWT_SECRET, MINIO_ACCESS_KEY, RESEND_API_KEY)
/apps/web/.env.local     → Exclusivas frontend (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_KEYCLOAK_URL)
```

Turborepo propaga env vars do root automaticamente. Validação fail-fast com Zod no bootstrap de cada app.

### Auth Testing Strategy

**CI rápido (toda PR):**
- Mock Keycloak via `test/helpers/mock-keycloak.ts` — gera JWTs válidos com claims `{ tenant_id, user_id, roles }` assinados com chave de teste
- Guards testados com tokens mock, sem Keycloak real
- Rápido (~ms por teste)

**Nightly/Pre-release:**
- Keycloak real no `docker-compose.test.yml`
- Testa fluxo completo: login redirect, token refresh, logout
- Detecta incompatibilidades de versão Keycloak

### E2E Seed Data (Idempotente)

O `seed-e2e.ts` cria o seguinte estado mínimo:
- 1 Super Admin (platform level)
- 1 Tenant "Igreja Teste" com config padrão (Free tier)
- 1 Admin do Tenant
- 1 Líder com 1 grupo "Grupo Alpha" + 3 participantes
- 1 Editor de Conteúdo com 1 trilha "Fundamentos" + 2 módulos
- 1 Reunião agendada para o grupo
- Estado Redis: reunião ativa com dados de presença (2/3 participantes presentes)
- Idempotente: usa `upsert` para não criar duplicatas em re-execução

### LGPD: Exportação de Dados do Tenant

**Requisito:** LGPD Art. 18 — portabilidade de dados. Titular (via Admin do Tenant) pode solicitar exportação completa.

**Implementação arquitetural:**
- Endpoint: `POST /api/v1/tenants/:tenantId/export` (Admin do Tenant ou Super Admin)
- Job BullMQ assíncrono no `queue:tenant-export`
- Gera ZIP com:
  - `users.csv` — dados dos membros do tenant
  - `groups.json` — grupos e memberships
  - `trails.json` — trilhas, módulos, progresso
  - `meetings.json` — reuniões, presença, engajamento
  - `audit-log.csv` — trilha de auditoria
- Upload do ZIP para MinIO/S3 com URL assinada (expiração 72h)
- Notificação ao admin quando pronto
- Prazo: ≤ 72h conforme NFR-L1

### Technical Roadmap (Future Enhancements)

| Prioridade | Enhancement | Quando | Trigger de Ativação |
|-----------|------------|--------|---------------------|
| 1 | Monitoramento de foco (Page Visibility API) | Release 2 | Story específica |
| 2 | NATS JetStream | Release 2+ | Quando 3+ serviços rodando |
| 3 | Observabilidade completa (Grafana/Prometheus/Loki) | Phase 3 | Primeiro incidente em produção |
| 4 | Database-per-tenant | Phase 4 | Primeiro cliente enterprise |
| 5 | API pública versionada | Phase 4 | Demanda de integradores |
| 6 | Busca semântica pgvector | Phase 5 | 6+ meses de dados acumulados |
| 7 | Offline capability (Service Worker) | Post-MVP | Feedback de igrejas rurais/conexão instável |

### Architecture Completeness Checklist

**✅ Requirements Analysis (Step 2)**
- [x] 82 FRs analisados e categorizados com peso arquitetural
- [x] 52 NFRs mapeados para decisões arquiteturais
- [x] 10 bounded contexts com classificação DDD
- [x] Hierarquia de tenants como constraint arquitetural
- [x] 9 cross-cutting concerns documentados

**✅ Starter Template (Step 3)**
- [x] 9 versões verificadas via web search (Abril 2026)
- [x] Monorepo Turborepo + pnpm + estrutura definida
- [x] Comandos de inicialização documentados
- [x] setup.sh para onboarding em 1 comando

**✅ Architectural Decisions (Step 4)**
- [x] 5 decisões críticas com versões verificadas
- [x] 6 decisões importantes com rationale
- [x] 5 decisões deferred com justificativa
- [x] ErrorResponseDto + contrato de erro padronizado
- [x] Sequência de implementação definida

**✅ Implementation Patterns (Step 5)**
- [x] Naming conventions completas (DB, API, código, componentes)
- [x] Structure patterns (módulos, testes, componentes)
- [x] Format patterns (responses, erros, datas, eventos)
- [x] Communication patterns (multi-tenancy, state, eventos versionados)
- [x] Process patterns (error handling, loading, auth, validação)
- [x] Quick Reference cheat sheet
- [x] 8 enforcement guidelines para agentes de IA

**✅ Project Structure (Step 6)**
- [x] Árvore completa (~150+ entries)
- [x] 14 API boundaries definidos (incluindo SSE versionado)
- [x] 3 data flows diagramados
- [x] Requirements → structure mapping
- [x] Test scope separation

**✅ Validation (Step 7)**
- [x] Coherence validation passed
- [x] 82/82 FRs cobertos
- [x] 52/52 NFRs cobertos
- [x] 9 gaps identificados e resolvidos
- [x] Backup & DR strategy definida
- [x] Rate limiting strategy definida
- [x] Health check pattern definido
- [x] Auth testing strategy (mock + real)
- [x] LGPD exportação de dados definida
- [x] Technical roadmap priorizado

### Architecture Readiness Assessment

**Overall Status: ✅ READY FOR IMPLEMENTATION**

**Confidence Level: Alta**

**Key Strengths:**
1. Multi-tenancy em 3 camadas com padrão impossível de esquecer (AsyncLocalStorage + Prisma extension + RLS)
2. Core domains priorizados com DDD (Radar Pastoral como estrela)
3. Alinhado com "infra simplificada para time enxuto"
4. Padrões detalhados para múltiplos agentes de IA implementarem sem conflito
5. Real-time pipeline com failure modes e mitigações documentados
6. LGPD como constraint transversal com retenção diferenciada e exportação
7. Quick Reference para adoção imediata
8. Backup & DR strategy concreta atingindo RPO ≤ 1h / RTO ≤ 4h
9. Testing strategy completa: mock Keycloak para CI, seed idempotente, RLS test utils

### Implementation Handoff

**AI Agent Guidelines:**
- Seguir todas as decisões arquiteturais exatamente como documentadas
- Consultar Quick Reference antes de criar qualquer arquivo, endpoint ou schema
- Usar implementation patterns consistentemente em todos os componentes
- Respeitar boundaries do projeto e classificação DDD dos módulos
- Referir-se a este documento para toda decisão arquitetural

**Primeira Story de Implementação:**
1. `pnpm dlx create-turbo@latest metanoia-hub --package-manager pnpm`
2. Adicionar NestJS como `apps/api`
3. Inicializar shadcn/ui em `packages/ui`
4. Configurar Prisma + schema base
5. Setup Docker Compose (PostgreSQL, Redis, Keycloak com realm, MinIO)
6. Criar `scripts/setup.sh`
7. Criar `apps/api/test/helpers/test-app.ts` (fundação de testes)
8. Criar `packages/types` com schemas Zod base + ErrorResponseDto
9. Configurar CI pipeline (GitHub Actions + Turborepo cache)
