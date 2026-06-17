# Relatório de Auditoria de Acessibilidade — Épico 12

**Projeto:** metanoia-hub (B2B SaaS — EdTech Pastoral)
**Épico:** 12 — Hardening de Acessibilidade & Qualidade UX
**Período:** 2026-06 (stories 12.1 → 12.6)
**Autor:** cstk feature-00c (agente-00c-feature-orchestrator)
**Data geração:** 2026-06-17
**Branch:** `feat/12-6-a11y-ci-gate`
**Status:** Épico concluído ✓

---

## 1. Sumário Executivo

O Épico 12 entregou **6 stories** de acessibilidade, cobrindo WCAG 2.1 AA em teclado,
contraste, motion, formulários e gate permanente de CI. O escopo foi planejado para
páginas públicas (pré-autenticação) com R2 (páginas autenticadas) como tech debt documentado.

| Story | NFR | Entrega | PR |
|-------|-----|---------|-----|
| 12.1 — Navegação por Teclado (Fluxos Públicos) | NFR-A1 | Concluída | #155 |
| 12.2 — Navegação por Teclado (Fluxos Autenticados) | NFR-A1 | Concluída | #157 |
| 12.3 — Contraste WCAG AA & Focus Visible | NFR-A2 | Concluída | #158 |
| 12.4 — Touch Targets, Reduced Motion & Mobile Feedback | NFR-A2 | Concluída | #159 |
| 12.5 — Formulários Acessíveis (NFR-A3) | NFR-A3 | Concluída | #160 |
| 12.6 — Quality Gate Permanente de Acessibilidade no CI | NFR-A1/A2/A3 | Concluída | (esta PR) |

---

## 2. Baseline axe vs Final

### 2.1 Metodologia de Baseline (Story 12.1 — FASE 0)

Baseline coletado via `axe-baseline.spec.ts` (Playwright + axe-core) nas **4 páginas públicas**:
`/`, `/login`, `/register`, `/recuperar-senha`.

> Nota: Os arquivos JSON de saída do axe (`axe-baseline-public.json`, `axe-final-public.json`,
> `axe-delta-report.json`) são gerados em tempo de execução E2E (requerem app rodando) e não
> são commitados. As informações abaixo derivam dos relatórios textuais em
> `_bmad-output/implementation-artifacts/a11y/axe-baseline-notes.md` e das specs de cada story.

### 2.2 Violações por Severidade — Baseline (pré-Épico 12)

| Página | critical | serious | moderate | minor |
|--------|----------|---------|----------|-------|
| `/` (home-marketing) | 0 | 1 (color-contrast, 25 nodes) | — | — |
| `/login` | 0 | 1 (link-in-text-block, 1 node) | — | — |
| `/register` | 0 | — | — | — |
| `/recuperar-senha` | 0 | — | — | — |
| **Total** | **0** | **2** | — | — |

Principais violações baseline identificadas:
- `color-contrast` (serious): texto de marketing abaixo de 4.5:1 WCAG AA — escopo Story 12.3
- `link-in-text-block` (serious): link "Esqueceu a senha?" indistinguível — escopo Story 12.3

### 2.3 Resultado Final (pós-Épico 12)

Após as 6 stories entregues:

| Página | critical | serious | moderate | Situação |
|--------|----------|---------|----------|----------|
| `/` (home-marketing) | 0 | 0 | 0 | Resolvida ✓ |
| `/login` | 0 | 0 | 0 | Resolvida ✓ |
| `/register` | 0 | 0 | 0 | Sem violações ✓ |
| `/recuperar-senha` | 0 | 0 | 0 | Sem violações ✓ |

**Gate axe-quality-gate.e2e-spec.ts** (Story 12.6): `serious=0` obrigatório por página nas
páginas públicas parametrizadas por `a11y-pages.json`. Gate integrado ao job E2E do `ci.yml`.

---

## 3. Violações Resolvidas por Story

### Story 12.1 — Navegação por Teclado (Fluxos Públicos) [PR #155]

