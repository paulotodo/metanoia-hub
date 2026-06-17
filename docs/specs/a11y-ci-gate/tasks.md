# Tasks — a11y-ci-gate (Story 12.6 — Quality Gate Permanente de Acessibilidade no CI)

> **Feature:** a11y-ci-gate | **Pipeline:** feature-00c | **Onda geração:** onda-004
> **Fases concluídas:** specify ✅ clarify ✅ plan ✅ checklist ✅
> **Data geração:** 2026-06-17

## Legenda de Criticidade

- **[crit]** — Tarefa crítica: bloqueia integração/CI ou constitui gate permanente; deve ser concluída antes de PR final.
- **[imp]** — Tarefa importante: entrega de valor direto à US; pode ter dependência sequencial.
- **[aux]** — Tarefa auxiliar: documentação, validação extra, suporte; não bloqueia PR se outras estiverem verdes.

---

## Escopo Coberto

- Eixo A: Gate axe consolidado parametrizado (`a11y-pages.json` + `axe-quality-gate.e2e-spec.ts`)
- Eixo B: `scripts/check-contrast.ts` (novo, coexiste com `.mjs`) + dep `color2k`
- Eixo C: `axe-final.spec.ts` — corrigir `serious=0` (FR-9/NC-2)
- Eixo D: Promoção motion-safe + i18n-scf warn→hard com pré-promoção FR-13
- Eixo E: Relatório de auditoria final do Épico 12 (`docs/a11y-audit-epic12.md`)
- Gaps do checklist: CHK030 (correção textual SC-5.1), CHK023 (validação YAML workflows)
- Workflow dedicado `a11y-checks.yml` (path-filtered)

## Escopo Excluído

- Páginas autenticadas no gate axe (R2 explícito — requer `loginAs` + Keycloak stack; ver dec-007/NC-3)
- Modificação do `check-contrast-tokens.mjs` existente (permanece intacto — NC-1/dec-005)
- Criação de novos módulos NestJS/backend
- Qualquer alteração fora do escopo de acessibilidade/CI do Epic 12

---

## Matriz de Dependências

```
T1 (CHK030 spec fix)          <- independente (pode rodar a qualquer momento)
T2 (color2k install)          <- independente; bloqueia T3
T3 (check-contrast.ts)        <- depende de T2
T4 (unit tests check-contrast)<- depende de T3
T5 (a11y-pages.json)          <- independente; bloqueia T6
T6 (axe-quality-gate.spec)    <- depende de T5; bloqueia T9/T10
T7 (axe-final serious=0)      <- independente do eixo A
T8 (pre-promocao FR-13)       <- depende de T3 (check-contrast.ts disponivel); bloqueia T9 (Eixo D)
T9 (ci.yml promocao + a11y)   <- depende de T8 (exit 0 confirmado); depende de T3, T6
T10 (a11y-checks.yml)         <- depende de T5, T6; depende de T9 (ci.yml finalizado)
T11 (YAML validation)         <- depende de T9, T10 (workflows gerados); CHK023
T12 (audit report Epic 12)    <- depende de T6, T7, T9, T10 (todos os gates verdes)
```

---

## FASE 1 — Correcoes e Dependencias Base

### 1.1 Corrigir texto de SC-5.1 na spec (CHK030) [aux]

**Eixo:** Correcao textual (gap CHK030 — conflito SC-5.1 vs NC-3/dec-007)
**Ref:** CHK030 [Conflict], dec-007 (score 3), dec-015

**Descricao:**
O texto original de SC-5.1 ainda pede "pelo menos uma pagina de fluxo autenticado-publico", porem
NC-3/dec-007 (score 3, empiricamente ratificado) declarou "SC-5.1 ajustado: paginas iniciais sao
`/login`, `/`, `/register`, `/recuperar-senha` (todas publicas)". A spec contradiz-se na letra —
corrigir o texto para alinhar com a decisao ratificada, sem alterar a semantica ja resolvida.

**Arquivo-alvo:**
- `docs/specs/a11y-ci-gate/spec.md` — secao `SC-5.1` (linha aprox. 121)

