# Performance Checklist: Notificações por Email via Resend

**Purpose**: Valida qualidade dos requisitos de performance — timeouts explícitos (NFR-I3), atomicidade sob concorrência (FR-11/SC-04), rate-limit diário (FR-09/FR-10), backoff e circuit breaker — garantindo que cada target seja mensurável e testável antes da implementação.
**Created**: 2026-06-21
**Feature**: [spec.md](../spec.md) | [research.md](../research.md)

---

## Targets de Latência Mensuráveis

- [x] CHK041 - O timeout de conexão ao Resend (≤ 3s) e o timeout de leitura (≤ 10s) são quantificados e rastreáveis a NFR-I3 e FR-03? [Clareza, spec.md §FR-03, research.md Decision 1] {auto}
  > Evidência: spec.md §FR-03: "conexão em no máximo 3 segundos, leitura em no máximo 10 segundos"; research.md Decision 1: `AbortController` / `undici` Agent com `connectTimeout:3000`, `bodyTimeout:10000`.

- [x] CHK042 - O target de entrega de alerta crítico (≤ 1 minuto end-to-end) está definido como critério de sucesso mensurável (SC-01), incluindo o tempo de fila BullMQ + envio Resend + confirmação? [Clareza, spec.md §SC-01] {auto}
  > Evidência: spec.md §SC-01: "100% dos alertas pastorais entregues em até 1 minuto após disparo."

- [ ] CHK043 - Os targets de latência incluem condições de medição? (Ex: p95 < 1min sob carga de quantos jobs/segundo? Em qual ambiente — staging com Redis/Postgres real ou apenas dev?) [Clareza, Gap] {humano}
  > Gap: spec.md §SC-01 define target de tempo mas não define percentil (p50/p95/p99) nem condições de carga concorrente para o target ser considerado atingido. Útil para definir o critério de "done" nos testes de integração.

---

## Atomicidade do Rate Limiter sob Concorrência

- [x] CHK044 - O requisito FR-11 (atomicidade) especifica explicitamente o mecanismo: Lua script Redis (INCR + compare em única execução atômica), evitando race conditions entre dois workers simultâneos? [Completude, spec.md §FR-11, research.md Decision 4] {auto}
  > Evidência: research.md Decision 4: "GET+compare+INCR numa única execução Lua é atômica no Redis (single-threaded). Dois jobs concorrentes em 79/100 → só o primeiro passa de 79→80."

- [x] CHK045 - O SC-04 ("envios concorrentes nunca ultrapassam o limite diário") é verificável em teste de integração? O script Lua recebe o `limit` como ARGV (não hardcoded), permitindo teste com limite menor? [Mensurabilidade, spec.md §SC-04, research.md Decision 4] {auto}
  > Evidência: research.md Decision 4: "Limite passado como ARGV (não hardcoded no script) permite configurabilidade pós-MVP sem reescrever o Lua."

- [x] CHK046 - A flag de alerta `rate:email:{tenantId}:{YYYYMMDD}:alerted` (SET NX) é atômica no Lua script, prevenindo que múltiplos workers disparem o admin alert ao mesmo tempo quando o threshold é cruzado? [Completude, research.md Decision 7] {auto}
  > Evidência: research.md Decision 7: "`SET NX` dentro do Lua quando `crossedThreshold`; só o primeiro a cruzar 80 dispara."

---

## TTL e Reset do Contador Diário

- [x] CHK047 - O TTL do contador de emails diário é calculado como segundos até a próxima meia-noite UTC (`EXPIREAT`), não como TTL fixo de 86400s, garantindo reset alinhado ao dia-calendário? [Clareza, spec.md §Clarifications Q4, data-model.md §EmailRateCounter] {auto}
  > Evidência: data-model.md §EmailRateCounter: "TTL: `EXPIREAT epoch_proxima_meia_noite_utc` (clarify Q4 — não TTL fixo 86400)"; spec.md §Clarifications Q4 confirma a decisão.

- [ ] CHK048 - É definido o comportamento do sistema quando o worker está rodando exatamente à meia-noite UTC (janela de troca de dia)? Um email enviado em T=23:59:59 e outro em T=00:00:01 contam para dias diferentes (comportamento esperado)? [Edge Case, Clareza] {humano}
  > Refinamento útil mas não crítico: a semântica de `{YYYYMMDD}` como chave torna trivial a separação, mas um teste de edge case nessa janela seria valioso para garantir que o EXPIREAT não expire antes da chave `{YYYYMMDD}` mudar.

---

## Backoff e Retry (NFR-I2)

