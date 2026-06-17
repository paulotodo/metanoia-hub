# Plano Técnico — a11y-ci-gate (Quality Gate Permanente de Acessibilidade no CI)

> **Feature**: a11y-ci-gate · **Épico**: 12 (Acessibilidade) · **Fase SDD**: plan
> **Spec**: `docs/specs/a11y-ci-gate/spec.md` (specify+clarify ✅)
> **Materializa**: dec-005 (NC-1 coexistência check-contrast), dec-006 (NC-2 serious=0),
> dec-007 (NC-3 apenas páginas públicas neste sprint)
> **Constraint CI deste projeto**: Chromium-only; jobs `Lint` e `E2E (Playwright)` já existem em
> `.github/workflows/ci.yml`. PREFERIR estender `ci.yml` a criar workflow novo.

---

## 1. Resumo da Arquitetura

O épico 12 entregou 6 stories de a11y (12.1–12.5). Esta story (12.6) **petrifica** os ganhos como
**gates permanentes de CI** e produz o **relatório de auditoria transversal** (DoD do épico). Não há
backend, banco, auth nem endpoint — é puramente front-end + configuração de CI. Cinco eixos:

| # | Eixo | Tipo | Onde roda | Modo |
|---|------|------|-----------|------|
| A | Gate axe consolidado (`axe-quality-gate.e2e-spec.ts`) parametrizado por `a11y-pages.json` | E2E novo | job `E2E (Playwright)` do `ci.yml` | hard (`toHaveLength(0)`) |
| B | `scripts/check-contrast.ts` (novo, color2k, oklch relative-color) | CLI novo | job `Lint` do `ci.yml` (step novo) | hard (exit 1) |
| C | `axe-final.spec.ts`: adicionar `serious=0` ao gate existente | edição mínima | job `E2E (Playwright)` | hard |
| D | Promoção warn→hard de `check-motion-safe.sh` + adição de `check-i18n-scf.sh --strict` | edição `ci.yml` | job `Lint` | hard |
| E | Relatório de auditoria final do Épico 12 (baseline vs final, 6 stories) | doc | — (artefato) | — |

### 1.1 Decisão de localização dos workflows (resolve item 2 do briefing da onda)

A spec (FR-3, US-2 SC-2.1) descreve um workflow **dedicado** `a11y-checks.yml` com path-filter.
O briefing desta onda instrui a **PREFERIR estender o `ci.yml` existente, salvo se a spec autoritativa
exigir workflow dedicado**. A spec autoritativa **exige** `a11y-checks.yml` (FR-3 é MUST, SC-2.1 nomeia
o arquivo e o path-filter explicitamente; SC-2.4 exige upload de artifact HTML axe próprio do run).

**Resolução (a confirmar como Decisão no execute-task, score esperado 2):** seguir a spec autoritativa
e criar `a11y-checks.yml` **dedicado** — é a única opção que satisfaz SC-2.1 (path-filter próprio),
SC-2.4 (artifact próprio) e o objetivo de isolar o gate a11y de mudanças não-UI (economiza minutos de CI
quando o PR não toca em UI). O job `E2E (Playwright)` do `ci.yml` permanece o lar do gate axe que **exige
a stack completa** (eixos A e C, que precisam de dev server + páginas renderizadas). Ou seja, há divisão
clara de responsabilidades, sem duplicação:

- `ci.yml` job `Lint` → **eixos B e D** (scripts estáticos, sem dev server: contrast/motion/i18n/focus-ring).
- `ci.yml` job `E2E (Playwright)` → **eixos A e C** (axe contra páginas públicas servidas; já há stack +
  Chromium + upload de report ali).
- `a11y-checks.yml` (novo, dedicado, path-filtered) → **espelha eixos B + A** para PRs que tocam UI, dando
  feedback a11y rápido e isolado conforme FR-3/SC-2.x, com `continue-on-error: false` em ambos os steps e
  upload de relatório HTML axe próprio (SC-2.4/FR-6).

> Nota de não-duplicação: o gate axe roda no `ci.yml` (caminho completo de E2E, sempre) **e** no
> `a11y-checks.yml` (caminho rápido path-filtered). Não é redundância nociva: o dedicado dá sinal cedo;
> o do `ci.yml` é a barreira final junto do restante do E2E. Ambos consomem o MESMO
> `axe-quality-gate.e2e-spec.ts` e o MESMO `a11y-pages.json` (fonte única — FR-11/SC-5.3).

---

## 2. Eixo A — Gate axe consolidado parametrizado (FR-4, FR-5, FR-6, FR-11; US-2, US-5)

