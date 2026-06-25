# Feature Specification: Semáforo Multimodal — Ícones, Texto Complementar & ARIA

**Feature**: `a11y-semaforo-multimodal`
**Epic**: 15 — Story 15.3 (NFR-A5)
**Created**: 2026-06-25
**Status**: Draft

## Context

O sistema de semáforo pastoral (care-urgent / care-attention / care-ok) atualmente comunica status por cor e, em alguns componentes, por texto sr-only (visível apenas a leitores de tela). Usuários com deficiência de visão de cores, usuários sem tecnologia assistiva e usuários com leitores de tela recebem experiências inconsistentes.

Esta feature garante que **todo componente de status pastoral exporte 3 canais simultâneos**: cor (via tokens pastorais do projeto), ícone distinto e texto visível — tornando o status compreensível independente de como a interface é percebida.

> Decisões de infraestrutura: N/A — feature stateless, sem scheduling, sem persistência nova, sem tokens externos.

---

## User Scenarios & Testing

### User Story 1 — Status sempre visível por ícone + texto (Priority: P1)

Como usuário com deficiência de visão de cores (deuteranopia, protanopia) que usa o painel do radar pastoral,
quero que o status de cada participante seja expresso por um ícone distinto **e** um rótulo de texto visível além da cor,
para que eu possa identificar o estado de cuidado de cada pessoa sem depender de percepção de cor.

**Why this priority**: Requisito WCAG 1.4.1 (Use of Color — Level A). Sem isso, a plataforma falha em acessibilidade legal e exclui parcela significativa de líderes com daltonismo.

**Independent Test**: Renderizar os 3 estados do semáforo com filtro de simulação de daltonismo (Deuteranopia) aplicado no navegador — os 3 estados devem ser distinguíveis apenas pelo ícone + texto, sem olhar para a cor.

**Acceptance Scenarios**:

1. **Given** o painel do radar está aberto, **When** um participante é exibido com status "care-urgent", **Then** o componente exibe: ícone de alerta crítico (distinto) + rótulo de texto sempre visível + cor pastoral urgente — todas as 3 pistas simultâneas.
2. **Given** o painel do radar está aberto, **When** um participante é exibido com status "care-attention", **Then** o componente exibe: ícone de atenção (distinto de urgente) + rótulo de texto sempre visível + cor pastoral de atenção.
3. **Given** o painel do radar está aberto, **When** um participante é exibido com status "care-ok", **Then** o componente exibe: ícone de bem-estar (distinto dos demais) + rótulo de texto sempre visível + cor pastoral ok.
4. **Given** todos os 3 estados são exibidos simultaneamente, **When** inspecionados sem cor (escala de cinza), **Then** os ícones e textos por si só permitem distinguir os 3 estados sem ambiguidade.
5. **Given** o SemaforoBadge no relatório administrativo exibe um dos 3 estados, **When** renderizado, **Then** o ícone Lucide substitui o símbolo Unicode anterior (●▲■) com ícone semanticamente apropriado + texto.

---

### User Story 2 — Leitores de tela anunciam status sem duplo anúncio (Priority: P1)

Como usuário que navega o radar pastoral com leitor de tela (VoiceOver, NVDA),
quero que o status do participante seja anunciado uma única vez com contexto completo,
para que eu entenda o estado de cuidado sem ouvir a mesma informação repetida.

**Why this priority**: Duplicação de anúncios (texto visível + sr-only + aria-label simultâneos) é anti-padrão crítico de acessibilidade que confunde e frustra usuários de AT.

**Independent Test**: Navegar por teclado pelo ParticipantCard com leitor de tela ativo e verificar que o status é anunciado exatamente uma vez por participante, incluindo nome e estado.

**Acceptance Scenarios**:

1. **Given** um ParticipantCard renderiza status "care-urgent", **When** o leitor de tela foca no card, **Then** o anúncio inclui o nome do participante e o rótulo de status — e o mesmo texto NÃO é anunciado duas vezes consecutivas.
2. **Given** o texto de status agora é visível (não sr-only), **When** o leitor de tela encontra o texto visível, **Then** o ícone Lucide tem `aria-hidden="true"` e `focusable="false"` — o AT lê apenas o texto, não descreve o ícone.
3. **Given** um `aria-label` contextual existe no componente de status, **When** o AT encontra o componente, **Then** o aria-label contém "{rótuloDStatus} — {nomeDoParticipante}" e o texto visível interno é suprimido do AT via `aria-hidden` no elemento filho ou via `aria-label` no container.
4. **Given** o componente de SemaforoPill (filtros de seção), **When** o AT o encontra, **Then** o `aria-label` do botão descreve a categoria + contagem, e o ícone interno tem `aria-hidden="true"`.

