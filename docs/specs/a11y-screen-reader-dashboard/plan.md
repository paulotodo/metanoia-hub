# Plan: a11y-screen-reader-dashboard (Story 15.2)

**Spec**: `docs/specs/a11y-screen-reader-dashboard/spec.md`
**Versão**: 1.0.0
**Data**: 2026-06-25
**Status**: draft

---

## 1. Visão Técnica

Story de FE/a11y pura: adicionar semântica de screen reader ao Radar Pastoral e anúncios `aria-live` para mudanças SSE. **Zero** mudança de backend, schema, auth ou contrato de API. Reusa infraestrutura existente (`useAsyncAnnouncer`, `useNotificationSilence`, `ParticipantCard`, `SemaforoPill`, `GrupoPillFilter`, `use-notification-stream`).

> Decisões de infraestrutura: N/A (stateless, sem scheduling, sem dados novos).

---

## 2. Mapa de Arquivos (rotas REAIS verificadas)

| Alvo | Caminho | Mudança |
|------|---------|---------|
| Radar page | `apps/web/app/(authenticated)/app/gestao/radar/page.tsx` | (a) `document.title` dinâmico via `useEffect`; (b) consumir hook de anúncio; (c) `aria-live` de contagem pós-filtro |
| ParticipantCard | `apps/web/app/(authenticated)/app/gestao/radar/_components/participant-card.tsx` | (a) `aria-label` status no raiz de Expanded/Medium; (b) `aria-controls`+`id` no Compact |
| Status helper | `apps/web/app/(authenticated)/app/gestao/radar/_components/` (novo `status-label.ts` ou inline) | mapa `signalType → texto pt-BR` ("Urgente"/"Atenção necessária"/"Bem") |
| Announce hook | `apps/web/app/(authenticated)/app/gestao/radar/` (novo `use-participant-status-announcer.ts`, co-located) | debounce 3s, respeita silenciar, compara snapshots |
| SSE reconexão | `apps/web/src/hooks/use-notification-stream.ts` | grace period 5s pós-reconexão + anúncio batched (se aplicável ao escopo radar) |
| Ratchet | `a11y-pages.json` (raiz do repo) | `dashboard-lider` e `radar-pastoral`: `baseline` → `hard` |
| Anti-redirect | `apps/web/e2e/a11y/axe-quality-gate.e2e-spec.ts` | asserção inline no bloco `[axe:hard]` (data-driven) |
| i18n | `apps/web/messages/pt-BR.json` | novas strings de status/anúncio se necessário |
| Roteiro manual | `docs/specs/a11y-screen-reader-dashboard/manual-test-checklist.md` | gate humano |

---

## 3. Estado Atual Verificado (sondas empíricas)

### 3.1 Já cobre (NÃO reimplementar — confirmado por código)
- `SemaforoPill`: `role="switch"` + `aria-pressed` (`getAriaPressed`) + `aria-label` + wrapper `aria-live="polite"` (semaforo-pill.tsx:55-142). **Pills já semânticos.**
- `GrupoPillFilter`: `role="radiogroup"` + `role="radio"` + `aria-checked` (grupo-pill.tsx:20-45). **Filtro de grupo já semântico.**
- `status-summary-card.tsx:32`: `role="status"` + aria-label contextual (dashboard admin — fora do fluxo líder).
- `ConnectionStatus`: `aria-live="polite"` + estados texto+botão (connection-status.tsx).
- `use-notification-stream.ts:144`: silenciar já suprime `announce()`.
- Timeline cuidado: `<ul>/<li>` semântico — **sem `<table>` → AC#5 N/A**.
- `ParticipantCardCompact`: painel expandido já usa `<ul>/<li>` (apenas falta `aria-controls`).

### 3.2 Gaps a implementar (confirmados)
1. **ParticipantCard status cor-only**: `border-l-care-urgent`/`border-l-care-attention` sem texto. `grep` confirmou **zero** `aria-labelledby` interno → adicionar `aria-label` no raiz sem conflito (dec-009).
2. **`aria-controls` ausente** no `<button>` do Compact (participant-card.tsx:~117 tem `aria-expanded`, falta `aria-controls`).
3. **Title estático**: radar/page.tsx é `"use client"` com `selectedGroupId` via `useState` → `document.title` em `useEffect` (dec-012; `generateMetadata` server-only não captura estado client-side).
4. **Anúncio SSE de participante**: dados via `useRadarPage` (TanStack Query); nenhum announce ao mudar `signalType`. Novo hook compara snapshots, debounce 3s (dec-010, co-located).
5. **`aria-live` contagem pós-filtro** (RF-03): região com "{n} participantes visíveis".
6. **Grace period 5s reconexão** (RF-06/07): gap-fill imediato hoje; adicionar janela de silêncio + anúncio "Conexão restaurada. {n} atualizados".

---

## 4. Decisões de Design (das clarificações)

| # | Decisão | Implementação |
|---|---------|---------------|
| C1 | `aria-label` no elemento raiz | `<div aria-label={...}>` (Expanded), `<Link aria-label={...}>` (Medium) |
| C2 | Textos: "Urgente"/"Atenção necessária"/"Bem" | mapa em pt-BR.json ou const; usado no aria-label |
| C3 | Hook co-located | `use-participant-status-announcer.ts` no dir do radar |
| C4 | Anti-redirect inline | adicionar no bloco `[axe:hard]` após `goto`, antes de `analyze()` |
| C5 | `document.title` via `useEffect` | `useEffect(() => { document.title = ... }, [groupName])` |