### 2.1 `a11y-pages.json` (raiz do repo) — fonte única de páginas

Arquivo na **raiz** do repositório (`/a11y-pages.json`). JSON-com-comentários não é válido em JSON
estrito; o spec lê via `JSON.parse`. **Resolução:** arquivo é JSON puro com um campo `$schema`/`$doc`
descritivo inline (string) + um README adjacente de schema **OU** comentários no cabeçalho do
`axe-quality-gate.e2e-spec.ts`. SC-5.2 pede "schema documentado por comentário" — atendido por um campo
`_README` array de strings dentro do próprio JSON (parseável) + cabeçalho documentado no spec/workflow.

Estrutura (entradas iniciais, todas públicas — dec-007/NC-3):

```jsonc
{
  "_README": [
    "Lista de páginas auditadas pelo gate axe (axe-quality-gate.e2e-spec.ts).",
    "Campos por entrada: path (string, rota relativa), label (string, nome do teste),",
    "requiresAuth (boolean). NESTE SPRINT entradas requiresAuth=true são SKIPPED",
    "(tech debt R2 — exigem loginAs + Keycloak; ver dec-007/NC-3 na spec).",
    "Para adicionar página pública: acrescente {path,label,requiresAuth:false}. Nenhuma",
    "edição no spec file é necessária (iteração dinâmica — FR-11/SC-5.3)."
  ],
  "pages": [
    { "path": "/",                "label": "home-marketing",  "requiresAuth": false },
    { "path": "/login",           "label": "login",           "requiresAuth": false },
    { "path": "/register",        "label": "register",        "requiresAuth": false },
    { "path": "/recuperar-senha", "label": "recuperar-senha", "requiresAuth": false }
  ]
}
```

> Páginas autenticadas futuras (dashboard, grupos) entram aqui com `requiresAuth: true` e serão
> automaticamente skipadas até R2 implementar o helper de login no CI.

### 2.2 `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` (novo) — gate hard

- Importa `test, expect` de `@playwright/test`, `AxeBuilder` de `@axe-core/playwright`, `fs`/`path`.
- Lê `a11y-pages.json` da raiz do repo (resolução: `path.join(process.cwd(), '../../a11y-pages.json')`
  ou caminho a confirmar via `process.cwd()` do runner — execute-task valida o cwd real do Playwright).
- **Filtra `pages.filter(p => p.requiresAuth === false)`** (dec-007/NC-3). Entradas `requiresAuth:true`
  geram `test.skip(...)` com anotação visível no relatório (SC-5 extensibilidade preservada).
- `for (const page of publicPages)` → um `test()` dinâmico por página (FR-11/SC-5.3).
- Em cada teste: `await pwPage.goto(page.path, { waitUntil: 'networkidle' })`, depois
  `new AxeBuilder({ page: pwPage }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()`.
  WCAG2AA é o alvo bloqueante (briefing). `best-practice` NÃO entra no conjunto bloqueante (evita
  falsos-positivos de melhores-práticas não-WCAG); axe-final/baseline mantêm best-practice só p/ relatório.
- **Assertion hard:** `expect(results.violations).toHaveLength(0)` (FR-5). Mensagem de falha lista
  `id`, `impact`, `description`, contagem de nós, por página.
- Cabeçalho documenta: propósito, refs (FR-5/FR-11), como estender via `a11y-pages.json` (FR-14/SC-5.4).

### 2.3 Integração no `ci.yml` job `E2E (Playwright)` (eixo A no caminho completo)

O job `E2E (Playwright)` já: instala Chromium, sobe serviços de teste, builda apps, sobe API+Web,
roda `playwright test`, faz upload de `playwright-report`. O `axe-quality-gate.e2e-spec.ts` é coletado
automaticamente por `testDir: './e2e'` (playwright.config.ts) — **roda junto** do E2E existente, sem step
novo. O `reporter: CI ? [['html'],['github']]` já gera HTML; o step "Upload Playwright report" (artifact
`playwright-report`) cobre SC-2.4 no caminho do `ci.yml`. **Nenhuma mudança estrutural** no `ci.yml` para
o eixo A — apenas o arquivo de teste novo é coletado.

---

## 3. Eixo B — `scripts/check-contrast.ts` (novo, coexiste) (FR-1, FR-2, FR-12; US-1)

### 3.1 Coexistência (dec-005/NC-1)

