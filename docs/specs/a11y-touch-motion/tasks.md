# Backlog — a11y-touch-motion (Story 12.4)
## Touch Targets, Reduced Motion & Mobile Feedback — NFR-A2 / UX-DR19

**Feature:** a11y-touch-motion | **Epic:** 12 — Acessibilidade
**Spec:** `docs/specs/a11y-touch-motion/spec.md` | **Plan:** `docs/specs/a11y-touch-motion/plan.md`
**Depende de:** Story 12.1 (nav pública teclado), 12.2 (nav autenticada teclado), 12.3 (contraste/focus)
**Gate local (execute-task):** `pnpm --filter @metanoia/api exec prisma generate && pnpm turbo build && pnpm turbo lint --max-warnings 0`

> Decisões materializadas: dec-008 (touch híbrido 44/24), dec-007 (reduced-motion), dec-023 (CHK033 Chromium-only CI), dec-024 (CHK025 globals.css path)

---

## Legenda de Criticidade
- `[crit]` — Bloqueia merge; quebra conformidade WCAG ou CI se ausente
- `[alto]` — Importante; deve ser feito nesta story (não pode ser deferido)
- `[normal]` — Melhora cobertura; pode ser simplificado se necessário
- `[baixo]` — Documentação / auxiliar; complementar

---

## EIXO-A: Touch Targets (US-1 / FR-1, dec-008)

### A.1 — Utilitários canônicos em `packages/ui/styles/globals.css` [crit]

**Fase:** EIXO-A | **Dependências:** nenhuma

**Descrição:**
Adicionar ao arquivo `packages/ui/styles/globals.css` (em `@layer utilities`, após o bridge shadcn):
- `.touch-target`: `position: relative; min-height: 44px; min-width: 44px;` + `@media (min-width: 768px) { min-height: 24px; min-width: 24px; }` (híbrido dec-008)
- `.touch-target-extend::before`: pseudo-elemento 44×44 para ícones de 24px em layout compacto (FR-1.2)
- `.touch-feedback`: `transition: none;` + `.touch-feedback:active { opacity: 0.8; transform: scale(0.98); }` (FR-2.1/2.2/2.3)

**Arquivos-alvo:**
- `packages/ui/styles/globals.css`

**Critério de aceite:**
- [x] `.touch-target` com `min-height: 44px` em mobile e `24px` em `>=768px`
- [x] `.touch-target-extend::before` com `height: 44px; width: 44px` e transform de centralização
- [x] `.touch-feedback` sem `transition` + `:active` com `opacity: 0.8; transform: scale(0.98)`
- [x] `pnpm turbo build` passa sem erros de CSS

---

### A.2 — Primitivo `Button` — tamanho mobile 44px [crit]

**Fase:** EIXO-A | **Dependências:** A.1

**Descrição:**
Em `packages/ui/components/button.tsx` (cva variants), ajustar os tamanhos para conformidade WCAG 2.5.5 mobile:
- `size:icon` — `"h-10 w-10"` → `"h-11 w-11 md:h-9 md:w-9"` (44px mobile / 36px desktop)
- `size:default` — garantir `min-h-[44px] md:min-h-9` ou `h-11 md:h-10` (44px mobile / 40px desktop)
- `size:sm` — `"h-9 ..."` → `min-h-[44px] md:min-h-9` (44px mobile / compacto desktop)
- Adicionar `active:scale-[0.98] active:opacity-90` à classe base do cva (todos os variants herdam — FR-2.1)
- `transition-colors` → `motion-safe:transition-colors` (FR-3.1/3.2)

**Arquivos-alvo:**
- `packages/ui/components/button.tsx`

**Critério de aceite:**
- [x] `size:icon` resulta em ≥44px no viewport <768px (medível via `getBoundingClientRect`)
- [x] `size:sm` e `size:default` com `min-height ≥ 44px` em mobile
- [x] Todas as variantes de Button exibem `active:` imediato (sem delay de transition)
- [x] `motion-safe:transition-colors` no lugar de `transition-colors`
- [x] `pnpm turbo build` e `pnpm turbo lint` passam

---

### A.3 — Primitivos de navegação (`Sidebar`, `BottomTabs`) [crit]

**Fase:** EIXO-A | **Dependências:** A.1