---

## 5. Abordagem por AC

### AC-1 (status textual) + AC-2 (`aria-controls`)
- Criar mapa `STATUS_LABEL: Record<SignalType, string>`.
- `ParticipantCardExpanded`: `<div aria-label={`${participant.name} — ${STATUS_LABEL["care-urgent"]}`}>`. O `<Link>` interno mantém navegação; aria-label no `<div>` raiz descreve o card como região.
- `ParticipantCardMedium`: `aria-label` no `<Link>` raiz (cuidado: `aria-label` em `<a>` sobrescreve conteúdo filho para AT — incluir nome + status + ação implícita "Ver").
- `ParticipantCardCompact`: gerar `panelId = useId()`; `<button aria-controls={panelId}>`; `<ul id={panelId}>`.

### AC-3 (filtro anuncia)
- Região `aria-live="polite"` (sr-only ou visível) na page; texto recalculado de `counts`/`activePill`. Suprimir anúncio no primeiro render (montagem) para não anunciar no load.

### AC-4 (title dinâmico)
- `useEffect(() => { const g = data?.groups.find(...)?.name; document.title = g ? `Radar Pastoral — ${g}` : "Radar Pastoral"; }, [selectedGroupId, data])`. Cleanup opcional ao desmontar.

### AC-5 (anúncio SSE participante + debounce + silenciar)
- `useParticipantStatusAnnouncer(participants, { silenced })`:
  - mantém `useRef` do snapshot anterior (`Map<participantId, signalType>`).
  - em mudança, acumula deltas; `setTimeout` 3s (resetado a cada novo delta dentro da janela).
  - ao disparar: se `silenced` → no-op; senão `announce(...)` (1 mudança → nome+status; 2+ → "{n} participantes atualizados").
  - usa `useNotificationSilence` para `silenced`; `useAsyncAnnouncer` para `announce`.
  - quando silenciado, a região `aria-live` correspondente deve ser `"off"`.

### AC-6 (reconexão grace 5s)
- Em `use-notification-stream.ts`: ref `isPostReconnect`; ao transicionar para `connected` após `reconnecting`, ativar flag 5s. Durante a janela, suprimir announces individuais; ao expirar, contar deltas do gap-fill e emitir 1 anúncio "Conexão restaurada. {n} participantes atualizados.". O indicador visual (`ConnectionStatus`) já some ao voltar a `connected`.

### AC-7 (ratchet hard + anti-redirect)
- `a11y-pages.json`: trocar `"gate": "baseline"` → `"gate": "hard"` em `dashboard-lider` e `radar-pastoral` (SOMENTE após axe local dar 0).
- `axe-quality-gate.e2e-spec.ts` bloco `[axe:hard]`: após `goto`, antes de `analyze()`, asserção que o conteúdo autenticado real carregou (ex: `expect(pwPage.url()).not.toContain('/login')` + presença de landmark/h1 esperado).

---

## 6. Validation Gates (antes de fechar execute-task)

Conforme `docs/project-context.md` e lição 15.1:
1. `pnpm turbo lint` (monorepo; `--force` ao revalidar)
2. `pnpm --filter @metanoia/web test`
3. `pnpm turbo build --filter=@metanoia/web`
4. Gates a11y HARD (re-rodar após QUALQUER mudança de className):
   - `bash scripts/check-focus-ring-variants.sh --ci`
   - `node apps/web/scripts/check-contrast-tokens.mjs`
   - `bash scripts/check-motion-safe.sh --ci`
5. **NUNCA** `transition-*` sem `motion-safe:` (gate Lint HARD).
6. E2E (lição 15.1): auditar specs em `apps/web/e2e/{keyboard,a11y}/` que assumem `data-testid`/touch-target/`:active` ANTES de fechar. SSE specs mockam EventSource (sem livekit).
7. axe local nas 2 páginas → confirmar 0 ANTES de promover ratchet.

---

## 7. Riscos & Mitigações

| Risco | Mitigação |
|-------|-----------|
| `aria-label` no `<Link>` Medium oculta conteúdo filho para AT | Incluir todo o contexto necessário no aria-label (nome + status); validar com axe |
| Mudança de className quebra gates a11y (focus-ring/contrast/motion) | Re-rodar os 3 gates após cada edição de className (lição 15.1) |
| E2E keyboard/a11y assume estrutura DOM atual do card | Auditar specs E2E antes de fechar; cards mudam de `<div>`/`<Link>` |
| Promover ratchet hard antes de axe=0 → CI vermelho | Rodar axe local primeiro; só então editar a11y-pages.json |
| SSE grace 5s interfere com gap-fill existente | Mudança mínima e localizada; testes mockam EventSource |
| Title dinâmico em Client Component | `document.title` em `useEffect` — padrão portável, sem dep nova |

---

## 8. Fora de Escopo (reafirmado)
- Busca full-text de participantes (não existe; só semântica no filtro).
- Semáforo visual ícone+texto (Story 15.3).
- Tabelas `<caption>/<th scope>` (sem `<table>` real → N/A).
- Teste real com VoiceOver/NVDA/JAWS → roteiro manual (gate humano).
