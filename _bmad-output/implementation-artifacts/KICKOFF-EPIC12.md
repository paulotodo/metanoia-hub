# KICKOFF — Epic 12 (Hardening de Acessibilidade & Qualidade UX) via cstk

> Prompt de arranque para **sessão limpa**. Copie o bloco "PROMPT PARA COLAR"
> no fim. Contexto e sondagens documentados aqui para auditoria.
> Gerado 2026-06-16 com Épicos 1-11 fechados (dev `193d190`, sincronizada com origin).

---

## Contexto da onda

- Projeto: `metanoia-hub`, trabalhar em `/var/lib/metanoia-hub` (VPS). Branch `dev` em
  `193d190`, sincronizada com origin. GitHub = fonte de verdade; credencial git já
  configurada com escrita.
- Épicos 1-11 = `done` e reconciliados no `sprint-status.yaml` (11-4 entregue via cstk
  `/feature-00c`, fechada na reconciliação `193d190`).
- A **stack de produção já está no ar** nesta VPS (`docker-compose.prod.yml`, projeto
  `metanoia-prod`, domínios `*.metanoia-hub.todo-tips.com`, atrás do Traefik do Swarm).
  **NÃO mexer** nos containers em execução nem nas stacks alheias do Swarm — o trabalho do
  épico é no repo (código + PRs); redeploy só sob pedido explícito.
- Epic 12 = **6 stories** (todas `ready-for-dev`), NFRs **A1, A2, A3**:
  - **12-1** Navegação por Teclado — Fluxos Públicos & Infraestrutura (NFR-A1) — `a11y-teclado-publico`
  - **12-2** Navegação por Teclado — Fluxos Autenticados (NFR-A1) — `a11y-teclado-autenticado`
  - **12-3** Contraste WCAG AA & Focus Visible (NFR-A2, UX-DR19) — `a11y-contraste-focus`
  - **12-4** Touch Targets, Reduced Motion & Mobile Feedback (NFR-A2, UX-DR19) — `a11y-touch-motion`
  - **12-5** Formulários Acessíveis (NFR-A3) — `a11y-formularios`
  - **12-6** Teste Automatizado de Contraste & axe-core Quality Gate no CI (UX-DR21) — `a11y-ci-gate`
- Fonte autoritativa: `_bmad-output/planning-artifacts/epics/epic-12.md` (271 linhas, 6 stories com ACs).
- **DoD transversal:** relatório de auditoria documentado (issues encontradas, corrigidas, e
  aceitas como tech debt p/ R2) + **report axe-core baseline (antes) vs. final (depois)** para
  medir progresso.

## 🚦 Escopo — o que ESTE épico NÃO cobre

Screen reader testing (VoiceOver/NVDA/JAWS, NFR-A4) é **Release 2 / Épico 15** — NÃO fazer aqui.
Este épico cobre **keyboard nav, contraste visual, formulários e CI gates**. Stakeholders cientes
de que acessibilidade "completa" inclui R2.

## Sondagens pré-flight (faça você mesmo antes de disparar)

Crie uma **RECONCILIACAO-EPIC12** (mesmo ritual dos épicos 9-11) commitando o resultado, cobrindo:

1. **Baseline axe-core (Sub-task 0 da 12-1):** rodar axe-core em todos os fluxos públicos E
   autenticados ANTES de qualquer correção; gerar report baseline e guardá-lo. Comparar com o
   report final (DoD transversal). Páginas-chave: login, dashboard (radar), groups list, trail detail.
2. **Componentes base usam Radix (acessíveis por padrão)** → focar em **gaps de integração**,
   validação manual e quality gates; não reconstruir o que o Radix já entrega (ex.: Dialog faz
   focus-trap nativo — o AC só valida que funciona em 3+ modais distintos).
3. **Infra compartilhada a construir cedo (alimenta as demais stories):**
   - skip-navigation global;
   - variável CSS `--ring` do tema shadcn = `brand-teal` + utilitário
     `focus-visible:ring-2 ring-brand-teal/30 ring-offset-2` (Story 12.3 é infra de que 12.4/12.5
     dependem — fazer os tokens de foco/contraste cedo).
4. **Deps a adicionar:** `@axe-core/playwright` e `color2k` (Story 12.6; `color2k` é tree-shakeable
   e mantido, preferido a `wcag-contrast`). `jest-axe` **já existe** no `apps/web`. Ao adicionar
   dep: `pnpm install` + commitar `pnpm-lock.yaml`.
5. **Story 12.6 cria um QUALITY GATE PERMANENTE no CI** (script de contraste com `color2k` +
   `@axe-core/playwright` nas páginas-chave) — não é limitado ao Epic 12. Vai por **ÚLTIMO**, depois
   que as correções das 12-1..12-5 estiverem no lugar (senão o gate falha).

## Ordem & estratégia de execução

- **Sequencial: 12-1 → 12-2 → 12-3 → 12-4 → 12-5 → 12-6.** Razão: 12-1 estabelece infra global +
  baseline; 12-3 define tokens de foco/contraste de que 12-4/12-5 dependem; 12-6 (gate permanente)
  por último para travar o resultado. Confirme/ajuste na RECONCILIACAO.
- Executar **via cstk `/feature-00c` por story** (padrão provado nos épicos 8-11), short-names
  acima. State de cada story em `.claude/feature-00c-state/<short>/`.
- Se a sessão cair: `/feature-00c-resume <short>`. Se `.lock` órfão e stale, `rmdir` antes de
  readquirir (atenção: `state-lock.sh check` tem **semântica invertida** — exit 0 = LIVRE;
  `current_stage` é top-level no `state.json`).

## 🚨 GUARDRAILS CI (regra crítica — lição da 8-10; memória `feedback_feature00c_direct_push_dev_bypasses_ci`)