> **Resolvido (Q1-LABELS, dec-005)**: O badge por-participante usa "Urgente" / "Atenção necessária" / "Bem" (STATUS_LABEL da 15.2), centralizados em `packages/types` como `SIGNAL_STATUS_LABELS` sem alterar valores. Termos corporativos da story ("Ativo"/"Crítico") rejeitados.

---

### User Story 3 — Transição de status anunciada e animada com respeito a motion (Priority: P2)

Como usuário que monitora o radar em tempo real durante uma reunião,
quero que mudanças de status sejam visualmente destacadas E anunciadas ao leitor de tela,
para que eu perceba atualizações mesmo quando minha atenção está em outra parte da tela.

**Why this priority**: A infraestrutura SSE da 15.2 já entrega o delta; a 15.3 fecha o ciclo com destaque visual (pulso 1s) + respeito a `prefers-reduced-motion`.

**Independent Test**: Simular mudança de status via SSE (ou mock) e verificar: (a) pulso visual aparece por ~1s; (b) com `prefers-reduced-motion: reduce` no SO, nenhuma animação de pulso ocorre, apenas transição de opacidade ≤ 0.15s; (c) o leitor de tela anuncia a mudança (via região aria-live já existente da 15.2).

**Acceptance Scenarios**:

1. **Given** `prefers-reduced-motion` NÃO está ativo, **When** o status de um participante muda via SSE, **Then** o badge exibe destaque visual de pulso (~1s) controlado por CSS media query — sem JavaScript para detectar a preferência.
2. **Given** `prefers-reduced-motion: reduce` está ativo no SO, **When** o status muda, **Then** nenhuma animação de pulso ocorre; apenas uma transição de opacidade curta (≤ 0.15s) indica a mudança.
3. **Given** qualquer mudança de status, **When** ocorre, **Then** a região `aria-live="polite"` já existente (SemaforoStatusRegion / useParticipantStatusAnnouncer da 15.2) anuncia a mudança — a 15.3 reutiliza essa infraestrutura sem duplicar regiões aria-live.
4. **Given** o gate de CI `check-motion-safe.sh --ci` é executado, **When** o código de animação de pulso é avaliado, **Then** qualquer `transition-*` ou `animate-*` sem prefixo `motion-safe:` causa falha de lint.

> **Resolvido (Q2-PULSE-TRIGGER, dec-006)**: O badge aceita prop `animatePulse?: boolean`. O pai (ParticipantCard) detecta o delta reutilizando o sinal do `useParticipantStatusAnnouncer` (15.2) e seta a prop, limpando-a após 1s. O badge não conhece SSE; apenas recebe o sinal. Mantém o badge desacoplado de SSE e reutiliza a detecção de delta existente.

---

### User Story 4 — Modo compacto: ícone sempre presente, texto abreviado acessível (Priority: P2)

Como líder pastoral que consulta o dashboard em dispositivo móvel ou em visualização comprimida,
quero que o ícone de status seja sempre visível mesmo no modo compacto,
para que eu identifique rapidamente o estado de cuidado sem precisar expandir o card.

**Why this priority**: Modo compacto é o estado padrão para "care-ok" no ParticipantCard (exibição em lista) e em contextos de visualização resumida.

**Independent Test**: Renderizar o badge em modo compacto (tamanho mínimo) e verificar: (a) ícone visível com ≥ 16×16px; (b) texto abreviado visível; (c) `aria-label` contém o texto completo do status; (d) `title` não é usado (inacessível em toque/mobile).

**Acceptance Scenarios**:

1. **Given** um componente de status está em modo compacto, **When** renderizado, **Then** o ícone ocupa no mínimo 16×16px e é sempre visível (não colapsado).
2. **Given** modo compacto ativo, **When** o texto de status é exibido, **Then** pode ser abreviado visualmente, mas o `aria-label` do componente contém sempre o texto completo do status.
3. **Given** modo compacto ativo, **When** o AT navega para o componente, **Then** o `title` HTML NÃO é usado para expor o texto completo — somente `aria-label` ou `sr-only` são válidos.

---

### User Story 5 — Dark mode: contraste validado automaticamente (Priority: P2)

