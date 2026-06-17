# Backlog de Execução — Navegação por Teclado nos Fluxos Autenticados (Story 12.2)

> Feature: `a11y-teclado-autenticado` | Pipeline: feature-00c | Fase: execute-task
> Gerado em: 2026-06-17 | Onda: onda-005

## Legenda de Criticidade

- `[crit]` — Bloqueador de merge: falha impede PR
- `[maj]` — Major: impacta critério de aceite principal; corrigir antes do done
- `[min]` — Minor: melhoria sem bloquear done

## Escopo Coberto

- US1 (Dashboard), US2 (Foco Pós-Login), US3 (CRUD Grupos), US4 (Builder Trilhas),
  US5 (Catálogo e Busca), US6 (Configurações Tenant), US7 (Gestão de Planos)
- FR-001 a FR-027 + gaps CHK004, CHK007, CHK013, CHK009, CHK018, CHK024, CHK036, CHK048

## Escopo Excluído

- OnboardingWizard (CL-002: fora do escopo explícito)
- Leitores de tela (CHK041, CHK043, CHK044: decisão de produto pendente)
- Testes em Firefox/Safari via CI (apenas manual — ver FASE 9)
- Endpoints de backend / schemas Prisma (feature é pure-frontend)

## Gate Local Obrigatório (antes de marcar qualquer task como done)

```bash
pnpm --filter @metanoia/api exec prisma generate && \
pnpm turbo build && \
pnpm turbo lint --max-warnings 0
```

## Matriz de Dependências

```
FASE 0 ──► FASE 1 ──► FASE 2 ──► FASE 3
                  └──► FASE 4 ──► FASE 5 ──► FASE 6 ──► FASE 7 ──► FASE 8 ──► FASE 9
```

Detalhes por task na coluna "Depende de" abaixo.

---

## FASE 0 — Baseline e Preparação de Infraestrutura de Testes

### 0.1 Relatório de Baseline Axe Automático [crit]

- **Depende de:** —
- **US/FR:** FR-001
- **Arquivos-alvo:**
  - `apps/web/e2e/a11y/axe-baseline.spec.ts` (NOVO)
  - `apps/web/playwright.config.ts` (verificar configuração Chromium)
- **Descrição:** Criar spec Playwright + @axe-core/playwright que executa análise
  automática em todas as rotas autenticadas antes de qualquer correção.
  Rodar contra ambiente local (docker-compose.yml). Exportar resultados como
  JSON + HTML em `apps/web/e2e/a11y/reports/baseline/`.
- **Critério de aceite:**
  - [ ] Spec executa sem timeout em ambiente local (Chromium-only no CI)
  - [ ] Relatório JSON gerado com `violations[]` para cada rota coberta
  - [ ] Saída inclui pelo menos: dashboard, /groups, /trails/builder, /catalog,
        /settings/tenant, /plans
  - [ ] Gate local passa após criação do arquivo

### 0.2 Configurar @axe-core/playwright no projeto [crit]

- **Depende de:** —
- **US/FR:** FR-001, FR-025
- **Arquivos-alvo:**
  - `apps/web/package.json`
  - `apps/web/e2e/keyboard/.gitkeep` ou equivalente (criar diretório)
- **Descrição:** Instalar `@axe-core/playwright` se ausente. Criar estrutura de
  diretórios `apps/web/e2e/keyboard/` para os specs de navegação por teclado.
  Verificar que jest-axe está disponível para testes unitários.
- **Critério de aceite:**
  - [ ] `@axe-core/playwright` importável em specs E2E
  - [ ] `jest-axe` (ou `@axe-core/jest`) importável em specs Vitest
  - [ ] Diretório `apps/web/e2e/keyboard/` criado
  - [ ] Gate local passa

---

## FASE 1 — Hooks e Componentes Transversais (Base para Todas as US)

> CHK004 resolvido: AsyncAnnouncerProvider é tarefa explícita desta fase (1.4 + 1.5),
> transversal a US1/US5/US6. Qualquer US que usa `useAsyncAnnouncer` depende da
> conclusão de 1.4 antes de marcar done.

### 1.1 Hook `useFocusOnRouteChange` + testes unitários [crit]

