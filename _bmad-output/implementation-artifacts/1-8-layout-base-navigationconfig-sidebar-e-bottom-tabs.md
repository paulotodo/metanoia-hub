# Story 1.8: Layout Base — NavigationConfig, Sidebar e Bottom Tabs

Status: done

## Story

As a developer,
I want the base application layout with unified navigation that renders as bottom tabs on mobile and sidebar on desktop,
So that all future pages share a consistent navigation structure across devices.

## Acceptance Criteria

**Given** the design tokens and shadcn/ui components from Story 1.7 are available
**When** I navigate to the authenticated app area
**Then** a `NavigationConfig` object defines 5 tabs: Radar, Reuniões, Trilhas, Perfil, Mais
**And** on mobile (< lg breakpoint), navigation renders as bottom tabs with icons and labels
**And** on screens ≤360px, bottom tabs show icon-only with labels only on the active tab
**And** on desktop (≥ lg breakpoint), navigation renders as a fixed sidebar (240px width) with icons and full labels
**And** the active tab/item is visually highlighted with `brand-teal`
**And** responsive breakpoints work correctly: base, sm, md, lg, xl, 2xl
**And** container uses `mx-auto` and `max-w-7xl` (1280px) for main content
**And** touch targets are ≥ 44px on mobile
**And** keyboard navigation works: Tab/Shift+Tab between nav items, Enter to activate
**And** `motion-safe:transition-all` is used for any navigation transitions (with reduced-motion alternative)
**And** navigation component passes jest-axe accessibility tests

## Tasks / Subtasks