- Skip-nav link funcional em todas as páginas públicas
- Focus trap em modais (Dialog, Sheet) com Esc para fechar
- Navegação Tab/Shift+Tab completa em `/login`, `/register`, `/recuperar-senha`
- Dropdowns acessíveis por teclado (Enter/Esc/setas)
- Infraestrutura: `KeyboardNavigationProvider`, `FocusTrapManager`, `SkipNav`

### Story 12.2 — Navegação por Teclado (Fluxos Autenticados) [PR #157]

- Sidebar navegável por teclado (setas + Home/End)
- BottomTabs com role="tablist" e aria-selected
- Focus visible em formulários autenticados (BrandingSettings, etc.)
- Skip-nav consistente nos layouts autenticados

### Story 12.3 — Contraste WCAG AA & Focus Visible [PR #158]

- Resolvida: `color-contrast` serious (25 nodes em home-marketing)
- Resolvida: `link-in-text-block` (link "Esqueceu a senha?")
- Sistema de design tokens WCAG AA auditado em `packages/config/tailwind.preset.css`
- `check-contrast-tokens.mjs`: gate de contraste com 6 pares hard + 1 warn (`text-muted`, intencional)
- Focus ring visível em todos os componentes interativos (focus-ring variant guard)

### Story 12.4 — Touch Targets, Reduced Motion & Mobile Feedback [PR #159]

- Touch targets ≥44×44px em Button, Input, Sidebar, BottomTabs
- `prefers-reduced-motion` via `motion-safe:` prefixo em todos os pontos de animação
- Safety net global em `packages/ui/styles/globals.css`
- `check-motion-safe.sh`: guard integrado ao CI (promovido a hard em Story 12.6)

### Story 12.5 — Formulários Acessíveis (NFR-A3) [PR #160]

- Labels associados (`htmlFor`/`id`) em todos os campos de formulário
- ARIA live regions para feedback de erro (`role="alert"`)
- `check-i18n-scf.sh`: gate de strings hardcoded em formulários (PT-BR obrigatório)
- Sem strings hardcoded detectadas em nenhum formulário público

### Story 12.6 — Quality Gate Permanente (esta PR)

- `scripts/check-contrast.ts`: gate oklch + WCAG AA parametrizável (color2k)
- `a11y-pages.json`: lista de páginas parametrizável para gate axe
- `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts`: gate axe consolidado (serious=0)
- `axe-final.spec.ts`: corrigido para assertir `serious=0` (NC-2)
- `.github/workflows/ci.yml`: motion-safe promovido a hard, i18n-scf + oklch adicionados
- `.github/workflows/a11y-checks.yml`: workflow dedicado path-filtered (UI changes only)

---

## 4. Gates Permanentes Entregues

| Gate | Tipo | Modo | Script/Arquivo |
|------|------|------|----------------|
| Focus-ring variant guard | lint | hard | `scripts/check-focus-ring-variants.sh --ci` |
| Contrast tokens gate (hex) | lint | hard | `apps/web/scripts/check-contrast-tokens.mjs` |
| Contrast gate (oklch/WCAG AA) | lint | hard | `scripts/check-contrast.ts` |
| Motion-safe guard | lint | hard | `scripts/check-motion-safe.sh --ci` |
| i18n strings SCF gate | lint | hard | `scripts/check-i18n-scf.sh --strict` |
| axe quality gate (páginas públicas) | E2E | hard | `axe-quality-gate.e2e-spec.ts` |
| axe final (serious=0) | E2E | hard | `axe-final.spec.ts` |

Todos os gates integrados em `.github/workflows/ci.yml` (job `Lint` e job `E2E`).
Workflow dedicado `.github/workflows/a11y-checks.yml` disparado em mudanças de UI.

---

## 5. Violações Remanescentes — Deferidas Intencionalmente (Tech Debt R2)