- **NUNCA aceitar push direto em `dev`.** O `ci.yml` só dispara em `pull_request` para `[main, dev]`
  → push direto = CI **nunca** roda. Toda story entra por **feature-branch → PR → CI verde →
  squash-merge**. Após cada "concluído" do feature-00c, **auditar o git real**: entrou via PR squash
  `(#NNN)`? Se foi commit direto em `dev`, recuperar via PR limpo (reset `dev`→`commit~1` +
  `--force-with-lease`, mover p/ feature-branch, PR, CI, squash).
- **⚠️ AMBIENTE (diferente da máquina WSL antiga):** o **`gh` CLI NÃO está instalado nesta VPS**.
  Instalá-lo (ou usar a API REST do GitHub com o token já configurado) **antes** de começar, senão
  não há como abrir/mergear PRs.
- **Validar localmente o que o CI roda ANTES de declarar done:** `pnpm exec prisma generate &&
  pnpm turbo build && pnpm turbo lint` (lint usa `--max-warnings 0`). **`jest-axe` e
  `@axe-core/playwright` são gates REAIS de a11y** deste épico — rodar os specs de acessibilidade
  localmente. Após migration/dep: `pnpm install` + commit `pnpm-lock.yaml`.
- Flakes conhecidos (épicos anteriores): cache-miss turbo/prisma, `registry-1.docker.io deadline`
  em E2E → `gh run rerun --failed`; `gh pr merge` 401 → retry 3-4x.

## Convenções (ver `CLAUDE.md` + `docs/project-context.md`)

- Código/logs/comentários em **inglês**; texto ao usuário em **PT-BR** com **vocabulário pastoral**
  (`apps/web/messages/pt-BR.json`). **Mensagens de erro de formulário vêm do i18n, não hardcoded**
  (relevante p/ 12-5).
- TS `strict`; multi-tenant RLS (`tenant_id` em toda tabela, **nunca** como parâmetro —
  AsyncLocalStorage/`withTenantTx`); UUID v7 (`generateId()`); datas ISO 8601; nulls explícitos.
- `useMutation` FE: `useMutation<undefined, Error, T>`, mutationFn async com await + `return undefined`.
- Contratos Zod em `packages/types` + snapshot. `ZodValidationPipe` custom. Conventional commits PT-BR.

## Fechamento

Ao mergear as 6 stories: marcar `12-1..12-6` `done` + `epic-12: done` no `sprint-status.yaml`
(commit `docs(planning)` direto em `dev` é OK — convenção do repo p/ planning-artifacts, não toca
build/lint/test). Rodar `epic-12-retrospective` (optional). Atualizar memória. Produzir o relatório
de auditoria final (axe-core baseline vs. final) exigido pelo DoD transversal.

---

## PROMPT PARA COLAR (sessão limpa)

```
Quero desenvolver o Epic 12 (Hardening de Acessibilidade & Qualidade UX) do metanoia-hub
via pipeline cstk /feature-00c, UMA story por vez. Trabalhe em /var/lib/metanoia-hub (VPS).

ESTADO: branch dev em 193d190, sincronizada com origin (GitHub = fonte de verdade; credencial git
já configurada com escrita). Épicos 1-11 done e reconciliados. A stack de produção JÁ está no ar
nesta VPS (docker-compose.prod.yml, projeto metanoia-prod, domínios *.metanoia-hub.todo-tips.com) —
NÃO mexa nos containers em execução nem nas stacks alheias do Swarm; o trabalho é no repo (código +
PRs); redeploy só se eu pedir.

Antes de disparar, faça a sondagem pré-flight e commite uma RECONCILIACAO-EPIC12 seguindo TODAS as
instruções de _bmad-output/implementation-artifacts/KICKOFF-EPIC12.md (baseline axe-core; Radix já
acessível → focar gaps; infra de foco/contraste --ring=brand-teal que 12.4/12.5 dependem; deps novas
@axe-core/playwright e color2k; 12.6 = quality gate permanente no CI por último; screen reader é R2,
fora de escopo). Fonte autoritativa das stories: _bmad-output/planning-artifacts/epics/epic-12.md.

REGRA CRÍTICA: NUNCA aceitar push direto em dev — ci.yml só roda em pull_request [main, dev]. Toda
story entra por feature-branch → PR → CI verde → squash-merge. ⚠️ O gh CLI NÃO está instalado nesta
VPS: instale-o (ou use a API REST do GitHub) antes de começar. Após cada "concluído" do feature-00c,
audite o git real e, se houve commit direto em dev, recupere via PR limpo. Valide local
(pnpm exec prisma generate && pnpm turbo build && pnpm turbo lint; jest-axe e @axe-core/playwright
são gates reais) antes de declarar done.

Execute na ordem 12-1 → 12-2 → 12-3 → 12-4 → 12-5 → 12-6 com short-names a11y-teclado-publico,
a11y-teclado-autenticado, a11y-contraste-focus, a11y-touch-motion, a11y-formularios, a11y-ci-gate.
Se a sessão cair, retome com /feature-00c-resume <short> (remova .lock órfão com rmdir se stale;
state-lock.sh check tem semântica invertida = exit 0 é LIVRE; current_stage é top-level no state.json).
Ao fechar as 6, marque epic-12: done no sprint-status.yaml, rode epic-12-retrospective e produza o
relatório de auditoria axe-core (baseline vs final). Atualize a memória.

Comece pela sondagem pré-flight + RECONCILIACAO-EPIC12 (incluindo o baseline axe-core e a checagem/
instalação do gh CLI). Só dispare /feature-00c a11y-teclado-publico depois de eu revisar a reconciliação.
```
