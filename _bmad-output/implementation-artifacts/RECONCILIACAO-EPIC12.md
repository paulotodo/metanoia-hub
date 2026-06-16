# RECONCILIAÇÃO — Epic 12 (Hardening de Acessibilidade & Qualidade UX)

> Sondagem pré-flight executada em **2026-06-16** sobre `dev @ 1373821` (sincronizada com
> origin). Documento de auditoria que precede o disparo do pipeline cstk `/feature-00c`.
> Fonte autoritativa das stories: `_bmad-output/planning-artifacts/epics/epic-12.md`.
> Guia de execução: `_bmad-output/implementation-artifacts/KICKOFF-EPIC12.md`.

---

## 0. Sumário executivo

| Item | Status |
|------|--------|
| Branch `dev` sincronizada com origin | ✅ `1373821`, 0 ahead / 0 behind |
| Baseline verde (build + lint do CI) | ✅ `turbo build` 3/3, `turbo lint` 4/4, exit 0 |
| Toolchain de PR (`gh` CLI + auth) | ✅ instalado (v2.63.2) e autenticado, escopos `repo`+`workflow` |
| `pnpm` 10.33.0 | ✅ via corepack |
| Deps a11y já presentes | `jest-axe@^10` (em `apps/web` **e** `packages/ui`) — **sem uso ainda** |
| Deps a adicionar (Story 12.6) | `@axe-core/playwright`, `color2k` — ausentes |
| Baseline de contraste (estático) | ⚠️ **22 de 35 pares falham** na matriz crua de tokens |
| Skip navigation global | ❌ inexistente (infra da 12-1) |
| Fonte de tokens real | ⚠️ `packages/config/tailwind.preset.**css**` (não `.ts` — discrepância c/ AC da 12.6) |
| Ordem de execução | ✅ confirmada 12-1 → 12-2 → 12-3 → 12-4 → 12-5 → 12-6 |
| Screen reader (NFR-A4) | 🚫 fora de escopo — Release 2 / Épico 15 |

**Veredito:** ambiente pronto para disparar o pipeline. Três correções de spec a aplicar
nas stories (ver §9). Nenhum bloqueador.

---

## 1. Estado & infraestrutura de execução

### 1.1 Toolchain de PR (guardrail CI)
- **`gh` CLI NÃO vinha instalado nesta VPS** (confirmado). Instalado o binário oficial
  `v2.63.2` em `/usr/local/bin/gh`.
- Autenticação: o git já usa `credential.helper=store` com PAT clássico (`ghp_…`, usuário
  `paulotodo`) em `~/.git-credentials`. Gravado `~/.config/gh/hosts.yml` com esse token
  (contorna a validação `read:org` que o `gh auth login --with-token` exige).
- **Escopos do token:** `project`, `repo`, `workflow`, `write:packages`. O escopo
  **`workflow` é essencial** — a Story 12.6 cria `.github/workflows/a11y-checks.yml`, e sem
  `workflow` o push do arquivo de workflow seria rejeitado pelo GitHub. ✅ presente.
- Permissão no repo: **ADMIN**. `gh pr list/create/merge` operacionais.

### 1.2 Build/test toolchain
- `pnpm@10.33.0` ativado via `corepack` (`packageManager` do repo bate).
- `node v22.22.3`. `pnpm install --frozen-lockfile` ✅ (lockfile não alterado).
- Browsers do Playwright: **não instalados** — serão necessários para os E2E axe-core
  (Stories 12.1, 12.2, 12.4, 12.5, 12.6). `pnpm exec playwright install` deve rodar dentro
  das stories que executam E2E.