- **Depende de:** 0.2
- **US/FR:** US2, FR-006, FR-007, CL-001
- **Arquivos-alvo:**
  - `apps/web/src/hooks/use-focus-on-route-change.ts` (NOVO)
  - `apps/web/src/__tests__/hooks/use-focus-on-route-change.spec.ts` (NOVO)
- **Descrição:** Implementar hook Client (`'use client'`) que observa `usePathname()`
  e move foco programaticamente após mudança de rota. Contrato:
  ```typescript
  export function useFocusOnRouteChange(options?: { selector?: string }): void
  ```
  Estratégia de seleção do elemento de foco (CHK007 — "primeiro elemento
  interativo significativo" operacionalizado):
  1. Elemento com `[data-autofocus]` dentro de `#conteudo`
  2. Fallback: primeiro `h1` dentro de `#conteudo`
  3. Fallback final: o próprio `#conteudo` (com `tabIndex={-1}`)
  Esta sequência de fallback DEVE ser documentada como comentário no arquivo.
  Suporta rotas diretas (`/dashboard`) e profundas (`/groups/123`) via
  `usePathname()` + `useSearchParams()` quando necessário (CHK036: premissa
  documentada no comentário do hook).
- **Critério de aceite:**
  - [x] Hook exportado e tipado com `strict: true`
  - [x] Testes unitários cobrem: foco no `[data-autofocus]`, fallback h1, fallback
        `#conteudo`, no-op quando pathname não muda
  - [x] CHK036: comentário documenta premissa sobre `usePathname()` com rotas dinâmicas
  - [x] CHK007: sequência de seleção "primeiro elemento interativo significativo"
        está comentada e implementada conforme Decision 2 do plan
  - [x] Gate local passa

### 1.2 Componente `FocusManager` [crit]

- **Depende de:** 1.1
- **US/FR:** US2, FR-006, CL-001
- **Arquivos-alvo:**
  - `apps/web/src/components/a11y/focus-manager.tsx` (NOVO)
  - `apps/web/src/__tests__/components/a11y/focus-manager.spec.ts` (NOVO)
- **Descrição:** Client Component que encapsula o hook `useFocusOnRouteChange`.
  Renderizado como filho do layout raiz autenticado (`navigation-shell.tsx`).
  Não renderiza DOM visível — efeito puro. Deve ser lazy-importado para não
  impactar o bundle do Server Component pai.
- **Critério de aceite:**
  - [x] Componente não renderiza elementos DOM visíveis
  - [x] Teste verifica que `useFocusOnRouteChange` é chamado na montagem
  - [x] Importado em `navigation-shell.tsx` via `dynamic()` com `ssr: false`
  - [x] Gate local passa

### 1.3 Hook `useRovingTabindex` + testes unitários [crit]

- **Depende de:** —
- **US/FR:** US1, FR-003, FR-004, CL-003
- **Arquivos-alvo:**
  - `apps/web/src/hooks/use-roving-tabindex.ts` (NOVO)
  - `apps/web/src/__tests__/hooks/use-roving-tabindex.spec.ts` (NOVO)
- **Descrição:** Implementar hook genérico de roving tabindex para listas de
  navegação. Suporte a Arrow Up/Down, Home/End, wrap circular (CHK009: FR-004
  expandido para incluir wrap e Home/End conforme CL-003).
  Contrato:
  ```typescript
  export function useRovingTabindex<T extends HTMLElement>(
    refs: React.RefObject<T>[],
    options?: { wrap?: boolean }
  ): { activeIndex: number; setActiveIndex: (i: number) => void }
  ```
- **Critério de aceite:**
  - [x] Arrow Up/Down navega entre itens
  - [x] Home vai ao primeiro; End vai ao último
  - [x] Wrap circular: Arrow Down no último vai ao primeiro (e vice-versa)
  - [x] Testes cobrem todos os casos acima + borda de lista vazia
  - [x] CHK009: comportamento de wrap e Home/End documentado em comentário
  - [x] Gate local passa

### 1.4 Componente `AsyncAnnouncer` + hook `useAsyncAnnouncer` [crit]

- **Depende de:** —
- **US/FR:** US1, US5, US6, FR-015 async, CL-005, CHK004
- **Arquivos-alvo:**
  - `apps/web/src/components/a11y/async-announcer.tsx` (NOVO)
  - `apps/web/src/__tests__/components/a11y/async-announcer.spec.ts` (NOVO)
  - `apps/web/messages/pt-BR.json` (MODIFICAR — adicionar chaves de anúncio)
- **Descrição:** Client Component + Context + hook. `AsyncAnnouncerProvider`
  renderiza `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">`.
  Mensagens PT-BR centralizadas em `pt-BR.json`:
  - `a11y.announce.searchResults`: `"N resultados encontrados para {termo}"`
  - `a11y.announce.settingsSaved`: `"Configurações salvas com sucesso."`
  - `a11y.announce.itemReordered`: `"{item} movido para a posição {posicao}."`
  Contrato do hook:
  ```typescript
  export function useAsyncAnnouncer(): (message: string) => void
  ```
- **Critério de aceite:**
  - [x] `AsyncAnnouncerProvider` renderiza região `aria-live="polite"` visível
        apenas para leitores de tela (`sr-only`)
  - [x] `useAsyncAnnouncer()` retorna função que atualiza o conteúdo da região
  - [x] Lança erro descritivo se usado fora do Provider
  - [x] Testes com jest-axe verificam que a região não tem violações de acessibilidade
  - [x] Mensagens PT-BR adicionadas em `pt-BR.json` (sem texto hardcoded)
  - [x] Gate local passa

### 1.5 Integrar `AsyncAnnouncerProvider` no `navigation-shell.tsx` [crit]

- **Depende de:** 1.4
- **US/FR:** US1, US5, US6, CHK004
- **Arquivos-alvo:**
  - `apps/web/src/components/layout/navigation-shell.tsx` (MODIFICAR)
- **Descrição:** Envolver o `<main id="conteudo">` com `AsyncAnnouncerProvider`.
  CHK004 explicitamente resolvido aqui: a tarefa transversal de adicionar o
  Provider é responsabilidade desta fase (não distribuída implicitamente nas
  features individuais).
- **Critério de aceite:**
  - [x] `AsyncAnnouncerProvider` envolve `<main id="conteudo">` no shell
  - [x] `FocusManager` (1.2) importado via `dynamic()` no mesmo arquivo
  - [x] Nenhum componente Server Component filho quebrado (verificar build)
  - [x] Gate local passa

---

## FASE 2 — Dashboard e Sidebar (US1)

### 2.1 Sidebar com roving tabindex (US1) [crit]

- **Depende de:** 1.3, 1.5
- **US/FR:** US1, FR-003, FR-004, FR-005, CL-003
- **Arquivos-alvo:**
  - `apps/web/src/components/layout/sidebar.tsx` (MODIFICAR)
  - `apps/web/src/__tests__/components/layout/sidebar.spec.ts` (NOVO ou MODIFICAR)
- **Descrição:** Aplicar `useRovingTabindex` nos itens do menu lateral. Garantir
  wrap circular (CHK009). Seletor de experiência (Consumo/Gestão/Admin) acessível
  via teclado — cada opção como `<button>` ou com `role="option"` navegável por
  setas. Skip link "Ir para conteúdo principal" como primeiro elemento focável
  da página.
- **Critério de aceite:**
  - [x] Tab posiciona foco na sidebar; Arrow Up/Down navega entre itens
  - [x] Home vai ao primeiro item; End vai ao último
  - [x] Wrap circular funcionando (CHK009)
  - [x] Seletor de experiência ativável por teclado
  - [x] Skip link presente e funcional (FR-003: sequência de foco correta)
  - [x] jest-axe: sem violações na sidebar isolada
  - [x] Gate local passa

### 2.2 E2E US1 — Dashboard (Chromium) [maj]

- **Depende de:** 2.1, 0.1
- **US/FR:** US1, FR-003, FR-004, FR-005, FR-025
- **Arquivos-alvo:**
  - `apps/web/e2e/keyboard/dashboard-keyboard.spec.ts` (NOVO)
- **Descrição:** Spec Playwright (Chromium-only no CI) cobrindo cenários de US1:
  skip link funcional, navegação sidebar via setas, seletor de experiência,
  axe sem violações críticas no dashboard completo.
  CHK048: verificar empiricamente se Radix Tooltip interfere com roving tabindex
  e documentar resultado como comentário no spec.
- **Critério de aceite:**
  - [x] Cenários de aceite US1 (1–4) passam automaticamente
  - [x] axe scan da página completa: 0 violations `critical` ou `serious`
  - [x] CHK048: comentário no spec documenta resultado da verificação de Tooltip
  - [x] Spec roda em `playwright.config.ts` com projeto `chromium`
  - [x] Gate local passa (inclui `pnpm turbo build`)

---

## FASE 3 — Foco Pós-Login (US2)

### 3.1 Integrar `FocusManager` no layout raiz autenticado [crit]

- **Depende de:** 1.2, 1.5
- **US/FR:** US2, FR-006, FR-007, TD-001
- **Arquivos-alvo:**
  - `apps/web/src/app/(authenticated)/layout.tsx` (MODIFICAR)
  - `apps/web/src/components/layout/navigation-shell.tsx` (verificar integração)
- **Descrição:** Garantir que `FocusManager` está ativo no layout autenticado.
  Adicionar `data-autofocus` nos primeiros elementos interativos significativos
  das rotas principais: `/dashboard` (primeiro card do Radar Pastoral ou h1),
  `/groups` (botão "Novo Grupo" ou h1), `/trails/builder` (h1 ou primeiro
  controle do builder).
  FR-007: testar com rota direta E rota profunda.
- **Critério de aceite:**
  - [ ] Após autenticação, foco move para elemento `[data-autofocus]` ou h1
        (nunca para `<body>` ou topo do documento)
  - [ ] Funciona para `/dashboard` e `/groups/123` (rota profunda)
  - [ ] `data-autofocus` adicionado nas 3 rotas principais documentadas
  - [ ] CHK007: critério "primeiro elemento interativo significativo" satisfeito
        conforme sequência de Decision 2 do plan
  - [ ] Gate local passa

### 3.2 E2E US2 — Foco Pós-Login (Chromium) [crit]

- **Depende de:** 3.1, 0.1
- **US/FR:** US2, FR-006, FR-007, FR-025
- **Arquivos-alvo:**
  - `apps/web/e2e/keyboard/post-login-focus.spec.ts` (NOVO)
- **Descrição:** Spec Playwright simulando redirect de autenticação e verificando
  posição do foco. Cobrir rota direta e rota profunda (FR-007).
- **Critério de aceite:**
  - [ ] Cenários de aceite US2 (1–3) passam
  - [ ] Foco não está em `document.body` após redirect
  - [ ] axe scan: 0 violations `critical`
  - [ ] Gate local passa

---

## FASE 4 — Builder de Trilhas (US4)

### 4.1 Componente `TrailItemReorder` [crit]

- **Depende de:** 1.4
- **US/FR:** US4, FR-012, FR-013, CL-004
- **Arquivos-alvo:**
  - `apps/web/src/components/trails/trail-item-reorder.tsx` (NOVO)
  - `apps/web/src/__tests__/components/trails/trail-item-reorder.spec.ts` (NOVO)
- **Descrição:** Componente com botões "Mover para cima" / "Mover para baixo"
  sempre visíveis (CL-004: não apenas on-hover). Rótulos ARIA descritivos:
  `aria-label="Mover {título do item} para cima"`. Após ativação, foco permanece
  no botão do item movido (FR-013 — não salta para topo).
  `useAsyncAnnouncer` anuncia posição após reordenação.
- **Critério de aceite:**
  - [ ] Botões sempre visíveis (não dependem de hover/focus-within)
  - [ ] `aria-label` descritivo com título do item
  - [ ] Foco permanece no botão após ativação (FR-013)
  - [ ] Anúncio via `useAsyncAnnouncer`: `"[Item] movido para a posição [N]."`
  - [ ] jest-axe: sem violações no componente isolado
  - [ ] Gate local passa

### 4.2 Integrar `TrailItemReorder` no builder (`group-trails-client.tsx`) [crit]

- **Depende de:** 4.1
- **US/FR:** US4, FR-012, FR-013, FR-014
- **Arquivos-alvo:**
  - `apps/web/src/components/trails/group-trails-client.tsx` (MODIFICAR)
- **Descrição:** Substituir controle de reordenação existente (ou adicionar
  ao lado do drag-and-drop) pelo `TrailItemReorder`. Garantir que formulários
  de criação/edição de módulo e lição são navegáveis por Tab (FR-014).
- **Critério de aceite:**
  - [ ] `TrailItemReorder` renderizado para cada item da lista
  - [ ] Formulários de módulo/lição: todos os campos alcançáveis via Tab
  - [ ] Ordem de Tab é lógica (top-to-bottom, left-to-right)
  - [ ] Gate local passa

### 4.3 E2E US4 — Builder de Trilhas (Chromium) [maj]

- **Depende de:** 4.2, 0.1
- **US/FR:** US4, FR-012, FR-013, FR-014, FR-025
- **Arquivos-alvo:**
  - `apps/web/e2e/keyboard/trail-builder-keyboard.spec.ts` (NOVO)
- **Critério de aceite:**
  - [ ] Cenários de aceite US4 (1–4) passam
  - [ ] axe scan: 0 violations `critical`
  - [ ] Gate local passa

---

## FASE 5 — CRUD de Grupos (US3)

### 5.1 Tab order e foco nos formulários de grupo [crit]

- **Depende de:** 1.2, 1.5
- **US/FR:** US3, FR-008, FR-011
- **Arquivos-alvo:**
  - `apps/web/src/app/(authenticated)/groups/page.tsx` (MODIFICAR)
  - `apps/web/src/components/groups/group-form.tsx` (MODIFICAR ou VERIFICAR)
- **Descrição:** Garantir que formulários de criar/editar grupo têm campos
  em ordem lógica de Tab. Após conclusão de ação (criar/editar/excluir),
  retornar foco para elemento significativo na lista (FR-011): botão "Novo
  Grupo" ou primeiro item da lista. Usar `useAsyncAnnouncer` para anunciar
  resultado da ação se aplicável.
- **Critério de aceite:**
  - [ ] Tab navega todos os campos em ordem visual (top-to-bottom)
  - [ ] Após criar grupo: foco retorna ao grupo recém-criado na lista
  - [ ] Após excluir grupo: foco retorna ao próximo item ou ao botão "Novo Grupo"
  - [ ] jest-axe: sem violações nos formulários
  - [ ] Gate local passa

### 5.2 Focus trap em diálogos de confirmação (Radix Dialog) [crit]

- **Depende de:** 1.5
- **US/FR:** US3, FR-009, CL-002
- **Arquivos-alvo:**
  - `apps/web/src/components/groups/delete-group-dialog.tsx` (NOVO ou MODIFICAR)
  - `apps/web/src/__tests__/components/groups/delete-group-dialog.spec.ts` (NOVO)
- **Descrição:** Usar shadcn/ui `Dialog` (Radix UI) para diálogos de confirmação
  destrutiva. Radix fornece focus trap nativamente — verificar que está ativo.
  Tab mantém foco dentro do diálogo. Escape cancela e retorna foco ao elemento
  que abriu o diálogo (FR-009).
- **Critério de aceite:**
  - [ ] Tab não escapa do diálogo aberto
  - [ ] Escape fecha o diálogo e retorna foco ao botão de origem
  - [ ] Primeiro elemento focável no diálogo é o botão "Cancelar" (mais seguro)
  - [ ] jest-axe: sem violações no diálogo
  - [ ] Gate local passa

### 5.3 Upload CSV focável (botão de convite) [maj]

- **Depende de:** 5.1
- **US/FR:** US3, FR-010
- **Arquivos-alvo:**
  - `apps/web/src/components/groups/invite-members-form.tsx` (MODIFICAR)
- **Descrição:** Garantir que o botão/input de upload de CSV é focável e
  ativável via Enter e Space. Usar padrão `<label>` + `<input type="file">` com
  label visível, ou `<button>` que programa o clique no input oculto.
- **Critério de aceite:**
  - [ ] Upload alcançável via Tab
  - [ ] Ativável com Enter e Space
  - [ ] `aria-label` ou texto visível descritivo presente
  - [ ] Gate local passa

### 5.4 E2E US3 — CRUD Grupos (Chromium) [maj]

- **Depende de:** 5.1, 5.2, 5.3, 0.1
- **US/FR:** US3, FR-008..011, FR-025
- **Arquivos-alvo:**
  - `apps/web/e2e/keyboard/grupos-keyboard.spec.ts` (NOVO)
- **Critério de aceite:**
  - [ ] Cenários de aceite US3 (1–5) passam
  - [ ] axe scan: 0 violations `critical`
  - [ ] Gate local passa

---

## FASE 6 — Catálogo e Busca (US5)

### 6.1 Campo de busca, filtros e cards focáveis [crit]

- **Depende de:** 1.4, 1.5
- **US/FR:** US5, FR-015, FR-016, FR-017, FR-018
- **Arquivos-alvo:**
  - `apps/web/src/app/(authenticated)/catalog/page.tsx` (MODIFICAR)
  - `apps/web/src/components/catalog/catalog-search.tsx` (MODIFICAR ou NOVO)
  - `apps/web/src/components/catalog/trail-card.tsx` (MODIFICAR)
  - `apps/web/src/components/catalog/trail-playlist.tsx` (MODIFICAR)
  - `apps/web/src/__tests__/components/catalog/catalog-search.spec.ts` (NOVO)
- **Descrição:** Campo de busca como primeiro focável da seção (FR-015).
  Dropdowns de filtro acessíveis (FR-016): `Enter`/`Space` abre; `Arrow Up/Down`
  navega opções; `Escape` fecha. Cards (`trail-card.tsx`, `trail-playlist.tsx`)
  focáveis e ativáveis com `Enter` (FR-017). Controles de paginação alcançáveis
  por Tab (FR-018). `useAsyncAnnouncer` anuncia contagem de resultados após busca
  assíncrona (CL-005, CHK004 transversal).
- **Critério de aceite:**
  - [ ] Campo de busca é o primeiro `tabIndex` positivo da seção
  - [ ] Filtros abrem/fecham/navegam via teclado
  - [ ] Cards têm `role="link"` ou `<a>` + são focáveis
  - [ ] Paginação alcançável via Tab com rótulos descritivos
  - [ ] Anúncio de resultados via `useAsyncAnnouncer`
  - [ ] jest-axe: sem violações nos componentes
  - [ ] Gate local passa

### 6.2 E2E US5 — Catálogo e Busca (Chromium) [maj]

- **Depende de:** 6.1, 0.1
- **US/FR:** US5, FR-015..018, FR-025
- **Arquivos-alvo:**
  - `apps/web/e2e/keyboard/catalogo-keyboard.spec.ts` (NOVO)
- **Critério de aceite:**
  - [ ] Cenários de aceite US5 (1–4) passam
  - [ ] axe scan: 0 violations `critical`
  - [ ] Gate local passa

---

## FASE 7 — Configurações do Tenant (US6)

### 7.1 Formulários de configuração + input hex + upload logo [crit]

- **Depende de:** 1.4, 1.5
- **US/FR:** US6, FR-019, FR-020, FR-021, CL-005
- **Arquivos-alvo:**
  - `apps/web/src/components/settings/branding-settings-form.tsx` (MODIFICAR)
  - `apps/web/src/__tests__/components/settings/branding-settings-form.spec.ts` (NOVO)
- **Descrição:** Todos os campos de configuração do tenant alcançáveis via Tab
  em ordem lógica (FR-019). Seletor de cor: adicionar campo `<input type="text">`
  hexadecimal alternativo ao seletor visual (FR-020 — seletor visual não é
  acessível por teclado em todos os browsers). Upload de logo como `<label>` +
  `<input type="file">` focável e ativável (FR-021). `useAsyncAnnouncer` anuncia
  "Configurações salvas com sucesso." (CL-005, CHK004 transversal).
- **Critério de aceite:**
  - [ ] Tab percorre todos os campos na ordem visual
  - [ ] Campo hex funcional: aceita `#RRGGBB`, atualiza seletor visual
  - [ ] Upload logo: focável, ativável com Enter/Space
  - [ ] Anúncio PT-BR ao salvar via `useAsyncAnnouncer`
  - [ ] jest-axe: sem violações no formulário
  - [ ] CHK024: target de `< 16ms` de latência no foco documentado como guideline
        (não como SC automático) em comentário no arquivo
  - [ ] Gate local passa

### 7.2 E2E US6 — Configurações Tenant (Chromium) [maj]

- **Depende de:** 7.1, 0.1
- **US/FR:** US6, FR-019..021, FR-025
- **Arquivos-alvo:**
  - `apps/web/e2e/keyboard/configuracoes-keyboard.spec.ts` (NOVO)
- **Critério de aceite:**
  - [ ] Cenários de aceite US6 (1–4) passam
  - [ ] axe scan: 0 violations `critical`
  - [ ] Gate local passa

---

## FASE 8 — Gestão de Planos e Upgrade (US7)

### 8.1 Cards de plano focáveis + CTAs + diálogo de upgrade [crit]

- **Depende de:** 1.4, 1.5
- **US/FR:** US7, FR-022, FR-023, FR-024
- **Arquivos-alvo:**
  - `apps/web/src/app/(authenticated)/plans/page.tsx` (MODIFICAR)
  - `apps/web/src/components/plans/plan-card.tsx` (MODIFICAR ou VERIFICAR)
  - `apps/web/src/components/plans/upgrade-dialog.tsx` (VERIFICAR focus trap)
  - `apps/web/src/__tests__/components/plans/plan-card.spec.ts` (NOVO)
- **Descrição:** Cards de plano individualmente focáveis (FR-022). Enter expande
  detalhes do plano. CTAs "Assinar Pro" e "Falar com vendas" focáveis e ativáveis
  (FR-023). Fluxo de upgrade (incluindo diálogo e etapas de confirmação) navegável
  por teclado (FR-024). Usar Radix Dialog para focus trap no diálogo de upgrade.
- **Critério de aceite:**
  - [ ] Tab navega entre cards individualmente
  - [ ] Enter em card expande detalhes
  - [ ] CTAs alcançáveis e ativáveis via teclado
  - [ ] Diálogo de upgrade: focus trap ativo, Escape cancela e retorna foco
  - [ ] jest-axe: sem violações na página de planos
  - [ ] Gate local passa

### 8.2 E2E US7 — Gestão de Planos (Chromium) [maj]

- **Depende de:** 8.1, 0.1
- **US/FR:** US7, FR-022..024, FR-025
- **Arquivos-alvo:**
  - `apps/web/e2e/keyboard/planos-keyboard.spec.ts` (NOVO)
- **Critério de aceite:**
  - [ ] Cenários de aceite US7 (1–4) passam
  - [ ] axe scan: 0 violations `critical`
  - [ ] Gate local passa

---

## FASE 9 — Relatório Final e Gate Cross-Browser Manual

> CHK013 resolvido: esta fase define explicitamente QUEM executa, QUANDO e COMO.

### 9.1 Relatório Final Axe (comparação com baseline) [crit]

- **Depende de:** todas as fases anteriores
- **US/FR:** FR-002
- **Arquivos-alvo:**
  - `apps/web/e2e/a11y/axe-final.spec.ts` (NOVO ou re-executar baseline)
  - `apps/web/e2e/a11y/reports/final/` (criar diretório para relatório)
  - `docs/specs/a11y-teclado-autenticado/a11y-report-final.md` (NOVO — sumário)
- **Descrição:** Executar análise axe automática final nas mesmas rotas do baseline.
  Gerar relatório comparativo JSON + sumário Markdown classificando problemas
  como bloqueador/maior/menor (FR-002). O relatório final é pré-requisito para
  marcar a feature como concluída.
- **Critério de aceite:**
  - [ ] axe final executado nas mesmas rotas do baseline (FR-001)
  - [ ] Relatório compara `baseline violations` vs `final violations`
  - [ ] Zero violations `critical` ou `serious` restantes
  - [ ] `a11y-report-final.md` gerado com classificação bloqueador/maior/menor
  - [ ] Gate local passa

### 9.2 Gate Cross-Browser Manual (FR-027) [maj]

- **Depende de:** todas as fases anteriores
- **US/FR:** FR-027, CHK013, CHK018
- **Arquivos-alvo:**
  - `docs/specs/a11y-teclado-autenticado/cross-browser-checklist.md` (NOVO)
- **Descrição:** CHK013 resolvido com definição explícita de responsabilidade:
  - **Executor:** Dev responsável pela feature (Paulo ou designado)
  - **Momento DEV:** Antes do PR de merge — testar manualmente em Chrome, Firefox e Safari
  - **Momento QA:** Em staging, pré-release — re-validar os mesmos fluxos
  - **Escopo:** US1–US7, cenários de aceite de cada user story
  - **Browsers:** Chrome (latest), Firefox (latest), Safari (latest no macOS)
  CHK018 resolvido: Firefox e Safari são cobertos APENAS manualmente (CI = Chromium-only).
  Este checklist manual é obrigatório como evidência no PR (screenshot ou log).
  Criar template de checklist em `cross-browser-checklist.md` com colunas:
  US | Cenário | Chrome | Firefox | Safari | Obs
- **Critério de aceite:**
  - [ ] Template de checklist criado com todas as US e cenários principais
  - [ ] CHK013: responsável (dev) e momento (pré-merge e pré-release) documentados
  - [ ] CHK018: nota explícita "CI = Chromium-only; Firefox/Safari = manual"
  - [ ] Checklist preenchido para Chrome, Firefox e Safari (dev faz antes do PR)
  - [ ] Evidências (screenshots ou logs) incluídas como links no PR

---

## Resumo por Fase

| Fase | Tasks | Criticidade | US/FR Principais |
|------|-------|-------------|-----------------|
| FASE 0 — Baseline | 0.1, 0.2 | crit×2 | FR-001 |
| FASE 1 — Infra Transversal | 1.1, 1.2, 1.3, 1.4, 1.5 | crit×5 | US1-6, CHK004 |
| FASE 2 — Dashboard (US1) | 2.1, 2.2 | crit, maj | FR-003..005 |
| FASE 3 — Foco Pós-Login (US2) | 3.1, 3.2 | crit×2 | FR-006..007, TD-001 |
| FASE 4 — Builder Trilhas (US4) | 4.1, 4.2, 4.3 | crit, crit, maj | FR-012..014 |
| FASE 5 — CRUD Grupos (US3) | 5.1, 5.2, 5.3, 5.4 | crit, crit, maj, maj | FR-008..011 |
| FASE 6 — Catálogo (US5) | 6.1, 6.2 | crit, maj | FR-015..018 |
| FASE 7 — Config Tenant (US6) | 7.1, 7.2 | crit, maj | FR-019..021 |
| FASE 8 — Planos (US7) | 8.1, 8.2 | crit, maj | FR-022..024 |
| FASE 9 — Relatório Final | 9.1, 9.2 | crit, maj | FR-002, FR-027 |
| **Total** | **29 tasks** | | |

## Gaps do Checklist — Como Foram Resolvidos

| CHK | Resolução | Task |
|-----|-----------|------|
| CHK004 | `AsyncAnnouncerProvider` como tarefa explícita transversal | 1.4 + 1.5 |
| CHK007 | Sequência de fallback "primeiro elemento interativo" documentada no hook | 1.1 |
| CHK013 | Responsável (dev), momento (pré-merge + QA staging) e escopo definidos | 9.2 |
| CHK009 | Wrap circular + Home/End como requisito explícito no hook | 1.3 + 2.1 |
| CHK018 | "CI = Chromium-only; Firefox/Safari = manual" documentado | 9.2 |
| CHK024 | Latência < 16ms documentada como guideline (comentário no arquivo) | 7.1 |
| CHK036 | Premissa `usePathname()` com rotas dinâmicas documentada no hook | 1.1 |
| CHK048 | Verificação empírica de Radix Tooltip documentada no spec E2E | 2.2 |
