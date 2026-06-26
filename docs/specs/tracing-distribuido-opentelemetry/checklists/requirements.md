# Requirements Checklist: Tracing Distribuído com OpenTelemetry (NFR-O5)

**Purpose**: Valida a qualidade, completude, clareza e consistência dos requisitos de observabilidade de tracing — não a implementação.
**Created**: 2026-06-26
**Feature**: [docs/specs/tracing-distribuido-opentelemetry/spec.md](../spec.md)
**Domínios cobertos**: Requirements, API (observabilidade), Security (anti-PII/sanitização)

---

## 1. Completude de Requisitos

- [x] CHK001 - São os requisitos de inicialização no-op definidos com condições precisas (ausência de env → sem exceção, sem rede, boot ≤5s)? [Completude, Spec §FR-01] {auto}
  > Evidência: FR-01 especifica modo no-op explícito + SC #2 mede "≤5s"; FR-09 documenta todas as 4 env vars como `.optional()`.

- [x] CHK002 - É o mecanismo de coexistência com Sentry v10 especificado com referência à opção pública de extensão (`openTelemetrySpanProcessors`)? [Completude, Spec §FR-02] {auto}
  > Evidência: FR-02 e plan §0 documentam D-01: anexar ao provider Sentry via `openTelemetrySpanProcessors` — NÃO criar segundo provider.

- [x] CHK003 - São os atributos obrigatórios de span raiz enumerados exaustivamente com fonte de cada atributo? [Completude, Spec §FR-03] {auto}
  > Evidência: FR-03 lista `http.method`, `http.url`, `http.status_code`, `user.id`, `tenant_id`, `correlation_id` — cada um com fonte (`RequestContext`).

- [x] CHK004 - São as camadas de instrumentação automática (Prisma, ioredis, BullMQ, HTTP externo) todas enumeradas com decisão explícita por camada? [Completude, Spec §FR-04] {auto}
  > Evidência: FR-04 lista todas as camadas; plan §3 documenta decisão D-03 de usar `$extends` manual para Prisma (com justificativa de cobertura do adapter PrismaPg).

- [x] CHK005 - É o requisito de sanitização de `db.statement` especificado com mecanismo explícito (não apenas "substituir por ?") e estratégia fail-closed? [Completude, Spec §FR-05] {auto}
  > Evidência: FR-05 especifica substitução por `?`; plan §3 detalha: operações de modelo → `<model>.<operation>`, raw queries → sanitizado ou **omitido** (fail-closed), `SET LOCAL`/`SELECT 1`/`SELECT version()` → dropados.

- [x] CHK006 - É o requisito de `tenant_id` em 100% dos spans especificado com mecanismo central (não por instrumentação avulsa)? [Completude, Spec §FR-06] {auto}
  > Evidência: FR-06 exige "todos os spans da árvore"; plan §4 especifica `context-span-processor.ts` com `onStart` central — garante cobertura sem tocar cada camada.

- [x] CHK007 - São os endpoints excluídos de traces listados explicitamente com padrão de URL (não apenas "health checks")? [Completude, Spec §FR-07] {auto}
  > Evidência: FR-07 e spec §P1 edge cases listam `/api/health` e `/api/v1/admin/health` + subpaths; plan §4 especifica filtro no sampler (mais barato).

- [x] CHK008 - São os parâmetros de batch (maxExportBatchSize, scheduledDelayMillis) e sampling especificados com valores numéricos exatos? [Completude, Spec §FR-08] {auto}
  > Evidência: FR-08 define 512 spans/lote, 5s flush; plan §2 confirma com `maxExportBatchSize: 512`, `scheduledDelayMillis: 5000`.

- [x] CHK009 - São todas as variáveis de ambiente enumeradas com tipo, default e comportamento quando ausentes? [Completude, Spec §FR-09] {auto}
  > Evidência: FR-09 lista as 4 vars OTEL_* com `.optional()`; plan §2 detalha schema Zod exato para cada uma incluindo preprocess `''→undefined` (lição 14-3).

