# Implementation Plan: Navegação por Teclado — Fluxos Autenticados

**Feature**: `a11y-teclado-autenticado` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)

## Summary

Implementar conformidade WCAG AA de navegação por teclado em todos os fluxos
autenticados do metanoia-hub (Story 12.2, Epic 12). A Story 12.1 já entregou a
infraestrutura de skip-nav e focus management nos fluxos públicos. Esta story
expande a cobertura para 7 contextos autenticados via três mecanismos técnicos
centrais:

1. **Hook `useFocusOnRouteChange()`** no layout raiz autenticado — foco pós-redirect
   pós-login (CL-001, TD-001).
2. **Roving tabindex** no componente `Sidebar` de `packages/ui` — navegação Arrow
   Up/Down sem sair do grupo (CL-003).
3. **Hook `useAsyncAnnouncer()`** + região `aria-live="polite"` global — anúncios
   assíncronos sem mover o foco (CL-005).
4. **Botões de reordenação sempre visíveis** (`aria-label` descritivo) no builder de
   trilhas (CL-004).
5. **shadcn/ui Dialog (Radix UI)** como único mecanismo de focus trap — sem
   implementação manual (CL-002).

Feature é puramente front-end: zero novos endpoints de API, zero migrações de banco,
zero novos schemas Zod.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true), React 19, Next.js 16.2 (App Router)
**Primary Dependencies**:
- `@radix-ui/react-dialog` via `packages/ui/components/dialog.tsx` (focus trap)
- `next/navigation` `usePathname` (hook de foco pós-rota)
- `packages/ui/components/sidebar.tsx` (roving tabindex — modificação)
- `@axe-core/playwright` (E2E a11y, já instalado em `apps/web/e2e/`)
- `jest-axe` (unit a11y, já instalado)
**Storage**: N/A — feature é puramente front-end, sem persistência
**Testing**: Vitest 4.1.2 (unit), Playwright 1.59.1 (E2E, Chromium-only no CI)
**Target Platform**: Vercel (Next.js), monorepo Turborepo 2.5+
**Project Type**: Web app (SaaS B2B)
**Performance Goals**: Foco programático em < 16ms (1 frame) após mudança de rota;
  aria-live announcement sem jank visual.
**Constraints**:
- `strict: true` em todo TypeScript — sem exceção (Const. II)
- UI strings user-facing em PT-BR, centralizadas em `apps/web/messages/pt-BR.json` (Const. III)
- WCAG AA obrigatório; acessibilidade é requisito (Const. VI)
- Sem novos endpoints de API, sem schemas Zod novos, sem migrations (feature é FE-only)
**Scale/Scope**: 7 fluxos autenticados auditados; ~15 arquivos modificados; 3 hooks novos;
  1 componente existente modificado (`packages/ui/components/sidebar.tsx`).

---

## Constitution Check

*GATE: Deve passar antes do Phase 0. Re-checar após Phase 1.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Multi-tenancy Absoluto | N/A | Feature é front-end puro. Sem tabelas, sem RLS, sem AsyncLocalStorage. Os fluxos autenticados já estão protegidos por Keycloak guards. |
| II. Type-Safety & Identificadores | PASS | strict: true em todos os hooks novos. Sem Prisma, sem UUIDs gerados nesta feature. |
| III. Idioma & Vocabulário Pastoral | PASS | Código/variáveis em inglês; strings user-facing (aria-label, aria-live) em PT-BR via `pt-BR.json`. Vocabulário pastoral mantido. |
| IV. Contratos de API Padronizados | N/A | Sem novos endpoints. Os hooks novos são puramente client-side; não alteramos schemas Zod. |
| V. Separação de Estado no Frontend | PASS | Hooks novos são puros React (useEffect, useRef, usePathname) sem Zustand nem TanStack Query. O layout raiz autenticado é Server Component — o hook `useFocusOnRouteChange` vive num Client Component filho (`FocusManager`) wrapping o children. |
| VI. Qualidade Verificável | PASS | jest-axe para unit; @axe-core/playwright para E2E. Testes E2E obrigatórios por fluxo (FR-025). WCAG AA como requisito. |
| VII. Processo de Entrega | PASS | CI verde obrigatório; sem stack trace exposto. Feature sem novos endpoints — CI é lint + test + build do apps/web. |