**Acao:**
Substituir SC-5.1 por:
```
SC-5.1: `a11y-pages.json` contem as paginas iniciais: `/` (home-marketing), `/login`,
`/register`, `/recuperar-senha` — todas com `requiresAuth: false`. Paginas autenticadas
(dashboard, grupos) sao R2 explicito (ver NC-3/dec-007): entram no JSON com `requiresAuth: true`
e sao automaticamente skipped pelo spec ate o helper `loginAs` ser estabilizado no CI.
```

**Criterio de aceite:**
- [ ] `grep -n "autenticado-publico" docs/specs/a11y-ci-gate/spec.md` retorna zero resultados
- [ ] O texto novo menciona explicitamente as 4 paginas publicas e referencia NC-3/dec-007
- [ ] Nenhuma outra linha da spec alterada

**Dependencias:** nenhuma

---

### 1.2 Instalar `color2k` em `apps/web` devDependencies [imp]

**Eixo:** B — check-contrast.ts (FR-12)
**Ref:** FR-12, plan §3.4, CHK011

**Descricao:**
`color2k` esta AUSENTE em `apps/web/package.json` (verificado empiricamente via jq). Necessaria para
que `scripts/check-contrast.ts` resolva cores oklch relative-color via `getContrast`/`parseToRgba`.
Instalar como devDependency em `apps/web`. Commitar o `pnpm-lock.yaml` atualizado.

**Arquivos-alvo:**
- `apps/web/package.json` — campo `devDependencies`
- `pnpm-lock.yaml` — atualizado automaticamente pelo `pnpm install`

**Acao:**
```bash
pnpm --filter @metanoia/web add -D color2k
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(deps): adiciona color2k como devDep em apps/web para check-contrast.ts"
```

**Criterio de aceite:**
- [ ] `jq '.devDependencies["color2k"]' apps/web/package.json` retorna string de versao (nao null)
- [ ] `pnpm --filter @metanoia/web exec node -e "require('color2k')"` sem erro de modulo nao encontrado
- [ ] `pnpm-lock.yaml` commitado junto da alteracao de `package.json`

**Dependencias:** nenhuma (pre-requisito para T3)

---

## FASE 2 — Eixo B: `scripts/check-contrast.ts`

### 2.1 Criar `scripts/check-contrast.ts` (CLI de contraste oklch) [imp]

**Eixo:** B — check-contrast.ts (FR-1, FR-2, FR-12; US-1)
**Ref:** FR-1, FR-2, FR-12, SC-1.1–SC-1.9, plan §3.2, NC-1/dec-005

**Descricao:**
Novo script CLI TypeScript que le tokens CSS (via `--tokens-path`, default
`packages/config/tailwind.preset.css`), resolve oklch relative-color usando `color2k`, verifica razao
de contraste WCAG AA (>=4.5:1 AA normal, >=3:1 AA large — parametrizavel via `--level`), e emite saida
estruturada com sugestoes quando abaixo do limiar.

**Coexistencia (NC-1/dec-005):** `apps/web/scripts/check-contrast-tokens.mjs` permanece intacto no
step "Contrast tokens gate" do ci.yml. O novo `.ts` e camada complementar (oklch + WCAG AA
parametrizavel), nao substituto.

**Arquivo-alvo:**
- `scripts/check-contrast.ts` (NOVO — raiz do repo, junto dos demais scripts sh)

**Contrato do script (plan §3.2):**
```
CLI: npx tsx scripts/check-contrast.ts [--tokens-path <path>] [--level AA|AAA] [--verbose]
Exit 0: todos os pares de contraste atendem o nivel solicitado ("Contrast OK")
Exit 1: >=1 par abaixo do limiar (mensagem: token, valor hex resolvido, ratio, limiar)
Flag --tokens-path: default packages/config/tailwind.preset.css (relativo ao cwd do processo)
Resolucao cwd: path.resolve(process.cwd(), tokensPath) — robusto em qualquer cwd
Sugestoes: para cada par reprovado, emitir valor hex sugerido que atingiria o limiar
Constraint: nao importar de apps/web/src/ (CLI standalone com color2k)
```

**Criterio de aceite:**
- [ ] `npx tsx scripts/check-contrast.ts --tokens-path packages/config/tailwind.preset.css` retorna exit 0 no estado atual do repo
- [ ] Modificar token de cor para valor de baixo contraste resulta em exit 1 com mensagem de falha
- [ ] `--tokens-path` aceita path relativo e absoluto; ausencia usa o default
- [ ] O script nao importa de `apps/web/src/`
- [ ] Cabecalho JSDoc documenta proposito, FR-1/FR-2, como estender

