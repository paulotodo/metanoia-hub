# Spec: a11y-ci-gate — Quality Gate Permanente de Acessibilidade no CI

**Feature:** a11y-ci-gate  
**Short name:** a11y-ci-gate  
**Status:** clarified  
**Story BMAD:** 12.6 — Teste Automatizado de Contraste & axe-core Quality Gate no CI (UX-DR21)  
**Epic:** 12 — Hardening de Acessibilidade & Qualidade UX  
**NFRs cobertos:** NFR-A2 (contraste WCAG AA), NFR-A3 (testes automatizados)  
**UX-DR:** UX-DR21  
**Constitution gates:** Princípio VI (Qualidade Verificável — WCAG AA é MUST)  
**Spec autoritativa fonte:** `_bmad-output/implementation-artifacts/12-6-teste-automatizado-de-contraste-axe-core-quality-gate-n.md`

---

## Contexto

O Epic 12 auditou e corrigiu acessibilidade nos fluxos implementados nos Epics 1–11. As stories 12.1–12.5 entregaram as correções de violações:

- **12.1** — Navegação por teclado nos fluxos públicos (focus trap, skip-nav, tab order)
- **12.2** — Navegação por teclado nos fluxos autenticados
- **12.3** — Contraste WCAG AA: tokens light/dark + focus-ring canônico
- **12.4** — Motion-safe guards (prefers-reduced-motion)
- **12.5** — Formulários acessíveis (labels, ARIA, i18n sem strings hardcoded)

A **12.6** é a última story do épico. Com as violações corrigidas, o gate pode rodar VERDE. O objetivo é **consolidar e formalizar** o quality gate permanente que bloqueia regressões em PRs futuros — não duplicar o que já existe, mas garantir que o conjunto seja coerente, documentado e extensível.

### Estado dos gates existentes (pré-12.6)

| Gate | Script / Spec | Job CI | Modo atual |
|---|---|---|---|
| Contraste tokens | `apps/web/scripts/check-contrast-tokens.mjs` | Lint — "Contrast tokens gate" | **hard** (exit 1) |
| Focus-ring variants | `scripts/check-focus-ring-variants.sh` | Lint — "Focus-ring variant guard" | **hard** (exit 1) |
| Motion-safe scan | `scripts/check-motion-safe.sh --warn` | Lint — "Motion-safe guard (warn)" | **warn** (exit 0) |
| i18n strings SCF | `scripts/check-i18n-scf.sh` | Não integrado ao ci.yml | — |
| axe-core E2E | `apps/web/e2e/a11y/axe-baseline.spec.ts` (baseline, não bloqueia) | E2E job (não hard gate) | baseline/documentação |
| axe-core E2E final | `apps/web/e2e/a11y/axe-final.spec.ts` | E2E job | a confirmar |
| jest-axe componentes | 26 arquivos `*.spec.tsx` com `toHaveNoViolations` | Test job (pnpm turbo test) | **hard** |

---

## User Stories

### US-1 — Contraste de tokens como gate permanente e parametrizável

**Como** desenvolvedor que modifica tokens de design,  
**Quero** que o CI execute `scripts/check-contrast.ts` com `color2k` comparando pares texto × superfície contra WCAG AA,  
**Para** que qualquer token que introduza par abaixo de 4.5:1 (normal) ou 3:1 (large) bloqueie o merge automaticamente.

**Critérios de aceite (SC-1):**
- SC-1.1: O script `scripts/check-contrast.ts` aceita `--tokens-path` (default: `packages/config/tailwind.preset.css`); o caminho nunca é hardcoded no script.
- SC-1.2: O script analisa o bloco `@theme { … }` do CSS e extrai propriedades `--color-*`; resolve valores `oklch(from …)` relative-color via `color2k`.
- SC-1.3: Falhas são reportadas no formato: `[FAIL] text: {name} ({hex}) on surface: {name} ({hex}) → ratio: {ratio}:1 (min: {threshold}:1)`.
- SC-1.4: O script sugere alternativa mais escura/mais clara do palette para cada par reprovado.
- SC-1.5: Saída de sucesso: `✓ {N} color pairs checked. All pass WCAG AA.` + exit code 0.
- SC-1.6: Qualquer falha emite exit code 1 (gate hard, bloqueia PR).
- SC-1.7: Flag `--verbose` exibe todos os pares (pass + fail) para auditoria completa.
- SC-1.8: Legenda WCAG AA (4.5:1 normal, 3:1 large, 7:1 enhanced) incluída na saída de falha.
- SC-1.9: Testes unitários Vitest em `scripts/__tests__/check-contrast.spec.ts` cobrem: pares que passam (exit 0), pares que falham (exit 1 + formato), flag `--verbose`, flag `--tokens-path`, sugestões de fix.

