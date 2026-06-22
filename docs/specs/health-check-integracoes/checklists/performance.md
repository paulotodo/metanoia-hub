# Performance Checklist: health-check-integracoes

**Purpose**: Validar qualidade dos requisitos de performance: targets de latência,
paralelismo de probes, throttle/cache, budget de sparkline e escalabilidade do job BullMQ.
**Created**: 2026-06-22
**Feature**: `docs/specs/health-check-integracoes/spec.md`

---

## Targets Mensuráveis

- [x] CHK042 - O target de latência total das probes está quantificado com valor específico? [Clareza, Spec §NFR-I5] {auto}
  > Evidência: spec §NFR-I5: "Todas as probes rodam com `Promise.all()` (paralelas). Timeout individual de 5s por probe HTTP + 3s para Redis/PostgreSQL. Latência total < 6s."

- [x] CHK043 - Os timeouts individuais por probe são definidos com valores específicos e diferenciados por tipo? [Clareza, Spec §FR-002] {auto}
  > Evidência: spec §FR-002: HTTP (Resend, Keycloak, MinIO) = 5s via `AbortSignal.timeout(5000)`; Redis = 3s via `RedisService timeout`; PostgreSQL = 3s via `prisma.$queryRaw`. Diferenciação justificada (HTTP externo vs intranet).

- [x] CHK044 - A latência esperada do endpoint `/history` está quantificada? [Clareza, Spec §D-005] {auto}
  > Evidência: spec §D-005: "Latência esperada: < 50ms com index." Índice `(integration_name, checked_at DESC)` especificado em §FR-001.

- [ ] CHK045 - Os targets de latência têm condições de medição definidas (p50/p95 sob carga concorrente)? [Clareza, Gap] {humano}
  > Julgamento de produto: spec §NFR-I5 define < 6s como target absoluto mas não especifica percentil (p50, p95, p99) nem nível de concorrência. Para uma feature de observabilidade de plataforma, esses targets são suficientes para MVP? Decidir se SLO formal é necessário nesta story.

---

## Paralelismo e Promise.all

- [x] CHK046 - O requisito de execução paralela das probes via `Promise.all` está especificado? [Completude, Spec §NFR-I5] {auto}
  > Evidência: spec §NFR-I5: "Todas as probes rodam com `Promise.all()` (paralelas)."

- [x] CHK047 - O comportamento de falha de uma probe (não cancela as demais) está especificado? [Completude, Spec §FR-002, §NFR-I5] {auto}
  > Evidência: spec §FR-002 define comportamento por probe em erro (status = unhealthy, latencyMs = tempo até erro); §NFR-I5 usa `Promise.all` com `AbortSignal.timeout` — falha de uma probe não cancela as outras (semântica `Promise.allSettled`-like por `AbortSignal` individual). O comportamento está claro.

- [x] CHK048 - O caso de probe travada (sem `AbortSignal`) que poderia bloquear `Promise.all` é coberto? [Cobertura, Spec §FR-002, §NFR-I5] {auto}
  > Evidência: spec §FR-002 e §D-002 definem `AbortSignal.timeout(5000)` para todas as probes HTTP. Para Redis e PG, o timeout é via `RedisService` e o prazo de `prisma.$queryRaw` (3s). Cobertura completa — sem probe sem timeout.

---

## Cache e Throttle

- [ ] CHK049 - O requisito de micro-cache/throttle server-side para o endpoint on-demand está especificado? [Completude, Gap, OWASP F4] {auto}
  > Gap (ver CHK035): spec §FR-003 define endpoint on-demand que executa probes, mas não especifica proteção contra múltiplas chamadas simultâneas (ex: múltiplos tabs do dashboard chamando simultaneamente). OWASP Finding F4 requer micro-cache de 5-10s. Ação: adicionar §NFR-PERF-001 ou nota em §FR-003.

- [x] CHK050 - O cache do TanStack Query para o endpoint de status está configurado com `staleTime` definido? [Clareza, Spec §FR-010] {auto}
  > Evidência: spec §FR-010: "`staleTime: 55000` (ligeiramente abaixo do refresh de 60s)" e `refetchInterval: 60000`. Valores específicos e coerentes com o auto-refresh de 60s.

- [x] CHK051 - O debounce de notificação (anti-flapping 2 checks = 10 min) é especificado com valores concretos? [Clareza, Spec §D-004, §FR-006] {auto}
  > Evidência: spec §D-004 e §FR-006 definem: `consecutiveCount >= 2` (10 min); chave Redis `rt:health-check:debounce:{name}` com TTL 30 min. Algoritmo detalhado em §FR-006.

---

## Banco de Dados e Índices