`apps/web/scripts/check-contrast-tokens.mjs` (12.3) **permanece intacto** no step "Contrast tokens gate"
do job Lint (`node apps/web/scripts/check-contrast-tokens.mjs`, ci.yml:103-104). O novo
`scripts/check-contrast.ts` é **camada complementar**: resolve `oklch(from … )` relative-color via
`color2k` e WCAG AA parametrizável — funcionalidade que o `.mjs` não cobre. Responsabilidades distintas,
zero duplicação. Não importar `apps/web/src/lib/contrast-checker.ts` (constraint: CLI usa color2k).

### 3.2 Contrato do `scripts/check-contrast.ts`

- Runner: **`tsx`** (constraint da spec; não `ts-node`). Invocação CI: `npx tsx scripts/check-contrast.ts`.
- Flag `--tokens-path` (default `packages/config/tailwind.preset.css`) — **nunca hardcoded** (SC-1.1).
- Parse do bloco `@theme { … }`, extrai `--color-*` (SC-1.2); resolve `oklch(from <base> …)` via `color2k`
  (`parseToRgba`/`toHex`/`hasBadContrast`-style helpers) e computa razão de contraste (SC-1.2).
- Pares texto×superfície: derivados por convenção de nomes (`--color-text-*` × `--color-surface-*`/
  `--color-bg-*`/`--color-background`). Execute-task confirma o conjunto exato de pares lendo o preset real.
- Formato de falha (SC-1.3): `[FAIL] text: {name} ({hex}) on surface: {name} ({hex}) → ratio: {ratio}:1 (min: {threshold}:1)`.
- Sugestão de fix mais escuro/claro do palette por par reprovado (SC-1.4).
- Sucesso (SC-1.5): `✓ {N} color pairs checked. All pass WCAG AA.` + exit 0.
- Falha → exit 1 (gate hard, SC-1.6). `--verbose` lista pass+fail (SC-1.7). Legenda WCAG AA
  (4.5:1 normal, 3:1 large, 7:1 enhanced) na saída de falha (SC-1.8).

### 3.3 Testes unitários `scripts/__tests__/check-contrast.spec.ts` (Vitest) (FR-2, SC-1.9)

Cobertura: pares que passam (exit 0), pares que falham (exit 1 + formato exato), `--verbose`,
`--tokens-path` apontando para fixture, sugestões de fix. Usa fixtures CSS sintéticos em
`scripts/__tests__/fixtures/` (preset bom + preset ruim) — não depende do preset real (estabilidade).

### 3.4 Dependência `color2k` (FR-12)

`color2k` está **AUSENTE** (verificado empiricamente: `jq` em `apps/web/package.json` → ABSENT).
`@axe-core/playwright@^4.11.3` **já presente** (verificado). Adicionar `color2k` a `apps/web` devDeps
(o script CLI roda na raiz mas resolve módulos via workspace; execute-task decide se vai em raiz ou
`apps/web` conforme onde `tsx` resolve `color2k` — preferir `apps/web/devDependencies` por consistência
com o monorepo). Após adicionar: `pnpm install` + commitar `pnpm-lock.yaml`.

### 3.5 Integração no `ci.yml` job `Lint` (step novo)

Adicionar step após "Contrast tokens gate" (ci.yml:103-104):

```yaml
      - name: Contrast WCAG AA gate (oklch relative-color, color2k)
        run: npx tsx scripts/check-contrast.ts
```

Hard por default (exit 1). FR-13: verificar `npx tsx scripts/check-contrast.ts` retorna exit 0 no estado
atual do repo ANTES de tornar gate (caso contrário corrigir tokens ou ajustar pares antes da promoção).

---

## 4. Eixo C — `axe-final.spec.ts`: `serious=0` (FR-9, dec-006/NC-2; US-4)

Estado atual (verificado): `apps/web/e2e/a11y/axe-final.spec.ts:114` tem
`expect(bySeverity.critical).toBe(0);` (apenas critical). Mudança mínima e cirúrgica:

```diff
       // ASSERT: no new critical violations (DoD transversal SC-006)
       expect(bySeverity.critical).toBe(0);
+      // ASSERT: no new serious violations (a11y-ci-gate FR-9 / dec-006 NC-2)
+      expect(bySeverity.serious).toBe(0);
```

> NC-2: `axe-final.spec.ts` deixa de ser parcialmente bloqueante (só critical) e passa a bloquear
> critical **e** serious. O gate permanente oficial continua sendo `axe-quality-gate.e2e-spec.ts`
> (FR-5, `toHaveLength(0)` = todas severidades). Não tocar o resto do arquivo (delta-report intacto).

---

## 5. Eixo D — Promoção de gates warn→hard no `ci.yml` job `Lint` (FR-7, FR-8, FR-13; US-3)