> **RESOLVED NC-1 (dec-005, score 3):** `check-contrast.ts` (novo) **coexiste** com `check-contrast-tokens.mjs` (12.3) — dois layers complementares. O `.mjs` permanece inalterado no job Lint do `ci.yml` (gate para tokens CSS existentes). O `check-contrast.ts` é adicionado ao `a11y-checks.yml` com `color2k` para resolução de `oklch(from …)` relative-color e WCAG AA parametrizável — funcionalidade distinta não coberta pelo `.mjs`. Anti-pattern de duplicação evitado: cada script tem responsabilidade única. Evidência: spec Restrições §"Nao duplicar gates existentes" + `apps/web/scripts/check-contrast-tokens.mjs` constatado em inspeção (distinto de `scripts/check-contrast.ts`).

---

### US-2 — axe-core/playwright como gate permanente em workflow dedicado

**Como** desenvolvedor que modifica componentes UI ou fluxos públicos,  
**Quero** que o CI execute `@axe-core/playwright` contra as páginas-chave em um workflow dedicado `a11y-checks.yml`,  
**Para** que qualquer violação axe bloqueie o merge antes de atingir produção.

**Critérios de aceite (SC-2):**
- SC-2.1: O workflow `.github/workflows/a11y-checks.yml` existe com path filter: `packages/config/**`, `packages/ui/**`, `apps/web/src/**`, `scripts/check-contrast.ts`.
- SC-2.2: Passo 1 executa `npx tsx scripts/check-contrast.ts`; passo 2 executa Playwright com `@axe-core/playwright` nas páginas de `a11y-pages.json`.
- SC-2.3: Ambos os passos devem passar para o check de PR ser verde (sem `continue-on-error`).
- SC-2.4: O passo axe gera relatório HTML e faz upload como artifact do workflow run.
- SC-2.5: O workflow inclui steps de setup: pnpm install, build web (`pnpm turbo build --filter=@metanoia/web`), start dev server antes dos testes E2E.
- SC-2.6: O test runner Playwright usa apenas **Chromium** (constraint CI deste projeto; não expandir para WebKit/Firefox).
- SC-2.7: A lista de páginas é configurada em `a11y-pages.json` na raiz do repositório com comentários inline de schema.
- SC-2.8: O spec file `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` lê páginas de `a11y-pages.json`, executa `AxeBuilder` em cada uma e falha com `expect(violations).toHaveLength(0)` em qualquer violação.

---

### US-3 — Promoção de gates warn para hard

**Como** tech lead do projeto,  
**Quero** que o gate de `motion-safe` seja promovido de `--warn` (exit 0) para **hard** (exit 1 em violações),  
**Para** que regressões de prefers-reduced-motion também bloqueiem merge, aproveitando que as violações foram corrigidas em 12.4.

**Critérios de aceite (SC-3):**
- SC-3.1: O step "Motion-safe guard" no `ci.yml` passa a executar `bash scripts/check-motion-safe.sh --ci` (sem `--warn`), com exit 1 em qualquer finding.
- SC-3.2: O step `bash scripts/check-i18n-scf.sh --strict` é adicionado ao job Lint do `ci.yml` (gate hard: exit 1 em strings hardcoded em formulários).
- SC-3.3: Ambas as mudanças são documentadas no comentário da seção de gates a11y no `ci.yml`.
- SC-3.4: Antes da promoção, é verificado que os scripts retornam exit 0 no estado atual do repositório (nenhuma violação pendente das stories 12.4 e 12.5).

---

### US-4 — Relatório de auditoria final do Epic 12 (DoD transversal)

**Como** stakeholder do projeto,  
**Quero** um documento de auditoria consolidado comparando o estado de acessibilidade antes (baseline axe) e depois (final axe) das correções do Epic 12,  
**Para** documentar o progresso, confirmar que o gate passa verde e registrar issues aceitas como tech debt para R2.

**Critérios de aceite (SC-4):**
- SC-4.1: O arquivo `_bmad-output/implementation-artifacts/a11y/epic-12-audit-report.md` é criado com seções: Escopo, Metodologia, Baseline, Final, Tech Debt R2, Gate Status.
- SC-4.2: A seção Baseline referencia `axe-baseline.spec.ts` e `axe-baseline-authenticated.spec.ts` e descreve as categorias de violações encontradas (por impacto: critical/serious/moderate/minor).
- SC-4.3: A seção Final confirma que `axe-final.spec.ts` roda com `expect(violations).toHaveLength(0)` e lista o resultado por página.
- SC-4.4: O relatório lista por story (12.1–12.5) as principais correções implementadas.
- SC-4.5: O relatório lista issues aceitas como tech debt R2 (screen reader NFR-A4, etc.) com justificativa.
- SC-4.6: A seção Gate Status confirma: (a) `axe-final.spec.ts` verde, (b) `check-contrast.ts` verde, (c) todos os scripts hard gate verdes no estado pós-epic.