**Resultado**: PASS em todos os princípios aplicáveis. Nenhuma violação de MUST.

---

## Convencoes de Borda

**N/A — single-layer (front-end).**

Esta feature não atravessa nenhuma fronteira FE/BE. Zero novos endpoints, zero schemas
Zod novos, zero mutations de banco. Todas as alterações são Client Components e hooks
React dentro de `apps/web/`. Não há mapper layer, não há contratos de API a declarar.

---

## Project Structure

### Documentation (this feature)

```
docs/specs/a11y-teclado-autenticado/
├── spec.md          — Especificação com 7 US e 5 clarifications (CL-001..005)
└── plan.md          — Este arquivo
```

### Source Code — Arquivos Reais Tocados

```
apps/web/
├── app/
│   ├── (authenticated)/
│   │   ├── layout.tsx                                      [MODIFY] inserir FocusManager como filho de NavigationShell
│   │   └── _components/
│   │       ├── navigation-shell.tsx                        [MODIFY] adicionar AsyncAnnouncerProvider + aria-live region
│   │       └── focus-manager.tsx                           [NEW]    Client Component; chama useFocusOnRouteChange()
│   └── app/
│       ├── admin/
│       │   ├── grupos/
│       │   │   ├── page.tsx                                [MODIFY] foco pós-ação (FR-011)
│       │   │   └── novo/_components/create-group-form.tsx  [MODIFY] Tab order, foco retorno (FR-008)
│       │   └── configuracoes/
│       │       ├── branding/BrandingSettingsForm.tsx        [MODIFY] input hex alternativo, foco (FR-019,FR-020)
│       │       └── politicas/_components/
│       │           └── privacy-confirm-dialog.tsx           [VERIFY] confirmar uso de Radix Dialog (FR-009)
│       ├── gestao/
│       │   └── relatorios/trilhas/[trailId]/page.tsx        [SCOPE]  verificar se builder de reordenação existe aqui
│       └── consumo/
│           └── trilhas/
│               ├── page.tsx                                [MODIFY] busca com aria-live, foco no campo (FR-015..018)
│               └── [trailId]/
│                   ├── trail-playlist.tsx                  [MODIFY] cards focáveis (FR-017)
│                   └── lesson-row.tsx                      [VERIFY] Tab order já ok?
│
├── app/(authenticated)/app/admin/igreja/grupos/[groupId]/trilhas/
│   ├── group-trails-client.tsx                             [MODIFY] integrar TrailItemReorder (US4)
│   └── _components/
│       └── trail-item-reorder.tsx                          [NEW]    botões Up/Down sempre visíveis (CL-004)
│
├── src/
│   ├── components/a11y/
│   │   ├── skip-nav.tsx                                    [REUSE]  já existe, não modificar
│   │   └── async-announcer.tsx                             [NEW]    região aria-live global (CL-005)
│   └── hooks/
│       ├── use-focus-on-route-change.ts                    [NEW]    CL-001 (TD-001)
│       ├── use-roving-tabindex.ts                          [NEW]    CL-003
│       └── use-async-announcer.ts                          [NEW]    CL-005 (re-export do Context)
│
└── e2e/keyboard/
    ├── dashboard-keyboard.spec.ts                          [NEW]    US1 E2E
    ├── post-login-focus.spec.ts                            [NEW]    US2 E2E
    ├── grupos-keyboard.spec.ts                             [NEW]    US3 E2E
    ├── trail-builder-keyboard.spec.ts                      [NEW]    US4 E2E
    ├── catalogo-keyboard.spec.ts                           [NEW]    US5 E2E
    ├── configuracoes-keyboard.spec.ts                      [NEW]    US6 E2E
    └── planos-keyboard.spec.ts                             [NEW]    US7 E2E

packages/ui/
└── components/
    └── sidebar.tsx                                         [MODIFY] adicionar roving tabindex (CL-003)
```

