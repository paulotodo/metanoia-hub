# UX Checklist: Preferências Granulares de Notificação por Tipo

**Purpose**: Validar qualidade dos requisitos de UX — estados de interação, optimistic update, acessibilidade, migração do "silenciar", rótulos PT-BR e comportamento do toggle do Líder.
**Created**: 2026-06-26
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)

---

## Hierarquia Visual e Layout

- [x] CHK044 - Os 7 tipos de notificação com seus 2 toggles por tipo estão definidos — o layout é especificado (lista vertical, cada tipo com 2 toggles "No app" e "E-mail")? [Completude, Spec §US1 AC1] {auto}
  > Spec US1 AC1: "vê uma lista com os tipos de notificação disponíveis (...), cada um com dois toggles ('No app' e 'E-mail') e seus rótulos e descrições em PT-BR." data-model.md §3.1 define os 7 rótulos e descrições PT-BR.

- [ ] CHK045 - Está definida a ordem de exibição dos 7 tipos de notificação na lista? [Clareza, Gap] {humano}
  > Os artefatos não especificam a ordem de exibição dos tipos na UI. data-model.md §3.1 lista os tipos na ordem da tabela, mas não declara que essa é a ordem visual. Decisão de produto/UX: ordenar por frequência de uso (pastoral_alert primeiro?), por importância ou por ordem do enum.

- [ ] CHK046 - As dimensões mínimas dos toggles estão definidas (touch target ≥44px para conformidade mobile)? [Clareza, Gap] {humano}
  > Os artefatos não especificam dimensões dos toggles. A UI usa shadcn/ui e Tailwind — o componente padrão pode ou não atender ≥44px. Decisão de design se reusar o componente canônico existente ou especificar tamanho mínimo. Ref: lição Epic 15.1 (touch-target a11y).

---

## Estados de Interação e Optimistic Update

- [x] CHK047 - O fluxo de optimistic update está especificado — o toggle muda imediatamente, com reversão e toast em PT-BR em caso de erro da API? [Completude, Spec §US1 AC2, plan.md §Camada 4] {auto}
  > Spec US1 AC2: "a UI reflete a mudança imediatamente (optimistic update) e o sistema persiste a preferência via PATCH sem exigir confirmação explícita; em caso de erro da API, o toggle reverte ao estado anterior e exibe mensagem de erro em PT-BR." plan.md §Camada 4: "Toggle otimista: muda já, reverte em erro da API + toast PT-BR."

- [x] CHK048 - O estado de loading (enquanto o PATCH está em andamento) está especificado? [Cobertura] {auto}
  > Os artefatos mencionam TanStack Query com `useMutation` e optimistic update, mas NÃO definem explicitamente um estado de loading/spinner durante o PATCH.

  **[Gap]**: Não há requisito sobre o estado visual do toggle durante o PATCH (loading indicator, desabilitar o toggle temporariamente, spinner). O optimistic update pode tornar isso irrelevante (o toggle já mudou), mas o comportamento em erro de rede demora a aparecer. Decisão de produto se o toggle permanece responsivo ou fica desabilitado durante a chamada.

- [x] CHK049 - O estado do toggle do Líder para `pastoral_alert.inApp` está especificado — visualmente desabilitado com tooltip explicativo? [Completude, Spec §US1 AC4, plan.md §Camada 4] {auto}
  > Spec US1 AC4: "ele aparece visualmente desabilitado com tooltip explicativo". plan.md §Camada 4: "Toggle `pastoral_alert.inApp` para Líder: `disabled` + tooltip 'Alertas pastorais no app não podem ser desativados'."

- [x] CHK050 - O requisito de defaults (todos os toggles ativados no primeiro acesso, sem linhas no DB) está especificado e visualmente coerente com a resposta GET que retorna todos como `true`? [Consistência, Spec §US1 AC3, data-model.md §4] {auto}
  > Spec US1 AC3: "todos os toggles aparecem ativados (defaults: inApp=true, email=true para todos os tipos)." data-model.md §4: defaults resolvidos no service — ausência de linha = `enabled: true`. Consistente.

---

## Acessibilidade

- [x] CHK051 - Os requisitos de acessibilidade para toggles interativos estão especificados (rótulos com `className`, conformidade com gates a11y hard do projeto)? [Cobertura, plan.md §Camada 4] {auto}
  > plan.md §Camada 4 (nota): "FE com `className` → lembrar os 3 gates a11y hard na execução." A spec cita rótulos e descrições em PT-BR por tipo. Os gates a11y hard do CI (Epic 12/15) se aplicam.