Estado atual verificado em `ci.yml`:
- L100-101 `Focus-ring variant guard`: `bash scripts/check-focus-ring-variants.sh --ci` → já **hard** ✅
- L103-104 `Contrast tokens gate`: `node apps/web/scripts/check-contrast-tokens.mjs` → já **hard** ✅
- L106-107 `Motion-safe guard (warn)`: `bash scripts/check-motion-safe.sh --ci --warn` → **warn** (promover)
- `check-i18n-scf.sh --strict`: **não integrado** ao ci.yml (adicionar)

### 5.1 Promoção motion-safe (FR-7, SC-3.1)

`scripts/check-motion-safe.sh` suporta `--ci` (saída concisa) e `--warn` (exit 0 sempre). Verificado:
L177 `exit 1` no modo não-warn. Mudança:

```diff
-      - name: Motion-safe guard (warn)
-        run: bash scripts/check-motion-safe.sh --ci --warn
+      - name: Motion-safe guard
+        # Promovido de warn→hard: violações prefers-reduced-motion corrigidas em 12.4.
+        # (a11y-ci-gate FR-7 / US-3 SC-3.1)
+        run: bash scripts/check-motion-safe.sh --ci
```

### 5.2 Adição i18n-scf strict (FR-8, SC-3.2)

`scripts/check-i18n-scf.sh` suporta `--strict` (verificado: L12 "exit 1 se qualquer string hardcoded";
L73 `exit 1`). Adicionar step ao job Lint:

```yaml
      - name: i18n SCF strict gate
        # Bloqueia strings hardcoded em formulários (a11y-ci-gate FR-8 / US-3 SC-3.2)
        run: bash scripts/check-i18n-scf.sh --strict
```

### 5.3 Verificação pré-promoção (FR-13, SC-3.4) — OBRIGATÓRIA no execute-task

