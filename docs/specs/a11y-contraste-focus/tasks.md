# Backlog de Tarefas: a11y-contraste-focus — Contraste WCAG AA + Focus-ring (Story 12.3)

> Spec autoritativa: `docs/specs/a11y-contraste-focus/spec.md`
> Plan: `docs/specs/a11y-contraste-focus/plan.md`
> Decisões chave: dec-006 (Opção B: hex care-* intocado, trocar classes), dec-007 (dark já passa), dec-008 (codemod semi-auto), dec-018 (CHK014 resolvido), dec-020 (CHK025: ring-primary migrado via codemod)
>
> **CHK014 [Conflict] RESOLVIDO (dec-018):** FR-03 refere-se a `text-muted` como texto de
> leitura nos componentes marketing/ (home). A decisão dec-006 (Opção B) é ortogonal: mantém
> os hex dos tokens care-* e exige `text-primary` como texto interno de badges. Hex
> `--color-text-muted` NÃO é alterado. Tasks distinguem: (A) badges → classes; (B) home → classes.
>
> **CHK025 [Gap] RESOLVIDO (dec-020):** ring-primary tem 14 ocorrências, todas em foco de
> navegação padrão (sem semântica especial). Incluídas no codemod C2 (task 3.2).
>
> **Gate local antes de done:** `pnpm --filter @metanoia/api exec prisma generate && pnpm turbo build && pnpm turbo lint --max-warnings 0`

## Legenda de Criticidade

- `[C]` Critical — bloqueia PR (WCAG AA obrigatório ou CI quebrado)
- `[A]` Alta — entrega incompleta sem este item
- `[M]` Média — qualidade/cobertura, mas não bloqueia PR imediatamente
- `[B]` Baixa — melhoria incremental, pode seguir em PR separado

## Legenda de Eixo

- **EIXO-A** — Tokens care-* (anotações no preset, correção de classes em badges)
- **EIXO-B** — axe-baseline debt (home color-contrast + login link-in-text-block)
- **EIXO-C** — Focus-ring (codemod + casos manuais + lint guardian)
- **EIXO-D** — Cobertura CI (script de tokens + E2E axe + jest-axe)

---

## Matriz de Dependências

```
EIXO-A (Task 1) → EIXO-D/T3 (jest-axe badges, Task 4.2)
EIXO-B (Task 2) → EIXO-D/T4 (E2E axe, Task 4.3)
EIXO-C (Task 3) → EIXO-D/T2 (jest-axe componentes, Task 4.2); CI lint guardian (3.4)
EIXO-D/D1 (Task 4.1) → independente; roda em CI após merges de A/B/C
EIXO-D/D2 (Task 4.3) → depende de B (rotas públicas corrigidas)
EIXO-D/D3 (Task 4.2) → depende de A e C (tokens/classes corrigidos)
Task 0.1 (dry-run codemod) → prerrequisito de Task 3.2 e 3.3
```

## Resumo de Escopo

**Coberto:** correção de classes/uso de tokens de contraste (care-*, text-muted, meeting-card,
post-meeting-report), link forgot-password underline, padronização focus-ring codemod (ring-*
→ ring-brand-teal/30 incluindo ring-primary), lint guardian CI, script check-contrast-tokens.mjs,
jest-axe em Button/Input/Select/Checkbox/Link/Radio/Tab, E2E axe rotas públicas.

**Excluído:** alteração de qualquer valor hex em tailwind.preset.css ou tokens.css (dec-006/007),
componentes care-* dedicados com ícone+texto (pós-Epic 7 / FR-10), rotas autenticadas no E2E
axe sem route-interception existente (fora de escopo desta story).

---

## FASE 0 — Preparação e Sondagem

### 0.1 Executar dry-run do codemod focus-ring e catalogar casos manuais `[C]`

Ref: spec §US-3/SC-3.3, plan §C2/C3, CHK008, CHK020

Pré-requisito de todas as tasks do EIXO-C. Cria `apps/web/scripts/codemod-focus-ring.mjs`
e produz relatório de casos que precisam de revisão manual.

**Arquivos:**
- `apps/web/scripts/codemod-focus-ring.mjs` (criar)