**Descrição:**
- `packages/ui/components/sidebar.tsx`: adicionar `min-h-[44px]` explícito ao `linkClasses` (hoje apenas `px-4 py-3`; ~48px OK mas sem garantia explícita). Adicionar `active:opacity-80` (FR-2.1).
- `packages/ui/components/bottom-tabs.tsx`: já tem `min-h-[44px] min-w-[44px]` — **sem mudança de tamanho**. Adicionar `active:opacity-80` ao item clicável (FR-2.1).

**Arquivos-alvo:**
- `packages/ui/components/sidebar.tsx`
- `packages/ui/components/bottom-tabs.tsx`

**Critério de aceite:**
- [x] `Sidebar` com `min-h-[44px]` explícito no elemento clicável do link
- [x] `BottomTabs` com `active:opacity-80` aplicado ao tab item
- [x] `Sidebar` com `active:opacity-80` aplicado ao `linkClasses`
- [x] `pnpm turbo build` passa

---

### A.4 — Primitivo `Input` — altura mobile 44px [alto]

**Fase:** EIXO-A | **Dependências:** A.1

**Descrição:**
Em `packages/ui/components/input.tsx`, ajustar `h-10` (40px) para `h-11 md:h-10` (44px mobile / 40px desktop). Secundário mas dentro do escopo FR-1.1.

**Arquivos-alvo:**
- `packages/ui/components/input.tsx`

**Critério de aceite:**
- [x] `Input` com `h-11` em mobile e `md:h-10` em desktop
- [x] Formulários de login/onboarding preservam layout (revisar visualmente)
- [x] `pnpm turbo build` passa

---

### A.5 — Folhas em `apps/web` — touch targets e feedback [alto]

**Fase:** EIXO-A | **Dependências:** A.1, A.2

**Descrição:**
Auditar e aplicar `.touch-target`, `min-h-[44px]` ou `touch-target-extend` nos componentes folha de risco elevado:
- `grupo-pill.tsx` — pill clicável: `min-h-[44px]` ou `.touch-target` + `active:opacity-80 active:scale-[0.98]`
- `plan-card.tsx` — CTA inline: garantir área ≥44px + `active:`
- `marketing-nav.tsx` — links de nav pública: `min-h-[44px]` + `active:`
- `onboarding/import-result-summary.tsx` — links inline: `.touch-target-extend` quando link ≤24px
- `content/trail-progress-bar.tsx` — links inline: mesma abordagem
- Checkboxes/radios de onboarding (`src/components/onboarding/*`): `min-h-[44px]` no label associado
- `app/(onboarding)/convite/[token]/_components/*` — botões de convite: `min-h-[44px]`

**Medição de alvo (operacionalização CHK010/CHK016):** tamanho do alvo real via `element.getBoundingClientRect()` — o teste E2E mede o elemento clicável real (não o espaçamento visual).

**Arquivos-alvo:**
- `apps/web/app/(authenticated)/app/gestao/radar/_components/grupo-pill.tsx`
- `apps/web/src/components/plans/plan-card.tsx`
- `apps/web/src/components/marketing/marketing-nav.tsx`
- `apps/web/src/components/onboarding/import-result-summary.tsx`
- `apps/web/src/components/content/trail-progress-bar.tsx`
- `apps/web/src/components/onboarding/` (checkboxes/radios — escopo a confirmar no arquivo)
- `apps/web/app/(onboarding)/convite/[token]/_components/` (botões)

**Critério de aceite:**
- [x] `getBoundingClientRect()` do elemento clicável real: `width ≥ 44 && height ≥ 44` em viewport 375px
- [x] Espaçamento entre alvos adjacentes ≥ 8px (SC-1.2 / FR-1.3)
- [x] `active:` presente em todos os componentes listados
- [x] `pnpm turbo lint --max-warnings 0` passa

---

## EIXO-B: Feedback Visual ao Toque (US-2 / FR-2)

### B.1 — `Dialog.tsx` — motion-safe + feedback [crit]

**Fase:** EIXO-B | **Dependências:** A.1