**Dependencias:** T2 (color2k instalada)

---

### 2.2 Criar testes unitarios `scripts/__tests__/check-contrast.spec.ts` (Vitest) [imp]

**Eixo:** B — testes unitarios (FR-2, SC-1.9)
**Ref:** FR-2, SC-1.9, plan §3.3

**Descricao:**
Testes unitarios Vitest para `check-contrast.ts` usando fixtures CSS sinteticos (independentes do
arquivo real de tokens). Cobrem os 5 casos definidos em SC-1.9.

**Arquivo-alvo:**
- `scripts/__tests__/check-contrast.spec.ts` (NOVO — criar diretorio se nao existir)

**Casos de teste obrigatorios (SC-1.9):**
```
1. Tokens com contraste suficiente -> exit 0
2. Token com contraste insuficiente -> exit 1 + mensagem inclui nome do token
3. Flag --verbose -> saida inclui ratio numerico por par
4. Flag --tokens-path invalido -> exit 1 com mensagem de erro de arquivo nao encontrado
5. Sugestoes -> quando falha, output inclui valor hex sugerido
```

**Criterio de aceite:**
- [ ] `npx vitest run scripts/__tests__/check-contrast.spec.ts` — todos os casos passam
- [ ] Cobertura dos 5 casos obrigatorios acima
- [ ] Fixtures CSS nao dependem de `packages/config/tailwind.preset.css` (inline ou em `__fixtures__/`)

**Dependencias:** T3 (check-contrast.ts criado)

---

### 2.3 Integrar `check-contrast.ts` no job Lint do `ci.yml` [crit]

**Eixo:** B — integracao CI (FR-1, SC-1.7/SC-1.8)
**Ref:** FR-1, SC-1.7, SC-1.8, plan §3.5

**Descricao:**
Adicionar step novo no job `Lint` do `.github/workflows/ci.yml`, apos o step existente
"Contrast tokens gate", para executar o novo script. O step existente permanece intacto (NC-1).
Esta tarefa e CONSOLIDADA com T9 (Fase 5) para evitar multiplos commits no ci.yml.

**Arquivo-alvo:**
- `.github/workflows/ci.yml` — job `Lint` (linhas aprox. 103–107)

**Step a adicionar (plan §3.5):**
```yaml
      - name: Contrast gate (oklch / WCAG AA parametrizable)
        # Novo gate complementar: resolve oklch relative-color via color2k.
        # Coexiste com "Contrast tokens gate" (check-contrast-tokens.mjs) — NC-1/dec-005.
        # (a11y-ci-gate FR-1 / US-1 SC-1.7)
        run: npx tsx scripts/check-contrast.ts
```

**Criterio de aceite:**
- [ ] Step presente no `ci.yml` apos o step "Contrast tokens gate"
- [ ] `npx tsx scripts/check-contrast.ts` retorna exit 0 no estado atual do repo (confirmar antes de commitar)
- [ ] Validacao YAML coberta por T11

**Dependencias:** T3 (script criado), T8 (pre-validacao local confirma exit 0 antes de promover)
**Nota:** Esta task pode ser consolidada no mesmo commit de T9 (ci.yml) para atomicidade.

---

## FASE 3 — Eixo A: Gate axe consolidado

### 3.1 Criar `a11y-pages.json` na raiz do repositorio [crit]

**Eixo:** A — fonte unica de paginas (FR-4, FR-11; US-2, US-5)
**Ref:** FR-4, FR-11, SC-5.1–SC-5.4, plan §2.1, dec-007/NC-3, CHK006

**Descricao:**
Arquivo JSON puro na raiz do repositorio (`/a11y-pages.json`) — fonte unica de paginas auditadas pelo
gate axe. Entradas iniciais: todas publicas (dec-007/NC-3). Campo `_README` documenta o schema (SC-5.2
atendido via campo parseavel em vez de comentario, que JSON nao suporta).

**Resolucao de cwd (CHK006):** o spec Playwright resolve o arquivo via
`path.join(process.cwd(), 'a11y-pages.json')`. O runner Playwright no CI tem cwd na raiz do repo
(configurado por `playwright.config.ts`). Confirmar em desenvolvimento com `console.log(process.cwd())`
antes de commitar o spec.