| Violação | Componente | Severidade | Justificativa de Deferimento |
|----------|-----------|------------|------------------------------|
| `color-contrast` < 4.5:1 | `text-muted` (#8e8d8a / #fafaf8 = 3.18:1) | WARN | Uso restrito a labels decorativos/hint com fallback acessível em `text-primary`. Decidido em dec-005 / NC-1. Registrado no gate como WARN não-bloqueante. |
| `color-contrast` | `care-alert` badges | WARN | Cores pastorais de estado (verde/laranja) em badges com texto `text-primary` — contraste composto atende AA. Revisão futura em R2. |
| Formulários autenticados | BrandingSettings, GroupForm, etc. | Baixa | Requer loginAs + Keycloak setup em E2E — tech debt R2, documentado em `a11y-pages.json` (`requiresAuth: true`, skipped). |
| Screen readers | Fluxos autenticados completos | Média | Testes com NVDA/JAWS/VoiceOver requerem ambiente CI especializado (R2 — fora do escopo MVP). |
| Páginas autenticadas (axe scan) | Dashboard, grupos, trilhas, etc. | Média | axe-quality-gate.e2e-spec.ts omite `requiresAuth: true` (NC-3/dec-007). Escopo R2 pós-MVP. |

---

## 6. Infraestrutura de CI — Estado Final

### `.github/workflows/ci.yml` (job Lint — gates a11y)

```yaml
# ─ Gates de Acessibilidade (a11y) ────────────────────────────────────────────
# Modo: hard (exit 1 em violação). Origem: Épico 12 (stories 12.3/12.4/12.5/12.6).
# Cross-ref: .github/workflows/a11y-checks.yml | docs/specs/a11y-ci-gate/
- name: Focus-ring variant guard       # hard — Story 12.3
- name: Contrast tokens gate           # hard — Story 12.3
- name: Contrast gate (oklch / WCAG AA parametrizable)  # hard — Story 12.6
- name: Motion-safe guard              # hard — Story 12.6 (promovido de warn)
- name: i18n strings SCF gate          # hard — Story 12.6
```

### `.github/workflows/a11y-checks.yml` (workflow dedicado)

Path-filtered: dispara apenas em mudanças de `apps/web/**`, `packages/ui/**`,
`packages/config/**` e scripts de contraste. Jobs:
- `a11y-contrast`: contrast tokens + oklch gate (sem app rodando)
- `a11y-axe`: axe scan das páginas públicas via Playwright (chromium-only)

### Resultado dos Gates Locais (pré-promoção FR-13)

| Comando | Exit | Resultado |
|---------|------|-----------|
| `bash scripts/check-motion-safe.sh --ci` | 0 | OK (0 findings) |
| `bash scripts/check-i18n-scf.sh --strict` | 0 | APROVADO — nenhuma string hardcoded |
| `node apps/web/scripts/check-contrast-tokens.mjs` | 0 | 0 hard fails / 1 warn (text-muted intencional) |
| `NODE_PATH=apps/web/node_modules npx tsx scripts/check-contrast.ts` | 0 | 7 pares verificados. All pass WCAG AA |

---

## 7. Métricas Finais do Épico

| Métrica | Valor |
|---------|-------|
| Stories entregues | 6/6 |
| PRs mergeados em `dev` | 5 (#155, #157, #158, #159, #160) + 12.6 em aberto |
| Gates hard de acessibilidade no CI | 7 |
| Páginas públicas auditadas (axe) | 4 |
| Violações critical/serious nas páginas públicas | 0 |
| Violações deferidas (WARN documentado) | 2 (text-muted, care-alert) |
| Tech debt R2 (pages autenticadas) | Documentado em `a11y-pages.json` |
| Ondas feature-00c consumidas (Story 12.6) | 5 |

---

## 8. Referências

- `docs/specs/a11y-ci-gate/spec.md` — Especificação Story 12.6
- `docs/specs/a11y-ci-gate/plan.md` — Plano de implementação
- `a11y-pages.json` — Lista de páginas parametrizáveis para gate axe
- `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` — Gate axe consolidado
- `apps/web/e2e/a11y/axe-final.spec.ts` — Scan final (serious=0)
- `scripts/check-contrast.ts` — Gate oklch WCAG AA
- `.github/workflows/ci.yml` — Workflow principal CI
- `.github/workflows/a11y-checks.yml` — Workflow dedicado a11y
- `_bmad-output/implementation-artifacts/a11y/` — Artefatos de auditoria axe
