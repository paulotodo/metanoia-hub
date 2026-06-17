# Quickstart / Cenários de Teste — Relatório Consolidado por Líder (FR79)

Formato: passos → **Expected**. Cobre happy path, edge e o roundtrip E2E
obrigatório (payload REAL, não mock — guarda contra drift snake↔camelCase).

## P1 — Líder com 3 grupos, período 30d (happy path)
1. Seed: tenant A; líder L (GroupMember.role='lider' em G1,G2,G3); membros
   ativos; reuniões+attendance no período; TrailProgress; RadarStatus variado.
2. `GET /api/v1/reports/leader-summary?period=30d` como L.
3. **Expected**: 200; `data.groups` tem 3 itens; cada um com
   `avgAttendancePercent` (0..100), `avgTrailProgressPercent`, `atRiskCount`,
   `activeParticipantsCount`; `summary.totalGroups=3`;
   `summary.totalParticipants` = dedup por userId; `overallAttendancePercent`
   ponderado por `activeParticipantsCount`; `meta.period='30d'`.

## P2 — Grupo sem reuniões no período (dec-008)
1. G2 sem nenhuma reunião na janela.
2. `GET .../leader-summary?period=30d`.
3. **Expected**: card de G2 com `avgAttendancePercent: null` (não 0);
   G2 NÃO entra na ponderação de `overallAttendancePercent`.

## P3 — Período custom
1. `GET .../leader-summary?period=custom&startDate=2026-05-01T00:00:00Z&endDate=2026-06-01T00:00:00Z`.
2. **Expected**: 200; `meta.startDate/endDate` refletem a janela; só reuniões
   nesse intervalo contam.
3. `period=custom` sem datas → **400** (Zod refinement).
4. `startDate >= endDate` → **400**.

## P4 — Drill-down por groupId (dec-011)
1. `GET .../leader-summary?period=30d&groupId=<G1>`.
2. **Expected**: `data.groups` array com **1** item (G1); `summary` calculado
   só para G1; mesmo schema do caso geral.

## P5 — Líder sem grupos
1. Líder L2 sem nenhum grupo como `lider`.
2. `GET .../leader-summary?period=30d`.
3. **Expected**: 200; `groups: []`; `summary.totalGroups=0`,
   `totalParticipants=0`, `overallAttendancePercent: null`,
   `overallTrailCompletionPercent: 0`.

## P6 — Autorização horizontal: groupId de outro líder (Decision 5)
1. L pede `groupId=<G de outro líder, mesmo tenant>`.
2. **Expected**: 200 `groups: []` (escopo-vazio); NÃO 403, NÃO vaza dados nem
   existência do grupo alheio.

## P7 — admin_tenant cross-grupo (SC-08)
1. admin_tenant do tenant A chama o endpoint.
2. **Expected**: `groups` cobre TODOS os grupos do tenant A.

## P8 — Isolamento RLS (SC-04, OBRIGATÓRIO) — `apps/api/test/rls/leader-summary.rls-spec.ts`
1. Seed tenant A e tenant B com grupos homônimos.
2. Líder do tenant A chama o endpoint.
3. **Expected**: nenhum grupo/participante/reunião do tenant B aparece;
   contagens batem só com dados de A. Repetir invertendo A↔B.

## P9 — Role negado
1. Usuário `participante` chama o endpoint.
2. **Expected**: 403 (RolesGuard).

## P10 — Roundtrip End-to-End (OBRIGATÓRIO — anti-drift snake↔camelCase)
1. E2E real: autentica como líder, faz `GET /api/v1/reports/leader-summary`
   contra o backend REAL (sem mock/fixture), captura o payload de resposta.
2. `LeaderSummaryResponseSchema.parse(payloadReal)` no teste.
3. **Expected**: `.parse` passa; todas as chaves em camelCase; nenhum
   `undefined`; `avgAttendancePercent` aparece como `null` quando aplicável
   (não omitido). Falha aqui = drift de convenção de borda.

## P11 — UI `/app/gestao/relatorios/lider` (a11y SC-06)
1. Render da página (Client Component) com filtros período/grupo/semáforo.
2. Filtro semáforo "vermelho/amarelo" → mostra só cards com `atRiskCount>0`;
   "verde" → cards com `atRiskCount=0` (dec-010, filtro sobre cards inteiros).
3. **Expected**: badges de semáforo com **ícone+texto** (não só cor) e
   contraste WCAG AA; cards/tabela navegáveis por teclado e screen reader;
   axe-core sem violações (gate a11y permanente Epic 12); reusa `FormField`
   e token `text-secondary`.

## P12 — Snapshot de schema (Princípio IV)
1. `packages/types/src/__tests__/leader-summary.snapshot.spec.ts`.
2. **Expected**: snapshot estável dos schemas; mudança de shape quebra o teste.