> **Nota sobre builder de trilhas (US4)**: Não foi encontrado diretório dedicado
> `trail-builder`. O arquivo mais próximo de gerenciamento de trilhas é
> `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/trilhas/group-trails-client.tsx`.
> A tarefa US4 implementa `TrailItemReorder` como componente novo nesse contexto.
> Se reordenação ainda não existir no código atual, o componente é criado como
> funcionalidade nova acessível (botões substituem drag-and-drop).

---

## Phase 0 — Research: Decisões Técnicas

### Decision 1 — Onde vive o `useFocusOnRouteChange` (CL-001)

**Decision**: Client Component `FocusManager` filho do layout raiz autenticado.

**Rationale**: `apps/web/app/(authenticated)/layout.tsx` é Server Component (usa
`cookies()`, `fetch` para branding). Não pode ter `useEffect` diretamente. A solução
canônica Next.js App Router é um Client Component filho que recebe `children` como
prop e adiciona o side-effect de foco. O `FocusManager` é inserido dentro do
`NavigationShell`, sem alterar a natureza Server do layout pai.

```tsx
// layout.tsx — Server Component, sem mudança de natureza
<NavigationShell>
  <FocusManager>
    <OnboardingRedirectGuard>{children}</OnboardingRedirectGuard>
  </FocusManager>
</NavigationShell>
```

**Alternativa rejeitada**: `useEffect` no próprio `layout.tsx` — impossível, Server
Component não suporta hooks React.

---

### Decision 2 — Estratégia de seleção do elemento de foco (CL-001)

**Decision**: `focusFirstInteractive()` busca dentro de `<main id="conteudo">`
(já presente no `NavigationShell`) na ordem:
1. `[data-autofocus]` — override explícito por página
2. `h1` — heading principal
3. Primeiro interativo: `a[href]`, `button:not([disabled])`, `input:not([disabled])`,
   `select:not([disabled])`, `textarea:not([disabled])`, `[tabindex]:not([tabindex="-1"])`

Guard: `prevPathname.current === pathname` → no-op (evita disparo duplo no mount).

---

### Decision 3 — Roving tabindex na Sidebar (CL-003)

**Decision**: Modificar `packages/ui/components/sidebar.tsx` consumindo hook
`useRovingTabindex`. O Sidebar já usa `<ul>` + `<li>` com `activeKey`. A extensão
adiciona `tabIndex` e `onKeyDown` por item sem breaking change na API pública
(`items`, `activeKey`, `renderLink` continuam intactos).

Comportamento Arrow keys:
- Arrow Down: próximo item (circular: último → primeiro)
- Arrow Up: item anterior (circular: primeiro → último)
- Home: primeiro item
- End: último item
- Tab: sai do grupo (tabIndex=-1 nos não-ativos faz o browser avançar para o
  próximo landmark)

---

### Decision 4 — `useAsyncAnnouncer` singleton (CL-005)

**Decision**: React Context com `AsyncAnnouncerProvider` no `NavigationShell`.
Região `role="status" aria-live="polite" aria-atomic="true" className="sr-only"`
singleton no DOM. Qualquer filho chama `useAsyncAnnouncer()` para anunciar mensagens.
Limpeza automática após 5s.

---

### Decision 5 — OnboardingWizard: fora do escopo desta story (CL-002)

**Decision**: `OnboardingWizard` usa `role="dialog"` customizado com full-screen e
lógica de navegação Arrow Left/Right entre steps. Migração para Radix Dialog quebraria
essa lógica e está no grupo `(onboarding)` — fora do escopo de fluxos **autenticados**.