### 1.3 ⚠️ Correção crítica: `prisma generate` NÃO roda do root
O KICKOFF instrui validar com `pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint`.
**Rodar `prisma generate` do root FALHA** (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL: Command "prisma"
not found`) — `prisma` é dependência de `apps/api`, não do root. Sem o client gerado, os tipos
da API colapsam para `{}` e o build produz **564 erros TS falsos** (TS2339/TS7006 em cascata).

**Comando correto:**
```bash
pnpm --filter @metanoia/api exec prisma generate   # gera o client no workspace certo
pnpm turbo build && pnpm turbo lint                 # então valida
```
Com o client gerado, **build 3/3 ✅ e lint 4/4 ✅** — baseline verde confirmado. Esta correção
deve ser observada em toda story que valida o CI localmente.

---

## 2. Baseline axe-core (Sub-task 0 da 12-1) — abordagem em duas camadas

A DoD transversal exige **report axe-core baseline (antes) vs. final (depois)**. O baseline foi
fatiado em duas camadas pela viabilidade real neste ambiente:

### 2.1 Camada A — baseline estático de contraste (executado AGORA)
Não exige a app no ar. Calcula a matriz WCAG texto×superfície direto dos tokens de
`packages/config/tailwind.preset.css`. Resultado registrado em §5. É a "fotografia antes" para
a dimensão de **contraste** (medida pela 12-3/12-6).

### 2.2 Camada B — baseline axe-core E2E autenticado (executado DENTRO da Story 12.1)
O scan axe-core dos **fluxos públicos e autenticados** depende de:
- `@axe-core/playwright` instalado (dep que a **própria 12.6** adiciona);
- browsers do Playwright instalados;
- stack de teste no ar com dados semeados + usuários de teste para os fluxos autenticados.

Por isso permanece como **Sub-task 0 da Story 12.1** (como o próprio épico e o KICKOFF
nomeiam), executada pelo `/feature-00c`. **Importante:** a 12.1 deve instalar
`@axe-core/playwright` cedo (não esperar a 12.6) para conseguir gerar o baseline — a 12.6 apenas
formaliza o **gate permanente** sobre o mesmo dep.

#### Viabilidade da stack de teste (sem tocar a produção)
A stack **prod está no ar** (`docker ps`): `metanoia-prod-*` publicando **8090** (web), **8091**
(api), **8092** (keycloak), **8093/8094** (minio), **7880–7882** (livekit); postgres/redis
internos (5432/6379, não publicados). O `docker-compose.test.yml` usa portas **dedicadas e
distintas**: **5433** (pg), **6380** (redis), **8081** (keycloak), **9002/9003** (minio) — **sem
conflito** com a prod. Única colisão: o **LiveKit de teste mapeia host 7881**, que a prod já usa
(7880–7881) — **irrelevante para a11y** (pode-se subir o compose de teste sem o serviço livekit).
→ É seguro subir o stack de teste para o baseline E2E sem mexer nos containers de produção.

#### Páginas-chave do baseline E2E (do épico)
`login`, `dashboard (radar)`, `groups list`, `trail detail` + fluxos das ACs (registro, modais,
catálogo, branding, planos). Report a guardar em
`_bmad-output/implementation-artifacts/a11y/axe-baseline-*.json` (ou artifact do CI).

---

## 3. Radix já acessível → focar gaps de integração (não reconstruir)

- `packages/ui` declara dependências `@radix-ui/*`; componentes base seguem padrão shadcn
  (Dialog, DropdownMenu etc.). **Dialog do Radix faz focus-trap + Escape + `aria-modal`/`role`
  nativos** → o AC da 12.1 sobre modais é de **validação** ("funciona em 3+ modais distintos"),
  não de implementação.
- **Conclusão:** o trabalho real do épico é (a) infra global ausente (skip-nav), (b)
  padronização de foco/contraste, (c) gaps de formulários (i18n/aria), (d) quality gates no CI —
  e **não** reescrever primitivos Radix.

---

## 4. Infra compartilhada a construir cedo (alimenta as demais stories)

### 4.1 Skip navigation global — ❌ inexistente
`grep` por `skip-nav|skip-link|ir para conteúdo` em `apps/web/src` e `packages/ui`: **zero
ocorrências**. Landmark `<main>` só aparece em `boundary-fallback.tsx` e `OnboardingWizard.tsx`
— **não há `<main id>` consistente** nos layouts autenticados/públicos. A 12.1 precisa:
1. criar o componente skip-link (`sr-only` → `focus:not-sr-only`, `z-50`, `surface-elevated`);
2. garantir um alvo `<main id="conteudo">` estável nos layouts (raiz pública + raiz autenticada).

### 4.2 Token de foco `--ring` + utilitário padrão — ⚠️ inconsistente
Hoje há **8 variantes distintas** de focus-ring em uso (quantificado):

| Variante | Ocorrências |
|----------|-------------|
| `ring-interactive-focus` | 13 |
| `ring-[var(--ring)]` | 8 |
| `ring-ring` | 6 |
| `ring-[var(--color-brand-teal)]` | 3 |
| `ring-[var(--color-accent)]` | 2 |
| `ring-primary` / `ring-brand-primary` | 1 cada |

O preset define `--color-interactive-focus: #2b7a78` (= `brand-teal`) e
`--color-interactive-focus-ring: oklch(from #2b7a78 l c h / 0.4)`. A **Story 12.3 é infra de que
12.4/12.5 dependem**: consolidar `--ring` = `brand-teal` e padronizar o utilitário
`focus-visible:ring-2 ring-brand-teal/30 ring-offset-2` (sempre `:focus-visible`, nunca `:focus`).
Fazer **cedo** (a ordem 12-3 antes de 12-4/12-5 garante isso).

---

## 5. Tokens & baseline de contraste (Camada A)

### 5.1 Fonte real dos tokens
`packages/config/tailwind.preset.css` (bloco `@theme`, valores hex literais). Tokens relevantes:

```
brand-teal #2b7a78 · brand-teal-light #3aafa9 · brand-teal-dark #17252a
care-urgent #c1666b · care-attention #d4a24c · care-ok #7ba38a · care-neutral #8e8d8a
surface-base #fafaf8 · surface-elevated #ffffff · surface-sunken #f2f0ed
text-primary #17252a · text-secondary #5c5a57 · text-muted #8e8d8a · text-inverse #fafaf8
```

### 5.2 Resultado do baseline estático: **22/35 pares falham**
Matriz crua texto×superfície (WCAG 2.1, fórmula validada contra
`apps/web/src/lib/contrast-checker.ts`). Violações mais relevantes (ratio < 4.5:1 normal,
< 3:1 gráfico):

| Texto | Superfície | Ratio | Severidade |
|-------|-----------|-------|-----------|
| `text-muted` / `care-neutral` (#8e8d8a) | surface-* | 2.92–3.32 | **major** (texto secundário real) |
| `care-attention` (#d4a24c) | surface-* | 2.04–2.31 | **major** (âmbar tem contraste péssimo) |
| `text-inverse` (#fafaf8) | `care-attention` | 2.22 | **major** (texto branco sobre âmbar) |
| `care-ok` (#7ba38a) | surface-* | 2.48–2.82 | major |
| `brand-teal-light` (#3aafa9) | surface-* | 2.34–2.66 | major (se usado como texto) |
| `care-urgent` (#c1666b) | surface-* | 3.43–3.90 | major (badge / texto) |
| `brand-teal` (#2b7a78) | `surface-sunken` | 4.44 | minor (limítrofe) |

**Triagem necessária (importante — a matriz crua superconta):** as cores `care-*` são usadas
predominantemente como **fundo de badge com ícone + texto** (o AC do semáforo exige que a cor
nunca seja o único indicador), não como texto pequeno. Cada par precisa ser confirmado no uso
real antes de virar correção. Mas confirma-se: **o trabalho de contraste da 12-3 é substantivo**,
em especial o âmbar `care-attention` (#d4a24c) e o `text-inverse` sobre âmbar. Este número (22)
é a "fotografia antes" da dimensão contraste; a 12-6 mede o "depois".

---

## 6. Dependências a adicionar (Story 12.6)

| Dep | Estado | Nota |
|-----|--------|------|
| `jest-axe` | ✅ já em `apps/web` e `packages/ui` (`^10`) | sem uso ainda — 12.3/12.4/12.5 passam a usar |
| `@axe-core/playwright` | ❌ adicionar | usado pela 12.1 (baseline) e 12.6 (gate). Instalar já na 12.1 |
| `color2k` | ❌ adicionar | tree-shakeable, preferido a `wcag-contrast`; usado pelo `scripts/check-contrast.ts` |

Ao adicionar dep: `pnpm install` + commit do `pnpm-lock.yaml` (regra do KICKOFF).

---

## 7. Story 12.6 (gate permanente) — observações e reuso

- Vai **por último** (depois das correções 12-1..12-5), senão o gate falha de imediato.
- **Reuso:** `apps/web/src/lib/contrast-checker.ts` já exporta `relativeLuminance`,
  `contrastRatio`, `checkBrandContrast` (WCAG 2.1, criado na Story 11-2 p/ brand do tenant). O
  novo `scripts/check-contrast.ts` pode reusar essa fórmula **ou** usar `color2k` (preferência do
  KICKOFF). Recomendação: usar `color2k` no CLI para consistência com a dep nova, mantendo o
  `contrast-checker.ts` como utilitário de runtime (são contextos distintos: app vs. script CI).
- O gate roda **`scripts/check-contrast.ts`** + **`@axe-core/playwright`** nas páginas-chave; é
  permanente (não limitado ao Epic 12); path filter cobre `packages/config/**`, `packages/ui/**`,
  `apps/web/src/**`, `scripts/check-contrast.ts`; lista de páginas extensível via `a11y-pages.json`.

---

## 8. Ordem & estratégia de execução (confirmada)

`12-1 → 12-2 → 12-3 → 12-4 → 12-5 → 12-6`, sequencial, **uma story por vez** via `/feature-00c`.
Short-names: `a11y-teclado-publico`, `a11y-teclado-autenticado`, `a11y-contraste-focus`,
`a11y-touch-motion`, `a11y-formularios`, `a11y-ci-gate`.

Razão: 12-1 estabelece infra global (skip-nav, `<main>`) + baseline E2E; 12-3 define tokens de
foco/contraste de que 12-4/12-5 dependem; 12-6 trava o resultado por último. **Toda story entra
por feature-branch → PR → CI verde → squash-merge** (nunca push direto em `dev`; auditar o git
real após cada "concluído").

---

## 9. Discrepâncias spec ↔ realidade — correções a aplicar nas stories

1. **[12.6] `--tokens-path` aponta para `.ts`, mas a fonte é `.css`.** O AC diz default
   `packages/config/tailwind.preset.ts`; o arquivo real é **`packages/config/tailwind.preset.css`**
   (bloco `@theme`). O `scripts/check-contrast.ts` deve **parsear CSS** (e tratar o valor
   `oklch(from #2b7a78 …)` do `--color-interactive-focus-ring`), com default apontando para o
   `.css`.
2. **[12.1] `prisma generate` do root falha.** Documentar `pnpm --filter @metanoia/api exec
   prisma generate` no passo de validação local (ver §1.3).
3. **[12.1] `@axe-core/playwright` deve ser instalado na 12.1** (não só na 12.6), senão o
   baseline E2E (Sub-task 0) não roda. A 12.6 reusa o mesmo dep para o gate.

Itens menores (não bloqueiam, corrigir no fluxo): inconsistências de acentuação no
`pt-BR.json` (ex.: linha ~15 `"E-mail invalido"` sem acento vs. `"E-mail inválido"` em outras
chaves) — alvo natural da 12-5, que centraliza mensagens de erro no i18n.

---

## 10. Escopo — fora deste épico

**Screen reader testing (VoiceOver/NVDA/JAWS, NFR-A4) = Release 2 / Épico 15.** Não fazer aqui.
Este épico cobre keyboard nav (12-1/12-2), contraste & focus (12-3), touch/motion (12-4),
formulários acessíveis (12-5) e CI gates (12-6).

---

## 11. DoD transversal — plano de medição

| Dimensão | Antes (baseline) | Depois (final) | Onde |
|----------|------------------|----------------|------|
| Contraste de tokens | **22/35 pares falham** (§5.2) | `scripts/check-contrast.ts` exit 0 | 12-3 corrige, 12-6 mede |
| axe-core E2E (páginas-chave) | gerado na 12.1 Sub-task 0 | gate verde no CI | 12-1 baseline, 12-6 gate |
| Skip-nav / focus-trap / keyboard | ausente / não validado | E2E `page.keyboard` passa | 12-1/12-2 |
| Formulários (aria/i18n) | mensagens parciais, alguns hardcoded | jest-axe + E2E aria | 12-5 |

Relatório final de auditoria (issues encontradas / corrigidas / aceitas como tech debt R2) +
comparação **baseline vs. final** a ser produzido no fechamento do épico.

---

## 12. Riscos & flakes conhecidos (épicos anteriores)

- Cache-miss turbo/prisma; `registry-1.docker.io deadline` em E2E → `gh run rerun --failed`.
- `gh pr merge` 401 intermitente → retry 3–4x.
- **Não aceitar push direto em `dev`** (`ci.yml` só dispara em `pull_request [main, dev]`).
- Subir stack de teste sem o serviço LiveKit (colisão de porta 7881 com a prod; irrelevante p/ a11y).

---

_Reconciliação concluída. Aguardando revisão humana antes de disparar
`/feature-00c a11y-teclado-publico`._
