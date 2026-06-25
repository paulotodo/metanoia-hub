# Implementation Plan: Semáforo Multimodal (Story 15.3)

**Feature**: `a11y-semaforo-multimodal`
**Spec**: `docs/specs/a11y-semaforo-multimodal/spec.md`
**Created**: 2026-06-25
**Status**: Draft

## Technical Context

- **Stack**: Next.js 16.2 (App Router, Client Components na área autenticada), Tailwind CSS 4.2.2, `lucide-react` (já instalado em `packages/ui`), `color2k@^2.0.3` (já em `apps/web/package.json`), Vitest 4.1.2.
- **Tokens pastorais** (`packages/ui/styles/tokens.css`):
  - Light: `--color-care-urgent: #c1666b`, `--color-care-attention: #d4a24c`, `--color-care-ok: #7ba38a`.
  - Dark: `--color-care-urgent: #d4918a`, `--color-care-attention: #e0bd7a`, `--color-care-ok: #96bda4`.
  - Surface dark: `--color-surface-base: #1a1a1a`, `--color-surface-elevated: #2a2a2a`.
- **Infra existente reutilizada (15.1/15.2)**: `motion-safe:` utilities + gate `check-motion-safe.sh`; `SemaforoStatusRegion` + `useParticipantStatusAnnouncer` (aria-live SSE); `check-contrast-tokens.mjs` (gate HARD); `risk-reason-badge.tsx` como modelo de referência.

## Decisões de design (das clarificações)

| Ref | Decisão |
|-----|---------|
| dec-005 (Q1-LABELS) | Centralizar STATUS_LABEL em `packages/types` como `SIGNAL_STATUS_LABELS = { 'care-urgent':'Urgente', 'care-attention':'Atenção necessária', 'care-ok':'Bem' }`. Valores idênticos aos atuais → teste 15.2 preservado. |
| dec-006 (Q2-PULSE) | Badge recebe prop `animatePulse?: boolean`; pai detecta delta e seta/limpa após 1s. |
| dec-007 (SR-ONLY) | Substituir `<span sr-only>` por ícone (`aria-hidden`) + texto visível; texto visível é fonte única para AT (sem aria-label redundante). |

## Arquitetura da solução

### Componente novo: `SemaforoStatusBadge`

Localização: `apps/web/app/(authenticated)/app/gestao/radar/_components/semaforo-status-badge.tsx`

Componente reutilizável (Client Component) — fonte canônica do trio cor+ícone+texto por participante. Props:

```
interface SemaforoStatusBadgeProps {
  signalType: SignalType;          // 'care-urgent' | 'care-attention' | 'care-ok'
  participantName?: string;        // se presente, compõe aria-label
  compact?: boolean;               // modo compacto (ícone >= 16px, texto abreviado)
  animatePulse?: boolean;          // aciona pulso 1s (motion-safe)
}
```

Mapeamento ícone (Lucide):
- `care-urgent` → `AlertCircle`
- `care-attention` → `AlertTriangle`
- `care-ok` → `CheckCircle2`

Regras ARIA (FR-004, FR-005, FR-010):
- Ícone: `aria-hidden="true"` + `focusable="false"`.
- Texto visível carrega o significado. Quando `participantName` presente: container recebe `aria-label="{label} — {name}"` e o texto visível interno fica `aria-hidden` (evita duplo-anúncio, dec-007).
- Modo compacto: texto abreviado visível; `aria-label` sempre com texto completo; **nunca** `title`.

Cor (FR-012): classes Tailwind `text-care-*` (light + dark automático via tokens). Pulso (FR-006/FR-007): `motion-safe:animate-[pulse-border_1s_ease-out]` quando `animatePulse`; `motion-reduce` → apenas `transition-opacity duration-150`.

### Reconciliação de labels (FR-014)

1. Adicionar `SIGNAL_STATUS_LABELS` em `packages/types/src/vocabulary/vocabulary.ts` (junto de SEMAFORO_STATUS_LABELS, que permanece para títulos de seção).
2. Exportar via `packages/types/src/vocabulary/index.ts` e `packages/types/src/index.ts`.
3. Substituir o `STATUS_LABEL` local em `participant-card.tsx` e `use-participant-status-announcer.ts` por import de `SIGNAL_STATUS_LABELS`.
4. Atualizar snapshot Zod/vocabulary se o snapshot test cobrir o mapa exportado.