**Descrição:**
Em `packages/ui/components/dialog.tsx`:
- `transition-opacity` → `motion-safe:transition-opacity`
- `animate-in/animate-out/fade/zoom/slide` (data-state animations Radix) → prefixar `motion-safe:` em todos
- Close button: adicionar `.touch-target` ou `min-h-[44px] min-w-[44px]` (ícone X tende a ser <44px)
- Adicionar `active:opacity-80` ao close button e ao trigger area

**Arquivos-alvo:**
- `packages/ui/components/dialog.tsx`

**Critério de aceite:**
- [x] Todas as classes `animate-in/out/fade/zoom/slide` com `motion-safe:` prefixo
- [x] `transition-opacity` substituído por `motion-safe:transition-opacity`
- [x] Close button com área ≥ 44×44px (medível)
- [x] Close button com `active:opacity-80`
- [x] `pnpm turbo build` passa

---

### B.2 — Folhas de feedback `hover-only` → `active:` [alto]

**Fase:** EIXO-B | **Dependências:** A.1, A.5

**Descrição:**
Componentes identificados no plano com hover sem active (FR-2 — 0 ocorrências de `active:` nos primitivos):
- `participant-card.tsx` — já tem `active:` (precedente existente; confirmar que padrão está correto)
- `grupo-pill.tsx` — hover sem active → adicionar `active:opacity-80 active:scale-[0.98]` (coberto também em A.5)
- `plan-card.tsx` — hover sem active → idem
- `marketing-nav.tsx` — hover sem active → idem

**Arquivos-alvo:**
- `apps/web/app/(authenticated)/app/gestao/radar/_components/participant-card.tsx`
- `apps/web/app/(authenticated)/app/gestao/radar/_components/grupo-pill.tsx`
- `apps/web/src/components/plans/plan-card.tsx`
- `apps/web/src/components/marketing/marketing-nav.tsx`

**Critério de aceite:**
- [x] Todos os componentes listados com `active:` que seja visualmente distinto do estado `hover` (FR-2.4)
- [x] Nenhum `transition-all delay-*` ou `transition-opacity duration-*` que poste o estado `:active` (FR-2.2)
- [x] `pnpm turbo lint --max-warnings 0` passa

---

## EIXO-C: Reduced Motion (US-3 / FR-3, dec-007)

### C.1 — Safety net global em `packages/ui/styles/globals.css` [crit]

**Fase:** EIXO-C | **Dependências:** A.1 (mesmo arquivo)