Antes de promover, execute-task **deve** rodar localmente no repo e confirmar exit 0:
`bash scripts/check-motion-safe.sh --ci` e `bash scripts/check-i18n-scf.sh --strict` e
`npx tsx scripts/check-contrast.ts`. Se algum retornar exit 1, NÃO promover sem antes corrigir as
violações remanescentes de 12.4/12.5 (ou registrar Decisão de bloqueio). Caso contrário a promoção
torna o `dev` vermelho imediatamente (lição MEMORY: PR #156 — CI silenciosamente vermelho).

### 5.4 Comentário de seção a11y no ci.yml (SC-3.3)

Adicionar bloco de comentário acima dos gates a11y do job Lint documentando: modo (hard), origem
(épico 12 stories 12.3/12.4/12.5/12.6), e cross-ref para `a11y-checks.yml` e `docs/specs/a11y-ci-gate/`.

---

## 6. Eixo E — Relatório de auditoria final do Épico 12 (FR-10; US-4, DoD transversal)

Documento: `_bmad-output/implementation-artifacts/a11y/epic-12-audit-report.md` (caminho da spec FR-10).
> Briefing da onda diz "Documento em docs/". Reconciliação: a spec autoritativa (FR-10) fixa o caminho
> `_bmad-output/implementation-artifacts/a11y/` (onde já vivem axe-baseline-public.json / axe-final-public.json
> / axe-delta-report.json — coerência de proveniência). Adicionar um stub/cross-link em `docs/` apontando
> para o relatório satisfaz ambos. Execute-task confirma e registra Decisão se houver conflito.

Conteúdo:
- **Baseline vs final**: comparar `axe-baseline-public.json` (FASE 0 de 12.1/12.2) com o estado final
  consolidado (`axe-final-public.json` + delta-report). Tabela por página pública (/, /login, /register,
  /recuperar-senha): violações baseline → final, por severidade.
- **Violações resolvidas por story**: mapear cada classe de violação às stories 12.1 (teclado), 12.2
  (foco/landmarks), 12.3 (contraste tokens), 12.4 (motion-safe), 12.5 (i18n/SCF), 12.6 (gates permanentes).
- **Remanescentes deferidas (R2)**: text-muted decorativo (contraste 3.18:1 aceito p/ texto decorativo),
  care-alert tokens, BrandingSettings, páginas autenticadas (requiresAuth — dec-007), screen readers
  (NFR-A4 fora de escopo). Cada item com justificativa e tracking de tech-debt.
- **Estado final dos gates**: tabela dos 7 gates (contrast tokens, contrast WCAG color2k, focus-ring,
  motion-safe, i18n-scf, axe-quality-gate, axe-final) com job CI e modo (todos hard ao fim de 12.6).

---

## 7. Cenários de Teste (test scenarios)

| ID | Cenário | Tipo | Critério de aceite | Gate hard? |
|----|---------|------|--------------------|-----------|
| T1 | `check-contrast.ts` em preset SEM violação | Vitest unit | exit 0 + `✓ N color pairs checked` | sim |
| T2 | `check-contrast.ts` em preset COM par < 4.5:1 | Vitest unit | exit 1 + formato `[FAIL] … ratio …` + sugestão fix | sim |
| T3 | `check-contrast.ts --verbose` | Vitest unit | lista pass+fail; legenda WCAG AA presente | — |
| T4 | `check-contrast.ts --tokens-path <fixture>` | Vitest unit | usa fixture, não default hardcoded | — |
| T5 | `axe-quality-gate.e2e-spec.ts` nas 4 páginas públicas, 0 violações WCAG2AA | Playwright E2E | todos `toHaveLength(0)` verde | sim |
| T6 | `axe-quality-gate` com violação WCAG2AA injetada (regressão) | Playwright E2E | teste falha com lista de violações | sim |
| T7 | `axe-quality-gate` skipa entrada `requiresAuth:true` | Playwright E2E | teste skipado, não falha (dec-007) | — |
| T8 | Adicionar página pública ao `a11y-pages.json` | manual/E2E | novo `test()` coletado sem editar spec (FR-11) | — |
| T9 | `axe-final.spec.ts` com `serious>0` injetado | Playwright E2E | `expect(bySeverity.serious).toBe(0)` falha (FR-9) | sim |
| T10 | `check-motion-safe.sh --ci` com finding | Bash | exit 1 (hard, sem --warn) (FR-7) | sim |
| T11 | `check-i18n-scf.sh --strict` com string hardcoded | Bash | exit 1 (FR-8) | sim |
| T12 | Pré-promoção FR-13: 3 scripts no estado atual do repo | Bash CI | todos exit 0 antes de promover | gate de promoção |
| T13 | `a11y-checks.yml` em PR que toca `apps/web/src/**` | CI integração | contrast + axe rodam, ambos hard, HTML upload | sim |
| T14 | `a11y-checks.yml` em PR que NÃO toca UI | CI integração | workflow não dispara (path filter) | — |

---

## 8. Artefatos a Entregar (resumo para create-tasks)

**Novos:**
- `a11y-pages.json` (raiz) — FR-4
- `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` — FR-5/FR-11
- `scripts/check-contrast.ts` — FR-1
- `scripts/__tests__/check-contrast.spec.ts` + `scripts/__tests__/fixtures/*.css` — FR-2
- `.github/workflows/a11y-checks.yml` — FR-3/FR-6
- `_bmad-output/implementation-artifacts/a11y/epic-12-audit-report.md` (+ cross-link em `docs/`) — FR-10

**Editados:**
- `apps/web/e2e/a11y/axe-final.spec.ts` — adicionar `expect(bySeverity.serious).toBe(0)` (FR-9)
- `.github/workflows/ci.yml` — step contrast WCAG (eixo B); promover motion-safe (FR-7);
  adicionar i18n-scf strict (FR-8); comentário de seção a11y (SC-3.3)
- `apps/web/package.json` + `pnpm-lock.yaml` — adicionar `color2k` (FR-12)

---

## 9. Restrições e Guardrails (herança da spec)

- **Chromium-only** em `a11y-checks.yml` e no gate axe (constraint CI). Não expandir WebKit/Firefox.
- **Não duplicar** `check-contrast-tokens.mjs` (permanece no Lint job, inalterado).
- **`tsx`** como runner de scripts TS no CI (não ts-node, não compilação separada).
- **Fonte única de tokens**: `packages/config/tailwind.preset.css`.
- **Páginas autenticadas = R2** (dec-007): `requiresAuth:true` skipado neste sprint.
- **Não tocar `.claude/settings.json`**. `ci.yml` é parte do escopo (editável).
- **Pré-promoção (FR-13)** é gate obrigatório antes de tornar motion-safe/i18n/contrast hard — evita
  regressão de CI vermelho (lição PR #156 / MEMORY).

---

## 10. Quality Gate desta onda

- **owasp-security**: SKIP justificado — feature é puramente front-end + configuração de CI (testes a11y,
  scripts CLI de contraste, edição de workflow YAML). Sem endpoint, sem dados, sem auth, sem superfície de
  ataque OWASP/ASVS na arquitetura proposta. Risco baixo. (Decisão registrada no state.json.)

## 11. Próxima Fase

`checklist` — quality gate de requisitos no domínio a11y/CI (validar que os ACs da spec são testáveis,
não-ambíguos e completos antes de decompor em tasks).