- [ ] CHK052 - Está definido se o toggle do Líder (`disabled`) tem `aria-disabled` e o tooltip é acessível via teclado e leitor de tela? [Cobertura, Gap] {humano}
  > Os artefatos especificam o tooltip visualmente ("tooltip explicativo"), mas não definem como o tooltip é exposto a usuários de teclado e leitores de tela (aria-describedby? title? role=tooltip?). Lição Epic 15: `aria-label` em elementos não-expostos é um trap recorrente. Decisão de design a11y.

- [ ] CHK053 - Estão definidos requisitos de navegação por teclado para a página de preferências (Tab entre toggles, Space/Enter para alternar)? [Cobertura, Gap] {humano}
  > Não especificado explicitamente. shadcn/ui `Switch` normalmente é teclado-acessível, mas o comportamento do toggle desabilitado (Líder) e do modal de migração não está definido. Ref: lição Epic 15.1 (keyboard specs).

---

## Rótulos e i18n PT-BR

- [x] CHK054 - Os rótulos e descrições PT-BR para os 7 tipos de notificação estão definidos e mapeados ao enum real? [Completude, data-model.md §3.1] {auto}
  > data-model.md §3.1 define a tabela completa: `pastoral_alert → "Alertas pastorais"`, `meeting_reminder → "Lembretes de reunião"`, etc. para todos os 7 tipos com rótulo + descrição PT-BR.

- [ ] CHK055 - Estão definidos os textos PT-BR do banner de silêncio, do modal de migração (título, corpo, duas ações) e do toast de erro de PATCH? [Completude, Spec §US3, Gap] {humano}
  > Spec §US3 AC1/2 descreve o conteúdo em português informal, mas não define os strings exatos para `pt-BR.json`. plan.md §Camada 4 lista o que deve estar em `pt-BR.json` (rótulos/descrições/textos do banner+modal), mas os valores precisam de aprovação do produto para vocabulário pastoral correto.

- [x] CHK056 - Está especificado que todos os textos de UI (rótulos, descrições, banner, modal, tooltip, toast) ficam em `apps/web/messages/pt-BR.json` (centralizado)? [Consistência, plan.md §Camada 4, CLAUDE.md] {auto}
  > plan.md §Camada 4: "i18n: adicionar rótulos/descrições/textos do banner+modal em `apps/web/messages/pt-BR.json`." CLAUDE.md: "User-facing messages: PT-BR (centralized in `apps/web/messages/pt-BR.json`)."

---

## Fluxo de Migração "Silenciar"

- [x] CHK057 - O fluxo de migração com banner + modal na primeira visita está especificado com as duas ações ("Manter silenciado" e "Configurar por tipo")? [Completude, Spec §US3 AC1/2] {auto}
  > Spec US3 AC1: banner quando `silenciar` ativo. AC2: modal na primeira visita com duas ações. plan.md §Camada 4: "banner + modal (1ª visita)."

- [x] CHK058 - O requisito de que o modal de migração não aparece após conclusão (localStorage removido → sem modal no reload) está especificado? [Completude, Spec §US3 AC5] {auto}
  > Spec US3 AC5: "o modal não é exibido novamente e o banner de silêncio não aparece." Critério claro e testável (T-M2).

- [x] CHK059 - O comportamento de "Configurar por tipo" (apenas remove localStorage, não persiste nada no servidor — usuário vê defaults) está especificado sem ambiguidade? [Clareza, Spec §US3 AC4] {auto}
  > Spec US3 AC4: "o localStorage é removido, o modal fecha e o usuário vê a página de preferências com todos os padrões ativados para configurar à vontade." Sem PATCH neste caminho — apenas remoção de key. Claro.

- [ ] CHK060 - O comportamento da UI durante o PATCH "Manter silenciado" (all inApp=false) está especificado — loading? confirmação de sucesso? [Cobertura, Gap] {humano}
  > Spec US3 AC3 descreve o resultado final, mas não o estado visual durante o PATCH no modal (14 chamadas implícitas ou 1 PATCH com todos os tipos?). Decisão de UX: PATCH único com payload completo ou sequência? E o spinner no modal durante o PATCH?

---

## Empty States e Comportamento em Erro

- [x] CHK061 - O estado sem preferências salvas (primeiro acesso) exibe todos os toggles ativados — não uma tela vazia ou de erro? [Cobertura, Spec §US1 AC3] {auto}
  > Spec US1 AC3: "todos os toggles aparecem ativados (defaults: inApp=true, email=true para todos os tipos)." data-model.md §4: service resolve defaults em memória sem exigir linhas no DB. Comportamento definido.

- [ ] CHK062 - O comportamento da página em caso de erro no GET de preferências (API indisponível) está especificado — mensagem de erro, retry automático, skeleton? [Cobertura, Gap] {humano}
  > Os artefatos especificam o optimistic update para erros no PATCH, mas não definem o comportamento da UI quando o GET inicial falha (TanStack Query error state). Decisão de UX: exibir todos como habilitados (fail-open) ou mostrar erro?