**Descrição:**
Adicionar safety net CSS em `packages/ui/styles/globals.css` (CHK025/dec-024 — este é o entry point real, NÃO `apps/web/app/globals.css`):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .animate-\[onboarding-shake_0\.4s_ease-in-out\] { animation: none !important; }
}
```

Esta regra cobre TODA animação não prefixada (backstop universal, FR-3.3), incluindo `@keyframes onboarding-shake` (sem guarda atual).

**Arquivos-alvo:**
- `packages/ui/styles/globals.css` ← APENAS este arquivo (dec-024 / CHK025 resolvido)

**Critério de aceite:**
- [x] Safety net presente em `packages/ui/styles/globals.css` (confirmar com `grep -n 'prefers-reduced-motion' packages/ui/styles/globals.css`)
- [x] `apps/web/app/globals.css` NÃO alterado (CHK025: arquivo errado para esta regra)
- [x] `pnpm turbo build` passa e regra compilada no bundle CSS

---

### C.2 — Prefixar `motion-safe:` nos pontos quentes [crit]

**Fase:** EIXO-C | **Dependências:** C.1

**Descrição:**
Defesa em profundidade além do safety net (FR-3.1/3.2, SC-3.2). Migrar:
- `button.tsx`: `transition-colors` → `motion-safe:transition-colors` (já coberto em A.2)
- `module-accordion-item.tsx`: `transition-all` → `motion-safe:transition-all`
- `plan-card.tsx`, `marketing-nav.tsx`: `transition-colors` → `motion-safe:transition-colors`
- radar pages e `_components/*` com `transition-colors`: prefixar `motion-safe:`
- Skeletons com `animate-pulse` (trail-card, invite, meeting, csv-preview, network-error, live-status-bar): `motion-safe:animate-pulse`

**Isenções documentadas (FR-3.4 / SC-3.4):** `animate-spin` em loaders sem percentual (tenant-switcher, file-upload-zone, church-card) são **animações essenciais** — manter sem prefixo (indicam processamento ativo); o safety net global já reduz duração ao mínimo.

**Arquivos-alvo:**
- `apps/web/app/(authenticated)/app/consumo/trilhas/[trailId]/module-accordion-item.tsx`
- `apps/web/src/components/plans/plan-card.tsx`
- `apps/web/src/components/marketing/marketing-nav.tsx`
- `apps/web/app/(authenticated)/app/gestao/radar/` (pages e _components com `transition-colors`)
- `apps/web/src/components/content/trail-card-skeleton.tsx`
- `apps/web/app/(onboarding)/convite/[token]/_components/invite-loading-skeleton.tsx`
- `apps/web/app/(authenticated)/app/gestao/reunioes/_components/meeting-skeleton.tsx`
- `apps/web/src/components/onboarding/csv-preview-table.tsx` (skeleton)
- `apps/web/src/components/ui/network-error-state.tsx` (skeleton)
- `apps/web/src/components/meetings/live-status-bar.tsx` (skeleton)

**Critério de aceite:**
- [x] `grep -rn 'animate-pulse' apps/web/src` retorna apenas `motion-safe:animate-pulse` (exceto isenções)
- [x] `grep -rn 'transition-all\|transition-colors\|transition-opacity' apps/web --include='*.tsx'` nos arquivos listados retorna prefixo `motion-safe:` (ou sem motion-related classes)
- [x] Isenções `animate-spin` documentadas em comentário `{/* motion-essential: loader sem alternativa não-animada */}`
- [x] `pnpm turbo lint --max-warnings 0` passa

---

## EIXO-T: Testes & Validação (FR-4)

### T.1 — E2E reduced-motion — arquivo novo [crit]

**Fase:** EIXO-T | **Dependências:** C.1, C.2

**Descrição:**
Criar `apps/web/e2e/a11y/reduced-motion.e2e-spec.ts` seguindo padrão **isolado/rota pública** (sem login). Usar `page.emulateMedia({ reducedMotion: 'reduce' })`.

Cenários obrigatórios:
1. **Skeleton estático:** abrir rota pública que renderiza skeleton; assert `getComputedStyle(el).animationDuration ≈ '0.01ms'` (zerado pelo safety net).
2. **Dialog sem motion:** abrir Dialog em rota pública/isolada; assert `getComputedStyle(content).transitionDuration ≈ '0.01ms'` E bounding box do elemento entre pré/pós abertura sem deslocamento perceptível (delta < 2px).
3. **Toast (N/A):** comentário explícito no spec: "Toast fora de escopo — nenhuma lib instalada (Sonner/useToast = 0 hits). Coberto em story futura."

Espelhar helpers de `contrast-focus.e2e-spec.ts` e `axe-baseline.spec.ts`.

**Arquivos-alvo:**
- `apps/web/e2e/a11y/reduced-motion.e2e-spec.ts` (novo)

**Critério de aceite:**
- [x] Arquivo criado com os 2 cenários implementados (skeleton + dialog)
- [x] Comentário N/A de toast presente
- [x] `pnpm exec playwright test e2e/a11y/reduced-motion.e2e-spec.ts --project=Desktop` passa
- [x] Sem asserções de tempo/delay (apenas `getComputedStyle` de duração)

---

### T.2 — Projeto mobile Playwright + E2E touch-targets [crit]

**Fase:** EIXO-T | **Dependências:** A.2, A.3, A.5

**Descrição:**
**CRÍTICO (CHK033/dec-023 — CI-RISK):** adicionar projeto mobile em `playwright.config.ts` usando **exclusivamente emulação Chromium**. NUNCA usar `devices['iPhone 12']` (WebKit — não instalado no CI Chromium-only). Opções válidas:
- `devices['Pixel 5']` (Mobile Chrome — Chromium) ← **PREFERENCIAL**
- OU: `{ name: 'mobile-a11y', use: { viewport: { width: 390, height: 844 }, hasTouch: true } }` (Desktop Chrome headless com viewport mobile)

Criar `apps/web/e2e/a11y/touch-targets.e2e-spec.ts`:
- Cenário 1 (SC-1.1): medir `getBoundingClientRect()` de todos os seletores `button, a, input, [role="tab"], [role="menuitem"]` na rota pública (landing/login). Assert `width >= 44 && height >= 44`.
- Cenário 2 (SC-1.2 / FR-1.3 operacionalizado): para itens de bottom-tabs, calcular espaçamento entre bordas de items adjacentes: `leftEdge[i+1] - rightEdge[i] >= 8`. Rodar em rota pública/autenticada mock.
- Cenário 3 (CHK035 / SC-2.2 operacionalizado): verificar que `active:` é visualmente distinto — via `page.locator(...).evaluate(el => getComputedStyle(el).opacity)` antes/durante mousedown e confirmar mudança.

**Arquivos-alvo:**
- `apps/web/playwright.config.ts` (adicionar project mobile-a11y com Chromium)
- `apps/web/e2e/a11y/touch-targets.e2e-spec.ts` (novo)

**Critério de aceite:**
- [x] `playwright.config.ts` com project `mobile-a11y` usando `devices['Pixel 5']` OU viewport+hasTouch (NUNCA `iPhone 12`/WebKit)
- [x] `pnpm exec playwright test --project=mobile-a11y` funciona no CI sem instalar WebKit
- [x] Todos os controles interativos públicos: `getBoundingClientRect()` com `width ≥ 44 && height ≥ 44` no viewport mobile
- [x] Espaçamento entre bottom-tabs adjacentes ≥ 8px
- [x] Cenário de `active:` com mudança de opacity detectada

---

### T.3 — Testes jest-axe em `packages/ui` [alto]

**Fase:** EIXO-T | **Dependências:** A.2, A.3

**Descrição:**
Estender specs existentes em `packages/ui/__tests__/`:
- `button.spec.tsx`: adicionar test de touch sizing — verificar que classe `h-11` (ou `min-h-[44px]`) está presente nas variants icon/default/sm; usar `@testing-library/react` + snapshot de className.
- `bottom-tabs.spec.tsx`: confirmar `min-h-[44px] min-w-[44px]` ainda presente; adicionar `toHaveNoViolations()` (jest-axe já configurado).
- `sidebar.spec.tsx`: confirmar `min-h-[44px]` no linkClasses; `toHaveNoViolations()`.

Reusar `vitest.setup.ts` (jest-axe configurado, `toHaveNoViolations` global).

**Arquivos-alvo:**
- `packages/ui/__tests__/button.spec.tsx`
- `packages/ui/__tests__/bottom-tabs.spec.tsx`
- `packages/ui/__tests__/sidebar.spec.tsx`

**Critério de aceite:**
- [x] `button.spec.tsx` com test de className `h-11`/`min-h-[44px]` em size:icon
- [x] `toHaveNoViolations()` nas 3 specs sem findings
- [x] `pnpm turbo test` passa sem falhas

---

### T.4 — Scan estático de motion não-guardado [alto]

**Fase:** EIXO-T | **Dependências:** C.2

**Descrição:**
Criar script de scan ou documentar como grep de CI/pre-commit para detectar `animate-*` e `transition-*` sem prefixo `motion-safe:` fora da lista de isenção (gate de regressão FR-3.5 / SC-3.2). Documentar no `plan.md` ou como script em `scripts/check-motion-safe.sh`.

**Arquivos-alvo:**
- `scripts/check-motion-safe.sh` (novo, opcional — pode ser documentado como comando grep manual)

**Critério de aceite:**
- [x] Comando de scan documentado (grep ou script) que detecta padrões sem `motion-safe:` nos arquivos cobertos
- [x] Isenções `animate-spin` explicitamente excluídas do scan
- [x] Executável sem dependências extras (bash + grep puro)

---

### T.5 — Checklist de teste manual [normal]

**Fase:** EIXO-T | **Dependências:** EIXO-A, EIXO-B, EIXO-C

**Descrição:**
Criar `docs/tests/manual/touch-targets.md` com checklist de aceite manual para iOS Safari + Android Chrome (gate de aceite final). Paridade com padrão da Story 12.1.

Conteúdo mínimo:
- [x] iOS Safari 16+: todos os controles tocáveis sem erro de alvo
- [x] Android Chrome 120+: feedback `:active` visível
- [x] iOS/Android: `Reduce Motion` ativado → sem animações perceptíveis exceto spinners essenciais
- [x] Verificar espaçamento de bottom-tabs com dedo (não só mouse)

**Arquivos-alvo:**
- `docs/tests/manual/touch-targets.md` (novo)

**Critério de aceite:**
- [x] Arquivo criado com itens de checklist para iOS Safari + Android Chrome
- [x] Seção de isenções documentada (animate-spin essenciais)
- [x] Pendência operacional pós-merge explicitamente anotada

---

## EIXO-P: PR & Finalização

### P.1 — Gate local e PR [crit]

**Fase:** EIXO-P | **Dependências:** todas as tasks anteriores

**Descrição:**
Executar gate local de qualidade antes de abrir o PR:
```bash
pnpm --filter @metanoia/api exec prisma generate
pnpm turbo build
pnpm turbo lint --max-warnings 0
pnpm turbo test
pnpm exec playwright test --project=Desktop --project=mobile-a11y
```

Abrir PR para branch `dev` com:
- Título: `feat(a11y): Story 12.4 — Touch Targets, Feedback :active e Reduced Motion (NFR-A2)`
- Descrição: resumo dos 3 eixos + link ao spec + decisions materializadas (dec-008, dec-023, dec-024)
- Labels: `accessibility`, `epic-12`, `nfr`

**Arquivos-alvo:**
- (todos os arquivos modificados nas tasks anteriores)

**Critério de aceite:**
- [x] `pnpm turbo build` passa (0 erros de TypeScript/CSS)
- [x] `pnpm turbo lint --max-warnings 0` passa
- [x] `pnpm turbo test` passa (incluindo jest-axe)
- [x] `playwright test --project=mobile-a11y` passa (Chromium — sem WebKit)
- [x] PR aberto em `dev` com revisão de acessibilidade solicitada

---

## Matriz de Dependências

```
A.1 ──┬──► A.2 ──────────────────────────────┐
       ├──► A.3 ─────────────────────────────┤
       ├──► A.4                               │
       ├──► A.5 ──────────────────────────────┤
       ├──► B.1                               │
       └──► C.1 ──► C.2 ──────────────────────┤
                                              ▼