Como usuário que utiliza a plataforma no modo escuro,
quero que os ícones e badges de status pastoral mantenham contraste visual adequado,
para que o estado de cuidado seja legível independente do tema.

**Why this priority**: Os tokens pastorais `care-*` já existem para dark mode; o risco é que uma mudança de componente altere os contrastes sem que haja um gate automatizado que detecte a regressão.

**Independent Test**: Executar o teste unitário `color2k` que valida cada combinação de cor de status (care-urgent, care-attention, care-ok) contra o background de superfície escura — resultado deve ser ≥ 3:1 para todos.

**Acceptance Scenarios**:

1. **Given** a plataforma está em dark mode, **When** os badges de status pastoral são renderizados, **Then** os tokens de cor escuros (`care-urgent` dark, `care-attention` dark, `care-ok` dark) são aplicados e mantêm contraste ≥ 3:1 contra o background de superfície correspondente.
2. **Given** o teste unitário `color2k` é executado em CI, **When** qualquer token de cor `care-*` muda, **Then** o teste falha automaticamente se o contraste cair abaixo de 3:1 para qualquer combinação status × tema.
3. **Given** o gate `check-contrast-tokens.mjs` é executado (gate HARD existente), **When** aplicado aos novos badges, **Then** não registra regressão nos tokens pastorais.

---

### Edge Cases

- O que acontece quando um participante tem status "care-ok" e é exibido no modo compacto em lista com dezenas de outros? O ícone deve permanecer visível sem criar poluição visual — tamanho mínimo garantido sem overflow.
- O que acontece quando a animação de pulso termina e o leitor de tela ainda está anunciando a mudança? A animação CSS é independente do aria-live — não deve haver race condition.
- O que acontece se o `useParticipantStatusAnnouncer` emitir múltiplos deltas em sequência rápida (3s window)? O comportamento de debounce da 15.2 já trata isso — a 15.3 não altera essa lógica.
- O que acontece com o SemaforoBadge no relatório administrativo quando status é desconhecido ou inválido? Deve haver fallback gracioso (ícone genérico + texto "Status desconhecido") sem quebrar o componente.
- O que acontece com GroupCard/status-indicator que usa `PastoralStatus` (healthy/attention/call/no-signal) em vez de `SignalType`? Este componente está **fora do escopo da 15.3** — documentado como follow-up técnico para não criar refactor de escopo ampliado.

---

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE exibir ícone distinto por estado de status (`care-urgent`, `care-attention`, `care-ok`) em todos os componentes de semáforo no escopo desta feature.
- **FR-002**: O sistema DEVE exibir rótulo de texto visível (não apenas sr-only) em todos os componentes de semáforo no escopo, indicando o estado de status de forma legível.
- **FR-003**: O sistema DEVE garantir que ícone + texto sejam suficientes para distinguir os 3 estados sem depender de percepção de cor (testável com simulação de daltonismo).
- **FR-004**: O sistema DEVE aplicar `aria-hidden="true"` e `focusable="false"` em todos os ícones de status (o texto carrega o significado para AT).
- **FR-005**: O sistema DEVE fornecer `aria-label` contextual em componentes de status que combine rótulo de status + nome do participante quando aplicável, sem duplicar o anúncio com texto visível interno.
- **FR-006**: O sistema DEVE implementar animação de destaque (pulso) na transição de status via CSS `@keyframes` com `motion-safe:` — **nunca** via JavaScript para detectar `prefers-reduced-motion`.
- **FR-007**: O sistema DEVE suprimir a animação de pulso quando `prefers-reduced-motion: reduce` está ativo, usando apenas transição de opacidade ≤ 0.15s.
- **FR-008**: O sistema DEVE manter compatibilidade com a região `aria-live` existente (SemaforoStatusRegion + useParticipantStatusAnnouncer da 15.2) — não criar regiões aria-live duplicadas.
- **FR-009**: O sistema DEVE garantir que componentes de status em modo compacto exibam ícone com dimensão mínima de 16×16px.
- **FR-010**: O sistema DEVE usar `aria-label` (nunca `title`) para expor texto completo de status em modo compacto.
- **FR-011**: O sistema DEVE validar automaticamente o contraste dos tokens `care-*` em dark mode via teste unitário `color2k` (≥ 3:1 para conteúdo não-textual, conforme WCAG AA).
- **FR-012**: O sistema DEVE usar os tokens pastorais `care-*` do projeto (definidos em `packages/ui/styles/tokens.css`) — **não** valores hexadecimais genéricos avulsos.
- **FR-013**: Os rótulos de texto de status visíveis DEVEM usar vocabulário pastoral (não termos corporativos como "Crítico" ou "Ativo") — alinhado com `CLAUDE.md` e `docs/project-context.md`.
- **FR-014**: A fonte de rótulos de status por-participante DEVE ser centralizada em `packages/types` como exportação única, eliminando as duplicatas atuais em `participant-card.tsx` e `use-participant-status-announcer.ts`, **sem alterar os valores atuais** (preservando o teste `"João — Urgente"` da 15.2).
- **FR-015**: O SemaforoBadge no relatório administrativo DEVE substituir os símbolos Unicode (●▲■) por ícones da mesma biblioteca de ícones usada nos demais componentes.