CL-002 aplica-se aos diálogos dentro da área `(authenticated)`:
- `privacy-confirm-dialog.tsx` (configurações)
- Diálogos de confirmação de CRUD de grupos
- Diálogos de confirmação de planos

Esses SIM devem usar `packages/ui/components/dialog.tsx`.

---

## Phase 1 — Design de Componentes e Hooks

### 1.1 Hook: `useFocusOnRouteChange`

**Arquivo**: `apps/web/src/hooks/use-focus-on-route-change.ts`
**Tipo**: Client hook (`'use client'`)
**Contrato**:
```typescript
export function useFocusOnRouteChange(options?: {
  selector?: string;  // override seletor (default: busca em #conteudo)
}): void
```
**Testes**:
```
apps/web/src/__tests__/hooks/use-focus-on-route-change.spec.ts  [NEW]
  - mock usePathname, mock DOM
  - verifica .focus() no elemento correto
  - no-op quando pathname não muda
  - fallback correto: sem [data-autofocus] usa h1
```

---

### 1.2 Component: `FocusManager`

**Arquivo**: `apps/web/app/(authenticated)/_components/focus-manager.tsx`
**Tipo**: Client Component (`'use client'`)
**Contrato**:
```typescript
export function FocusManager({ children }: { children: React.ReactNode }): JSX.Element
```
Renderiza `children` sem wrapper visual. Chama `useFocusOnRouteChange()` internamente.

---

### 1.3 Hook: `useRovingTabindex`

**Arquivo**: `apps/web/src/hooks/use-roving-tabindex.ts`
**Tipo**: Client hook
**Contrato**:
```typescript
export function useRovingTabindex<T extends string>(config: {
  keys: T[];
  activeKey: T;
}): {
  getTabIndex: (key: T) => 0 | -1;
  getKeyDownHandler: (key: T) => React.KeyboardEventHandler;
  setRef: (key: T, el: HTMLElement | null) => void;
}
```
**Testes** (em `packages/ui/__tests__/sidebar.spec.tsx` + novo spec do hook):
```
  - Arrow Down move foco para próximo item
  - Arrow Up move foco para item anterior
  - Circular: Arrow Down no último → primeiro
  - Tab não fica preso no grupo
  - Home/End funcionam
```

---

### 1.4 Component: `AsyncAnnouncer` + Hook `useAsyncAnnouncer`

**Arquivo**: `apps/web/src/components/a11y/async-announcer.tsx`
**Tipo**: Client Component + Context
**Contrato**:
```typescript
export function AsyncAnnouncerProvider({ children }: { children: React.ReactNode }): JSX.Element
// Renderiza <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">

export function useAsyncAnnouncer(): (message: string) => void
```
**Mensagens PT-BR** (via `apps/web/messages/pt-BR.json`):
- Busca: `"N resultados encontrados para [termo]"`
- Salvar config: `"Configurações salvas com sucesso."`
- Reordenação: `"[Item] movido para a posição [N]."`

---

### 1.5 Component: `TrailItemReorder`

**Arquivo**: `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/trilhas/_components/trail-item-reorder.tsx`
**Tipo**: Client Component
**Contrato**:
```typescript
interface TrailItemReorderProps {
  itemId: string;
  titulo: string;        // para aria-label descritivo
  canMoveUp: boolean;    // false no primeiro item
  canMoveDown: boolean;  // false no último item
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpRef?: React.RefObject<HTMLButtonElement>;   // para foco pós-reordenação
  moveDownRef?: React.RefObject<HTMLButtonElement>;
}
export function TrailItemReorder(props: TrailItemReorderProps): JSX.Element
```
**Regras de acessibilidade** (CL-004):
- Botões SEMPRE visíveis (não hover-only)
- `aria-label={`Mover "${titulo}" para cima`}` e `aria-label={`Mover "${titulo}" para baixo`}`
- `disabled` + `aria-disabled="true"` quando `!canMoveUp` / `!canMoveDown`
- Foco pós-reordenação via ref: `moveUpRef?.current?.focus()` no `useEffect([order])`