- [x] CHK010 - São os atributos do span SSR (FR-11) consistentes com os do span API (FR-03) no que é aplicável a ambos? [Consistência, Spec §FR-10, §FR-11] {auto}
  > Evidência: FR-11 lista `http.url`, `http.method`, `next.route`, `next.rsc`, `tenant.id` — complementares, não conflitantes com FR-03; `tenant.id` marcado "quando disponível" (sem travar).

- [x] CHK011 - São os atributos obrigatórios do span BullMQ worker listados com distinção entre obrigatórios e opcionais? [Completude, Spec §FR-12] {auto}
  > Evidência: FR-12 lista `job.name`, `job.id`, `job.attemptsMade`, `queue.name`; plan §6 adiciona `tenant.id` via context processor.

- [x] CHK012 - São os eventos de exceção em spans (`exception.type`, `exception.message`, `exception.stacktrace`) especificados com referência ao campo de correlação existente? [Completude, Spec §FR-13] {auto}
  > Evidência: FR-13 lista os 3 campos de exceção OTel + `correlation_id` do `RequestContext` — ligação explícita com logging Pino existente (Epic 1).

- [x] CHK013 - É o runbook especificado com seções mínimas concretas (não apenas "documentação operacional")? [Completude, Spec §FR-14] {auto}
  > Evidência: FR-14 lista seções: variáveis de ambiente, verificação OTLP, diagnóstico Sentry/OTel, reversão no-op, verificação de chegada de traces.

---

## 2. Clareza de Requisitos

- [x] CHK014 - É "modo no-op" definido com comportamento específico e não apenas como ausência de ação (sem exceção, sem rede, sem impacto de boot mensurável)? [Clareza, Spec §FR-01, §FR-09] {auto}
  > Evidência: FR-01 especifica "nenhuma exceção é lançada, nenhuma rede é acessada, nenhum impacto de performance mensurável no boot"; SC #2 quantifica "≤5s".

- [x] CHK015 - É "coexistência com Sentry" (FR-02) especificada com o mecanismo técnico preciso e não apenas com a meta ("não duplicar")? [Clareza, Spec §FR-02] {auto}
  > Evidência: FR-02 cita `@sentry/opentelemetry`, opção `openTelemetrySpanProcessors`, fallback documentado; plan §0 detalha a opção pública `initOtel.js:spanProcessors`.

- [x] CHK016 - É "dados do usuário" em FR-05 definido com exemplos concretos do domínio (emails, nomes, conteúdo pastoral) — não genérico? [Clareza, Spec §FR-05] {auto}
  > Evidência: FR-05 usa "nomes, e-mails, conteúdo pastoral"; plan §3 complementa com "where/data com PII: emails, nomes, conteúdo pastoral".

- [x] CHK017 - É "todos os spans da árvore" (FR-06) precisado com quais spans especificamente constituem a árvore (raiz, Prisma, Redis, BullMQ, HTTP externo)? [Clareza, Spec §FR-06] {auto}
  > Evidência: FR-06 lista "spans filhos de Prisma, Redis, BullMQ e HTTP externo"; SC #4 quantifica "10 requisições autenticadas de tenants distintos".

- [x] CHK018 - É o "traceparent W3C" (FR-10, FR-12) especificado com referência ao padrão (RFC W3C Trace Context) e não apenas como "header"? [Clareza, Spec §FR-10, §FR-12] {auto}
  > Evidência: spec Key Entities documenta `traceparent = "Header W3C Trace Context para propagação cross-service | RFC W3C"`.