> **RESOLVED NC-2 (dec-006, score 3):** `axe-final.spec.ts` está **parcialmente bloqueante** — asserta apenas `expect(bySeverity.critical).toBe(0)` (linha 114), sem cobertura para `serious` violations. FR-9 exige hard gate completo (critical + serious). Decisão: na task de execute-task, adicionar `expect(bySeverity.serious).toBe(0)` ao `axe-final.spec.ts`. O gate permanente oficial é o novo `axe-quality-gate.e2e-spec.ts` (FR-5) com `expect(violations).toHaveLength(0)`. `axe-final.spec.ts` é promovido para cobrir também `serious` por alinhamento com FR-9. Evidência: grep linha 114 `axe-final.spec.ts`: `expect(bySeverity.critical).toBe(0)` — sem assertiva para serious.

---

### US-5 — Extensibilidade do gate axe para futuros épicos

**Como** desenvolvedor em épicos futuros (13+),  
**Quero** poder adicionar novas páginas ao gate axe editando apenas `a11y-pages.json`,  
**Para** que novos fluxos sejam automaticamente auditados sem alterar código de teste.

**Critérios de aceite (SC-5):**
- SC-5.1: `a11y-pages.json` contém as páginas iniciais públicas: `/` (home-marketing), `/login`, `/register`, `/recuperar-senha` — todas com `requiresAuth: false`. Páginas autenticadas são R2 explícito (dec-007/NC-3): skipped no gate axe deste sprint, não incluídas nas entradas iniciais.
- SC-5.2: O arquivo inclui schema documentado por comentário (campo `path`, `label`, `requiresAuth` booleano) e instrução de adição de novas páginas.
- SC-5.3: `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` itera dinamicamente sobre o array; adicionar entrada ao JSON não requer edição no spec file.
- SC-5.4: O cabeçalho do `a11y-checks.yml` documenta o processo de adição de páginas.