- [x] CHK049 - O backoff exponencial (30s base, 3 tentativas) é definido e rastreável ao mecanismo existente do BullMQ `DigestService` — sem necessidade de reimplementação? [Completude, spec.md §FR-05, research.md Decision 2] {auto}
  > Evidência: research.md Decision 2: "`DigestService.enqueue()` já define `attempts:3`, `backoff:{exponential,30000}`."

- [ ] CHK050 - São definidos os tempos totais de espera de retry (0s → 30s → 60s ≈ 90s de janela total antes de `failed`)? Esse prazo cabe dentro do target de 1 min para alertas críticos? [Clareza, Conflict, spec.md §SC-01/FR-05] {humano}
  > Potencial conflito: SC-01 exige entrega ≤ 1 min para alertas críticos; FR-05 define 3 retries com backoff exponencial de 30s. 3 tentativas com backoff 30s × (1+2) = 90s EXCEDE o target de 1 min. Confirmar se: (a) backoff só se aplica a tipos não-críticos, ou (b) alertas críticos têm retries com backoff mais curto.

---

## Circuit Breaker e Failover Performance

- [x] CHK051 - A janela de detecção de outage do circuit breaker (> 5 minutos de falha contínua) é suficiente para SC-03 (30 min sem provedor)? O sistema entra em modo contingência EM TEMPO para garantir os 30 min de operação contínua via fallback? [Completude, spec.md §SC-03/FR-12] {auto}
  > Evidência: spec.md §FR-12: "mais de 5 minutos consecutivos de falha → modo contingência"; SC-03: "30 minutos após indisponibilidade total". O breaker abre em 5min, sobrando 25min de operação em fallback — satisfaz SC-03.

- [x] CHK052 - O fechamento automático do circuit breaker (3 health-checks consecutivos OK, FR-14) não gera spike de reenvio de emails diferidos durante a contingência (FR-15 — notificações diferidas NÃO são reenviadas)? [Completude, spec.md §FR-15] {auto}
  > Evidência: spec.md §FR-15: "notificações diferidas durante o período de contingência NÃO devem ser reenviadas após recuperação"; o fallback in-app já entregou a informação.

---

## Cache de Branding e Performance de Template

- [x] CHK053 - O branding do tenant é obtido via cache Redis `cache:branding:{tenantId}` (TTL 1h) e não via query Prisma a cada envio de email, evitando N queries por email? [Completude, research.md Decision 3] {auto}
  > Evidência: research.md Decision 3: "Branding obtido via `BrandingService.getBranding()` (Epic 6), com cache Redis `cache:branding:{tenantId}`."

- [ ] CHK054 - O tempo de renderização do template HTML (incluindo resolução de branding via cache) está dentro do budget de latência total (≤ 1 min SC-01)? Existe target explícito para o tempo de renderização? [Clareza, Gap] {humano}
  > Gap: spec.md não define target de latência para a etapa de renderização de template. Como `BrandingService.getBranding()` pode fazer uma chamada Redis (cache miss → MinIO para logoUrl), o tempo de renderização pode variar. Valor como "renderização < 500ms" ou "cache-hit em 99% dos casos" seria útil.

---

## Observabilidade de Performance

- [ ] CHK055 - São definidos requisitos de métricas de performance para o canal de email: taxa de sucesso/falha de envio por tenant, latência de `EmailService.send()`, contagem de defers por tipo? [Cobertura, Gap] {humano}
  > Gap: spec.md define rastreabilidade de status (FR-17) mas não define métricas de observabilidade emitidas por instrução (ex: Prometheus counters/histograms). Sem métricas, SC-04 (atomicidade sob concorrência) e SC-01 (latência) não são monitoráveis em produção.

- [x] CHK056 - A feature não introduz queries N+1 ao banco Postgres: o `EmailChannel` não faz query por notificação (usa payload do job) e o branding é cacheado? [Cobertura, plan.md §Technical Context] {auto}
  > Evidência: research.md Decision 2 confirma reuso do worker existente (payload já carrega os dados); research.md Decision 3 confirma cache Redis do branding.

---

## Notes

- CHK043, CHK054, CHK055 `[Gap]` → tarefas em `/create-tasks`: "definir condições de medição dos targets de latência", "definir target de latência de renderização de template", "definir métricas de observabilidade do EmailChannel".
- CHK050 `[Conflict]` → verificar com tech lead se backoff exponencial de 30s se aplica a alertas críticos; pode requerer config separada de retry por tipo.
- CHK048 `{humano}` → edge case de meia-noite UTC: de baixo impacto (semântica da chave `{YYYYMMDD}` cobre o caso), mas teste explícito é recomendado.