**Arquivo-alvo:**
- `a11y-pages.json` (NOVO — raiz `/var/lib/metanoia-hub/a11y-pages.json`)

**Conteudo (plan §2.1):**
```json
{
  "_README": [
    "Lista de paginas auditadas pelo gate axe (axe-quality-gate.e2e-spec.ts).",
    "Campos por entrada: path (string, rota relativa), label (string, nome do teste),",
    "requiresAuth (boolean). NESTE SPRINT entradas requiresAuth=true sao SKIPPED",
    "(tech debt R2 — exigem loginAs + Keycloak; ver dec-007/NC-3 na spec).",
    "Para adicionar pagina publica: acrescente {path,label,requiresAuth:false}. Nenhuma",
    "edicao no spec file e necessaria (iteracao dinamica — FR-11/SC-5.3)."
  ],
  "pages": [
    { "path": "/",                "label": "home-marketing",  "requiresAuth": false },
    { "path": "/login",           "label": "login",           "requiresAuth": false },
    { "path": "/register",        "label": "register",        "requiresAuth": false },
    { "path": "/recuperar-senha", "label": "recuperar-senha", "requiresAuth": false }
  ]
}
```

**Criterio de aceite:**
- [ ] `python3 -c "import json; d=json.load(open('a11y-pages.json')); print(len(d['pages']), 'paginas')"` retorna `4 paginas` sem erro
- [ ] Todas as 4 entradas tem `requiresAuth: false`
- [ ] Campo `_README` presente e documenta o schema (SC-5.2)
- [ ] Arquivo commitado na raiz do repo

**Dependencias:** nenhuma (pre-requisito para T6)

---

### 3.2 Criar `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` [crit]

**Eixo:** A — gate axe bloqueante (FR-4, FR-5, FR-6, FR-11; US-2, US-5)
**Ref:** FR-4, FR-5, FR-6, FR-11, SC-2.7, SC-2.8, SC-5.3, plan §2.2, CHK006

**Descricao:**
Novo spec Playwright que le `a11y-pages.json`, filtra `requiresAuth === false`, itera dinamicamente
criando um `test()` por pagina, roda axe com tags WCAG 2A/2AA/2.1AA, e faz assertion hard
`expect(violations).toHaveLength(0)`. Entradas `requiresAuth: true` geram `test.skip` anotado.
Resolucao de cwd: `path.join(process.cwd(), 'a11y-pages.json')` — cwd do runner Playwright e a
raiz do repo (CHK006 resolvido — confirmar uma vez em dev antes de commitar).

**Arquivo-alvo:**
- `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` (NOVO)

