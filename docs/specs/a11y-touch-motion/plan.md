# Plano Técnico — a11y-touch-motion (Story 12.4)

**Feature:** Touch Targets, Reduced Motion & Mobile Feedback
**NFR:** NFR-A2 (Acessibilidade), UX-DR19 | **Epic:** 12 — Acessibilidade
**Spec:** `docs/specs/a11y-touch-motion/spec.md` (specify ✅ / clarify ✅)
**Depende de:** Story 12.1 (teclado público), 12.2 (teclado autenticado), 12.3 (contraste/focus)
**Stack:** Next.js 16.2 (App Router), Tailwind v4.2 (preset CSS), shadcn/ui, Vitest + jest-axe, Playwright + @axe-core/playwright

> Decisões materializadas: dec-008 (touch híbrido 44/24), dec-007 (reduced-motion), US-2 (feedback ao toque).
> Princípio de design deste plano: **corrigir o primitivo `packages/ui` propaga conformidade a todos os consumidores** (alavancagem máxima), e só depois auditar componentes folha em `apps/web`.

---

## 0. Sumário do estado atual (auditoria de código real)

Sondagem empírica no codebase (grep/leitura direta):

| Aspecto | Achado real | Conformidade |
|--------|-------------|--------------|
| Safety net `prefers-reduced-motion` | **Ausente** no fonte. Hits só em `apps/web/.next/**` (build). Entry point real = `packages/ui/styles/globals.css` ("Imported by apps/web/app/layout.tsx"). Há `@keyframes onboarding-shake` sem guarda. | ❌ FR-3.3 |
| `motion-safe:` em nav | `bottom-tabs.tsx` e `sidebar.tsx` já usam `motion-safe:transition-colors` | ✅ parcial |
| `transition-*` sem `motion-safe:` | `button.tsx` (`transition-colors`), `dialog.tsx` (`transition-opacity` + `animate-in/out/fade/zoom/slide`), `participant-card`, `grupo-pill`, `plan-card`, `module-accordion-item` (`transition-all`), radar pages (`transition-colors`) | ❌ FR-3.1/3.2 |
| `animate-*` (motion) | `animate-pulse` (skeletons: trail-card, invite, meeting, csv-preview, network-error, live-status-bar), `animate-spin` (loaders: tenant-switcher, file-upload-zone, church-card), `animate-in/out` (dialog), `animate-[onboarding-shake]` (terms) | ❌ a maioria sem guarda |
| Touch target — `Button` | `size:icon = h-10 w-10` (**40px < 44**); `size:default h-10`, `sm h-9` | ❌ FR-1.1 (mobile) |
| Touch target — nav | `bottom-tabs` já tem `min-h-[44px] min-w-[44px]`; `sidebar` `px-4 py-3` (~48px OK, sem garantia explícita) | ✅/⚠️ |
| Touch target — `Input` | `h-10` (40px) | ⚠️ FR-1 (secundário) |
| Feedback `:active` | **0 ocorrências** em `Button`, `Sidebar`, `BottomTabs`; `participant-card` já tem `active:` (precedente). hover sem active em `grupo-pill`, `plan-card`, `marketing-nav` | ❌ FR-2 |
| Lib de animação (framer-motion) | **Nenhuma** | ✅ (confirma FR-3.5) |
| Lib de toast (Sonner) | **Nenhuma instalada** (`@radix-ui/react-dialog` + `slot` apenas) | ⚠️ ver §3 (escopo) |
| Test infra | `@axe-core/playwright ^4.11.3`, `jest-axe ^10` instalados; `apps/web/e2e/a11y/` existe; `playwright.config` só tem projeto **Desktop Chrome** | ✅/⚠️ falta projeto mobile |

---

## 1. Eixo A — Touch Targets (US-1 / FR-1, dec-008 híbrido)

**Decisão (dec, score 3):** classe utilitária compartilhada, **não** novos tokens `@theme`. O preset (`packages/config/tailwind.preset.css`) só define `--color-*`, `--font-*`, `--radius-*`, `--font-size-*` — Tailwind v4 não tem token de tap-target e grep `--spacing|--size|44|24` retornou 0 hits de sizing.

### A1 — Utilitário canônico (FR-1.2, FR-2.3)
Adicionar em `packages/ui/styles/globals.css` (camada de utilitários, após o bridge shadcn):