**Subtarefas:**
- [ ] 0.1.1 Criar `apps/web/scripts/codemod-focus-ring.mjs` com modo `--dry-run` e `--apply`
  - Substituições automatizadas (SEM revisão manual):
    - `ring-interactive-focus` → `ring-brand-teal/30` (38× detectadas)
    - `ring-ring` → `ring-brand-teal/30` (21× detectadas)
    - `ring-[var(--ring)]` → `ring-brand-teal/30`
    - `ring-[var(--color-brand-teal)]` → `ring-brand-teal/30`
    - `ring-primary` → `ring-brand-teal/30` (14× detectadas — dec-020: CHK025 resolvido)
  - Preservar (NÃO substituir, lista de exclusão hardcoded no script):
    - `ring-red-500` / `ring-red-*` (semântica de erro/destrutivo)
    - `ring-brand-primary/30` (estado selecionado em wizard, não foco)
    - `ring-blue-500` (revisar manualmente antes de decidir)
  - Suporte a linhas com múltiplas classes (CHK008/CHK020): o script aplica substituições por
    token, não por linha — seguro para múltiplas variantes na mesma className
- [ ] 0.1.2 Executar `node apps/web/scripts/codemod-focus-ring.mjs --dry-run` e capturar saída
- [ ] 0.1.3 Revisar relatório dry-run: confirmar lista de arquivos afetados e identificar
  qualquer caso adicional com cor semântica não prevista
- [ ] 0.1.4 Para cada caso ambíguo detectado no dry-run: registrar decisão explícita
  (substituir ou preservar) antes de aplicar `--apply`

**Critério de aceite:**
- Script `codemod-focus-ring.mjs` existe e executa sem erro em dry-run
- Relatório lista todos os arquivos com substituições planejadas
- Casos de exclusão (ring-red-500, ring-brand-primary/30) NÃO aparecem como candidatos no relatório
- Nenhuma linha com múltiplas variantes gera substituição parcial incorreta

**Dependências:** nenhuma

---

## FASE 1 — EIXO-A: Tokens care-* (Anotações e Correção de Classes)

### 1.1 Adicionar comentários de restrição de uso nos arquivos de tokens `[A]`

Ref: spec §FR-04/FR-05/FR-06, plan §A/Eixo-A, US-2

**Arquivos:**
- `packages/config/tailwind.preset.css`
- `packages/ui/styles/tokens.css`

**Subtarefas:**
- [ ] 1.1.1 Em `packages/config/tailwind.preset.css`, adicionar comentários acima de cada token:
  ```css
  /* care-attention #d4a24c: contraste 2.22:1 sobre surface — NÃO usar como texto.
     Uso permitido: FUNDO de badge com texto interno text-primary (#17252a = 6.80:1 PASS).
     Cor nunca é único indicador (ícone+texto obrigatório, WCAG 1.4.1). */
  --color-care-attention: #d4a24c;

  /* care-ok #7ba38a: contraste 2.70:1 sobre surface — NÃO usar como texto.
     Uso permitido: FUNDO de badge com texto interno text-primary (#17252a = 5.58:1 PASS). */
  --color-care-ok: #7ba38a;

  /* brand-teal-light #3aafa9: contraste 2.55:1 sobre surface — NÃO usar como texto;
     apenas fundo/decorativo. */
  --color-brand-teal-light: #3aafa9;
  ```
- [ ] 1.1.2 Em `packages/ui/styles/tokens.css`, espelhar os mesmos comentários nos tokens
  correspondentes do bloco `.dark` (confirmar que dark já passa — dec-007; comentar rationale)