---

### 1.6 Modificações em Páginas Existentes

#### `navigation-shell.tsx` — adicionar `AsyncAnnouncerProvider`
Wrapping do `<main id="conteudo">` com o provider. A região `aria-live` fica
dentro do componente para ser acessível como descendente do main landmark.

#### `grupos/page.tsx` — foco pós-ação (FR-011)
Após mutação de criação de grupo bem-sucedida: ref no container + `focus()` no
`<article>` do grupo recém-criado.

#### `BrandingSettingsForm.tsx` — input hex alternativo (FR-020)
Se color picker visual existir: adicionar `<input type="text" pattern="^#[0-9A-Fa-f]{6}$">`
como alternativa teclado-acessível ao seletor visual.

#### `trail-playlist.tsx` / `trail-card.tsx` — cards focáveis (FR-017)
Verificar que cada card tem `tabIndex={0}` (se `<div>`) ou é wrapping por `<a>`.
Adicionar `onKeyDown` para Enter → navegação.

---

## Cenários de Teste por User Story

### US1 — Dashboard (E2E: `e2e/keyboard/dashboard-keyboard.spec.ts`)

| Cenário | Tipo | Ferramenta | Critério de Pass |
|---------|------|-----------|-----------------|
| Tab segue ordem: skip-nav → sidebar → main → ações | E2E | Playwright | foco chega em cada landmark em ordem |
| Arrow Down na sidebar move foco para o próximo item | E2E | Playwright | `activeElement` muda para item seguinte |
| Arrow Up na sidebar move foco para item anterior | E2E | Playwright | `activeElement` muda para item anterior |
| Arrow Down no último item da sidebar → volta ao primeiro | E2E | Playwright | comportamento circular |
| Tab sai do grupo sidebar (não fica preso) | E2E | Playwright | Tab após último item vai para main |
| Sem foco preso em nenhum elemento | E2E+axe | @axe-core/playwright | 0 violations `keyboard-trap` |
| `aria-current="page"` no item ativo | Unit | jest-axe | atributo presente |

### US2 — Foco Pós-Login (E2E: `e2e/keyboard/post-login-focus.spec.ts`)

| Cenário | Tipo | Ferramenta | Critério de Pass |
|---------|------|-----------|-----------------|
| Após redirect de login: foco em h1 ou [data-autofocus] | E2E | Playwright | `document.activeElement !== document.body` |
| Rota direta `/app/gestao/radar`: foco em conteúdo | E2E | Playwright | activeElement dentro de `#conteudo` |
| Rota profunda `/app/admin/grupos/[id]`: foco no destino | E2E | Playwright | foco no conteúdo da rota profunda |
| Re-login após expiração de sessão: foco correto | E2E | Playwright | mesmo comportamento do login inicial |

### US3 — CRUD Grupos (E2E: `e2e/keyboard/grupos-keyboard.spec.ts`)

| Cenário | Tipo | Ferramenta | Critério de Pass |
|---------|------|-----------|-----------------|
| Tab percorre todos os campos do formulário | E2E | Playwright | todos os campos focados em sequência |
| Diálogo de exclusão: focus trap (Tab não escapa) | E2E | Playwright | activeElement sempre dentro do dialog |
| Diálogo de exclusão: Escape fecha e restaura foco | E2E | Playwright | foco volta ao trigger |
| Após criar grupo: foco no card do novo grupo | E2E | Playwright | activeElement é o artigo do novo grupo |
| Formulário sem violations a11y | Unit | jest-axe | 0 violations |

### US4 — Builder de Trilhas (E2E: `e2e/keyboard/trail-builder-keyboard.spec.ts`)