```css
@layer utilities {
  /* FR-1.2 — área de toque mínima sem alterar tamanho visual (pseudo-elemento).
     Mobile (<md): 44x44. Desktop (>=md): relaxa para 24 mínimo (WCAG 2.5.8). */
  .touch-target {
    position: relative;
    min-height: 44px;
    min-width: 44px;
  }
  .touch-target-extend::before {
    content: "";
    position: absolute;
    inset: 50% 50% auto auto;
    transform: translate(50%, -50%);
    height: 44px;
    width: 44px;
  }
  @media (min-width: 768px) {
    .touch-target { min-height: 24px; min-width: 24px; }
  }
  /* FR-2.1/2.2 — feedback :active imediato (sem delay), distinto de hover (FR-2.4). */
  .touch-feedback { transition: none; }
  .touch-feedback:active { opacity: 0.8; transform: scale(0.98); }
}
```

> Estratégia de duplo nível: o utilitário cobre casos não-shadcn; para componentes shadcn a conformidade vem do primitivo (A2). `touch-target-extend` é a opção pseudo-elemento de FR-1.2 para ícones de 24px em layout compacto.

### A2 — Primitivo `Button` (`packages/ui/components/button.tsx`) — alavancagem máxima
- `size: { icon: "h-10 w-10" }` → **`"h-11 w-11 md:h-9 md:w-9"`** (44px mobile / 36px desktop, mantém densidade desktop ≥24).
- `size: { default: "h-10 ..." }` → garantir `min-h-[44px] md:min-h-9` ou `h-11 md:h-10`.
- `size: { sm: "h-9 ..." }` → `min-h-[44px] md:min-h-9` (mobile sobe a 44; desktop mantém compacto).
- (combina com C/feedback em §2.A2.)

### A3 — Nav primitivos
- `BottomTabs` (`packages/ui/components/bottom-tabs.tsx`): já conforme (`min-h-[44px] min-w-[44px]`). **Sem mudança de tamanho**; só §2 (feedback).
- `Sidebar` (`packages/ui/components/sidebar.tsx`): adicionar `min-h-[44px]` explícito ao `linkClasses` (hoje só `px-4 py-3`).

### A4 — `Input` (`packages/ui/components/input.tsx`)
- `h-10` → `h-11 md:h-10` (44 mobile / 40 desktop). Secundário mas dentro de FR-1.1.

### A5 — Folhas em `apps/web` (FR-1.5)
Auditar e aplicar `.touch-target`/`touch-target-extend` ou `min-h-[44px]`:
- `app/(authenticated)/app/gestao/radar/_components/grupo-pill.tsx` (pill clicável)
- `src/components/plans/plan-card.tsx` (CTA inline)
- checkboxes/radios de onboarding (`src/components/onboarding/*`)
- links inline citados na spec: `onboarding/import-result-summary.tsx`, `content/trail-progress-bar.tsx`
- `marketing-nav.tsx` (nav pública)
- `app/(onboarding)/convite/[token]/_components/*` (botões de fluxo de convite)

### A6 — Espaçamento adjacente (FR-1.3 / SC-1.2)
- `BottomTabs` usa `justify-around` — espaçamento natural ≥8px; validado por E2E (§4).
- Onde houver listas densas (radar pills, onboarding), garantir `gap-2` (8px) mínimo.

---

## 2. Eixo B — Feedback ao toque / `:active` (US-2 / FR-2)

**Achado:** 0 ocorrências de `active:` nos primitivos. Precedente já existe em `participant-card.tsx` (`active:`).

### B1 — Padrão aprovado (FR-2.1/2.2)
`active:opacity-80 active:scale-[0.98]` (combinação), **sem** `transition-all delay-*`/`duration-*` que poste o estado. Usar utilitário `.touch-feedback` (§A1) ou as classes Tailwind diretas no primitivo.

### B2 — Aplicação
- `Button`: anexar `active:scale-[0.98] active:opacity-90` à base do `cva` (todos os variants herdam). Manter `transition-colors` (cor de hover), mas migrar para `motion-safe:transition-colors` (ver §3) — `:active` não depende de transition, satisfazendo FR-2.2.
- `Sidebar` / `BottomTabs` `linkClasses`: adicionar `active:opacity-80`.
- Folhas com hover-only (`grupo-pill`, `plan-card`, `marketing-nav`): adicionar `active:` correspondente.

### B3 — Distinção hover×active (FR-2.4)
hover muda cor de fundo/texto (já existente); active muda opacidade+escala → visualmente distinto em dispositivo híbrido. Documentar no JSDoc do utilitário.

---

## 3. Eixo C — Reduced Motion (US-3 / FR-3, dec-007)

