# Performance Checklist: Preferências Granulares de Notificação por Tipo

**Purpose**: Validar qualidade dos requisitos de performance — latência de cache, fallback DB, impacto na pipeline BullMQ, índices e targets mensuráveis.
**Created**: 2026-06-26
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)

---

## Targets Mensuráveis

- [x] CHK063 - O TTL de cache (600s ≈ 10 minutos) está quantificado com valor específico? [Clareza, Spec §Requirements FR-005, data-model.md §6] {auto}
  > Spec FR-005: "cache de preferências por usuário com TTL de aproximadamente 10 minutos". data-model.md §6: `'EX', 600` (valor exato). research.md D5: espelha padrão `'EX', seconds`.

- [x] CHK064 - O requisito de cache hit "na grande maioria dos casos" (SC-003) é mensurável — há proxy de medição definido? [Clareza, Spec §SC-003] {auto}
  > Spec SC-003: "atendida por cache na grande maioria dos casos, sem impacto perceptível na latência do pipeline de notificação." "Grande maioria" é impreciso, mas o mecanismo (TTL 600s + invalidação só no PATCH) torna mensurável via `MONITOR` Redis ou métricas de hit/miss.

  **[Gap]**: Spec SC-003 usa "grande maioria" sem percentual concreto (p.ex., ≥90% cache hit rate). Para MVP sem métricas de Redis, o TTL de 10 min é a implementação do critério — aceitável. Mas se SLO formal for necessário futuramente, o critério precisará ser quantificado. Registrado como gap de baixo impacto.

- [ ] CHK065 - Existe target de latência para o endpoint GET e PATCH (p50, p95)? [Clareza, Gap] {humano}
  > Spec SC-001: "em menos de 2 minutos" — refere-se à experiência do usuário completa (abrir página + alterar + confirmar), não à latência da API. Não há SLO de latência HTTP definido para os endpoints individuais. Decisão de produto se este nível de especificação é necessário no MVP.

---

## Impacto na Pipeline BullMQ

- [x] CHK066 - O impacto de latência da checagem de preferência no pipeline BullMQ está documentado — cache hit é consulta local (sem ida ao DB)? [Clareza, plan.md §Camada 3, research.md D4/D5] {auto}
  > plan.md §Camada 3: `resolveEnabled` usa cache→DB. research.md D5: `RedisService extends Redis` (ioredis). Cache hit = `get()` local (~1ms). Fallback DB = `SELECT` via `withTenantTx`. Impacto documentado.

- [x] CHK067 - O requisito de que o fallback DB em falha de Redis NÃO causa descarte de notificação (zero notificações perdidas por falha de cache) está especificado de forma mensurável? [Mensurabilidade, Spec §SC-006, FR-006] {auto}
  > Spec SC-006: "0 notificações descartadas por falha de cache (fallback a DB garante)." Mensurável: se Redis down, o fluxo continua via DB; `return` só ocorre por preferência do usuário (`enabled=false`), não por falha de infra.

- [ ] CHK068 - Está quantificado o overhead máximo aceitável por job BullMQ com a checagem de preferência adicionada (latência adicional por canal)? [Clareza, Gap] {humano}
  > Os artefatos não quantificam o overhead por job. Para cada canal de cada notificação: 1 Redis GET (~1ms) ou 1 SELECT via `withTenantTx` (~5-15ms). Com múltiplos canais por notificação, o overhead é multiplicado. Decisão de produto se esse overhead é aceitável ou se merece um SLO.

---

## Caching

- [x] CHK069 - A estratégia de invalidação do cache (imediata no PATCH, não TTL-only) está especificada? [Clareza, Spec §Requirements FR-005, data-model.md §6] {auto}
  > Spec FR-005: "invalidando o cache imediatamente após qualquer atualização bem-sucedida". data-model.md §6: "`del(cache:notif-prefs:{userId})` no PATCH bem-sucedido." Claro e imediato, não lazy.

- [ ] CHK070 - Existe requisito de proteção contra cache stampede quando o TTL expira e múltiplas notificações chegam simultaneamente para o mesmo userId? [Cobertura, Gap] {humano}
  > Não definido. Em produção com alta carga de notificações, múltiplos jobs BullMQ processando para o mesmo usuário simultaneamente podem gerar múltiplos DB reads quando o cache expira. Para MVP, a probabilidade é baixa. Decisão de produto se `NX` ou lock distribuído é necessário.

---

## Índices e Queries

- [x] CHK071 - O índice de tenant (`notification_preferences_tenant_idx`) está definido para queries tenant-scoped eficientes? [Completude, data-model.md §1.1] {auto}
  > data-model.md §1.1: `@@index([tenantId], name: "notification_preferences_tenant_idx")`. data-model.md §1.2 inclui o `CREATE INDEX` no SQL da migration.

- [x] CHK072 - O índice único de `(user_id, tenant_id, notification_type, channel)` serve como índice de lookup para o cache miss (sem scan)? [Cobertura, data-model.md §1.1] {auto}
  > data-model.md §1.1: `@@unique([userId, tenantId, notificationType, channel], name: "notif_prefs_user_tenant_type_channel_uq")`. O UNIQUE INDEX serve como índice de lookup. O GET carrega todas as linhas do usuário no tenant — 1 SELECT com `WHERE user_id=$1 AND tenant_id=current_tenant` (coberto pelo índice composto).

- [x] CHK073 - O lookup `user_tenants.role` para o worker (D3.b) é bounded pelo índice existente da tabela `user_tenants`? [Cobertura, research.md D3.b] {auto}
  > research.md D3.b: `SELECT role FROM user_tenants WHERE user_id=$1 AND tenant_id=current_tenant`. A tabela `user_tenants` existe (schema.prisma:197). Assume-se índice existente (tabela de relacionamento); a migration desta feature NÃO cria o índice (não é responsabilidade dela). Sem evidência de índice faltante — bug potencial apenas se `user_tenants` não tiver índice em `(user_id, tenant_id)`.

  **[Gap]**: Não verificado se `user_tenants` tem índice em `(user_id, tenant_id)`. Se não tiver, cada job BullMQ que processa `pastoral_alert.inApp` faria scan. A task de implementação deve verificar.

---

## Degradação e Fallback

- [x] CHK074 - O comportamento de degradação (Redis indisponível → fallback DB + log warn + continua processamento) está especificado sem ambiguidade? [Completude, Spec §Requirements FR-006, Spec §Edge Cases] {auto}
  > Spec §Edge Cases: "consulta diretamente a base de dados e emite um aviso nos logs — nenhuma notificação é silenciosamente descartada por falha de cache." Spec FR-006 confirma. data-model.md §6: "NUNCA dropar/abortar notificação por cache miss (SC-006)."

- [x] CHK075 - O comportamento de cache miss (ausência de chave, não falha de Redis) está diferenciado do comportamento de falha de Redis nos requisitos? [Clareza, data-model.md §6] {auto}
  > data-model.md §6 distingue: `get()` retorna `null` (miss normal → fallback DB sem warn) vs. `get()` lança exceção (Redis indisponível → `logger.warn` + fallback DB). Fluxo: `try { val = await redis.get(key); if (!val) { /* miss: DB */ } } catch { logger.warn; /* DB */ }`.
