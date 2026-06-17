# Plano Técnico — a11y-contraste-focus (Story 12.3)

> Contraste WCAG AA + focus-visible NFR-A2 / UX-DR19. Feature individual
> sobre o monorepo metanoia-hub. Spec autoritativa:
> `docs/specs/a11y-contraste-focus/spec.md` (specify + clarify concluídos).
> Constitution do projeto reusada (sem constitution por feature).
>
> Decisões do clarify materializadas aqui:
> - **dec-006** (Opção B): tokens `care-*` mantêm hex; texto interno SEMPRE `text-primary`.
> - **dec-007**: auditoria cobre light (preset) + dark (tokens.css) — dark já PASSA.
> - **dec-008**: focus-ring semi-automatizado (codemod global + casos manuais).

---

## Phase 0 — Research: Decisões Técnicas

| # | Decisão | Escolha | Evidência empírica |
|---|---------|---------|--------------------|
| R1 | Remediação `care-attention`/`care-ok` | dec-006 Opção B: manter hex, exigir `text-primary` em badges | `text-primary` #17252a sobre `care-attention` #d4a24c = **6.80:1** PASS; sobre `care-ok` #7ba38a = **5.58:1** PASS |
| R2 | Escopo dark mode | dec-007: light primário, dark confirmatório | `.dark` em `tokens.css`: `care-attention` #e0bd7a = 9.72:1; `care-ok` #96bda4 = 8.38:1 (vs #1a1a1a) — PASS |
| R3 | `--ring` shadcn | `--ring` → `brand-teal` (#2b7a78) | Hoje `globals.css:43` = `var(--color-interactive-focus-ring)` (oklch derivado de brand-teal /0.4). brand-teal sobre white = 5.05:1 PASS (WCAG 1.4.11 foco ≥ 3:1) |
| R4 | Estratégia focus-ring | dec-008: codemod global + ~5-10 casos manuais | grep: 38× `ring-interactive-focus`, 21× `ring-ring`, 14× `ring-primary`, 2× `ring-red-500` |
| R5 | Texto baixo contraste em `/` | Raiz dos 25 nodes = `text-[var(--color-text-muted)]` (#8e8d8a, 3.18:1) em `components/marketing/*` | Trocar por `text-secondary` (#5c5a57 = 6.58:1 PASS) onde for texto de leitura; manter muted só onde for não-essencial |
| R6 | Script de contraste no CI | Reusar `apps/web/src/lib/contrast-checker.ts` (já exporta `relativeLuminance`, `contrastRatio`, `checkBrandContrast`) | Não reimplementar fórmula WCAG; parsear `@theme`/`.dark` e aplicar `contrastRatio` |
| R7 | Gate do CI (hard vs warn) | **Hard fail** para os pares já corrigidos nesta feature; warn para o restante (lição CHK068/config-ui-tenant) | Evita regressão silenciosa nos pares fechados, sem bloquear pares fora de escopo |

### Não-existência de componentes care-* dedicados (importante)
Auditoria confirmou: **os badges/semáforo do Pastoral Radar (care-*) ainda não
existem como componente dedicado** (SC-4.4: pós-Epic 7). Usos `care-*` reais
hoje são:
- `components/meetings/*` — `text-care-ok`, `bg-care-ok`, `bg-care-ok/10` (status de reunião, não semáforo pastoral).
- `components/onboarding/wizard/steps/Step5Radar.tsx` — preview do radar usa **paleta tailwind** (`bg-yellow-100 text-yellow-800`), NÃO os tokens care-*.

→ FR-10 (auditoria de semáforo) fica como **documentação + comentário no preset
+ teste-guardião**, executável agora; a auditoria visual completa do componente
de semáforo é deferida para quando o Epic 7 entregá-lo (registrado como dependência).

---

## Phase 1 — Arquitetura por eixo

### Eixo A — Tokens care-* (dec-006 / FR-04, FR-05, FR-06)

**Arquivos a tocar:**
- `packages/config/tailwind.preset.css` — adicionar comentário de restrição de uso
  acima dos tokens `--color-care-attention`, `--color-care-ok`, `--color-brand-teal-light`.
- `packages/ui/styles/tokens.css` — comentário espelhado (mesma restrição); confirmar bloco `.dark` PASS.

**Comentário canônico (preset, light):**
```css
/* care-attention #d4a24c: contraste 2.22:1 sobre surface — NÃO usar como texto.
   Uso permitido: FUNDO de badge/indicador com texto interno text-primary
   (#17252a = 6.80:1 PASS). Cor nunca é o único indicador (ícone+texto, WCAG 1.4.1). */
--color-care-attention: #d4a24c;
/* care-ok #7ba38a: idem. text-primary sobre care-ok = 5.58:1 PASS. */
--color-care-ok: #7ba38a;
/* brand-teal-light #3aafa9: 2.55:1 sobre surface — NÃO usar como texto; só fundo/decorativo. */
--color-brand-teal-light: #3aafa9;
```

**Correção de uso real detectada (eixo A++):**
- `components/meetings/post-meeting-report.tsx:125,131` — usa `text-care-ok` / `text-care-attention`
  como **texto** (FAIL 2.70:1 / 2.22:1). Plano: trocar por par conforme: ou
  `text-secondary` (semântica neutra) ou manter cor só em badge com fundo + `text-primary`.
  Decisão de UX delegada à execução; o teste-guardião (jest-axe) trava.
- `components/meetings/meeting-card.tsx:80` — `bg-care-ok ... text-white`: `text-white`
  sobre `care-ok` = ~2:1 FAIL. Trocar `text-white` → `text-primary` (5.58:1 PASS).

### Eixo B — axe-baseline debt (FR-01, FR-02 / US-1)

**B1 — `/` color-contrast (25 nodes)** — rota = `apps/web/app/(marketing)/page.tsx`.
Raiz: `text-[var(--color-text-muted)]` (#8e8d8a = 3.18:1) usado como texto de leitura.
Arquivos reais a corrigir em `apps/web/src/components/marketing/`:
- `hero-section.tsx:13` (subtítulo principal — texto grande, limítrofe; validar)
- `persona-blocks.tsx:27`, `feature-blocks.tsx:27`, `feature-grid.tsx:46`,
  `faq-accordion.tsx:34`, `blog-list.tsx:42` (corpo de texto — trocar para `text-secondary` #5c5a57 = 6.58:1)
- `marketing-footer.tsx:33,42,66`, `marketing-nav.tsx:36` (links/legendas — `text-secondary` ou underline)
Estratégia: substituir `text-[var(--color-text-muted)]` → `text-secondary` em texto
de leitura; manter `muted` apenas em conteúdo decorativo/não-textual (ex: ícone `+` do FAQ `faq-accordion.tsx:29`).

**B2 — `/login` link-in-text-block** — `apps/web/app/(public)/login/_components/login-form.tsx:145`
(`{t.forgotPassword}`). Adicionar `underline underline-offset-2` permanente (não depender de cor).
Há teste guardião existente: `login/__tests__/login-forgot-link.spec.tsx` (estender para asserir underline).

### Eixo C — focus-ring (dec-008 / FR-07, FR-08, FR-09)

**C1 — `--ring` (FR-07):** `packages/ui/styles/globals.css:43`
`--ring: var(--color-interactive-focus-ring);` → manter aponta para brand-teal;
confirmar SC-3.1 (já é brand-teal via oklch). Adicionar utilitário canônico documentado.

**Utilitário canônico (SC-3.2):**
`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 focus-visible:ring-offset-2`

**C2 — Codemod global (FR-08):** 28 arquivos. Substituição automatizada para variantes
SEM cor semântica: `ring-interactive-focus` (38×), `ring-ring` (21×),
`ring-[var(--ring)]`, `ring-[var(--color-brand-teal)]` → `ring-brand-teal/30`.
Script: `apps/web/scripts/codemod-focus-ring.mjs` (sed/regex node, dry-run + apply).
Arquivos-alvo principais: `packages/ui/components/{input,dialog,sidebar,bottom-tabs,button}.tsx`,
`components/forms/{password-input-with-toggle,day-of-week-select,terms-checkbox}.tsx`,
`components/{catalog,groups,meetings,onboarding,content,search,tenant,trails}/*`.

**C3 — Casos manuais a PRESERVAR (revisão obrigatória, NÃO codemod):**
- `components/groups/delete-group-dialog.tsx:106` — `ring-red-500` (ação destrutiva, semântica intencional).
- `components/onboarding/wizard/OnboardingWizard.tsx:181` — `ring-brand-primary/30` (estado *selecionado* de step, não foco).
- `components/content/trail-card.tsx:56` — `focus-within:ring-primary` (foco de card; avaliar se vira brand-teal ou fica).
- Quaisquer `ring-blue-500` (1×) — revisar contexto.

**C4 — `focus-visible` vs `:focus` (FR-09):** grep `:focus[^-]` em componentes;
garantir uso de `focus-visible:`. Verificação por teste + grep no CI script.

### Eixo D — Cobertura CI (FR-11, FR-12, FR-13 / US-5)

**D1 — Script de auditoria de tokens (FR-13):** `apps/web/scripts/check-contrast-tokens.mjs`
- Reusa `apps/web/src/lib/contrast-checker.ts` (`contrastRatio`).
- Parse `@theme {}` de `packages/config/tailwind.preset.css` (light) e bloco `.dark` de
  `packages/ui/styles/tokens.css` (dark) → mapa hex de tokens.
- Matriz de pares críticos declarada em config: `[{fg, bg, min, mode}]` (ex:
  `text-primary`×`care-attention` ≥ 4.5; `text-secondary`×`surface-base` ≥ 4.5;
  `brand-teal`×`surface-elevated` ≥ 3 foco).
- Gate (R7): **fail** nos pares corrigidos por esta feature; **warn** no restante (lição CHK068).
- Saída: tabela ratio/PASS-FAIL; exit 1 se par hard-gated falha.

**D2 — E2E axe (FR-11):** `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts`
- Segue padrão dos specs existentes (`axe-baseline.spec.ts`, `axe-final.spec.ts`):
  `AxeBuilder` + `runOnly: wcag2aa`, rotas públicas `/` e `/login` por `goto + networkidle`.
- Rotas autenticadas (`/dashboard`, grupos): seguir padrão ISOLADO/route-interception
  do projeto (como `a11y-teclado-autenticado`) — specs autenticados com `goto` sem login falham;
  usar interceptação de rota/mock para chegar à tela sem fluxo de login real.
- Asserir 0 violações de `color-contrast` e `link-in-text-block`.

**D3 — jest-axe unit (FR-12):** specs em `apps/web/src/**/__tests__/` para
Button, Input, Select, Checkbox, Radio, Tab, Link (`toHaveNoViolations`).
`jest-axe@^10` + `@axe-core/playwright@^4.11` já estão em `apps/web/package.json` (deps presentes).
+ teste-guardião dos badges care-* (foco interno text-primary) e do focus-ring canônico.

**D4 — Integração CI:** `pnpm turbo test` (vitest) já roda no job `test` de
`.github/workflows/ci.yml`. Adicionar:
- `check-contrast-tokens` como script npm rodado no job `lint` ou `test` (sem alterar env de produção — SC-5.5).
- E2E axe: o CI hoje **não roda Playwright** (só `pnpm turbo test`). Plano: adicionar
  step de E2E a11y OU registrar como follow-up de pipeline (decisão de tasks).

---

## Phase 2 — Modelo de dados / Contratos

Feature pure-frontend (tokens CSS + classes + testes). **Sem mudança de schema
Prisma, sem novo endpoint, sem contrato Zod, sem RLS.** Nenhum impacto multi-tenant.
"Contrato" desta feature = a matriz de pares de contraste declarada em
`check-contrast-tokens.mjs` (fonte da verdade dos thresholds).

---

## Phase 3 — Cenários de teste

| ID | Tipo | Arquivo | Asserção |
|----|------|---------|----------|
| T1 | unit (vitest) | `apps/web/src/lib/__tests__/check-contrast-tokens.spec.ts` | `contrastRatio(text-primary, care-attention)` ≥ 4.5; pares hard-gated PASS |
| T2 | unit jest-axe | `packages/ui/**/__tests__/*.spec.tsx` (Button/Input/Select/Checkbox/Radio/Tab/Link) | 0 violações axe; ring = brand-teal |
| T3 | unit jest-axe | `components/meetings/__tests__/*` (badges care-*) | texto interno = text-primary, 0 violação cor-única |
| T4 | E2E axe | `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts` | `/` 0 color-contrast; `/login` 0 link-in-text-block (wcag2aa) |
| T5 | guardião | `login/__tests__/login-forgot-link.spec.tsx` (estender) | link forgot tem underline permanente |
| T6 | guardião grep | script CI | 0 ocorrências de `ring-interactive-focus`/`ring-ring` fora dos casos manuais |

Padrão E2E: ISOLADO/route-interception para rotas autenticadas; `goto+networkidle`
para públicas (`/`, `/login`).

---

## Phase 4 — Riscos & Rollback

- **Codemod focus-ring**: risco de tocar caso semântico. Mitigação: dry-run + allowlist
  de casos manuais (C3) + visual regression gate (dec-008).
- **`text-muted`→`text-secondary` na home**: risco visual. Mitigação: trocar só em texto
  de leitura; preview manual + axe E2E como gate.
- **CI E2E Playwright ausente**: pode exigir novo job (custo de pipeline). Decisão em create-tasks.
- **care-* dedicado pós-Epic 7**: FR-10 visual completo deferido; guardião cobre o que existe hoje.
- Rollback: feature pure-CSS/classe — `git revert` do PR restaura tokens/classes; sem migração.

## Dependências
- Epic 7 (componente de semáforo Pastoral Radar) — auditoria visual completa de FR-10 fica pendente até entrega.
- Story 12.1 (axe-baseline) — fonte do debt (já entregue, PR #155).

## Escopo coberto
Tokens care-* (doc+restrição), debt axe `/` e `/login`, focus-ring unificado, script CI de contraste, testes axe/jest-axe.

## Escopo excluído
Alterar hex dos tokens care-* (dec-006 Opção B preserva); remediação dark mode (já PASS);
componente de semáforo pastoral dedicado (pós-Epic 7); rotas fora de `/` e `/login` no debt herdado.
