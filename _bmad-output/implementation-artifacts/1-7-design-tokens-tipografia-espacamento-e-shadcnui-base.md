# Story 1.7: Design Tokens, Tipografia, Espaçamento e shadcn/ui Base

Status: ready-for-dev

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

- [ ] Task 1: Configurar design tokens como CSS custom properties (AC: #1, #2, #3)
  - [ ] 1.1 Criar arquivo de CSS tokens em `packages/ui/styles/tokens.css` com `:root`
  - [ ] 1.2 Definir Brand colors: brand-teal, brand-teal-light, brand-teal-dark, brand-terracotta, brand-terracotta-light
  - [ ] 1.3 Definir Pastoral colors: care-urgent, care-attention, care-ok, care-neutral
  - [ ] 1.4 Definir Surface colors: surface-base, surface-elevated, surface-sunken
  - [ ] 1.5 Definir Interactive state tokens: hover, active, focus, disabled

- [ ] Task 2: Configurar Tailwind preset com tokens (AC: #1)
  - [ ] 2.1 Criar `packages/config/tailwind.preset.ts`
  - [ ] 2.2 Mapear CSS custom properties para classes Tailwind semânticas
  - [ ] 2.3 Configurar Next.js para carregar o preset

- [ ] Task 3: Configurar tipografia (AC: #4, #5)
  - [ ] 3.1 Carregar Inter via `next/font` com latin + latin-ext
  - [ ] 3.2 Configurar typography scale: Display 36/700, H1 30/700, H2 24/600, Body 16/400, Body Small 14/400, Caption 12/500, Overline 11/600

- [ ] Task 4: Configurar espaçamento (AC: #6)
  - [ ] 4.1 Configurar base-4px spacing scale
  - [ ] 4.2 Criar density tokens: Consumo (20-24px), Gestão (16-20px), Admin (12-16px)

- [ ] Task 5: Preparar dark mode (AC: #7)
  - [ ] 5.1 Criar classe `.dark` com redefinição dos CSS custom properties
  - [ ] 5.2 Garantir que todos tokens são redefiníveis

- [ ] Task 6: Inicializar shadcn/ui com componentes base (AC: #8, #9)
  - [ ] 6.1 Inicializar shadcn/ui CLI v4 em `packages/ui/`
  - [ ] 6.2 Adicionar componentes: Button, Card, Input, Dialog
  - [ ] 6.3 Customizar componentes para usar design tokens (não cores default do shadcn)

- [ ] Task 7: Testes de acessibilidade (AC: #10)
  - [ ] 7.1 Configurar jest-axe para components
  - [ ] 7.2 Escrever testes de acessibilidade para Button, Card, Input, Dialog

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
