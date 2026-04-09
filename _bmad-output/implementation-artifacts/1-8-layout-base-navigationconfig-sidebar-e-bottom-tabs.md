# Story 1.8: Layout Base — NavigationConfig, Sidebar e Bottom Tabs

Status: ready-for-dev

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

- [ ] Task 1: Criar NavigationConfig (AC: #1)
  - [ ] 1.1 Criar `apps/web/config/navigation.ts` com definição de 5 tabs
  - [ ] 1.2 Definir interface: label, icon, href, activeIcon para cada tab
  - [ ] 1.3 Tabs: Radar, Reuniões, Trilhas, Perfil, Mais

- [ ] Task 2: Implementar Bottom Tabs para mobile (AC: #2, #3)
  - [ ] 2.1 Criar `packages/ui/components/bottom-tabs.tsx`
  - [ ] 2.2 Renderizar icons + labels para telas > 360px
  - [ ] 2.3 Renderizar icon-only (label apenas no tab ativo) para telas ≤ 360px
  - [ ] 2.4 Garantir touch targets ≥ 44px

- [ ] Task 3: Implementar Sidebar para desktop (AC: #4)
  - [ ] 3.1 Criar `packages/ui/components/sidebar.tsx`
  - [ ] 3.2 Sidebar fixa com 240px de largura
  - [ ] 3.3 Icons + full labels

- [ ] Task 4: Layout responsivo unificado (AC: #5, #6, #7)
  - [ ] 4.1 Criar `apps/web/app/(authenticated)/layout.tsx`
  - [ ] 4.2 Bottom tabs < lg breakpoint, sidebar ≥ lg breakpoint
  - [ ] 4.3 Destacar item ativo com `brand-teal`
  - [ ] 4.4 Container principal com `mx-auto` e `max-w-7xl`

- [ ] Task 5: Acessibilidade e motion (AC: #8, #9, #10)
  - [ ] 5.1 Implementar keyboard navigation: Tab/Shift+Tab + Enter
  - [ ] 5.2 Usar `motion-safe:transition-all` para transições
  - [ ] 5.3 Garantir alternativa para reduced-motion

- [ ] Task 6: Testes de acessibilidade (AC: #11)
  - [ ] 6.1 Escrever testes jest-axe para bottom-tabs
  - [ ] 6.2 Escrever testes jest-axe para sidebar
  - [ ] 6.3 Escrever testes jest-axe para layout unificado

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