### C1 — Safety net global (FR-3.3) — `packages/ui/styles/globals.css`
**Decisão (dec, score 3):** a regra vai em `packages/ui/styles/globals.css` (entry point real importado por `apps/web/app/layout.tsx`), não em `apps/web/app/globals.css`. Adicionar:

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

> Esta regra é o backstop que cobre TODA animação/transição não prefixada — inclusive `@keyframes onboarding-shake` e qualquer `animate-*`/`transition-*` legado. Implementa SC-3.1.

### C2 — Prefixar `motion-safe:` nos pontos quentes (FR-3.1/3.2, SC-3.2)
Defesa em profundidade além do safety net. Migrar:
- `button.tsx`: `transition-colors` → `motion-safe:transition-colors`.
- `dialog.tsx`: `transition-opacity` → `motion-safe:transition-opacity`; envolver `animate-in/animate-out/fade/zoom/slide` com `motion-safe:` (Radix data-state animations). Alternativa: deixar o safety net zerar a duração (suficiente p/ FR-3.3) e prefixar só onde houver slide/scale perceptível.
- `module-accordion-item.tsx`, `plan-card.tsx` (`transition-all`), radar pages e `_components/*` (`transition-colors`): prefixar `motion-safe:`.
- Skeletons `animate-pulse` (trail-card, invite, meeting, csv-preview, network-error, live-status-bar): `motion-safe:animate-pulse`.
- Loaders `animate-spin` (tenant-switcher, file-upload-zone, church-card): **isenção** — ver C3.

### C3 — Animações essenciais isentas (FR-3.4 / SC-3.4)
"Essencial" = sua remoção elimina informação de estado sem substituto não-animado. Lista de isenção documentada:
- `animate-spin` em **loaders de submissão/upload sem percentual** (tenant-switcher, file-upload-zone, church-card): manter rotação (indica processamento ativo). Reduzir a mínimo aceitável; o safety net global zera duração, então **adicionar `motion-reduce:` fallback** que troque o spinner por estado estático rotulado ("Carregando…") OU manter spin essencial com nota. → Recomendação: manter spin como essencial e documentar; é a única exceção.
- **Não-essenciais (NÃO isentas):** toasts, skeleton shimmer (`animate-pulse`), transições de hover/cor, page transitions, dropdown/dialog slide/zoom, parallax. Todas reduzidas pelo safety net + `motion-safe:`.

### C4 — Toast (FR-3.4/FR-4.1) — escopo
**Decisão (dec, score 3):** nenhuma lib de toast instalada (grep `sonner|Toaster|useToast` = 0). Instalar Sonner é **scope creep**. Toast é registrado como **N/A documentado** nesta story; o E2E de reduced-motion cobre **Dialog** (animate-in/fade/zoom/slide reais) + **Skeleton** (`animate-pulse` real) em vez de toast. Se/quando toast for adotado (story futura), nasce já com `motion-safe:`.

---

## 4. Cobertura de testes (FR-4)

### T1 — E2E reduced-motion — `apps/web/e2e/a11y/reduced-motion.e2e-spec.ts` (FR-4.1, SC-3.3)
Padrão **isolado/rota pública** (não navegar autenticado sem login). Usar `page.emulateMedia({ reducedMotion: 'reduce' })`:
- **Skeleton estático:** abrir rota pública que renderiza skeleton (ou montar via rota de loading); assert `animation-duration` computado ≈ `0.01ms` (zerado pelo safety net).
- **Dialog sem motion:** abrir um Dialog em rota pública/isolada; assert que `transition-duration`/`animation-duration` do content ≈ 0 e elemento aparece sem deslocamento perceptível (comparar bounding box pré/pós abertura).
- **(toast):** substituído por Dialog+Skeleton (ver C4) — comentário explícito no spec.
- Espelhar baseline existente (`contrast-focus.e2e-spec.ts`, `axe-baseline.spec.ts`) para reuso de helpers/fixtures.

### T2 — E2E touch-targets — `apps/web/e2e/a11y/touch-targets.e2e-spec.ts` (FR-4.2, SC-1.1/1.2)
- **Projeto mobile no Playwright (decisão, score 3):** adicionar em `playwright.config.ts` um project `{ name: 'mobile-a11y', use: { ...devices['iPhone 12'] } }` (hoje só existe Desktop Chrome). FR-4.2 exige iPhone 12 ou equivalente.
- Medição via `getBoundingClientRect()`: todo controle interativo (`button, a, input, [role=tab]`, nav items) com `width>=44 && height>=44`.
- Espaçamento: para itens adjacentes de navegação (bottom-tabs), distância entre bordas `>=8px`.
- Rodar em rotas públicas (landing/login) + telas isoladas.

