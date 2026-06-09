<!--
Sync Impact Report
- Version: (nova) → 1.0.0
- Principios criados: 7 (Multi-tenancy Absoluto, Type-Safety & Contratos, Idioma & Vocabulário Pastoral, Contratos de API Padronizados, Separação Frontend State, Qualidade Verificável, Processo de Entrega)
- Secoes adicionadas: Core Principles, Architecture Decisions, Quality Standards, Governance
- Fontes: docs/01-briefing-discovery/briefing.md, docs/project-context.md (47 regras), CLAUDE.md
- Artefatos alinhados: CLAUDE.md (já reflete), sprint-status.yaml (tracking)
- TODOs pendentes: nenhum
-->

# metanoia-hub Constitution

> Princípios imutáveis que governam arquitetura, qualidade e processo do
> metanoia-hub. Derivada do briefing e das 47 regras de `docs/project-context.md`.
> Serve de gate para `/specify`, `/plan` e `/feature-00c` (Constitution Check).

## Core Principles

### I. Multi-tenancy Absoluto (NON-NEGOTIABLE)

Isolamento de tenant é a invariante de segurança mais crítica do produto.

- MUST: toda tabela possui coluna `tenant_id`; RLS habilitada desde a criação.
- MUST: `tenant_id` resolvido via `AsyncLocalStorage`/`RequestContext` e aplicado
  por `withTenantTx` (`SET LOCAL app.current_tenant_id`). **NUNCA** passar
  `tenant_id` como parâmetro de função.
- MUST: toda migration que toque policy de RLS acompanha teste de isolamento em
  `apps/api/test/rls/` (2 tenants, SELECT/UPDATE/DELETE/INSERT, JOINs e aggregations).
- MUST: a autorização tem 3 camadas — Keycloak (roles) → NestJS Guards
  (role + tenant + group) → RLS (última linha de defesa).
- Why: um vazamento cross-tenant é falha de produto inaceitável num SaaS pastoral
  que lida com dados sensíveis de pessoas.

### II. Type-Safety & Identificadores Determinísticos (NON-NEGOTIABLE)

- MUST: `strict: true` em todo o TypeScript, sem exceção.
- MUST: UUID v7 via `uuidv7()` — **proibido** `@default(uuid())` do Prisma.
- MUST: datas como strings ISO 8601; ausência expressa como `null` explícito;
  **nunca** `undefined` em respostas JSON (campos não omitidos).
- Why: previsibilidade de contratos e ordenação temporal estável dos IDs.

### III. Idioma & Vocabulário Pastoral

- MUST: código, variáveis, logs, comentários e descrições Swagger em **inglês**.
- MUST: mensagens user-facing em **PT-BR**, centralizadas em
  `apps/web/messages/pt-BR.json`.
- MUST: UI usa **vocabulário pastoral** (jornada, sinal de cuidado, marco de
  crescimento) e o reframing anti-vigilância (cuidado, não controle). Ícone
  sempre acompanha texto; toda tela nova passa por revisão de vocabulário.
- Why: o idioma é parte do produto; o buyer é não-técnico e o DNA é cuidado pastoral.

### IV. Contratos de API Padronizados

- MUST: contratos compartilhados FE+BE como schemas **Zod** em `packages/types`,
  com snapshot test (gate contra breaking changes silenciosos).
- MUST: sucesso `{ data, meta? }` (paginação em meta); erro
  `{ statusCode, error, message, details? }` sem stack trace para o frontend.
- MUST: Create→201, Delete→204 (sem corpo), Async→202; eventos de domínio no
  formato `{ eventId, eventType, version, tenantId, timestamp, data, metadata }`.
- MUST: API versionada com prefixo `/api/v1/` desde o MVP; `ZodValidationPipe`
  próprio (proibido lib de validação NestJS de terceiros).
- Why: contrato único elimina divergência FE/BE e regressões de integração.

### V. Separação de Estado no Frontend

- MUST: Server Components por default (App Router), usando `fetch` nativo —
  **proibido** TanStack Query em Server Components.
- MUST: TanStack Query apenas em Client Components (server state); Zustand apenas
  para client state, um store por concern (`useAuthStore`, `useMeetingStore`, …).
- MUST: nunca misturar server state (TanStack) com client state (Zustand).
- Why: separar as duas naturezas de estado evita bugs de cache e hidratação.

### VI. Qualidade Verificável

- MUST: testes unit (`*.spec.ts`), integration (`*.integration-spec.ts`) e e2e
  (`apps/web/e2e/`); factories de teste sempre incluem `tenantId`.
- MUST: RLS isolation specs obrigatórios para mudanças em policy; snapshot tests
  para schemas Zod.
- MUST: WCAG AA em todas as interfaces; acessibilidade é requisito, não polimento.
- MUST: CI (lint + test + build) verde antes de `done`; sem stack trace exposto.
- Why: qualidade é prioridade acima de velocidade neste domínio sensível.

### VII. Processo de Entrega Auditável

- MUST: conventional commits em **PT-BR**; branches `feat/`/`fix/`/`docs/`/`refactor/`.
- MUST: 1 story = 1 branch = 1 PR; PRs pequenos e focados.
- MUST: reconciliação WDS↔BMad antes de implementar uma story marcada
  `ready-for-dev` — confirmar no código real se já foi entregue por trabalho WDS.
- Why: rastreabilidade e prevenção de retrabalho/conflito num projeto com dois
  sistemas de planejamento (BMad + WDS).

## Architecture Decisions

- Módulos NestJS por bounded context (auth, tenant, groups, content, meetings,
  pastoral, analytics, notifications, audit, onboarding).
- Core domains (Pastoral, Meetings, Content): **repository pattern**. Supporting
  subdomains: service direto com Prisma.
- Multi-tenant via RLS no MVP (sem schema/database separation); evolução para
  database-per-tenant só sob demanda enterprise real.
- Redis único no MVP (cache/sessões/BullMQ/estado de reunião) — dívida técnica
  consciente; namespaces `cache:*`, `rt:*`, `queue:*`, `rate:*`, `session:*`.
- Sem pacote genérico `packages/utils` — usar nomes de pacote semânticos.

## Quality Standards

- Performance: LCP ≤ 2,5s, INP ≤ 200ms, entrada na reunião < 3s, dashboard ≤ 2s
  (cache quente).
- LGPD: exportação ≤ 72h, exclusão ≤ 30 dias, consentimento prévio, retenção
  diferenciada, auditoria imutável (≥ 1 ano).
- Confiabilidade: RPO ≤ 1h, RTO ≤ 4h; o sinal pastoral prioriza padrões sobre
  eventos isolados, permite correção humana e nunca penaliza por falha técnica.

## Governance

- Esta constituição prevalece sobre convenções ad-hoc. Conflitos resolvem-se a
  favor do princípio mais restritivo (segurança/isolamento vence velocidade).
- Amendments seguem SemVer: MAJOR (remoção/redefinição incompatível de princípio),
  MINOR (novo princípio ou expansão material), PATCH (clarificação não-semântica).
- Todo amendment exige Sync Impact Report e atualização dos artefatos dependentes
  (CLAUDE.md, plans, tasks).
- Exceções a um princípio MUST exigem justificativa documentada no PR e aprovação
  explícita; não há exceção tácita.
- `/plan` e `/feature-00c` executam Constitution Check; violação bloqueia o gate.

**Version**: 1.0.0 | **Ratified**: 2026-06-09 | **Last Amended**: 2026-06-09