| Cenário | Tipo | Ferramenta | Critério de Pass |
|---------|------|-----------|-----------------|
| Botões "Mover ↑" e "Mover ↓" sempre visíveis | E2E | Playwright | `visibility !== 'hidden'` sem hover |
| `aria-label` inclui título do item | Unit | jest-axe | aria-label contém o titulo da trilha |
| Enter em "Mover ↑": item sobe, foco mantido | E2E | Playwright | foco permanece no botão do item movido |
| Botão "Mover ↑" do primeiro item: disabled | Unit | Vitest | `disabled` e `aria-disabled="true"` |
| Botão "Mover ↓" do último item: disabled | Unit | Vitest | `disabled` e `aria-disabled="true"` |
| `TrailItemReorder`: 0 violations a11y | Unit | jest-axe | 0 violations |

### US5 — Catálogo e Busca (E2E: `e2e/keyboard/catalogo-keyboard.spec.ts`)

| Cenário | Tipo | Ferramenta | Critério de Pass |
|---------|------|-----------|-----------------|
| Campo busca é primeiro focável da seção | E2E | Playwright | Tab chega ao campo antes de qualquer card |
| Após busca: foco permanece no campo de busca | E2E | Playwright | `activeElement === searchInput` |
| Após busca: aria-live anuncia contagem | E2E | Playwright | `role=status` tem texto "N resultados" |
| Cards: focáveis e ativáveis com Enter | E2E | Playwright | Enter no card navega para a trilha |
| Filtros dropdown: Arrow Up/Down navegam opções | E2E | Playwright | opções alcançáveis por teclado |

### US6 — Configurações Tenant (E2E: `e2e/keyboard/configuracoes-keyboard.spec.ts`)

| Cenário | Tipo | Ferramenta | Critério de Pass |
|---------|------|-----------|-----------------|
| Tab percorre todos os campos na ordem visual | E2E | Playwright | todos os campos focados em sequência |
| Input hex alternativo ao color picker focável | E2E | Playwright | `input[type=text]` focável na seção cor |
| Upload logo: Enter abre diálogo de arquivo | E2E | Playwright | click disparado no `input[type=file]` |
| Após salvar: aria-live anuncia sucesso | E2E | Playwright | `role=status` tem mensagem de confirmação |
| Formulário: 0 violations a11y | Unit | jest-axe | 0 violations |

### US7 — Gestão de Planos (E2E: `e2e/keyboard/planos-keyboard.spec.ts`)

| Cenário | Tipo | Ferramenta | Critério de Pass |
|---------|------|-----------|-----------------|
| Cards de plano são individualmente focáveis | E2E | Playwright | Tab foca cada card separadamente |
| Enter no card: detalhes expandidos | E2E | Playwright | conteúdo visível após Enter |
| CTAs "Assinar"/"Falar com vendas" focáveis | E2E | Playwright | Tab chega aos botões |
| Fluxo de upgrade: todos os steps por teclado | E2E | Playwright | completar fluxo sem mouse |

---

## Relatório de Baseline e Final (FR-001, FR-002)

### FR-001 — Baseline (antes das correções)

O arquivo `e2e/a11y/axe-baseline.spec.ts` já existe. Configurar para auditar:
- `/app/gestao/radar` (dashboard Gestão)
- `/app/consumo/trilhas` (catálogo Participante)
- `/app/admin/grupos` (CRUD grupos)
- `/app/admin/configuracoes/branding` (branding Tenant)

**Classificação de problemas**:
- **Bloqueador**: impede completar tarefa principal sem mouse
- **Maior**: degrada significativamente a experiência
- **Menor**: desvio de boa prática, não impede conclusão

### FR-002 — Relatório Final

Comparar com baseline. Critério de "done": zero bloqueadores em todos os fluxos auditados.

---

## Verificação Cross-Browser (FR-027)

