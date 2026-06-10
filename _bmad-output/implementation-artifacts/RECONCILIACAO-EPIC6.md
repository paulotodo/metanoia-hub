# Reconciliação WDS↔BMad — Epic 6 (Radar Pastoral)

> Pré-flight 2026-06-10. Auditoria do código real contra 6-1..6-6 (6 agentes).
> **Aviso**: diferente das waves de Release 1a, o Radar tem trabalho NOVO
> substancial — é o core domain e o maior investimento do produto.

## Resultado

| Story | Classificação | Tamanho do residual |
|---|---|---|
| 6-1 Vocabulário & governança | **NOVA (0%)** | Médio (foundational) |
| 6-2 Cálculo assíncrono do semáforo | **PARCIAL** (UI ok, engine nova) | Grande (foundational) |
| 6-3 Tendência + alertas | **NOVA (0%)** | Grande (depende 6-2) |
| 6-4 Perfil + ações de cuidado | **JÁ-COBERTA + residual** | Pequeno-médio |
| 6-5 Componentes UX | **PARCIAL** | Médio |
| 6-6 Dashboard agregado | **PARCIAL ~60%** | Médio-grande |

## Ordem recomendada (por dependências)
```
6-1 (vocabulary.ts)  →  6-2 (ParticipantRadarStatus + engine async)
                              ├─ 6-3 (trend/alertas estendem o model)
                              └─ 6-6 (agregação consome o model)
6-4 e 6-5 (UX) podem ir depois, usam vocabulary.ts (6-1) e o model (6-2)
```
Sugestão de sub-waves: **W1b.4a** = 6-1, 6-2; **W1b.4b** = 6-3, 6-6; **W1b.5** = 6-4, 6-5.

## 6-1 — NOVA (0%)
Vocabulário pastoral existe mas **disperso** (hardcoded em `semaforo-pill.tsx`,
`section-divider.tsx`; strings em pt-BR.json). Falta tudo:
1. `packages/types/src/vocabulary/vocabulary.ts` — typed constants `as const` (cuidado, acompanhamento, presença, atenção pastoral, semáforo, jornada, sinal de cuidado…).
2. ESLint custom rule (`packages/config`) bloqueando termos de vigilância (vigilância, tracking, monitoramento, surveillance, monitoring, rastreamento) — falha no CI com mensagem apontando vocabulary.ts.
3. `.github/CODEOWNERS` cobrindo `packages/types/src/vocabulary/`.
4. Refactor de `semaforo-pill.tsx` / `section-divider.tsx` p/ usar vocabulary.ts.
5. Snapshot test dos termos + teste da lint rule.

## 6-2 — PARCIAL (UI ~70%, engine NOVA)
Coberto (Cenário 01): `SemaforoPill`, `app/gestao/radar/page.tsx`, hook `useRadarPage`,
schemas `radar.ts` (SignalType). NOVO:
1. Model Prisma `ParticipantRadarStatus` (status verde/amarelo/vermelho, trend, presence_pct, last_active_at, calculated_at) + migration + RLS + RLS spec.
2. Constantes de threshold em `packages/types` (RADAR_GREEN/YELLOW/RED, ACTIVE/INACTIVE days).
3. Job/Processor BullMQ `queue:radar-calculation` — recalcula status por participante (presença últimas 3 reuniões + inatividade), persiste no model, cacheia em Redis `cache:radar:{tenantId}:{groupId}` TTL 5min. (Hoje o cálculo é síncrono inline em `pastoral.service.ts`.)
4. Refino UI a11y: tooltip acessível, `aria-live="polite"`, `prefers-reduced-motion`.

## 6-3 — NOVA (0%)
Nenhuma lógica de tendência nem de alertas read/dismiss. Residual:
1. Cálculo de trend (melhorando/estável/declínio) sobre histórico → grava em `ParticipantRadarStatus.trend` (estende 6-2).
2. Estender `PastoralAlert`: `previous_status`, `new_status`, `trend`, `read_at`, `dismissed_at` + dedup. Sem alerta em transição positiva (emitir evento p/ CelebrationBanner).
3. Endpoints: `GET /groups/:groupId/alerts`, `PATCH /alerts/:id/read`, `PATCH /alerts/:id/dismiss`.
4. Frontend `TrendIndicator` (↑→↓) no dashboard.
5. Tipos Zod (TrendType, PastoralAlertWithTrend).

## 6-4 — JÁ-COBERTA com residual
Coberto (Cenário 03): `pastoral_actions` (model+RLS+repo+endpoint POST), ParticipantCard
expandível, form de ação (textarea + undo 5s). Residual:
1. **TimelineCuidado individual** na página de perfil do participante (`/gestao/radar/[participantId]/perfil`) — mesclar sinais de presença + ações de cuidado em ordem reversa (hoje a timeline existe só em escopo de grupo). Endpoint `GET .../participants/:id/timeline`.
2. Empty state pastoral específico ("Nenhuma ação de cuidado registrada. Que tal começar com uma mensagem?").
3. AC#4 (trail progress "Em breve") → DEFERIR (depende Epic 8).

## 6-5 — PARCIAL
Coberto (Cenário 01): SaudacaoCard, InboxZeroState, presence-dots, return-banner,
radar-skeleton, grupo-pill. Residual:
1. **NudgePastoral** (NOVA): component `nudge-pastoral.tsx` + endpoint `GET /radar/nudges` + lógica de triggers (2+ ausências→ligação; vermelho→visita; 7+ dias inativo→mensagem).
2. Extrair hook reutilizável `useUndoableAction` (hoje a lógica de undo 5s está inline em `cuidado/page.tsx`).
3. CelebrationBanner (nice-to-have; casa com o evento de transição positiva de 6-3).
4. Trocar strings hardcoded por vocabulary.ts (depende 6-1).

## 6-6 — PARCIAL (~60%)
Coberto (Cenário 03): vista agregada `getChurchOverview` (grid de group-cards) + filtros UI
em `app/admin/igreja/vista`. Residual:
1. **Guardrail líder server-side (privacidade — importante)**: `findAllGroupsWithLeader()` hoje retorna TODOS os grupos do tenant; um líder veria todos. Filtrar por `RequestContext.userId` (ou endpoint `/overview/mine`).
2. Agregação BullMQ + cache Redis `cache:radar-aggregate:{tenantId}` TTL 30s + polling `refetchInterval: 30000`.
3. Viz avançada: summary cards (contadores verde/amarelo/vermelho), distribuição por grupo, trend geral.
4. Testes: AC#2 (isolamento líder) + AC#3 (cache hit).

## Notas
- 6-2/6-3/6-6 compartilham o motor assíncrono (BullMQ + `ParticipantRadarStatus` + Redis). Implementar 6-2 primeiro estabelece a base; 6-3 e 6-6 estendem.
- Constituição Princípio I (multi-tenancy): o guardrail líder de 6-6 e os RLS specs dos novos models são obrigatórios.
- 6-1 deve vir antes de 6-4/6-5 (que consomem vocabulary.ts).