**Estrutura core do spec:**
```typescript
/**
 * axe-quality-gate.e2e-spec.ts — Gate axe bloqueante (FR-5/FR-11)
 * Paginas: a11y-pages.json (raiz do repo) — adicionar pagina = editar JSON, nao este arquivo.
 * Tags WCAG bloqueantes: wcag2a, wcag2aa, wcag21aa. best-practice: excluida do gate.
 * requiresAuth:true -> test.skip (R2 explicito; ver NC-3/dec-007 na spec).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

const pagesJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'a11y-pages.json'), 'utf-8')
);
const allPages = pagesJson.pages as Array<{
  path: string; label: string; requiresAuth: boolean;
}>;

test.describe('axe quality gate — paginas publicas (WCAG 2AA)', () => {
  for (const pageEntry of allPages) {
    if (pageEntry.requiresAuth) {
      test(`[SKIP/R2] ${pageEntry.label} (${pageEntry.path}) — requiresAuth=true`, () => {
        test.skip(true, '[R2] Pagina autenticada: loginAs nao disponivel no CI (NC-3/dec-007)');
      });
      continue;
    }
    test(`[axe] ${pageEntry.label} (${pageEntry.path}) — zero violacoes WCAG 2AA`,
      async ({ page: pwPage }) => {
        await pwPage.goto(pageEntry.path, { waitUntil: 'networkidle' });
        const results = await new AxeBuilder({ page: pwPage })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        if (results.violations.length > 0) {
          const summary = results.violations
            .map(v => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nos)`)
            .join('\n');
          throw new Error(
            `Violacoes WCAG 2AA em "${pageEntry.label}" (${pageEntry.path}):\n${summary}`
          );
        }
        expect(results.violations).toHaveLength(0);
      }
    );
  }
});
```

**Criterio de aceite:**
- [ ] O spec compila sem erros TypeScript (`npx tsc --noEmit`)
- [ ] Cada pagina publica gera 1 teste dinamico (4 testes para as 4 entradas iniciais)
- [ ] Entradas `requiresAuth: true` (quando adicionadas) geram `test.skip` visivel no relatorio
- [ ] `process.cwd()` no runner resolve para raiz do repo (confirmar uma vez em dev — CHK006)

**Dependencias:** T5 (`a11y-pages.json` criado)

---

### 3.3 Integrar gate axe no `ci.yml` job `E2E (Playwright)` [crit]

**Eixo:** A — integracao CI (FR-5, SC-2.3; plan §2.3)
**Ref:** FR-5, SC-2.3, plan §2.3

**Descricao:**
Confirmar (nao adicionar step novo, se o job E2E ja roda todos os specs em `e2e/`) que
`axe-quality-gate.e2e-spec.ts` sera executado no job E2E. Se o job usa filtro de arquivo,
adicionar o spec explicitamente. Confirmar ausencia de `continue-on-error: true`.

**Arquivo-alvo:**
- `.github/workflows/ci.yml` — job `E2E (Playwright)` (linha aprox. 195+)

**Acao:**
```bash
# Verificar se o job E2E usa glob ou lista explicita de specs:
grep -A 20 "E2E (Playwright)" .github/workflows/ci.yml | grep "playwright test"
# Se usa npx playwright test sem filtro -> axe-quality-gate.e2e-spec.ts e incluido automaticamente
# Se usa filtro -> adicionar apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts
```

**Criterio de aceite:**
- [ ] `axe-quality-gate.e2e-spec.ts` e executado no job E2E (confirmar via inspecao do ci.yml)
- [ ] Nenhum `continue-on-error: true` no step que roda o gate axe
- [ ] Upload de relatorio HTML axe via `actions/upload-artifact` presente no job E2E (SC-2.4/FR-6)

**Dependencias:** T6 (spec criado)

---

## FASE 4 — Eixo C: `axe-final.spec.ts` — serious=0

### 4.1 Corrigir `axe-final.spec.ts` para assertir `serious=0` (NC-2/dec-006) [crit]

**Eixo:** C — `axe-final.spec.ts` (FR-9; US-4)
**Ref:** FR-9, NC-2, dec-006, plan §4, CHK012

**Descricao:**
`apps/web/e2e/a11y/axe-final.spec.ts` linha 114 assertiva apenas `expect(bySeverity.critical).toBe(0)`.
A NC-2/dec-006 especifica que o gate de finalizacao do Epico 12 deve incluir `serious=0`.
Adicionar assertion para `serious` sem remover a existente para `critical`.

**Arquivo-alvo:**
- `apps/web/e2e/a11y/axe-final.spec.ts` — linha 114 (assertion `critical`)

**Diff esperado:**
```diff
       // ASSERT: no new critical violations (DoD transversal SC-006)
       expect(bySeverity.critical).toBe(0);