### Integração nos componentes em escopo

| Componente | Mudança |
|-----------|---------|
| `participant-card.tsx` (3 variantes) | Substituir `<span sr-only>{STATUS_LABEL}</span>` por `<SemaforoStatusBadge signalType participantName>` visível; importar label de packages/types; passar `animatePulse` via delta do announcer. |
| `semaforo-pill.tsx` | Adicionar ícone Lucide (`aria-hidden`) ao lado da contagem; manter `SEMAFORO_STATUS_LABELS` (rótulos de seção) e role=switch. |
| `semaforo-badge.tsx` (admin/relatorio) | Trocar Unicode (●▲■) por Lucide (CheckCircle2/AlertTriangle/AlertCircle); manter `data-testid={semaforo-${status}}` e mapeamento verde/amarelo/vermelho. |

### Detecção de pulso no ParticipantCard

Reutilizar o delta já calculado pelo `useParticipantStatusAnnouncer` (15.2): expor o conjunto de IDs com delta recente OU adicionar callback que o card consome para setar `animatePulse=true` por 1s via `useState`+`setTimeout`. Sem JS para `prefers-reduced-motion` — a animação CSS já é suprimida por `motion-safe:`.

### Teste color2k (FR-011, SC-003)

Novo teste co-localizado: `apps/web/app/(authenticated)/app/gestao/radar/_components/__tests__/semaforo-status-badge.contrast.spec.ts` (ou estender o padrão existente). Usa `color2k` `getContrast()` para validar os 6 pares (3 status × 2 temas) ≥ 3:1 contra a surface correspondente. Falha o teste se qualquer par cair abaixo de 3:1.

> **Nota**: tokens light care-attention (#d4a24c, 2.22:1) e care-ok (#7ba38a, 2.70:1) NÃO passam 4.5:1 como **texto**, mas como cor de **ícone/badge não-textual** o alvo WCAG é 3:1. O ícone+texto carregam significado redundante; a cor é decorativa. O teste color2k valida ≥ 3:1 (non-text) — não 4.5:1. Validar empiricamente no execute-task que os pares dark passam 3:1; se um par light não atingir 3:1 como UI component, usar `text-care-*` em conjunto com o texto legível (que usa token de texto AA), mantendo a cor apenas no ícone/borda.

## Riscos & mitigações

| Risco | Mitigação |
|-------|-----------|
| Duplo-anúncio AT ao adicionar texto visível | dec-007: texto visível como fonte única; aria-label só quando inclui nome, com texto interno aria-hidden. Validar com audit dos specs E2E em `e2e/a11y/*`. |
| Quebrar teste `"João — Urgente"` da 15.2 | FR-014: valores idênticos; só muda a origem do import. Rodar `pnpm --filter @metanoia/web test` + `@metanoia/types test`. |
| Animação sem `motion-safe:` falha gate Lint HARD | Toda classe de animação com prefixo `motion-safe:`; rodar `check-motion-safe.sh --ci` após cada mudança. |
| E2E que assume data-testid/touch-target em elementos interativos | Auditar `e2e/keyboard/*` e `e2e/a11y/*` antes de fechar; manter data-testid existentes. |
| Par de contraste light < 3:1 como UI | Usar cor no ícone/borda + texto em token AA; teste color2k valida 3:1 non-text. |

## Fora de escopo (follow-up)

- `GroupCard`/`status-indicator.tsx` (admin/igreja/vista): usa tipo `PastoralStatus` (healthy/attention/call/no-signal) ≠ `SignalType` e tokens emerald/amber/red. Reconciliar é refactor amplo → documentado como follow-up técnico, NÃO nesta story.
- Screen reader real (VoiceOver/NVDA) e visual regression real: entregues como `manual-test-checklist.md` (gate humano pendente, SC-007).

## Validation gates (ordem)

1. `pnpm turbo lint` (--force ao revalidar)
2. `pnpm --filter @metanoia/types test` (se tocar vocabulary — snapshot Zod)
3. `pnpm --filter @metanoia/web test`
4. `node apps/web/scripts/check-contrast-tokens.mjs`
5. `apps/web/scripts/check-motion-safe.sh --ci`
6. `apps/web/scripts/check-focus-ring-variants.sh --ci`
7. `pnpm turbo build --filter=@metanoia/web`
