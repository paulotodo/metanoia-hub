# UX/A11y Checklist: health-check-integracoes

**Purpose**: Validar qualidade dos requisitos de UX e acessibilidade do dashboard:
badges, sparkline acessível, auto-refresh/stale, motion-safe, focus-ring,
estados de interação e i18n PT-BR.
**Created**: 2026-06-22
**Feature**: `docs/specs/health-check-integracoes/spec.md`

---

## Hierarquia Visual e Badges

- [x] CHK062 - Os requisitos de badge (cor + texto) estão definidos para todos os três status? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010: "`bg-green-500` (healthy), `bg-yellow-500` (degraded), `bg-red-500` (unhealthy)"; §i18n: "Saudável / Degradado / Indisponível". Cor e texto definidos para os 3 estados.

- [x] CHK062b - Os badges combinam cor E texto (não apenas cor) para conformidade WCAG 1.4.1 (Use of Color)? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 define badge com `bg-green/yellow/red-500` (cor) e §i18n define "Saudável/Degradado/Indisponível" (texto). Combinação cor+texto satisfaz WCAG 1.4.1. Requisito presente.

- [ ] CHK063 - O contraste das cores de badge (verde/amarelo/vermelho sobre fundo claro ou escuro) atende WCAG AA (4.5:1 para texto)? [Conformidade, Gap] {humano}
  > Julgamento de produto: spec §FR-010 menciona "contraste WCAG AA" como requisito geral mas não especifica o valor de contraste por badge. `bg-yellow-500` com texto branco pode não atingir 4.5:1. Decidir se o sistema de cores do projeto (Tailwind) já tem validação de contraste ou se é necessária revisão específica para badges.

- [x] CHK064 - Os nomes das integrações em PT-BR estão definidos no i18n? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 §i18n define `integrationNames` com os 5 nomes: "E-mail (Resend)", "Autenticação (Keycloak)", "Armazenamento (MinIO)", "Cache (Redis)", "Banco de Dados (PostgreSQL)".

---

## Estados de Interação

- [x] CHK065 - Os estados de loading estão especificados para o auto-refresh e para o carregamento inicial? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 define `refetchInterval: 60000` e `staleTime: 55000` (TanStack Query). Estado de loading implícito pelo comportamento padrão do TanStack Query; indicador "Atualizado há X segundos" está especificado.

- [ ] CHK066 - O estado de loading (skeleton/spinner) do painel durante o carregamento inicial está especificado com um componente ou padrão definido? [Clareza, Gap] {humano}
  > Gap: spec §FR-010 define o indicador "Atualizado há X segundos" e o alerta stale, mas não especifica o estado de loading inicial (skeleton cards, spinner, ou layout shift). Decidir qual padrão usar (coerente com o design system do projeto).

- [x] CHK067 - O estado stale (dados desatualizados > 2 min) está especificado com threshold e apresentação visual? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010: "Alerta stale: banner amarelo 'Dados podem estar desatualizados' se `Date.now() - lastRefreshed > 120000`." Threshold (120s) e visual (banner amarelo) definidos.

- [x] CHK068 - O estado stale tem texto i18n definido em PT-BR? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 §i18n define `"staleWarning": "Dados podem estar desatualizados"`. Presente.