+      // ASSERT: no serious violations (NC-2/dec-006 — DoD Story 12.6 FR-9)
+      expect(bySeverity.serious).toBe(0);
```

**Criterio de aceite:**
- [ ] `grep -n "expect(bySeverity.serious).toBe(0)" apps/web/e2e/a11y/axe-final.spec.ts` retorna >=1 resultado
- [ ] A assertion `critical` permanece intacta na linha original
- [ ] O spec compila sem erros TypeScript

**Dependencias:** nenhuma

---

## FASE 5 — Eixo D: Pre-promocao e promocao warn->hard

### 5.1 Verificacao pre-promocao FR-13 — confirmar exit 0 local [crit]

**Eixo:** D — pre-promocao (FR-13, SC-3.4; US-3)
**Ref:** FR-13, SC-3.4, plan §5.3, CHK015, CHK016, CHK017

**Descricao:**
OBRIGATORIA antes de qualquer promocao a hard no ci.yml (licao PR #156: CI silenciosamente vermelho).
Rodar os 3 scripts localmente no repo e confirmar exit 0.

**Acao (executar em sequencia, parar se exit != 0):**
```bash
bash scripts/check-motion-safe.sh --ci       # exit 0 esperado (correcoes 12.4)
bash scripts/check-i18n-scf.sh --strict      # exit 0 esperado (correcoes 12.5)
npx tsx scripts/check-contrast.ts            # exit 0 esperado (tokens atuais)
node apps/web/scripts/check-contrast-tokens.mjs  # exit 0 esperado (gate existente)
```

**Criterio de aceite (CHK015/CHK016):**
- [ ] `bash scripts/check-motion-safe.sh --ci` -> exit 0
- [ ] `bash scripts/check-i18n-scf.sh --strict` -> exit 0
- [ ] `npx tsx scripts/check-contrast.ts` -> exit 0
- [ ] `node apps/web/scripts/check-contrast-tokens.mjs` -> exit 0

**Resolucao CHK017 (criterio corrigir-vs-bloquear):**
Se pre-promocao falhar -> SEMPRE corrigir a violacao (nao desabilitar o gate).
Registrar Decisao com `--score 2` explicando a violacao encontrada.
Somente se a correcao nao for possivel nesta story -> registrar Decisao `--score 0` + BloqueioHumano
com diagnostico explicito. NUNCA promover a hard com violacao pendente.

**Dependencias:** T3 (check-contrast.ts disponivel para o 3o script); executa ANTES de T9

---

### 5.2 Promover gates warn->hard e adicionar i18n-scf no `ci.yml` [crit]

**Eixo:** D — promocao (FR-7, FR-8, FR-13; US-3)
**Ref:** FR-7, FR-8, SC-3.1, SC-3.2, SC-3.3, plan §5.1/5.2/5.4

**Descricao:**
Tres mudancas no job `Lint` do `ci.yml` (consolidadas em um unico commit com T2.3):
1. Promover step "Motion-safe guard (warn)" para hard (remover `--warn`, atualizar label)
2. Adicionar step `check-i18n-scf.sh --strict` (gate hard)
3. Adicionar comentario de secao a11y antes do bloco de gates (SC-3.3)

**Arquivo-alvo:**
- `.github/workflows/ci.yml` — job `Lint` (linhas aprox. 98–110)

**Estado alvo do bloco de gates (plan §5.1/5.2/5.4):**
```yaml
      # ─ Gates de Acessibilidade (a11y) ──────────────────────────────────────────
      # Modo: hard (exit 1 em violacao). Origem: Epico 12 (stories 12.3/12.4/12.5/12.6).
      # Cross-ref: .github/workflows/a11y-checks.yml | docs/specs/a11y-ci-gate/
      - name: Focus-ring variant guard
        run: bash scripts/check-focus-ring-variants.sh --ci
      - name: Contrast tokens gate
        run: node apps/web/scripts/check-contrast-tokens.mjs
      - name: Contrast gate (oklch / WCAG AA parametrizable)
        # Complementar ao step acima; resolve oklch relative-color via color2k. (FR-1)
        run: npx tsx scripts/check-contrast.ts
      - name: Motion-safe guard
        # Promovido de warn->hard: violacoes prefers-reduced-motion corrigidas em 12.4.
        # (a11y-ci-gate FR-7 / US-3 SC-3.1)
        run: bash scripts/check-motion-safe.sh --ci
      - name: i18n strings SCF gate
        # Gate hard: strings hardcoded em formularios (stories 12.5 corrigidas).
        # (a11y-ci-gate FR-8 / US-3 SC-3.2)
        run: bash scripts/check-i18n-scf.sh --strict
```

**Criterio de aceite:**
- [ ] Step "Motion-safe guard" usa `bash scripts/check-motion-safe.sh --ci` (sem `--warn`)
- [ ] Step "i18n strings SCF gate" presente com `bash scripts/check-i18n-scf.sh --strict`
- [ ] Comentario de secao a11y presente antes do primeiro gate (SC-3.3)
- [ ] `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"` -> sem erro (coberto por T11)

**Dependencias:** T8 (pre-promocao FR-13 confirmou exit 0); T3 (check-contrast.ts disponivel)

---

## FASE 6 — Workflow dedicado `a11y-checks.yml`

### 6.1 Criar `.github/workflows/a11y-checks.yml` (path-filtered, dedicado) [crit]

**Eixo:** A+B — workflow dedicado (FR-3, SC-2.1–SC-2.6; US-2)
**Ref:** FR-3, SC-2.1, SC-2.2, SC-2.3, SC-2.4, SC-2.5, SC-2.6, plan §1.1/§2.3

