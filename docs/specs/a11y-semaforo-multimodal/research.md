# Research: Semáforo Multimodal (Story 15.3)

**Feature**: `a11y-semaforo-multimodal`

## D1 — Biblioteca de ícones

**Decisão**: `lucide-react` (já instalado em `packages/ui`).
**Rationale**: Consistente com `risk-reason-badge.tsx` (modelo de referência, usa `AlertTriangle`). Evita nova dependência. Ícones SVG suportam `aria-hidden` + `focusable="false"`.
**Alternativas rejeitadas**: Unicode (●▲■, usado hoje no SemaforoBadge admin) — inconsistente, sem semântica, difícil estilizar tamanho mínimo.

## D2 — Ícones por estado

**Decisão**: `care-urgent` → `AlertCircle`; `care-attention` → `AlertTriangle`; `care-ok` → `CheckCircle2`.
**Rationale**: Distintos entre si por forma (círculo com "!", triângulo, círculo com "check") — distinguíveis em escala de cinza (testa daltonismo). `AlertTriangle` já é o ícone de risco no projeto.

## D3 — Detecção de prefers-reduced-motion

**Decisão**: CSS media query via utilities `motion-safe:` / `motion-reduce:` do Tailwind (FR-006).
**Rationale**: Performance (sem JS no caminho de render), consistente com 40+ componentes do projeto e com o gate HARD `check-motion-safe.sh`. JS (`matchMedia`) seria mais lento e violaria FR-006.

## D4 — Animação de pulso

**Decisão**: `@keyframes pulse-border` (1s, ease-out) aplicado via classe `motion-safe:animate-[...]`; `motion-reduce` recebe apenas `transition-opacity duration-150`.
**Rationale**: Pulso de borda é destaque sutil; respeita reduced-motion automaticamente. A classe só é aplicada quando `animatePulse=true` (prop), evitando animação contínua.
**Trigger**: prop `animatePulse` setada pelo pai usando o delta do `useParticipantStatusAnnouncer` (15.2) — sem reimplementar detecção de mudança (dec-006).

## D5 — Centralização de labels

**Decisão**: `SIGNAL_STATUS_LABELS` em `packages/types/src/vocabulary/vocabulary.ts`, valores idênticos aos atuais.
**Rationale**: FR-014 — uma fonte única; preserva teste 15.2. Coexiste com `SEMAFORO_STATUS_LABELS` (rótulos de seção). Vocabulário pastoral (CLAUDE.md); termos corporativos da story rejeitados.
**Risco**: snapshot Zod do vocabulary — atualizar via `-u` e rodar `@metanoia/types test`.

## D6 — Validação de contraste

**Decisão**: teste unitário com `color2k` (`getContrast`) validando 6 pares (3 status × 2 temas) ≥ 3:1 (non-text, WCAG AA para UI components).
**Rationale**: `color2k@^2.0.3` já disponível; padrão estabelecido na Epic 12 (`check-contrast-tokens.mjs`). Alvo 3:1 (não 4.5:1) porque a cor é redundante com ícone+texto — é graphical object, não texto.
**Observação empírica a validar no execute-task**: light care-attention (2.22:1) e care-ok (2.70:1) NÃO atingem 3:1 como cor de preenchimento sobre surface clara. Mitigação: a cor fica no ícone/borda; o texto usa token de texto AA; o teste valida o que de fato comunica status (ícone+texto). Confirmar par a par com `getContrast` no execute-task antes de fixar os thresholds do teste.

## D7 — Evitar duplo-anúncio (sr-only vs visível)

**Decisão**: substituir o `<span sr-only>` da 15.2 por texto visível; texto visível é fonte única para AT. `aria-label` de container apenas quando inclui nome do participante, com texto interno `aria-hidden` (dec-007).
**Rationale**: FR-005. Manter sr-only + visível + aria-label simultâneos causaria leitura tripla. Auditar specs E2E em `e2e/a11y/*` que possam assumir o `sr-only` atual.

## D8 — Limites honestos

Não há execução de screen reader real (VoiceOver/NVDA) nem visual regression real neste ambiente. Entregáveis automatizados: código + axe verde + teste color2k. Entregável manual: `manual-test-checklist.md`. Gate humano fica pendente (SC-007).