- [x] CHK052 - O índice necessário para a query de histórico está mapeado ao padrão de acesso? [Traceability, Spec §FR-001, §D-005] {auto}
  > Evidência: spec §FR-001 define `@@index([integrationName, checkedAt(sort: Desc)], name: "integration_health_log_name_checked_idx")`; §D-005 justifica para query `WHERE integration_name = $1 ORDER BY checked_at DESC LIMIT N`.

- [x] CHK053 - O volume máximo de dados do sparkline (288 pontos × 5 integrações) está considerado como requisito de capacidade? [Cobertura, Spec §D-005, §FR-004] {auto}
  > Evidência: spec §D-005: "24h / 5 min = 288 pontos"; §FR-004: max `hours * 12` pontos por integração. Para 5 integrações × 288 pts = 1440 pontos/dia. Com `hours` max = 72: 72 × 12 × 5 = 4320 pontos por query. Escala é gerenciável com índice.

- [ ] CHK054 - A política de retenção de `integration_health_log` está definida (quando deletar registros antigos)? [Completude, Gap] {humano}
  > Gap: spec §FR-001 não define retenção/expiração de registros em `integration_health_log`. Com 288 pontos/dia × 5 integrações = 1440 linhas/dia. Sem política de retenção, o storage cresce indefinidamente. Decidir se retenção (ex: 30 dias) é necessária nesta story ou tech debt.

---

## Sparkline e Frontend

- [x] CHK055 - O número de pontos do sparkline está quantificado e vinculado ao schedule do job? [Clareza, Spec §D-005, §FR-010] {auto}
  > Evidência: spec §D-005: 24h / 5 min = 288 pontos; §FR-004 e §D-005 vinculam os 288 pontos ao job de 5 min. Consistência verificada.

- [x] CHK056 - A estratégia de renderização do sparkline (SVG inline, sem @nivo) está especificada e justificada? [Clareza, Spec §D-006] {auto}
  > Evidência: spec §D-006: "SVG inline pode ser gerado por um pequeno helper React com performance superior para 288 pontos. Não adicionar `@nivo/line` ao bundle (~200KB)." Justificativa de bundle size presente.

- [x] CHK057 - O requisito de `motion-safe` (não animar se `prefers-reduced-motion: reduce`) está especificado? [Completude, Spec §FR-010] {auto}
  > Evidência: spec §FR-010 define `<LatencySparkline>`: "`motion-safe` (não anima se `prefers-reduced-motion: reduce`)."

- [ ] CHK058 - O budget de performance de frontend (LCP, bundle size) para a página `/admin/health` está definido? [Clareza, Gap] {humano}
  > Gap: spec §D-006 menciona evitar `@nivo/line` (~200KB) mas não define um budget explícito de LCP ou bundle size para a página de health. Decidir se targets de Web Vitals são necessários nesta story.

---

## BullMQ e Escalabilidade

- [x] CHK059 - O schedule do job (5 min) e o TTL do lock (270s) são consistentes (TTL < intervalo)? [Consistencia, Spec §D-003, §FR-005] {auto}
  > Evidência: spec §D-003: TTL = 270s (4m30s) < intervalo = 300s (5 min). "TTL com margem cobre execução travada sem deadlock." Consistência verificada matematicamente.

- [x] CHK060 - O requisito de single-execution para múltiplas instâncias está coberto por teste específico? [Completude, Spec §Testes] {auto}
  > Evidência: spec §Testes: "BullMQ single-execution 2 instâncias simuladas" em `health-check.processor.spec.ts`.

- [ ] CHK061 - O comportamento do job BullMQ sob restart da aplicação (perda do repeatable job) está especificado? [Edge Case, Gap] {humano}
  > Gap: spec §FR-005 define registro do job no `onModuleInit` do `AdminHealthModule`. O comportamento de restart (o job já está registrado no Redis vs registro duplicado) não está especificado. BullMQ repeatable jobs por `every` são deduplicados pelo BullMQ internamente, mas o requisito de idempotência do `onModuleInit` não está explícito. Decidir se isso é requisito desta story ou assumption aceita.

---

## Notes

- Items `{auto}` resolvidos pelo agente com citação da spec/plan.
- **Gaps abertos**: CHK049 (micro-cache on-demand), CHK054 (retenção de dados), CHK058 (budget FE), CHK061 (restart/idempotência onModuleInit).
- **Julgamento de produto** (humano): CHK045 (SLO formal), CHK054 (retenção), CHK058 (Web Vitals), CHK061 (restart).
- **Próximos passos**: CHK049 → adicionar §NFR-PERF-001; CHK054/CHK061 → tech debt ou decidir como acceptance criteria.