- [x] CHK069 - O estado de erro de rede (fetch falha) está implicitamente coberto pelo TanStack Query? [Cobertura, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 usa TanStack Query com `refetchInterval` — TanStack Query tem comportamento padrão de retry em falha de rede (3 tentativas). Porém, o estado de exibição em erro persistente não está especificado.
  > **[Gap]** Estado de erro persistente (fetch falhou após retries) não está especificado visualmente. Ação: definir estado de erro do dashboard (ex: "Não foi possível carregar os dados").

- [x] CHK070 - O estado de modal/drawer de histórico detalhado (aberto/fechado, integração selecionada) está especificado? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 define `<IntegrationHistoryModal>` com "tabela de logs com status, latência, mensagem de erro, timestamp" disparada por click na card. Gatilho e conteúdo definidos.

---

## Acessibilidade (WCAG AA / a11y)

- [x] CHK071 - `aria-live="polite"` está especificado no container de status para anunciar atualizações a leitores de tela? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010: "`aria-live=\"polite\"` no container de status."

- [x] CHK072 - `role="status"` está especificado no indicador de refresh? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010: "`role=\"status\"` no indicador de refresh."

- [x] CHK073 - O `focus-ring` visível está especificado como requisito? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010: "`focus-ring` visível."

- [ ] CHK074 - A navegação por teclado está especificada para fluxos críticos (card → modal, fechar modal)? [Cobertura, Gap] {auto}
  > Gap: spec §FR-010 menciona `focus-ring` e a11y geral, mas não especifica o fluxo de navegação por teclado explicitamente: ex. Enter/Space na card abre o modal? Escape fecha? Tab navega entre integrações? Ação: adicionar requisitos de navegação por teclado a §FR-010.

- [x] CHK075 - O `motion-safe` (não animar sparkline se `prefers-reduced-motion`) está especificado? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010: "`motion-safe` (não anima se `prefers-reduced-motion: reduce`)."

- [ ] CHK076 - O sparkline SVG tem atributos de acessibilidade definidos (`aria-label`, `role="img"` ou `<title>`)? [Cobertura, Gap] {auto}
  > Gap: spec §FR-010 define `<LatencySparkline>` com hover tooltip e `motion-safe`, mas não especifica os atributos a11y do SVG para leitores de tela (ex: `role="img"`, `aria-label="Latência de X nas últimas 24h"`). Um SVG inline sem ARIA é invisível a leitores de tela. Ação: adicionar requisito de ARIA no SVG a §FR-010.

- [ ] CHK077 - O hover tooltip do sparkline tem alternativa acessível para usuários de teclado/leitor de tela? [Cobertura, Gap] {auto}
  > Gap: spec §FR-010 define "hover tooltip com valor exato e timestamp" para o sparkline, mas não especifica como esse tooltip é acessível por teclado ou leitor de tela (que não tem "hover"). Ação: especificar se o tooltip é acionável por focus ou se os dados brutos são fornecidos em alternativa.

- [x] CHK078 - O requisito de contraste WCAG AA está mencionado como padrão? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010: "contraste WCAG AA." Presente como requisito geral.

---

## Auto-refresh e Stale

- [x] CHK079 - O intervalo de auto-refresh está quantificado (60s)? [Clareza, Spec §FR-010] {auto}
  > Evidência: spec §FR-010: "`refetchInterval: 60000`" e "auto-refresh via `setInterval(60000)`."

- [x] CHK080 - O indicador de tempo desde a última atualização ("Atualizado há X segundos") está especificado com template i18n? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 §i18n: `"lastUpdated": "Atualizado há {seconds}s"`. Template com placeholder presente.

- [ ] CHK081 - O comportamento do auto-refresh quando a aba está em background (visibilidade oculta) está especificado? [Edge Case, Gap] {humano}
  > Gap: spec §FR-010 não especifica se o auto-refresh continua quando a aba do browser está em background. TanStack Query por padrão pausa `refetchInterval` em tabs sem foco (visibilidade oculta). Este comportamento implícito é desejado? Decidir e especificar.

---

## Responsividade

- [ ] CHK082 - Os breakpoints e o layout responsivo do dashboard estão definidos com critérios mensuráveis? [Clareza, Gap] {humano}
  > Gap: spec §FR-010 não define breakpoints específicos nem o layout em mobile vs desktop para o painel de integrações. "Sparkline responsivo" é mencionado em §D-006 mas sem breakpoints. Decidir se layout mobile é requisito desta story ou tech debt.

- [ ] CHK083 - O tamanho dos touch targets (clique na card para abrir modal) atende ~44px mínimo em mobile? [Clareza, Gap] {humano}
  > Gap: spec §FR-010 define click na card abrindo o modal, mas não especifica tamanho mínimo de touch target. Para mobile, WCAG 2.5.5 (AAA) e guidelines gerais recomendam 44×44px. Decidir se é requisito desta story.

---

## Vocabulário Pastoral e i18n

- [x] CHK084 - Todos os textos user-facing estão definidos em PT-BR em `pt-BR.json` sob chave `health.integrations.*`? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 §i18n define as chaves: `title`, `subtitle`, `status.healthy/degraded/unhealthy`, `lastUpdated`, `staleWarning`, `integrationNames.*` (5 integrações). Vocabulário pastoral ("Saudável", "Degradado", "Indisponível") definido.

- [ ] CHK085 - Os textos do modal de histórico detalhado (cabeçalhos da tabela, labels de data) estão definidos em PT-BR? [Completude, Gap] {auto}
  > Gap: spec §FR-010 define `<IntegrationHistoryModal>` com "tabela de logs com status, latência, mensagem de erro, timestamp", mas não define as strings i18n dos cabeçalhos da tabela (ex: "Status", "Latência (ms)", "Mensagem", "Verificado em"). Ação: adicionar chaves i18n do modal a §FR-010 ou task.

- [x] CHK086 - O vocabulário pastoral é consistente (sem termos corporativos como "sistema offline", usando "Indisponível" em vez disso)? [Consistencia, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 usa "Saudável / Degradado / Indisponível" — não "Online/Offline/Error". Vocabulário pastoral consistente.

---

## Edge Cases UX

- [ ] CHK087 - O comportamento do dashboard quando TODAS as integrações estão unhealthy está especificado? [Edge Case, Gap] {auto}
  > Gap: spec §FR-010 define o painel por integração com badge por status, mas não especifica apresentação especial quando todas as 5 integrações estão `unhealthy` (ex: alerta de sistema crítico, diferente do stale banner). Ação: especificar ou aceitar o comportamento padrão (todos os badges vermelhos).

- [ ] CHK088 - O comportamento quando o histórico retorna 0 pontos (integração nova ou sem dados) está especificado? [Edge Case, Gap] {auto}
  > Gap: spec §FR-010 não define o estado vazio do sparkline (nenhum dado de histórico). `<LatencySparkline data={[]}>` com array vazio poderia renderizar SVG vazio ou mensagem "Sem histórico". Ação: definir o empty state do sparkline.

- [x] CHK089 - A mensagem de erro nas notificações de status é textual (não apenas ícone)? [Completude, Spec §FR-007] {auto}
  > Evidência: spec §FR-007 define `title: '⚠️ {integrationName} está {status}'` e `body: 'Latência: {latencyMs}ms | Verificado: {lastChecked}'`. Contém texto descritivo além do emoji.

---

## Notes

- Items `{auto}` resolvidos pelo agente com citação da spec/plan.
- **Gaps abertos (ação necessária)**: CHK069 (erro persistente de fetch), CHK074 (navegação por teclado), CHK076 (ARIA no SVG), CHK077 (tooltip acessível), CHK085 (i18n do modal), CHK087 (todas unhealthy), CHK088 (empty state sparkline).
- **Julgamento de produto** (humano): CHK063 (contraste exato dos badges), CHK066 (skeleton de loading), CHK081 (refresh em background tab), CHK082 (breakpoints mobile), CHK083 (touch targets).
- **Críticos para a11y (devem ir para task antes de execute-task)**: CHK076 (SVG sem ARIA é bloqueante para leitores de tela), CHK077 (tooltip inacessível por teclado).
- **Próximos passos**: CHK076/CHK077/CHK074 → adicionar à spec §FR-010 como requisitos a11y; CHK085 → adicionar i18n do modal; CHK088 → definir empty state.