- [x] Task 1: Criar NavigationConfig (AC: #1)
  - [x] 1.1 Criar `apps/web/config/navigation.ts` com definição de 5 tabs
  - [x] 1.2 Definir interface: label, icon, href, activeIcon para cada tab
  - [x] 1.3 Tabs: Radar, Reuniões, Trilhas, Perfil, Mais

- [x] Task 2: Implementar Bottom Tabs para mobile (AC: #2, #3)
  - [x] 2.1 Criar `packages/ui/components/bottom-tabs.tsx`
  - [x] 2.2 Renderizar icons + labels para telas > 360px
  - [x] 2.3 Renderizar icon-only (label apenas no tab ativo) para telas ≤ 360px
  - [x] 2.4 Garantir touch targets ≥ 44px

- [x] Task 3: Implementar Sidebar para desktop (AC: #4)
  - [x] 3.1 Criar `packages/ui/components/sidebar.tsx`
  - [x] 3.2 Sidebar fixa com 240px de largura
  - [x] 3.3 Icons + full labels

- [x] Task 4: Layout responsivo unificado (AC: #5, #6, #7)
  - [x] 4.1 Criar `apps/web/app/(authenticated)/layout.tsx`
  - [x] 4.2 Bottom tabs < lg breakpoint, sidebar ≥ lg breakpoint
  - [x] 4.3 Destacar item ativo com `brand-teal`
  - [x] 4.4 Container principal com `mx-auto` e `max-w-7xl`

- [x] Task 5: Acessibilidade e motion (AC: #8, #9, #10)
  - [x] 5.1 Implementar keyboard navigation: Tab/Shift+Tab + Enter
  - [x] 5.2 Usar `motion-safe:transition-all` para transições
  - [x] 5.3 Garantir alternativa para reduced-motion

- [x] Task 6: Testes de acessibilidade (AC: #11)
  - [x] 6.1 Escrever testes jest-axe para bottom-tabs
  - [x] 6.2 Escrever testes jest-axe para sidebar
  - [x] 6.3 Escrever testes jest-axe para layout unificado

### Review Findings

- [x] [Review][Decision] `motion-safe:transition-colors` vs spec `transition-all` — Mantido `transition-colors` (mais performático). Desvio intencional aprovado.
- [x] [Review][Patch] Route matching greedy com `startsWith` — fixado com boundary check `=== href || startsWith(href + '/')` [navigation-shell.tsx:16]
- [x] [Review][Patch] Fallback `items[0].key` crash se array vazio — fixado com optional chaining `items[0]?.key` [navigation-shell.tsx:16]
- [x] [Review][Patch] Sidebar missing `flex` no base class — adicionado `flex` antes de `flex-col` [sidebar.tsx:23]
- [x] [Review][Patch] Tailwind v4 `bg-[var(--primary)]/10` — fixado com `color-mix(in srgb, var(--primary) 10%, transparent)` [sidebar.tsx:48]
- [x] [Review][Defer] jest-axe TypeScript types sem augmentation para vitest — deferred, pre-existing
- [x] [Review][Defer] Sem error boundary no NavigationShell — deferred, escopo geral de app

## Dev Notes

### Stack & Versões
- Next.js 16.2 App Router
- Tailwind CSS 4.2.2
- shadcn/ui CLI v4
- Lucide React (icons)
- Vitest 4.1.2 + jest-axe

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 1.1 (Scaffold do Monorepo) — apps/web base
- Story 1.7 (Design Tokens) — tokens de cor, tipografia, shadcn/ui components

### Project Structure Notes
```
apps/web/
├── config/
│   └── navigation.ts           # NavigationConfig object
├── app/
│   └── (authenticated)/
│       └── layout.tsx          # Unified layout with sidebar/bottom tabs
└── components/
    ├── bottom-tabs.tsx
    ├── bottom-tabs.spec.tsx
    ├── sidebar.tsx
    └── sidebar.spec.tsx
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-01.md — Story 1.8]
- [Source: docs/project-context.md — Frontend patterns, responsive breakpoints]
- [Source: _bmad-output/planning-artifacts/architecture.md — UI layout, navigation]

## Dev Agent Record

### Implementation Plan
- NavigationItem interface genérica em packages/ui, config concreta em apps/web
- Componentes BottomTabs e Sidebar são framework-agnostic via prop `renderLink`
- NavigationShell (client component) encapsula usePathname + Next.js Link
- Layout (server component) passa navigationItems ao shell
- Aria-labels diferenciados: "Main navigation" (sidebar) e "Mobile navigation" (bottom tabs) para evitar violação axe landmark-unique
- Usado `<nav>` ao invés de `<aside role="navigation">` no Sidebar para evitar violação aria-allowed-role

### Debug Log
- Fix: `<aside role="navigation">` não é permitido pelo axe — trocado para `<nav>`
- Fix: Import path `@/config/navigation` não funcionava (alias `@/` aponta para `./src/*` inexistente) — usado import relativo
- Fix: Teste axe do NavigationShell falhava com `<main>` duplicado e aria-labels iguais — removido `<main>` do children de teste, diferenciado aria-labels entre sidebar e bottom tabs
- Fix: `lucide-react` não estava instalado em apps/web — adicionado como dependência
- Fix: `@testing-library/user-event` não estava em packages/ui — adicionado como devDependency

### Completion Notes
- 43 testes passando (35 packages/ui + 8 apps/web), zero falhas
- Todos os ACs satisfeitos: NavigationConfig com 5 tabs, bottom tabs responsivo com breakpoint 360px, sidebar 240px, layout unificado com breakpoints lg, container max-w-7xl, touch targets 44px, keyboard nav, motion-safe transitions, jest-axe passing
- Componentes seguem padrão existente: forwardRef, cn(), CSS variables dos design tokens

## File List

- `packages/ui/components/navigation-types.ts` — NEW: Interface NavigationItem
- `packages/ui/components/bottom-tabs.tsx` — NEW: Componente BottomTabs mobile
- `packages/ui/components/sidebar.tsx` — NEW: Componente Sidebar desktop
- `packages/ui/src/index.ts` — MODIFIED: Adicionados exports de NavigationItem, BottomTabs, Sidebar
- `packages/ui/__tests__/bottom-tabs.spec.tsx` — NEW: 11 testes (axe, keyboard, responsivo)
- `packages/ui/__tests__/sidebar.spec.tsx` — NEW: 12 testes (axe, keyboard, header slot)
- `apps/web/config/navigation.ts` — NEW: Config com 5 tabs (Radar, Reuniões, Trilhas, Perfil, Mais)
- `apps/web/app/(authenticated)/layout.tsx` — NEW: Server Component layout autenticado
- `apps/web/app/(authenticated)/_components/navigation-shell.tsx` — NEW: Client Component com usePathname + Link
- `apps/web/app/(authenticated)/__tests__/navigation-shell.spec.tsx` — NEW: 7 testes (axe, layout, breakpoints)
- `apps/web/vitest.setup.ts` — NEW: Setup jest-axe para vitest
- `apps/web/vitest.config.ts` — MODIFIED: Adicionado setupFiles
- `apps/web/package.json` — MODIFIED: Adicionado lucide-react
- `packages/ui/package.json` — MODIFIED: Adicionado @testing-library/user-event

## Change Log

- 2026-04-09: Implementação completa da Story 1.8 — NavigationConfig, BottomTabs, Sidebar, layout responsivo unificado com testes de acessibilidade (43 testes passando)