- [ ] 1.1.3 Verificar que `--color-text-muted` (#8e8d8a) NÃO recebe alteração de valor hex
  (dec-018/dec-006: hex intocado; apenas uso via classes é corrigido nas tasks seguintes)

**Critério de aceite:**
- `grep -A1 'care-attention' packages/config/tailwind.preset.css` exibe o comentário de restrição
- `grep -A1 'care-ok' packages/config/tailwind.preset.css` idem
- `grep -A1 'brand-teal-light' packages/config/tailwind.preset.css` idem
- Hex values dos tokens são idênticos antes e após o commit

**Dependências:** nenhuma

---

### 1.2 Corrigir `meeting-card.tsx`: `text-white` → `text-primary` em badge care-ok `[C]`

Ref: spec §US-2/US-4, plan §Eixo-A (Correção de uso real), CHK014 (dec-018)

**Arquivos:**
- `apps/web/src/components/meetings/meeting-card.tsx` (linha ~80)

**Subtarefas:**
- [ ] 1.2.1 Localizar o botão com `bg-care-ok ... text-white` (linha ~80)
- [ ] 1.2.2 Substituir `text-white` → `text-primary` nesse elemento
  (text-primary #17252a sobre care-ok #7ba38a = 5.58:1 PASS)
- [ ] 1.2.3 Verificar visualmente que o contraste do botão "join meeting" está legível
  e que text-primary (#17252a escuro) sobre fundo verde care-ok é aceitável esteticamente
- [ ] 1.2.4 Se `STATUS_CLASSES` usa `text-care-ok` / `text-care-attention` como texto
  (linhas 13-16), avaliar: se é texto de leitura em destaque de status, trocar para
  `text-secondary`; se é apenas classe de cor de ícone decorativo, pode manter com
  documentação. Registrar decisão explícita.

**Critério de aceite:**
- `grep -n 'bg-care-ok.*text-white\|text-white.*bg-care-ok' meeting-card.tsx` retorna 0 resultados
- Teste jest-axe da task 4.2 (badge care-ok) passa com 0 violações

**Dependências:** 0.1 (dry-run para verificar se codemod afeta este arquivo)

---

### 1.3 Corrigir `post-meeting-report.tsx`: `text-care-ok`/`text-care-attention` como texto `[C]`

Ref: spec §US-2/US-4, plan §Eixo-A (post-meeting-report.tsx:125,131), CHK014 (dec-018)

**Arquivos:**
- `apps/web/src/components/meetings/post-meeting-report.tsx` (linhas ~125, ~131, ~137)

**Subtarefas:**
- [ ] 1.3.1 Inspecionar contexto de uso das classes `text-care-ok` (linha ~125),
  `text-care-attention` (linha ~131), `text-care-alert` (linha ~137 e ~40)
- [ ] 1.3.2 Para cada uso como texto de leitura (ex: `<dd className="text-base font-medium text-care-ok">`):
  - Opção preferida: trocar para `text-secondary` (semântica neutra, 6.58:1 PASS) +
    manter o ícone care-* como indicador visual de semântica
  - Alternativa: envolver em badge com `bg-care-ok text-primary` se o contexto exigir
    destaque colorido
- [ ] 1.3.3 Para `text-care-alert` / `text-sm text-care-alert` (linha ~40 — mensagem de erro):
  Avaliar ratio de `care-alert` sobre surface. Se < 4.5:1, trocar para `text-destructive`
  (ou cor de erro que passe). Registrar decisão com ratio calculado.
- [ ] 1.3.4 Garantir que ícone/label ainda identifica semanticamente o status após a troca
  (cor não é único indicador — WCAG 1.4.1)

**Critério de aceite:**
- `grep -n 'text-care-ok\|text-care-attention' post-meeting-report.tsx` retorna 0 resultados
  em usos de texto de leitura (OK se permanecer em ícone ou em badge com texto-primary)
- Teste jest-axe de badge/status (task 4.2) passa com 0 violações

**Dependências:** 1.1

---

## FASE 2 — EIXO-B: axe-baseline Debt (Home + Login)

### 2.1 Corrigir `color-contrast` na home-marketing (`/`) `[C]`

Ref: spec §US-1/FR-01/FR-03, plan §B1, testes T1/T4

**CHK014 CONTEXTO:** dec-018 confirma que FR-03 refere-se a este caso (text-muted como texto de
leitura em marketing/), NÃO a alteração do hex --color-text-muted.

**Arquivos:**
- `apps/web/src/components/marketing/hero-section.tsx` (linha ~13)
- `apps/web/src/components/marketing/persona-blocks.tsx` (linha ~27)
- `apps/web/src/components/marketing/feature-blocks.tsx` (linha ~27)
- `apps/web/src/components/marketing/feature-grid.tsx` (linha ~46)
- `apps/web/src/components/marketing/faq-accordion.tsx` (linhas ~29, ~34)
- `apps/web/src/components/marketing/blog-list.tsx` (linha ~42)
- `apps/web/src/components/marketing/marketing-footer.tsx` (linhas ~33, ~42, ~66)
- `apps/web/src/components/marketing/marketing-nav.tsx` (linha ~36)

**Subtarefas:**
- [ ] 2.1.1 Substituir `text-[var(--color-text-muted)]` → `text-secondary` em todos os textos
  de LEITURA dos arquivos acima (onde seja corpo de texto, legendas, labels)
  - `text-secondary` (#5c5a57) = 6.58:1 sobre surface-base (#fafaf8) — PASS
  - Verificar que a substituição não quebra layouts (text-secondary é mais escuro)
- [ ] 2.1.2 Exceção: manter `text-muted` (ou equivalente decorativo) apenas em elementos
  NÃO-textuais (ex: ícone `+` do FAQ toggle em `faq-accordion.tsx:29`). Documentar exceções.
- [ ] 2.1.3 Para `hero-section.tsx:13` (subtítulo principal — texto grande): verificar se
  texto grande com ratio ≥ 3:1 é suficiente (WCAG AA para texto grande ≥ 18pt/14pt-bold).
  Se 3.18:1 for suficiente para texto grande, pode manter muted com comentário. Registrar ratio+decisão.
- [ ] 2.1.4 Para `marketing-footer.tsx` e `marketing-nav.tsx` (links): se o axe reporta
  `link-in-text-block`, adicionar `underline underline-offset-2` além de trocar cor
- [ ] 2.1.5 Rodar `pnpm turbo build && pnpm turbo lint --max-warnings 0` para garantir sem regressão

**Critério de aceite:**
- `grep -rn 'text-\[var(--color-text-muted)\]' apps/web/src/components/marketing/` retorna 0
  resultados em contextos de texto de leitura
- E2E axe `contrast-focus.e2e-spec.ts` na rota `/`: 0 violações `color-contrast` (task 4.3)

**Dependências:** nenhuma (independente do codemod focus-ring)

---

### 2.2 Corrigir link "Esqueceu a senha?" em `/login` (link-in-text-block) `[C]`

Ref: spec §US-1/FR-02, plan §B2, teste T5

**Arquivos:**
- `apps/web/app/(public)/login/_components/login-form.tsx` (linha ~145)
- `apps/web/app/(public)/login/__tests__/login-forgot-link.spec.tsx` (estender)

**Subtarefas:**
- [ ] 2.2.1 Localizar o elemento do link "Esqueceu a senha?" em `login-form.tsx:145`
- [ ] 2.2.2 Adicionar `underline underline-offset-2` ao `className` do link (torna distinguível
  sem depender de cor — resolve WCAG 1.4.1 / link-in-text-block)
- [ ] 2.2.3 Verificar i18n: o texto é servido via `t.forgotPassword` — não alterar o valor
  de tradução em `apps/web/messages/pt-BR.json`
- [ ] 2.2.4 Estender `login/__tests__/login-forgot-link.spec.tsx` (ou criar se não existir):
  asserir que o link possui `underline` no className e contraste adequado via jest-axe

**Critério de aceite:**
- `grep 'underline' apps/web/app/(public)/login/_components/login-form.tsx` confirma presença
- E2E axe `contrast-focus.e2e-spec.ts` na rota `/login`: 0 violações `link-in-text-block` (task 4.3)
- Teste unitário `login-forgot-link.spec.tsx` passa

**Dependências:** nenhuma

---

## FASE 3 — EIXO-C: Focus-ring (Codemod + Casos Manuais + Lint Guardian)

### 3.1 Confirmar e documentar `--ring` em globals.css `[A]`

Ref: spec §US-3/SC-3.1, plan §C1/FR-07

**Arquivos:**
- `packages/ui/styles/globals.css` (linha ~43)

**Subtarefas:**
- [ ] 3.1.1 Confirmar que `--ring` aponta para `brand-teal` (via `var(--color-interactive-focus-ring)`)
- [ ] 3.1.2 Adicionar comentário inline documentando o padrão canônico:
  ```css
  /* --ring: token shadcn canonical de focus-ring. Aponta para brand-teal (#2b7a78 = 5.05:1 PASS).
     Padrão canônico de uso: focus-visible:outline-none focus-visible:ring-2
     focus-visible:ring-brand-teal/30 focus-visible:ring-offset-2 */
  --ring: var(--color-interactive-focus-ring);
  ```
- [ ] 3.1.3 Se `--ring` NÃO apontar para brand-teal: corrigir o valor antes das tasks seguintes
  (bloqueia 3.2 e 4.2)

**Critério de aceite:**
- `grep -A2 '\-\-ring' packages/ui/styles/globals.css` mostra brand-teal como valor efetivo
- Comentário canônico presente

**Dependências:** nenhuma

---

### 3.2 Aplicar codemod focus-ring (substituição automatizada) `[C]`

Ref: spec §US-3/SC-3.2/SC-3.3, plan §C2/FR-08, CHK025 (dec-020)

**CHK025 CONTEXTO:** `ring-primary` incluído no codemod (dec-020): 14 ocorrências, todas foco de
navegação padrão em páginas autenticadas. Equivalência: ring-primary → --ring → brand-teal.
Nenhum caso é semântico especial.

**Arquivos principais (conforme dry-run de 0.1):**
- `packages/ui/components/input.tsx`, `dialog.tsx`, `sidebar.tsx`, `bottom-tabs.tsx`, `button.tsx`
- `apps/web/src/components/forms/password-input-with-toggle.tsx`, `day-of-week-select.tsx`, `terms-checkbox.tsx`
- `apps/web/src/components/catalog/*`, `groups/*`, `meetings/*`, `onboarding/*`, `content/*`, `search/*`, `tenant/*`, `trails/*`
- `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/grupo-client.tsx`
- `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/_components/back-link.tsx`
- `apps/web/app/(authenticated)/app/admin/igreja/grupos/[groupId]/_components/drill-error-state.tsx`
- `apps/web/app/(authenticated)/app/admin/igreja/vista/_components/vista-empty-state.tsx`
- `apps/web/app/(authenticated)/app/admin/igreja/vista/_components/vista-error-state.tsx`
- `apps/web/app/(authenticated)/app/admin/igreja/vista/_components/vista-filter-bar.tsx`
- `apps/web/app/(authenticated)/app/admin/igreja/vista/_components/group-card.tsx`
- `apps/web/app/(authenticated)/app/admin/igreja/lideres/[leaderId]/_components/outreach-intent-form.tsx`
- `apps/web/src/components/content/trail-card.tsx` (focus-within:ring-primary → focus-within:ring-brand-teal/30)

**Subtarefas:**
- [ ] 3.2.1 Aplicar `node apps/web/scripts/codemod-focus-ring.mjs --apply` (após dry-run de 0.1)
- [ ] 3.2.2 Verificar que `ring-red-500` (delete-group-dialog.tsx:106) NÃO foi alterado
- [ ] 3.2.3 Verificar que `ring-brand-primary/30` (OnboardingWizard.tsx:181) NÃO foi alterado
- [ ] 3.2.4 Para linhas com múltiplas classes de ring (CHK008): verificar que apenas a classe de
  focus-ring foi substituída, sem duplicação ou remoção de outras classes
- [ ] 3.2.5 Rodar `pnpm turbo build && pnpm turbo lint --max-warnings 0`

**CHK011 — Lint guardian (integrado nesta task):**
- [ ] 3.2.6 Adicionar regra ESLint ou script de guarda em CI para impedir novas ocorrências de
  `ring-interactive-focus`, `ring-ring`, `ring-[var(--ring)]`, `ring-[var(--color-brand-teal)]` e
  `ring-primary` em novos arquivos. Opções:
  - Script `check-focus-ring-variants.sh` rodando `grep -rn 'ring-interactive-focus\|ring-ring\|ring-\[var(--ring' ...`
    com exit 1 se > 0 resultados (exceto comentários)
  - OU regra ESLint `no-restricted-syntax` com regex (se ESLint cobre classNames)
  - Preferir script Bash (determinístico, sem dependência ESLint de análise de className)
- [ ] 3.2.7 Adicionar o script guardião ao job `lint` do `.github/workflows/ci.yml`
  (sem alterar env de produção — conforme SC-5.5 do plan)

**Critério de aceite:**
- `grep -rn 'ring-interactive-focus\|ring-\[var(--ring\|ring-ring\|ring-primary' apps/web/src/ packages/ui/` retorna 0 resultados
  (exceto em comentários e nos casos preservados: ring-red-500, ring-brand-primary/30)
- Build e lint passam sem warnings
- Script guardião existe e retorna exit 1 em teste com string proibida

**Dependências:** 0.1 (dry-run concluído e casos manuais catalogados), 3.1

---

### 3.3 Revisar e tratar casos manuais do focus-ring `[A]`

Ref: spec §SC-3.3/NC-3, plan §C3, CHK008

**Arquivos:**
- `apps/web/src/components/groups/delete-group-dialog.tsx` (linha ~106)
- `apps/web/src/components/onboarding/wizard/OnboardingWizard.tsx` (linha ~181)

**Subtarefas:**
- [ ] 3.3.1 `delete-group-dialog.tsx:106` — `ring-red-500` (ação destrutiva):
  - Confirmar que é `focus-visible:ring-red-500` (foco semântico de ação destrutiva)
  - Calcular contraste de red-500 (#ef4444) sobre fundos usados: verificar ≥ 3:1 (WCAG 1.4.11)
  - Se passa: manter e documentar com comentário `/* PRESERVADO: semântica destrutiva */`
  - Se falha: trocar para `ring-destructive` ou ajustar shade de red que passe
- [ ] 3.3.2 `OnboardingWizard.tsx:181` — `ring-brand-primary/30` (estado selecionado, não foco):
  - Confirmar que é `ring-brand-primary/30` aplicado em estado selecionado (step ativo)
  - Se for estado selecionado (não `:focus-visible`): manter sem alteração, adicionar comentário
    `/* PRESERVADO: indicador de step selecionado, não focus-ring de navegação */`
  - Se houver tanto `:focus-visible` como estado selecionado sobrepostos: separar as classes
- [ ] 3.3.3 `ring-blue-500` (1×, localização a confirmar no dry-run):
  - Identificar arquivo/linha exata
  - Calcular contraste de blue-500 (#3b82f6) sobre fundos usados
  - Se for foco genérico: migrar para `ring-brand-teal/30`
  - Se for semântico (ex: link externo, info): manter com comentário

**Critério de aceite:**
- Casos preservados têm comentário inline explicando o motivo
- Nenhum caso manual fica sem decisão registrada
- `grep -rn 'ring-red-500\|ring-brand-primary/30' apps/web/src/` retorna apenas os arquivos
  esperados (não há proliferação)

**Dependências:** 0.1 (dry-run que identifica localização de ring-blue-500)

---

### 3.4 Verificar `focus-visible` vs `:focus` em componentes `[A]`

Ref: spec §US-3/SC-3.4/FR-09, plan §C4

**Subtarefas:**
- [ ] 3.4.1 Executar grep de auditoría:
  ```bash
  grep -rn ':focus[^-]' apps/web/src/ packages/ui/ --include='*.tsx' --include='*.ts' --include='*.css'
  ```
- [ ] 3.4.2 Para cada ocorrência de `:focus` (sem `-visible`): avaliar se é intencional
  (ex: `:focus` em elemento que já tem `focus-visible` sobreposto) ou se é legado a migrar
- [ ] 3.4.3 Migrar usos de `:focus` → `focus-visible:` onde for adequado (elementos interativos
  comuns: button, input, select, link)
  - Componentes já verificados pelo codemod (3.2) terão `focus-visible:ring-brand-teal/30`
  - Verificar CSS puro (`.css`) separadamente

**Critério de aceite:**
- `grep -rn ':focus[^-]' apps/web/src/ packages/ui/` retorna 0 resultados ou apenas casos
  documentados como intencionais

**Dependências:** 3.2

---

## FASE 4 — EIXO-D: Cobertura CI (Script de Tokens + Jest-axe + E2E)

### 4.1 Criar script CI `check-contrast-tokens.mjs` `[C]`

Ref: spec §US-5/FR-13, plan §D1/R6/R7, CHK009

**CHK009 CONTEXTO:** Pares hard-gated (enumerar explicitamente no script):
```
text-primary (#17252a) × care-attention (#d4a24c) ≥ 4.5  [hard — texto em badge]
text-primary (#17252a) × care-ok (#7ba38a)         ≥ 4.5  [hard — texto em badge]
text-secondary (#5c5a57) × surface-base (#fafaf8)  ≥ 4.5  [hard — texto de corpo]
brand-teal (#2b7a78) × surface-elevated (#ffffff)  ≥ 3.0  [hard — focus-ring, WCAG 1.4.11]
brand-teal (#2b7a78) × surface-base (#fafaf8)      ≥ 3.0  [hard — focus-ring]
text-secondary (#5c5a57) × surface-elevated (#fff) ≥ 4.5  [hard — texto de corpo]
```
Pares de aviso (warn — fora de escopo desta feature, mas monitorados):
```
care-urgent (#c1666b) × surface-base (#fafaf8)     ≥ 4.5  [warn — já é 3.73:1]
text-muted (#8e8d8a) × surface-base (#fafaf8)       ≥ 4.5  [warn — decorativo/não-essencial]
brand-teal-light (#3aafa9) × surface-base (#fafaf8) ≥ 4.5  [warn — só decorativo]
brand-terracotta (#c1666b) × surface-base (#fafaf8) ≥ 4.5  [warn]
```

**Arquivos:**
- `apps/web/scripts/check-contrast-tokens.mjs` (criar)

**Subtarefas:**
- [ ] 4.1.1 Criar `apps/web/scripts/check-contrast-tokens.mjs`:
  - Importar/usar `contrastRatio` de `apps/web/src/lib/contrast-checker.ts`
    (via import dinâmico ou adaptar a função WCAG para o script ESM puro)
  - Parse `@theme {}` de `packages/config/tailwind.preset.css` (light mode)
  - Parse bloco `.dark` de `packages/ui/styles/tokens.css` (dark mode — confirmatório)
  - Declarar a matriz de pares hard-gated e warn acima como config inline no script
  - Para cada par: chamar `contrastRatio(fgHex, bgHex)` e comparar com `min`
  - Saída: tabela ASCII `| par | ratio | min | resultado |`
  - Exit 0 se todos os pares hard-gated passam; exit 1 se qualquer hard falha
  - Exit 0 mesmo se warn falha (apenas imprime aviso — lição dec-013 / R7)
- [ ] 4.1.2 Adicionar script npm em `apps/web/package.json`:
  `"check:contrast": "node scripts/check-contrast-tokens.mjs"`
- [ ] 4.1.3 Integrar ao CI em `.github/workflows/ci.yml`:
  - Adicionar step no job `lint` (ou `test`): `pnpm --filter @metanoia/web check:contrast`
  - Sem alterar env de produção (SC-5.5: não usar VITE_ vars de produção no script)
- [ ] 4.1.4 Rodar localmente e verificar que todos os pares hard-gated passam após as
  correções das fases 1/2/3

**Critério de aceite:**
- `node apps/web/scripts/check-contrast-tokens.mjs` sai com exit 0 (todos hard-gated PASS)
- Tabela exibe os 6 pares hard-gated com ratio e resultado
- CI step integrado e documentado

**Dependências:** nenhuma para a criação do script; para validação correta depende de 1.2, 1.3, 2.1

---

### 4.2 Adicionar testes jest-axe nos componentes interativos e badges care-* `[A]`

Ref: spec §US-5/FR-12, plan §D3, testes T2/T3

**Arquivos:**
- `packages/ui/src/components/__tests__/button.spec.tsx` (criar ou estender)
- `packages/ui/src/components/__tests__/input.spec.tsx` (criar ou estender)
- `packages/ui/src/components/__tests__/select.spec.tsx` (criar ou estender)
- `packages/ui/src/components/__tests__/checkbox.spec.tsx` (criar ou estender)
- `packages/ui/src/components/__tests__/radio.spec.tsx` (criar ou estender)
- `packages/ui/src/components/__tests__/tab.spec.tsx` (criar ou estender)
- `packages/ui/src/components/__tests__/link.spec.tsx` (criar ou estender)
- `apps/web/src/components/meetings/__tests__/meeting-card-a11y.spec.tsx` (criar)
- `apps/web/src/components/meetings/__tests__/post-meeting-report-a11y.spec.tsx` (criar)

**Subtarefas:**
- [ ] 4.2.1 Para cada componente core (Button, Input, Select, Checkbox, Radio, Tab, Link):
  - Importar `axe` de `jest-axe@^10` (já em package.json)
  - Renderizar com estados principais (default, focus, disabled)
  - Asserir `toHaveNoViolations()` (inclui color-contrast e focus)
  - Asserir que focus-ring usa `ring-brand-teal` (SC-3.7)
- [ ] 4.2.2 Para badges care-* em `meeting-card.tsx`:
  - Asserir que elemento com `bg-care-ok` tem texto com contraste ≥ 4.5:1
  - Asserir que NÃO existe `text-white` combinado com `bg-care-ok` (regressão guard)
- [ ] 4.2.3 Para `post-meeting-report.tsx`: asserir que status fields (ok/attention/alert)
  não usam `text-care-ok`/`text-care-attention` como único indicador (0 violações axe)
- [ ] 4.2.4 Garantir que todos os specs rodam via `pnpm turbo test` sem configuração extra

**Critério de aceite:**
- `pnpm turbo test` com jest-axe: 0 violações em todos os componentes listados
- Teste de regressão de badge: falha explicitamente se `text-white bg-care-ok` for reintroduzido

**Dependências:** 1.2, 1.3, 3.2

---

### 4.3 Criar spec E2E axe para rotas públicas `[A]`

Ref: spec §US-5/FR-11, plan §D2, testes T4/T5

**CHK017/CHK026 — Safari/cross-browser:** Verificação manual com responsável designado
(dev pré-merge, QA staging pré-release) — mesma política das stories 12.1 e 12.2.
Checklist manual integrado ao final desta task.

**Arquivos:**
- `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts` (criar)
- `apps/web/e2e/a11y/` (diretório já existente da 12.1)

**Subtarefas:**
- [ ] 4.3.1 Criar `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts` seguindo o padrão dos
  specs existentes (`axe-baseline.spec.ts`, `axe-final.spec.ts`):
  ```typescript
  // Rotas públicas: goto + networkidle (sem login)
  test('/ — 0 violações color-contrast (wcag2aa)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast', 'link-in-text-block'])
      .analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('/login — 0 violações link-in-text-block (wcag2aa)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast', 'link-in-text-block'])
      .analyze();
    expect(results.violations).toHaveLength(0);
  });
  ```
- [ ] 4.3.2 NÃO criar specs para rotas autenticadas neste arquivo (dashboard, grupos, etc.)
  sem route-interception configurada — fora de escopo desta story
- [ ] 4.3.3 Verificar que o CI roda E2E axe: o job "E2E (Playwright)" já existe (confirmado
  na entrega da Story 12.2). O novo spec em `apps/web/e2e/a11y/` será coletado
  automaticamente pelo Playwright config existente.
- [ ] 4.3.4 Checklist manual obrigatório pré-merge (CHK017/CHK026 — Safari/cross-browser):
  - [ ] Chrome: focus-ring visível em todos os elementos interativos (home, login)
  - [ ] Firefox: focus-ring visível (idem)
  - [ ] Safari: focus-ring visível (idem) — observar bug de `outline` em Safari ≤ 15
  - [ ] Responsável: dev assignado ao PR, confirmar no comment de PR
  - [ ] QA staging: repetir checklist antes de release (política épico 12)

**Critério de aceite:**
- `apps/web/e2e/a11y/contrast-focus.e2e-spec.ts` existe
- Spec passa localmente: 0 violações em `/` e `/login` após correções de EIXO-B
- CI job "E2E (Playwright)" coleta e executa o spec sem configuração adicional
- Checklist manual preenchido no PR antes de merge

**Dependências:** 2.1, 2.2

---

## FASE 5 — Validação Final e Gate de Qualidade

### 5.1 Verificação integrada e gate local `[C]`

Ref: plan §Phase 4/Rollback, spec §NFR-A2/NFR-CI/NFR-MANUT

**Subtarefas:**
- [ ] 5.1.1 Executar gate local completo:
  ```bash
  pnpm --filter @metanoia/api exec prisma generate
  pnpm turbo build
  pnpm turbo lint --max-warnings 0
  pnpm turbo test
  node apps/web/scripts/check-contrast-tokens.mjs
  node apps/web/scripts/codemod-focus-ring.mjs --dry-run  # deve retornar 0 candidatos
  ```
- [ ] 5.1.2 Verificar NFR-MANUT:
  ```bash
  grep -rn 'ring-interactive-focus\|ring-\[var(--ring\|ring-ring' apps/web/src/ packages/ui/
  # deve retornar 0 resultados
  ```
- [ ] 5.1.3 Verificar que `ring-primary` só permanece nos casos preservados (se houver):
  ```bash
  grep -rn 'ring-primary' apps/web/src/ packages/ui/
  # deve retornar 0 resultados (todos migrados pelo codemod)
  ```
- [ ] 5.1.4 Verificar que hex de tokens care-* é idêntico ao original:
  ```bash
  git diff packages/config/tailwind.preset.css | grep '^[-+].*#'
  # deve mostrar apenas linhas de comentário adicionadas, sem mudança de hex
  ```
- [ ] 5.1.5 Executar E2E Playwright localmente (se ambiente disponível):
  ```bash
  pnpm --filter @metanoia/web exec playwright test apps/web/e2e/a11y/contrast-focus.e2e-spec.ts
  ```

**Critério de aceite:**
- Todos os comandos acima saem com código 0
- Zero regressões em testes existentes (vitest, jest-axe)
- NFR-MANUT verificado: `grep ring-interactive-focus` retorna vazio

**Dependências:** todas as fases anteriores (1-4)

---

### 5.2 Criar PR e documentar decisões `[M]`

**Subtarefas:**
- [ ] 5.2.1 Criar PR com título: `feat(a11y): Story 12.3 — Contraste WCAG AA + Focus-ring Canônico`
- [ ] 5.2.2 PR body deve incluir:
  - Tabela de violações resolvidas (antes/depois: 25 nodes color-contrast, 1 link-in-text-block)
  - Lista de arquivos com ring migrado (output do codemod)
  - Checklist manual Safari/cross-browser (CHK017/CHK026) preenchido
  - Referência à decisão dec-006 (hex intocado) e dec-020 (ring-primary migrado)
- [ ] 5.2.3 Atribuir reviewer com contexto a11y do épico 12

**Critério de aceite:**
- PR criado, CI verde (build + lint + test + check-contrast)
- Checklist manual documentado no PR antes de merge

**Dependências:** 5.1

---

## Escopo Coberto

- Classes de badges care-* corrigidas (text-primary em lugar de text-white/text-care-*)
- Texto de leitura marketing/ corrigido (text-secondary em lugar de text-muted)
- Link forgot-password com underline permanente
- Focus-ring padronizado via codemod (~73 ocorrências: 38 ring-interactive-focus + 21 ring-ring + 14 ring-primary)
- Script CI `check-contrast-tokens.mjs` com 6 pares hard-gated
- jest-axe: Button, Input, Select, Checkbox, Radio, Tab, Link + badges care-*
- E2E axe: rotas públicas `/` e `/login`
- Lint guardian: script CI que bloqueia novas variantes ad-hoc de focus-ring
- Checklist manual cross-browser (CHK017/CHK026)

## Escopo Excluído

- Alteração de qualquer valor hex em `tailwind.preset.css` ou `tokens.css` (dec-006/dec-007)
- Componentes care-* dedicados com ícone+texto completo (pós-Epic 7 / FR-10)
- E2E axe para rotas autenticadas sem route-interception (fora desta story)
- Ajuste de `care-urgent` (#c1666b = 3.73:1) — passa WCAG para gráfico, monitorado via warn no script