> **RESOLVED NC-3 (dec-007, score 3):** Gate axe cobre **apenas páginas públicas** neste sprint. Páginas autenticadas requerem `loginAs` helper + Keycloak stack + seed — setup frágil no CI (histórico: PR #156 corrigiu KEYCLOAK_PUBLIC_URL que silenciou CI). `a11y-pages.json` suporta o campo `requiresAuth: boolean` no schema, mas `axe-quality-gate.e2e-spec.ts` filtra e processa apenas entradas com `requiresAuth: false` neste sprint. Páginas autenticadas marcadas com `requiresAuth: true` são skipped automaticamente. Páginas autenticadas = R2 explícito. SC-5.1 ajustado: páginas iniciais são `/login`, `/` (home-marketing), `/register`, `/recuperar-senha` (todas públicas). Evidência: `axe-baseline-authenticated.spec.ts` usa `loginAs()` + `networkidle` — frágil; histórico de regressão CI documentado em MEMORY.

---

## Functional Requirements

| ID | Requisito | US | Prioridade |
|---|---|---|---|
| FR-1 | Script `scripts/check-contrast.ts` com `color2k`, `--tokens-path`, exit codes corretos | US-1 | MUST |
| FR-2 | Testes unitários Vitest para `check-contrast.ts` em `scripts/__tests__/` | US-1 | MUST |
| FR-3 | Workflow `.github/workflows/a11y-checks.yml` com dois steps (contrast + axe) e ambos hard | US-2 | MUST |
| FR-4 | `a11y-pages.json` na raiz do repo com lista inicial e schema documentado | US-2, US-5 | MUST |
| FR-5 | `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` com axe bloqueante (`toHaveLength(0)`) | US-2 | MUST |
| FR-6 | Upload de relatório HTML axe como artifact do workflow `a11y-checks.yml` | US-2 | MUST |
| FR-7 | Promoção de `check-motion-safe.sh` de warn para hard no `ci.yml` | US-3 | MUST |
| FR-8 | Adição de `check-i18n-scf.sh --strict` no job Lint do `ci.yml` | US-3 | MUST |
| FR-9 | `axe-final.spec.ts` configurado como hard gate (`toHaveLength(0)`) | US-4 | MUST |
| FR-10 | Documento `_bmad-output/implementation-artifacts/a11y/epic-12-audit-report.md` | US-4 | MUST |
| FR-11 | Iteração dinâmica do spec axe-quality-gate sobre `a11y-pages.json` | US-5 | MUST |
| FR-12 | Instalação de `color2k` e `@axe-core/playwright` como devDependencies (se ausentes) | US-1, US-2 | MUST |
| FR-13 | Verificação pre-promoção: scripts rodados no repo retornam exit 0 antes de promover para hard | US-3 | MUST |
| FR-14 | Cabeçalhos/comentários nos arquivos novos documentando propósito, refs e como estender | US-2, US-5 | SHOULD |

---

## Restrições Arquiteturais e Guardrails

- **Nao duplicar gates existentes:** `check-contrast-tokens.mjs` (job Lint) permanece inalterado; `check-contrast.ts` novo é adicionado ao `a11y-checks.yml` (camada complementar).
- **Chromium apenas:** o workflow `a11y-checks.yml` usa apenas Chromium; não expandir para WebKit/Firefox (constraint CI deste projeto).
- **Reuso do `contrast-checker.ts`:** `apps/web/src/lib/contrast-checker.ts` permanece como utilitário de runtime; o CLI `check-contrast.ts` usa `color2k` (não importar `contrast-checker.ts` no script CLI).
- **Tokens source único:** `packages/config/tailwind.preset.css` é o source of truth para tokens de design.
- **Scope screen readers:** NFR-A4 (VoiceOver/NVDA/JAWS) é fora do escopo deste épico; tech debt R2.
- **`tsx` para scripts TypeScript:** runner de scripts TypeScript no CI é `tsx`; não usar `ts-node` ou compilação separada.

---

## Artefatos a Entregar

| Artefato | Acao |
|---|---|
| `scripts/check-contrast.ts` | criar |
| `scripts/__tests__/check-contrast.spec.ts` | criar |
| `a11y-pages.json` | criar |
| `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` | criar |
| `.github/workflows/a11y-checks.yml` | criar |
| `.github/workflows/ci.yml` | editar (promover motion-safe + adicionar i18n-scf) |
| `apps/web/e2e/a11y/axe-final.spec.ts` | verificar/editar (tornar hard gate se necessário) |
| `_bmad-output/implementation-artifacts/a11y/epic-12-audit-report.md` | criar |

---

## Definition of Done (DoD)

1. Todos os FRs MUST implementados e verificados.
2. `pnpm turbo test` verde (testes unitários `check-contrast.spec.ts` + 26 specs jest-axe existentes).
3. Workflow `a11y-checks.yml` pode ser executado localmente via `act` com ambos os steps passando.
4. `ci.yml` atualizado: motion-safe hard + i18n-scf adicionado.
5. Documento `epic-12-audit-report.md` confirma gate verde (seção Gate Status).
6. PR passa todos os checks: Lint (focus-ring + contrast-tokens + motion-safe + i18n-scf), Test, Build, E2E, a11y-checks.
7. NEEDS_CLARIFICATION NC-1, NC-2, NC-3 resolvidos na fase clarify ou decisão documentada.

---

## Clarifications

| ID | Decisão | Score | Resolução |
|---|---|---|---|
| NC-1 | `check-contrast.ts` (novo) **coexiste** com `check-contrast-tokens.mjs` (12.3) | 3 | `.mjs` permanece no Lint job; `.ts` no `a11y-checks.yml` com `color2k` para oklch/WCAG AA parametrizável. Camadas complementares, responsabilidades distintas. (dec-005) |
| NC-2 | `axe-final.spec.ts` **parcialmente bloqueante** — apenas `critical=0`; falta `serious` | 3 | Task execute-task adiciona `expect(bySeverity.serious).toBe(0)`. Gate permanente oficial: `axe-quality-gate.e2e-spec.ts` (FR-5) com `toHaveLength(0)`. (dec-006) |
| NC-3 | Gate axe cobre **apenas páginas públicas** neste sprint | 3 | `axe-quality-gate.e2e-spec.ts` filtra `requiresAuth: false` do `a11y-pages.json`. Autenticadas = R2 explícito. Páginas: `/login`, `/`, `/register`, `/recuperar-senha`. (dec-007) |

---

## Referencias

- `_bmad-output/implementation-artifacts/12-6-teste-automatizado-de-contraste-axe-core-quality-gate-n.md`
- `_bmad-output/planning-artifacts/epics/epic-12.md`
- `docs/constitution.md` §VI (Qualidade Verificável)
- `docs/project-context.md` regra UX-DR21
- `.github/workflows/ci.yml`
- `apps/web/e2e/a11y/` (specs E2E axe existentes)
- `apps/web/src/lib/contrast-checker.ts` (utilitário runtime WCAG)