### Key Entities

- **StatusIcon**: representação visual distinta (ícone) por estado de status pastoral — 3 valores, um por estado.
- **StatusLabel**: rótulo textual por estado de status pastoral, centralizado em `packages/types` — fonte única para badge por-participante e para announcer da 15.2.
- **StatusBadge**: componente que combina ícone + rótulo + cor; suporta modo compacto; recebe `participantName` opcional para `aria-label` contextual.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% dos componentes de semáforo no escopo (SemaforoPill, ParticipantCard 3 variantes, SemaforoBadge do relatório) exibem ícone + texto visível + cor simultâneos após a entrega.
- **SC-002**: 0 violations reportadas pela ferramenta axe-core nas páginas que contêm componentes de semáforo (`/app/gestao/radar`, `/app/admin/igreja/relatorio`) relacionadas a "color only" ou ausência de texto alternativo.
- **SC-003**: O teste unitário `color2k` valida ≥ 3:1 de contraste para todos os tokens `care-*` (3 estados × 2 temas = 6 combinações) e roda em CI sem flake.
- **SC-004**: 0 regressões nos testes existentes da 15.2 (`"João — Urgente"`, aria-live, announcer debounce) após a unificação da fonte de rótulos.
- **SC-005**: O gate `check-motion-safe.sh --ci` passa sem erros após adição da animação de pulso — nenhuma `transition-*` ou `animate-*` sem `motion-safe:` no novo código.
- **SC-006**: Os 3 gates HARD de a11y (`check-focus-ring-variants.sh --ci`, `check-contrast-tokens.mjs`, `check-motion-safe.sh --ci`) continuam passando sem regressão.
- **SC-007**: `manual-test-checklist.md` entregue cobrindo: simulação de daltonismo (ícone+texto distinguem sem cor), `prefers-reduced-motion`, dark mode, e navegação por leitor de tela.

## Clarifications

Resolvidas autonomamente na fase clarify (asker retornou `perguntas:[]`; answerer não foi spawnado pois as ambiguidades têm recomendação suficiente na própria spec — score ≥ 2).

### Q1-LABELS — Qual rótulo exibir no badge por-participante? (dec-005)

**Decisão**: Opção A — "Urgente" / "Atenção necessária" / "Bem" (STATUS_LABEL da 15.2). Centralizar como `SIGNAL_STATUS_LABELS` em `packages/types` sem alterar valores. SEMAFORO_STATUS_LABELS permanece para títulos de seção (plural). Termos corporativos ("Ativo"/"Crítico") rejeitados por CLAUDE.md (vocabulário pastoral). Preserva o teste `"João — Urgente"` da 15.2.

### Q2-PULSE-TRIGGER — Como acionar a animação de pulso? (dec-006)

**Decisão**: Opção A — badge aceita prop `animatePulse?: boolean`. O pai (ParticipantCard) detecta o delta reutilizando o `useParticipantStatusAnnouncer` (15.2) e seta a prop, limpando após 1s. O badge não conhece SSE; só recebe o sinal.

### Q3-SR-ONLY — Conciliar sr-only (15.2) com texto visível (15.3) sem duplo-anúncio (dec-007)

**Decisão**: Substituir o `<span class="sr-only">` da 15.2 por ícone (`aria-hidden`) + texto **visível** que carrega o significado para o AT. Evitar duplo-anúncio: NÃO manter sr-only paralelo + texto visível + aria-label redundante simultaneamente. O texto visível é a fonte única; quando um `aria-label` de container for necessário (ex: incluir nome do participante), o texto interno fica `aria-hidden` para o AT ler apenas o aria-label uma vez.