**Descricao:**
Workflow GitHub Actions dedicado ao gate a11y, path-filtered para PRs que tocam UI.
Espelha eixos B (check-contrast) + A (axe quality gate) com feedback rapido e isolado.
`continue-on-error: false` implicito em todos os steps de gate (SC-2.3).

**Arquivo-alvo:**
- `.github/workflows/a11y-checks.yml` (NOVO)

**Paths do path-filter (SC-2.1):**
```yaml
on:
  pull_request:
    paths:
      - 'apps/web/**'
      - 'packages/ui/**'
      - 'packages/config/**'
      - 'a11y-pages.json'
      - 'scripts/check-*.ts'
      - 'scripts/check-*.sh'
```

**Steps obrigatorios:**
1. checkout, pnpm setup, node setup, `pnpm install --frozen-lockfile`
2. `pnpm --filter @metanoia/web build` (build da web antes de servir)
3. Step: "Contrast gate (oklch)" — `npx tsx scripts/check-contrast.ts`
4. Start dev server em background + wait-on (ou sleep 15 se wait-on indisponivel)
5. Step: "axe quality gate (paginas publicas — WCAG 2AA)" — `npx playwright test apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts --project=chromium`
6. `actions/upload-artifact` com `if: always()` para `apps/web/e2e/a11y/reports/` (FR-6/SC-2.4)

**Criterio de aceite:**
- [ ] `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/a11y-checks.yml'))"` -> YAML valido sem erro
- [ ] Path-filter cobre todos os paths listados em SC-2.1
- [ ] Nenhum step tem `continue-on-error: true`
- [ ] Step de upload de relatorio presente com `if: always()` (FR-6/SC-2.4)
- [ ] Cabecalho do workflow documenta processo de adicao de paginas (SC-5.4)

**Dependencias:** T5, T6, T9 (ci.yml finalizado como referencia)

---

## FASE 7 — Validacao YAML dos Workflows (CHK023)

### 7.1 Validar YAML de `a11y-checks.yml` e `ci.yml` [aux]

**Eixo:** Validacao explicita (CHK023 [Gap], dec-016)
**Ref:** CHK023, DoD §3, dec-016

**Descricao:**
Adicionar validacao YAML explicita como criterio de aceite formal (CHK023 identificou que apenas
execucao via `act` cobria YAML valido indiretamente). Usar `python3 yaml.safe_load` disponivel
no ambiente; `actionlint` se disponivel (nao obrigatorio).

**Acao:**
```bash
python3 -c "
import yaml, sys
files = ['.github/workflows/ci.yml', '.github/workflows/a11y-checks.yml']
errors = []
for f in files:
    try:
        yaml.safe_load(open(f))
        print(f'YAML OK: {f}')
    except yaml.YAMLError as e:
        errors.append(f'{f}: {e}')
        print(f'YAML ERRO: {f}: {e}')
sys.exit(1 if errors else 0)
"
# Extra (se disponivel):
which actionlint && actionlint .github/workflows/ci.yml .github/workflows/a11y-checks.yml || true
```

**Criterio de aceite (CHK023 — explicito e verificavel):**
- [ ] `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` -> exit 0
- [ ] `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/a11y-checks.yml'))"` -> exit 0
- [ ] Se `actionlint` disponivel: zero erros nos dois arquivos

**Dependencias:** T9 (ci.yml com alteracoes), T10 (a11y-checks.yml criado)

---

## FASE 8 — Eixo E: Relatorio de Auditoria Final do Epico 12

### 8.1 Gerar `docs/a11y-audit-epic12.md` (DoD transversal) [imp]

**Eixo:** E — relatorio de auditoria final (FR-10; US-4)
**Ref:** FR-10, SC-4.1–SC-4.4, plan §6, DoD §6

**Descricao:**
Relatorio consolidado do Epico 12 de Acessibilidade. Documento Markdown human-readable cobrindo:
status de cada story (12.1–12.6), gates ativos e seus modos, baseline axe vs. estado final,
violacoes resolvidas, R2 documentados, e aprovacao formal de DoD transversal.

**Arquivo-alvo:**
- `docs/a11y-audit-epic12.md` (NOVO)

