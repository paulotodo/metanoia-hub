# Story 1.7: Design Tokens, Tipografia, Espaçamento e shadcn/ui Base

Status: review

## Story

As a developer,
I want design tokens (colors, typography, spacing) configured as CSS custom properties with Tailwind integration, and shadcn/ui initialized with base components,
So that all future UI work follows a consistent visual foundation with reusable accessible components.

## Acceptance Criteria

**Given** the `packages/config/tailwind.preset.ts` is loaded by Next.js
**When** I use semantic classes like `bg-surface-base`, `text-brand-teal`, `text-care-urgent`
**Then** the correct CSS custom properties are applied
**And** CSS custom properties are defined in `:root` for:
  - Brand: `brand-teal` (#2B7A78), `brand-teal-light` (#3AAFA9), `brand-teal-dark` (#17252A), `brand-terracotta` (#C1666B), `brand-terracotta-light` (#D4918A)
  - Pastoral: `care-urgent` (#C1666B), `care-attention` (#D4A24C), `care-ok` (#7BA38A), `care-neutral` (#8E8D8A)
  - Surfaces: `surface-base` (#FAFAF8), `surface-elevated` (#FFFFFF), `surface-sunken` (#F2F0ED)
  - Interactive states: `hover`, `active`, `focus`, `disabled` tokens
**And** Inter font is loaded via `next/font` with latin + latin-ext subsets
**And** typography scale is configured: Display 36px/700, H1 30px/700, H2 24px/600, Body 16px/400, Body Small 14px/400, Caption 12px/500, Overline 11px/600
**And** spacing follows base-4px scale with density tokens per experience (Consumo 20-24px, Gestão 16-20px, Admin 12-16px)
**And** structure is prepared for dark mode (CSS custom properties redefinable via `.dark` class)
**And** shadcn/ui (CLI v4) is initialized in `packages/ui/components/` with base components: Button, Card, Input, Dialog
**And** base components use the design tokens (not default shadcn colors)
**And** all base components pass jest-axe accessibility tests

## Tasks / Subtasks

- [x] Task 1: Configurar design tokens como CSS custom properties (AC: #1, #2, #3)
  - [x] 1.1 Criar arquivo de CSS tokens em `packages/ui/styles/tokens.css` com `:root`
  - [x] 1.2 Definir Brand colors: brand-teal, brand-teal-light, brand-teal-dark, brand-terracotta, brand-terracotta-light
  - [x] 1.3 Definir Pastoral colors: care-urgent, care-attention, care-ok, care-neutral
  - [x] 1.4 Definir Surface colors: surface-base, surface-elevated, surface-sunken
  - [x] 1.5 Definir Interactive state tokens: hover, active, focus, disabled

- [x] Task 2: Configurar Tailwind preset com tokens (AC: #1)
  - [x] 2.1 Criar `packages/config/tailwind.preset.css` (Tailwind v4 CSS-first — equivalente idiomático ao .ts)
  - [x] 2.2 Mapear CSS custom properties para classes Tailwind semânticas via @theme
  - [x] 2.3 Configurar Next.js para carregar o preset (PostCSS + globals.css import chain)

- [x] Task 3: Configurar tipografia (AC: #4, #5)
  - [x] 3.1 Carregar Inter via `next/font` com latin + latin-ext
  - [x] 3.2 Configurar typography scale: Display 36/700, H1 30/700, H2 24/600, Body 16/400, Body Small 14/400, Caption 12/500, Overline 11/600

- [x] Task 4: Configurar espaçamento (AC: #6)
  - [x] 4.1 Configurar base-4px spacing scale
  - [x] 4.2 Criar density tokens: Consumo (20-24px), Gestão (16-20px), Admin (12-16px)

- [x] Task 5: Preparar dark mode (AC: #7)
  - [x] 5.1 Criar classe `.dark` com redefinição dos CSS custom properties
  - [x] 5.2 Garantir que todos tokens são redefiníveis

- [x] Task 6: Inicializar shadcn/ui com componentes base (AC: #8, #9)
  - [x] 6.1 Inicializar shadcn/ui em `packages/ui/` (manual, pattern-based — mais confiável em monorepo)
  - [x] 6.2 Adicionar componentes: Button, Card, Input, Dialog
  - [x] 6.3 Customizar componentes para usar design tokens (via shadcn variable bridge em globals.css)

- [x] Task 7: Testes de acessibilidade (AC: #10)
  - [x] 7.1 Configurar Vitest + jest-axe para components
  - [x] 7.2 Escrever testes de acessibilidade para Button, Card, Input, Dialog

## Dev Notes

### Stack & Versões
- Tailwind CSS 4.2.2
- shadcn/ui CLI v4
- next/font (Inter)
- Vitest 4.1.2 + jest-axe

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 1.1 (Scaffold do Monorepo) — packages/ui e packages/config existem

### Project Structure Notes
```
packages/ui/
├── styles/
│   └── tokens.css              # CSS custom properties (:root + .dark)
├── components/
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── dialog.tsx
└── __tests__/
    ├── button.spec.tsx
    ├── card.spec.tsx
    ├── input.spec.tsx
    └── dialog.spec.tsx

packages/config/
└── tailwind.preset.ts          # Tailwind preset com design tokens
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-01.md — Story 1.7]
- [Source: docs/project-context.md — UI: Tailwind CSS, shadcn/ui]
- [Source: _bmad-output/planning-artifacts/architecture.md — Design system, color palette]

## Dev Agent Record

### Implementation Plan
- Tailwind CSS v4.2.2 usa configuração CSS-first (@theme) em vez de tailwind.config.ts — criado `tailwind.preset.css` como equivalente idiomático
- Design tokens definidos como CSS custom properties em `packages/ui/styles/tokens.css` com `:root` (light) e `.dark` (dark mode)
- shadcn/ui bridge: mapeamento das variáveis esperadas pelo shadcn (`--primary`, `--background`, etc.) para nossos design tokens em `globals.css`
- Componentes shadcn criados manualmente (não via CLI) para evitar problemas em monorepo — seguem exatamente os templates oficiais do shadcn/ui v4
- Font Inter carregada via `next/font/google` em `layout.tsx`, exposta como CSS variable `--font-inter`

### Debug Log
- Teste `button.spec.tsx > renders with text` falhou inicialmente por usar `toHaveTextContent` (requer `@testing-library/jest-dom`). Corrigido usando `textContent` nativo.

### Completion Notes
- ✅ Todos os 12 testes passando (4 arquivos de teste)
- ✅ Build do Next.js compilando sem erros
- ✅ Design tokens: 5 brand colors, 4 pastoral colors, 3 surface colors, 6 interactive state tokens, 4 text colors, 2 border colors
- ✅ Tipografia: Inter font com latin + latin-ext, 7 tamanhos no scale (Display → Overline)
- ✅ Espaçamento: base-4px scale (10 valores) + 3 density tokens (consumo, gestão, admin)
- ✅ Dark mode: classe `.dark` redefine todas as custom properties
- ✅ shadcn/ui: Button (6 variants), Card (6 sub-components), Input, Dialog (10 sub-components) — todos usando design tokens
- ✅ Acessibilidade: jest-axe passa para todos os 4 componentes base

## File List

### Novos
- `packages/ui/styles/tokens.css` — CSS custom properties (:root + .dark)
- `packages/ui/styles/globals.css` — Entry CSS com imports + shadcn variable bridge
- `packages/ui/lib/utils.ts` — Utilitário cn() (clsx + tailwind-merge)
- `packages/ui/components/button.tsx` — Componente Button com 6 variants
- `packages/ui/components/card.tsx` — Componente Card com 6 sub-componentes
- `packages/ui/components/input.tsx` — Componente Input
- `packages/ui/components/dialog.tsx` — Componente Dialog com 10 sub-componentes
- `packages/ui/vitest.config.ts` — Configuração Vitest para UI package
- `packages/ui/vitest.setup.ts` — Setup jest-axe para Vitest
- `packages/ui/__tests__/button.spec.tsx` — Testes de acessibilidade do Button
- `packages/ui/__tests__/card.spec.tsx` — Testes de acessibilidade do Card
- `packages/ui/__tests__/input.spec.tsx` — Testes de acessibilidade do Input
- `packages/ui/__tests__/dialog.spec.tsx` — Testes de acessibilidade do Dialog
- `packages/config/tailwind.preset.css` — Tailwind v4 @theme com design tokens
- `apps/web/postcss.config.mjs` — PostCSS config para @tailwindcss/postcss

### Modificados
- `packages/ui/package.json` — Deps (radix, cva, clsx, tailwind-merge, lucide, vitest, jest-axe, etc.)
- `packages/ui/src/index.ts` — Re-exports de todos os componentes
- `packages/config/package.json` — Dep tailwindcss, export ./tailwind
- `apps/web/package.json` — Deps @metanoia/ui, @tailwindcss/postcss, tailwindcss
- `apps/web/app/layout.tsx` — Inter font, import globals.css, classes semânticas

## Change Log

- 2026-04-09: Implementação completa da Story 1-7 — design tokens, Tailwind v4 preset, tipografia Inter, espaçamento base-4px com density tokens, dark mode via .dark class, shadcn/ui inicializado com Button/Card/Input/Dialog usando design tokens, testes de acessibilidade jest-axe (12 testes passando)