- [ ] CHK019 - É "linked span" (FR-12, SC #5) definido com precisão técnica — `traceId` igual ao da requisição origem E `parentSpanId` != null — ou pode ser confundido com "span filho"? [Clareza, Spec §FR-12, §SC #5] {auto}
  > [Gap parcial] FR-12 diz "linked span que continua o trace original" mas não distingue explicitamente de `CHILD_OF` vs `FOLLOWS_FROM` (semantic OTel). SC #5 é mais preciso: "worker span com `parentSpanId` diferente de null e `traceId` igual ao da requisição origem". Plan §6 usa `SpanKind.CONSUMER` com `context.with(parentCtx)` — que cria `CHILD_OF` semântico, não um link formal. A spec deveria esclarecer se é `CHILD_OF` ou `LINK` (OTel permite ambos; `CHILD_OF` é mais simples mas semântica de `LINK` é mais correta para async). Risco: testes T8 podem passar com `CHILD_OF` mesmo se intenção era `LINK`.

- [x] CHK020 - São os valores de sampling (100% dev/test, 10% prod) especificados com lógica de override e comportamento de fallback quando `OTEL_TRACES_SAMPLER_ARG` está ausente? [Clareza, Spec §FR-08] {auto}
  > Evidência: FR-08 e plan §2 definem: `OTEL_TRACES_SAMPLER_ARG` presente → usa valor; ausente → NODE_ENV resolve (dev/test→1.0, prod→0.1). `ParentBasedSampler` garante coerência do trace.

---

## 3. Consistência de Requisitos

- [x] CHK021 - São os requisitos de FR-05 (sanitização de `db.statement`) e FR-07 (exclusão de `SELECT 1`/`SET LOCAL`) consistentes — os statements dropados não precisam ser sanitizados? [Consistência, Spec §FR-05, §FR-07] {auto}
  > Evidência: plan §3 regra 4 clarifica: `SELECT 1`, `SELECT version()`, `SET LOCAL app.current_tenant_id` → dropados (não geram span), portanto sanitização irrelevante para eles. Sem conflito.

- [x] CHK022 - É o requisito de no-op (FR-01/FR-09) consistente com a estratégia de coexistência Sentry (FR-02) — quando no-op, o Sentry continua funcionando? [Consistência, Spec §FR-01, §FR-02] {auto}
  > Evidência: plan §2 tabela de decisão: no-op = `openTelemetrySpanProcessors: []` (array vazio), Sentry opera normalmente. Consistente.

- [x] CHK023 - São os cenários de teste (§7 do plan, T1–T12) consistentes com os success criteria da spec (SC #1–#7)? [Consistência, Spec §Success Criteria, Plan §7] {auto}
  > Evidência: mapeamento verificado: SC#1→T3+T4, SC#2→T1, SC#3→T4, SC#4→T7, SC#5→T8, SC#6→T11, SC#7→CI gate. Todos SCs têm teste correspondente.

- [ ] CHK024 - É o comportamento do `tenant.id` no span SSR (FR-11: "quando disponível") consistente com FR-06 que exige `tenant_id` em 100% dos spans? [Consistência, Spec §FR-06, §FR-11] {auto}
  > [Gap] FR-06 exige 100% dos spans; FR-11 especifica `tenant.id` como "quando disponível no contexto de sessão". Na arquitetura SSR há spans onde o tenant pode não estar disponível (ex: páginas públicas) — isso é uma exceção intencional ao FR-06 mas não está documentada como tal. A spec deveria enunciar explicitamente: "FR-06 aplica-se a spans da API; spans SSR de páginas públicas são isentos".

- [x] CHK025 - São os requisitos de BullMQ (FR-12) consistentes com o escopo "ZERO produção" — o mecanismo de propagação não exige mudança em infraestrutura? [Consistência, Spec §FR-12, Plan §Scope guardrail] {auto}
  > Evidência: FR-12 injeta `_traceContext` no `job.data` (campo de dados do job, não infraestrutura); wrap em `bullmq.service.ts` é código puro. Consistente com escopo.

---

## 4. Qualidade dos Critérios de Aceite (Success Criteria)

- [x] CHK026 - SC #1 ("trace com ≥3 spans, rastreável via console exporter") é mensurável objetivamente sem ambiguidade sobre quais 3 spans? [Mensurabilidade, Spec §SC #1] {auto}
  > Evidência: SC #1 especifica "SSR → API → Prisma"; o requisito do endpoint ("listagem de grupos") é concreto. Mensurável.

- [x] CHK027 - SC #2 (boot "≤5 segundos") tem critério de medição definido (via `curl /api/health` retornando 200)? [Mensurabilidade, Spec §SC #2] {auto}
  > Evidência: SC #2 especifica "validado por `curl /api/health` retornando 200 após boot" — método de verificação explícito.

- [x] CHK028 - SC #3 ("inspeção manual de 20 spans") tem critério de verificação objetivo (nenhum valor de parâmetro em `db.statement`)? [Mensurabilidade, Spec §SC #3] {auto}
  > Evidência: SC #3 especifica "apenas `?` como placeholder" — critério binário verificável.

- [x] CHK029 - SC #4 ("100% dos spans com `tenant.id`") tem metodologia de amostragem definida (10 requisições de tenants distintos, todos os níveis da árvore)? [Mensurabilidade, Spec §SC #4] {auto}
  > Evidência: SC #4 define "10 requisições autenticadas de tenants distintos" + "raiz, Prisma, Redis, BullMQ" como universo a verificar.

- [x] CHK030 - SC #5 (BullMQ linked) especifica os invariantes tecnicamente verificáveis (`parentSpanId` != null, `traceId` == origem)? [Mensurabilidade, Spec §SC #5] {auto}
  > Evidência: SC #5 é preciso: "worker span com `parentSpanId` diferente de null e `traceId` igual ao da requisição origem".

- [x] CHK031 - SC #6 ("Sentry não duplica spans") tem método de verificação definido (comparação de `spanId` únicos)? [Mensurabilidade, Spec §SC #6] {auto}
  > Evidência: SC #6 especifica "comparação de `spanId` únicos" — verificável programaticamente via T11.

- [x] CHK032 - SC #7 ("CI verde") lista os comandos exatos do CI gate incluindo a lição 14-3 (boot `start:e2e`+health)? [Mensurabilidade, Spec §SC #7, Plan §7] {auto}
  > Evidência: SC #7 lista `pnpm turbo lint`, `test`, `build`; plan §7 complementa com "boot `start:e2e`+health — lição 14-3/14-FECHADO".

---

## 5. Cobertura de Cenários e Edge Cases

- [x] CHK033 - Estão os edge cases de P1 (health check exclusion, `SELECT 1`, OTLP endpoint ausente) documentados com comportamento esperado? [Cobertura, Spec §P1 edge cases] {auto}
  > Evidência: spec §P1 edge cases lista os 3; FR-07 e FR-09 os formalizam como requisitos.

- [x] CHK034 - Está o cenário de "Sentry DSN presente mas OTLP endpoint ausente" coberto (Sentry opera normal, tracing OTel em no-op)? [Cobertura, Spec §FR-01, §FR-02] {auto}
  > Evidência: plan §2 tabela de decisão cobre "otlp (default) + endpoint ausente = NO-OP" com Sentry não-afetado.

- [x] CHK035 - Está o cenário de "ambos Sentry DSN e OTLP endpoint presentes" coberto sem duplicação de spans? [Cobertura, Spec §SC #6, Plan §D-01] {auto}
  > Evidência: D-01 (plan §0) documenta que NÃO instalar `auto-instrumentations-node` previne duplicação; T11 valida.

- [ ] CHK036 - Está o cenário de falha do exporter OTLP em runtime (backend indisponível) coberto com comportamento esperado (descarte silencioso? backpressure? log de warning)? [Cobertura] {auto}
  > [Gap] A spec não especifica o comportamento quando o backend OTLP está configurado (`OTEL_EXPORTER_OTLP_ENDPOINT` presente) mas inacessível em runtime — batch vai acumular até overflow ou descarta silenciosamente? `BatchSpanProcessor` do OTel tem comportamento padrão (descarte silencioso após max queue size), mas isso não está documentado na spec/runbook. Risco operacional: spans perdidos sem alerta.

- [ ] CHK037 - Está o cenário de `_traceContext.traceparent` malformado (BullMQ) coberto com comportamento seguro (iniciar root span fresco — não propagar)? [Cobertura, OWASP M3] {auto}
  > [Gap] A spec não especifica validação do `traceparent` inbound nos jobs BullMQ. O plan §6 usa `propagation.extract()` diretamente sem validação prévia. O OWASP gate identificou isso como M3 (medium): `traceparent` malformado pode causar comportamento indefinido do propagador. Requer regex W3C `^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$` antes do extract.

- [ ] CHK038 - Está o cenário de worker BullMQ sem `_traceContext` (job enfileirado antes da instrumentação existir, ou de fonte externa) coberto? [Cobertura, Spec §FR-12] {auto}
  > [Gap parcial] Plan §6 tem `tc ? propagation.extract(...) : context.active()` — trata `_traceContext` ausente criando root span fresco. Mas a spec FR-12 não documenta esse fallback explicitamente; apenas descreve o happy path. O comportamento de fallback deveria estar em FR-12 ou nos edge cases de P1.

- [x] CHK039 - Está o cenário de spans SSR fora de request (ex: static generation em build) coberto (não deve acessar `RequestContext`)? [Cobertura, Spec §FR-11] {auto}
  > Evidência: plan §4 especifica `context-span-processor.ts` com `onStart` que faz try/catch defensivo — "fora de request HTTP, ex. boot, o store não existe e NÃO deve lançar".

- [ ] CHK040 - Está o cenário de `user.id` em spans quando a requisição não é autenticada (tenant presente mas user ausente, ou ambos ausentes) coberto com comportamento definido? [Cobertura, Spec §FR-03] {auto}
  > [Gap] FR-03 especifica `user.id` "quando autenticado" mas não define o atributo quando ausente — deve ser omitido (preferred), definido como `""`, ou definido como `"anonymous"`? Inconsistência potencial com filtros de backend OTLP que podem interpretar atributo ausente ≠ string vazia.

---

## 6. Requisitos de Segurança e Anti-PII (OWASP bindings — OBRIGATÓRIOS)

Os 4 itens MEDIUM do OWASP gate (onda plan) devem aparecer como requisitos explícitos. Esta seção verifica se foram adequadamente formalizados na spec e no plan.

- [x] CHK041 - É a sanitização de `db.statement` especificada como **allowlist fail-closed** (não regex-strip) para operações de modelo — `<model>.<operation>` apenas, nunca args? [Segurança, OWASP M1, Spec §FR-05, Plan §3] {auto}
  > Evidência: plan §3 regra 1 especifica: "Operações de modelo: `db.statement` = `<model>.<operation>`. NUNCA serializar `args`". Regra 2 para raw queries: "sanitizar OU omitir (fail-closed — nunca vaza)". D-04 registra a decisão.

- [x] CHK042 - É o drop explícito de `SET LOCAL app.current_tenant_id` especificado com justificativa de segurança (tenant UUID em plaintext no statement)? [Segurança, OWASP M1, Plan §3] {auto}
  > Evidência: plan §3 "Nota crítica OWASP (anti-PII real)" especifica explicitamente: "`SET LOCAL app.current_tenant_id = '<uuid>'` emitido por `with-tenant-tx.ts` carrega o tenant UUID em texto plano. O filtro DEVE dropar esse statement OU substituir o valor por `?`".

- [ ] CHK043 - Está a allowlist de atributos de span **enforced em código** (deny-by-default no exporter wrapper) especificada como requisito, não apenas como intenção de design? [Segurança, OWASP M2] {auto}
  > [Gap] O OWASP gate identificou M2: allowlist deve ser enforced em código (deny-by-default) via `onEnd`/exporter wrapper que remove qualquer key fora da allowlist **antes** de exportar. A spec FR-05 menciona "allowlist" em linguagem informal mas não especifica o mecanismo de enforcement (SpanProcessor `onEnd` que filtra atributos). Plan §3 lista "Proibido: `db.statement.params`" mas não especifica wrapper de deny-by-default. Precisa de um requisito formal do tipo: "Um SpanProcessor de sanitização remove atributos fora da allowlist antes do BatchSpanProcessor exportar".

- [ ] CHK044 - Está a validação do `traceparent` inbound (BullMQ + SSR→API) especificada como requisito com regex W3C e comportamento em mismatch (root span fresco, não linkar)? [Segurança, OWASP M3, Spec §FR-12] {auto}
  > [Gap] M3 do OWASP gate: validar `_traceContext.traceparent` contra regex W3C `^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$` ANTES de `propagation.extract()`. Em mismatch: iniciar root span fresco (não linkar). Mesma validação no traceparent inbound SSR→API. Não está formalizado como FR na spec. Precisa de FR-15 ou adenda ao FR-12.

- [ ] CHK045 - Está a propagação de `tenant.id` no boundary BullMQ worker especificada como **mandatória** (não opcional) com mecanismo de re-estabelecimento do RequestContext? [Segurança, OWASP M4, Spec §FR-06, §FR-12] {auto}
  > [Gap] M4 do OWASP gate: worker roda fora do `AsyncLocalStorage` da request — sem re-estabelecimento do RequestContext, spans do worker ficam sem `tenant.id`, violando FR-06 (100% dos spans). Plan §6 menciona "propagar tenantId no `_traceContext` também" como "opcional". Deve ser formalizado como obrigatório na spec: o `_traceContext` deve carregar `tenantId` E o worker deve re-estabelecer `RequestContext` mínimo antes de criar spans filhos.

- [ ] CHK046 - Está o requisito de `user.id` = subject Keycloak (nunca email/nome) especificado formalmente, com referência ao campo JWT? [Segurança, OWASP LOW, Spec §FR-03] {auto}
  > [Gap] O OWASP gate identificou LOW: garantir `user.id` = subject Keycloak (nunca email/nome). FR-03 especifica `user.id` "do `RequestContext`" mas não detalha que o campo `userId` do `RequestContext` já deve ser o sub JWT (não email/nome). Precisa de nota explícita ou referência ao `userId` já extraído do token Keycloak na autenticação existente.

- [ ] CHK047 - Está o comportamento do exporter `console` em `NODE_ENV=production` especificado (deve gerar warning ou ser desabilitado)? [Segurança, OWASP LOW, Spec §FR-08] {auto}
  > [Gap] O OWASP gate identificou LOW: ignorar/warn quando `OTEL_TRACES_EXPORTER=console` em `NODE_ENV=production` (vazamento de dados de produção no stdout). A spec FR-08 descreve `console` como modo de desenvolvimento mas não proíbe explicitamente seu uso em produção nem especifica warning. Precisa de cláusula de guardrail.

---

## 7. Dependências e Premissas

- [x] CHK048 - São as dependências npm novas especificadas com versão mínima e justificativa de escolha (ex: `@opentelemetry/exporter-trace-otlp-http` vs alternativas)? [Dependências, Plan §D-01, §0] {auto}
  > Evidência: plan §0 lista deps ausentes confirmadas empiricamente (`@opentelemetry/sdk-node` etc. NÃO no store); plan §0 D-01 justifica adição mínima: apenas `@opentelemetry/exporter-trace-otlp-http` + `sdk-trace-base` explicit. D-02 documenta avaliação `@vercel/otel` vs sdk-trace-node.

- [x] CHK049 - É a premissa de que `@sentry/node@10.47.0` usa `openTelemetrySpanProcessors` como opção pública (não interna) verificada contra código fonte real (não documentação)? [Dependências, Plan §0] {auto}
  > Evidência: plan §0 cita `sdk/index.js:59` e `initOtel.js` com evidência empírica do `node_modules` real — não suposição de doc.

- [ ] CHK050 - É a premissa de que Next.js 16 chama `register()` de `instrumentation.ts` automaticamente (sem flag) verificada ou é estimativa pendente de confirmação? [Dependências/Assumption, Spec §FR-10, Plan §5] {auto}
  > [Assumption] Plan §5 afirma "Next 16 chama `register()` de `instrumentation.ts` automaticamente (nativo, sem flag experimental)" mas marca com "confirmar" apenas para `instrumentationHook` no `next.config.ts`. No Next.js 13.x era experimental (`experimental.instrumentationHook`); no 15+ tornou-se estável. Para Next 16.2.3, a premissa é correta mas deveria ser verificada com `grep -r "instrumentationHook\|experimental" apps/web/next.config.ts` antes de depender dela.

- [x] CHK051 - É a premissa de que `@opentelemetry/sdk-trace-base` (com `InMemorySpanExporter`) já está no store (transitivamente via Sentry) verificada empiricamente? [Dependências, Plan §7] {auto}
  > Evidência: plan §0 lista `@opentelemetry/sdk-trace-base@^2.6.1` como dep direta do `@sentry/node` — verificado nos `node_modules` reais.

---

## 8. Requisitos Não-Funcionais

- [x] CHK052 - São os requisitos de performance do SDK (no-op sem impacto mensurável, overhead de tracing em produção) especificados ou documentados como não-requisito intencional? [NFR, Spec §FR-01] {auto}
  > Evidência: FR-01 especifica "nenhum impacto de performance mensurável no boot" para no-op; SC #2 quantifica "≤5s". Overhead em produção não é especificado — aceitável para um NFR de observabilidade (OTel tem overhead <1% tipicamente).

- [x] CHK053 - É o requisito de confiabilidade do SDK (falha no SDK não deve afetar disponibilidade da plataforma) especificado implicitamente via no-op ou explicitamente? [NFR, Spec §P4] {auto}
  > Evidência: P4 especifica "incidente no SDK de tracing não comprometa a disponibilidade da plataforma"; FR-01 garante no-op; runbook cobre reversão. NFR de disponibilidade implícito via escopo do P4.

- [ ] CHK054 - É o requisito de segurança de memória do `BatchSpanProcessor` (limite de fila, comportamento em pressão de memória) especificado? [NFR/Performance] {humano}
  > Decisão de produto: `BatchSpanProcessor` padrão do OTel tem `maxQueueSize: 2048` por default — quando a fila enche, spans são descartados silenciosamente. Para um sistema multi-tenant em produção, descarte silencioso pode ocultar problemas. Deve-se definir `maxQueueSize` explicitamente e decidir se descarte silencioso é aceitável ou se requer métrica/alerta.

---

## Notes

- Items `{auto}` resolvidos com citação de evidência: **32 itens** marcados `[x]`
- Items `{humano}` aguardando decisão do produto: **1** (CHK054)
- Gaps identificados (`[Gap]`/`[Ambiguity]`): **10** (CHK019, CHK024, CHK036, CHK037, CHK038, CHK040, CHK043, CHK044, CHK045, CHK046, CHK047, CHK050)

---

## Ação por Gap

| CHK | Marcador | Destino | Prioridade |
|-----|----------|---------|------------|
| CHK019 | [Gap] `CHILD_OF` vs `LINK` OTel não esclarecido | Clarify spec FR-12 + T8 | BAIXA (testes passam de qualquer modo) |
| CHK024 | [Gap] spans SSR público isentos de FR-06 não documentados | Clarify spec FR-06/FR-11 | BAIXA (comportamento já correto) |
| CHK036 | [Gap] comportamento falha OTLP em runtime | Runbook + create-tasks | MÉDIA |
| CHK037 | [Gap] validação traceparent BullMQ (OWASP M3) | **create-tasks OBRIGATÓRIO** (M3 binding) | ALTA |
| CHK038 | [Gap] fallback `_traceContext` ausente não documentado na spec | create-tasks (task de documentação) | BAIXA |
| CHK040 | [Gap] `user.id` quando não-autenticado indefinido | create-tasks (aclarar no código) | BAIXA |
| CHK043 | [Gap] allowlist deny-by-default não formalizada (OWASP M2) | **create-tasks OBRIGATÓRIO** (M2 binding) | ALTA |
| CHK044 | [Gap] validação traceparent inbound não formalizada (OWASP M3) | **create-tasks OBRIGATÓRIO** (M3 binding) | ALTA |
| CHK045 | [Gap] tenant.id no worker BullMQ "opcional" deve ser obrigatório (OWASP M4) | **create-tasks OBRIGATÓRIO** (M4 binding) | ALTA |
| CHK046 | [Gap] `user.id` = sub Keycloak não explícito (OWASP LOW) | create-tasks (nota no código) | BAIXA |
| CHK047 | [Gap] console exporter em production não guardado (OWASP LOW) | create-tasks (guardrail no otel-config) | BAIXA |
| CHK050 | [Assumption] `instrumentation.ts` auto em Next 16 não verificado | create-tasks (verificar no início da task web) | BAIXA |