B.2 (depende A.5) ─────────────────► T.1 ─────┤
                                     T.2 ──────┤
                                     T.3 ──────┤
                                     T.4 ──────┤
                                     T.5 ──────┤
                                               ▼
                                              P.1
```

## Resumo por Eixo

| Eixo | Tasks | Criticidade principal |
|------|-------|----------------------|
| EIXO-A (Touch Targets) | A.1, A.2, A.3, A.4, A.5 | 3× crit + 2× alto |
| EIXO-B (Feedback :active) | B.1, B.2 | 1× crit + 1× alto |
| EIXO-C (Reduced Motion) | C.1, C.2 | 2× crit |
| EIXO-T (Testes) | T.1, T.2, T.3, T.4, T.5 | 2× crit + 2× alto + 1× normal |
| EIXO-P (PR) | P.1 | 1× crit |

**Total: 15 tasks** — 8× [crit], 5× [alto], 1× [normal], 1× [baixo]

## Escopo Coberto

- Touch targets: primitivos (`Button`, `Input`, `Sidebar`, `BottomTabs`) + folhas de risco elevado em `apps/web`
- Feedback `:active`: todos os primitivos shadcn + folhas hover-only identificadas no plan
- Reduced motion: safety net global + prefixo `motion-safe:` em pontos quentes + isenções de essenciais
- Testes: E2E mobile Chromium (Pixel 5 / sem WebKit), E2E reduced-motion, jest-axe, scan estático, checklist manual
- PR com gate local completo

## Escopo Excluído

- Toast animado: nenhuma lib de toast instalada (Sonner = 0 hits); registrado como N/A (ver T.1)
- Animações Framer Motion: não instalada no projeto (confirma FR-3.5)
- Story 12.1/12.2/12.3: pre-requisitos; não reabrir escopo delas
- Instalação de Sonner/toast: scope creep — story futura
- `apps/web/app/globals.css`: NÃO alterado (CHK025/dec-024 — não é o entry point real)
- `iPhone 12` / WebKit: excluído do CI (CHK033/dec-023 — Chromium-only runner)