**Secoes obrigatorias (plan §6/SC-4.1–SC-4.4):**
```
# Relatorio de Auditoria de Acessibilidade — Epico 12
## 1. Sumario Executivo
## 2. Gates CI Ativos (estado final)
   Tabela: Gate | Script | Job | Modo
   (todos os 5 gates: focus-ring, contrast-tokens, contrast-oklch, motion-safe, i18n-scf)
## 3. Stories 12.1–12.6 — Status de Conclusao
## 4. Baseline axe vs. Estado Final (critical:0, serious:0)
## 5. Violacoes Resolvidas no Epico
## 6. R2 — Tech Debt Documentado (paginas autenticadas no gate axe — NC-3/dec-007)
## 7. Aprovacao DoD Transversal
```

**Criterio de aceite:**
- [ ] Arquivo existe em `docs/a11y-audit-epic12.md`
- [ ] Secoes 1–7 presentes e preenchidas (nao placeholders)
- [ ] Tabela de gates lista todos os 5 gates do estado final (todos hard)
- [ ] Secao R2 documenta explicltamente paginas autenticadas como tech debt (NC-3/dec-007)

**Dependencias:** T6, T7, T9, T10 (todos os gates implementados e validados)

---

## Resumo das Tasks por Eixo

| ID | Fase | Eixo | Titulo | Criticidade | Depende de |
|----|------|------|--------|-------------|------------|
| T1 | 1.1 | Fix/CHK030 | Corrigir texto SC-5.1 na spec | [aux] | — |
| T2 | 1.2 | B | Instalar `color2k` em apps/web devDeps | [imp] | — |
| T3 | 2.1 | B | Criar `scripts/check-contrast.ts` | [imp] | T2 |
| T4 | 2.2 | B | Testes unitarios `check-contrast.spec.ts` (Vitest) | [imp] | T3 |
| T5 | 3.1 | A | Criar `a11y-pages.json` na raiz | [crit] | — |
| T6 | 3.2 | A | Criar `axe-quality-gate.e2e-spec.ts` | [crit] | T5 |
| T7 | 4.1 | C | Corrigir `axe-final.spec.ts` serious=0 | [crit] | — |
| T8 | 5.1 | D | Verificacao pre-promocao FR-13 (exit 0 local) | [crit] | T3 |
| T9 | 5.2 | D+B | Promover gates + ci.yml (motion/i18n/oklch/comentario) | [crit] | T8, T3 |
| T10 | 6.1 | A+B | Criar `a11y-checks.yml` dedicado (path-filtered) | [crit] | T5, T6, T9 |
| T11 | 7.1 | CHK023 | Validar YAML dos workflows (python3 yaml.safe_load) | [aux] | T9, T10 |
| T12 | 8.1 | E | Gerar `docs/a11y-audit-epic12.md` | [imp] | T6, T7, T9, T10 |

**Totais por eixo:**
- Eixo A (gate axe): T5, T6, T10 — 3 tasks [crit]
- Eixo B (check-contrast.ts): T2, T3, T4 + parte de T9 — 4 tasks
- Eixo C (axe-final serious=0): T7 — 1 task [crit]
- Eixo D (promocao warn->hard): T8, T9 — 2 tasks [crit]
- Eixo E (relatorio Epic 12): T12 — 1 task [imp]
- Gaps do checklist: T1 (CHK030), T11 (CHK023) — 2 tasks [aux]
- **Total: 12 tasks** (7 [crit] + 3 [imp] + 2 [aux])

---

## Definition of Done (DoD) da Story 12.6

- [ ] Todos os gates do job Lint retornam exit 0 no branch `dev` (focus-ring, contrast-tokens, contrast-oklch, motion-safe, i18n-scf)
- [ ] `axe-quality-gate.e2e-spec.ts` passa nos 4 testes de paginas publicas (exit 0 em CI)
- [ ] `axe-final.spec.ts` assertiva `critical=0` **e** `serious=0`
- [ ] Relatorio HTML axe publicado como artifact do ultimo run do CI
- [ ] `a11y-checks.yml` path-filtered executado via `act` local sem erros
- [ ] `ci.yml` YAML valido apos alteracoes (`python3 yaml.safe_load`)
- [ ] `docs/a11y-audit-epic12.md` preenchido e commitado
- [ ] Todos os NCs resolvidos ou documentados como R2 explicito
- [ ] PR aprovado com todos os checks CI verdes (sem `--warn` restante nos gates a11y)