### T3 — Unit jest-axe — `packages/ui` (FR-4.3, SC-4.3)
Estender specs existentes (`button.spec.tsx`, `bottom-tabs.spec.tsx`, `sidebar.spec.tsx`) com asserção de touch-target sizing para Button, Link/NavigationItem. Reusar `vitest.setup.ts` (jest-axe já configurado, `toHaveNoViolations`). Snapshot/medida de classe `min-h`/`h-11` aplicada.

### T4 — Scan estático (auditoria FR-3.5 / SC-3.2)
Script/grep de CI ou doc: detectar `animate-*` e `transition-*` em `.tsx/.css` **sem** prefixo `motion-safe:` e fora da lista de isenção → findings. (gate de regressão para reduced-motion.)

### T5 — Manual (FR-4.4)
`docs/tests/manual/touch-targets.md` — checklist iOS Safari + Android Chrome (gate de aceite final). Tratado como **pendência operacional pós-merge documentada** (paridade com padrão cross-browser da Story 12.1, recuperado via read-back).

---

## 5. Arquivos reais a tocar (resumo)

**packages/ui (primitivos — alavancagem):**
- `styles/globals.css` — safety net reduced-motion (C1) + `@layer utilities` `.touch-target`/`.touch-feedback` (A1)
- `components/button.tsx` — size icon/default/sm (A2) + `active:` (B2) + `motion-safe:transition` (C2)
- `components/sidebar.tsx` — `min-h-[44px]` (A3) + `active:` (B2)
- `components/bottom-tabs.tsx` — `active:` (B2) [tamanho já OK]
- `components/input.tsx` — `h-11 md:h-10` (A4)
- `components/dialog.tsx` — `motion-safe:` nas animações Radix (C2) + close button `.touch-target`
- `__tests__/button.spec.tsx`, `bottom-tabs.spec.tsx`, `sidebar.spec.tsx` — jest-axe touch sizing (T3)

**apps/web (folhas + testes):**
- `playwright.config.ts` — project mobile `iPhone 12` (T2)
- `e2e/a11y/reduced-motion.e2e-spec.ts` — novo (T1)
- `e2e/a11y/touch-targets.e2e-spec.ts` — novo (T2)
- `app/(authenticated)/app/gestao/radar/_components/{grupo-pill,participant-card}.tsx` — `active:` / `motion-safe:`
- `app/(authenticated)/app/consumo/trilhas/[trailId]/module-accordion-item.tsx` — `motion-safe:transition-all`
- `src/components/plans/plan-card.tsx`, `marketing/marketing-nav.tsx` — `active:` + `motion-safe:`
- skeletons (`content/trail-card-skeleton.tsx`, `(onboarding)/convite/.../invite-loading-skeleton.tsx`, `gestao/reunioes/_components/meeting-skeleton.tsx`, `onboarding/csv-preview-table.tsx`, `ui/network-error-state.tsx`, `meetings/live-status-bar.tsx`) — `motion-safe:animate-pulse`
- onboarding checkboxes/links (`onboarding/import-result-summary.tsx`, `content/trail-progress-bar.tsx`) — `.touch-target`
- `docs/tests/manual/touch-targets.md` — novo (T5)

**Isenções documentadas (FR-3.4/SC-3.4):** `animate-spin` em loaders sem percentual (tenant-switcher, file-upload-zone, church-card) — essenciais.

---

## 6. Segurança (gate owasp-security)

Superfície: **front-end puro** (CSS sizing/motion, classes Tailwind, specs de teste). Sem endpoint novo, sem dados, sem auth, sem entrada de usuário processada. Risco OWASP/ASVS **baixo**. Único cuidado: o safety net usa `!important` global — não introduz XSS nem vazamento; é CSS estático. Gate registrado como **passagem com risco baixo** (ver state.json).

## 7. Riscos & mitigação

| Risco | Mitigação |
|------|-----------|
| `!important` global zera animação essencial (spinner) | Lista de isenção (C3) + `motion-reduce:` fallback rotulado onde aplicável |
| Subir `h-11` em desktop quebra densidade | Responsivo `h-11 md:h-10/9` — mobile sobe, desktop mantém |
| E2E flaky por timing de animação | Asserção sobre `getComputedStyle` duration ≈ 0, não sobre tempo de espera |
| `iPhone 12` device ausente no runner CI | `devices` é built-in do Playwright (sem download de browser real extra) |

## 8. Próxima fase
`checklist` — quality gate de requisitos (domínios ux + a11y) sobre esta spec/plan antes de `create-tasks`.