| Browser | Método | Critério |
|---------|--------|---------|
| Chromium | Automatizado no CI (Playwright E2E) | 100% testes passando |
| Firefox | Manual (checklist gerado em /checklist) | Nenhum bloqueador |
| Safari | Manual (checklist gerado em /checklist) | Nenhum bloqueador |

---

## Sequenciamento de Tasks (para `/create-tasks`)

| Fase | Task | Dep | US/FR Cobertos |
|------|------|-----|---------------|
| 1 | `use-focus-on-route-change.ts` + `FocusManager` | — | US2, CL-001, FR-006, FR-007 |
| 1 | `async-announcer.tsx` + `use-async-announcer.ts` | — | CL-005, FR-017 async |
| 2 | `use-roving-tabindex.ts` + Sidebar modificado | Fase 1 | US1, CL-003, FR-003, FR-004 |
| 2 | Baseline axe em `e2e/a11y/axe-baseline.spec.ts` | — | FR-001 |
| 3 | E2E US1 (dashboard) | Fase 2 | FR-025 |
| 3 | E2E US2 (pós-login) | Fase 1 | FR-025 |
| 4 | `TrailItemReorder` + `group-trails-client.tsx` | Fase 1 | US4, CL-004, FR-012, FR-013 |
| 4 | E2E US4 (builder trilhas) | Fase 4 | FR-025 |
| 5 | CRUD Grupos: tab order + Radix Dialog + foco retorno | Fase 1 | US3, CL-002, FR-008..011 |
| 5 | E2E US3 (grupos) | Fase 5 | FR-025 |
| 6 | Catálogo: busca + aria-live + cards focáveis | Fase 1 | US5, FR-015..018 |
| 6 | E2E US5 (catálogo) | Fase 6 | FR-025 |
| 7 | Configurações: hex input + upload + aria-live | Fase 1 | US6, FR-019..021 |
| 7 | E2E US6 (configurações) | Fase 7 | FR-025 |
| 8 | Gestão planos: cards focáveis + CTAs + dialog | Fase 1 | US7, FR-022..024 |
| 8 | E2E US7 (planos) | Fase 8 | FR-025 |
| 9 | Relatório final + cross-browser checklist | Todas | FR-002, FR-027 |

---

## Constitution Check (Re-check pós-Phase 1)

| Princípio | Status | Notas Pós-Design |
|-----------|--------|-----------------|
| I. Multi-tenancy | N/A | Sem alterações de dados. Confirmed. |
| II. Type-Safety | PASS | Todos os hooks tipados estritamente. Props TypeScript explícitas. |
| III. Idioma & Vocabulário | PASS | Variáveis/hooks em inglês. `aria-label` e mensagens `aria-live` em PT-BR via `pt-BR.json`. |
| IV. Contratos de API | N/A | Zero endpoints novos. Confirmed. |
| V. Separação de Estado | PASS | Hooks são pure UI state (não Zustand, não TanStack). `FocusManager` é Client filho de Server layout — sem violação do padrão App Router. |
| VI. Qualidade Verificável | PASS | jest-axe + @axe-core/playwright por US. E2E no CI (Chromium). |
| VII. Processo de Entrega | PASS | CI verde obrigatório. Sem stack trace exposto. |

**Resultado pós-Phase 1**: PASS completo. Nenhuma violação introduzida.

---

## Artefatos

| Arquivo | Status |
|---------|--------|
| `docs/specs/a11y-teclado-autenticado/plan.md` | Criado |

> `data-model.md`, `contracts/`, `research.md` e `quickstart.md` são N/A:
> feature é single-layer front-end sem entidades de dados novas ou contratos de API.

---

## Próximos Passos

1. `/checklist` — Gerar quality gate (WCAG AA checklist por fluxo + cross-browser)
2. `/create-tasks` — Decompor em backlog executável (usar sequenciamento da tabela acima)
3. `/execute-task` — Implementar na ordem das fases (Fase 1 → Fase 9)
