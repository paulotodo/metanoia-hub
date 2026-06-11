# Checklist: Requirements — auditoria-log (9-3)

**Domínio**: Qualidade geral dos requisitos (completude, consistência, testabilidade, rastreabilidade)
**Gerado em**: 2026-06-11 | **Wave**: onda-003 (fase checklist)
**Fonte da verdade**: spec.md, plan.md, data-model.md, contracts/audit-events.md, research.md

---

## REQ-001 — Todo FR tem Acceptance Criteria testável {auto}

**Requisito**: Boas práticas SDD — requisitos devem ser verificáveis
**Item**: Cada FR da spec tem ao menos um Acceptance Criteria mapeável a um teste automatizado.

Mapeamento FR → teste:

| FR | Teste |
|----|-------|
| FR-001 (captura automática) | Integration test: POST endpoint → verificar `audit_events` count +1 |
| FR-002 (campos obrigatórios) | Unit test: `audit.service.ts` cria evento com todos os 12 campos |
| FR-003 (imutabilidade) | RLS spec: UPDATE e DELETE falham para `metanoia_app` role |
| FR-004 (isolamento tenant) | RLS spec: SELECT com tenant A não retorna eventos do tenant B |
| FR-005 (viewer paginado 50/pág) | Integration test: GET `/audit/events?page=1` retorna `meta.perPage=50` |
| FR-006 (filtros server-side) | Integration test: filtro por `action=delete` retorna só deletes |
| FR-007 (export assíncrono) | Integration test: POST export → 202 → polling → signedUrl |
| FR-008 (linhas expansíveis) | jest-axe + Playwright: expandir linha mostra `previousState` formatado |
| FR-009 (auto-refresh 30s) | Unit test: `useAuditEvents` tem `refetchInterval: 30000` |
| FR-010 (falhas não-bloqueantes) | Unit test: interceptor com DB down não propaga erro |
| FR-011 (GET não auditado) | Integration test: GET endpoint → `audit_events` count estável |
| FR-012 (índice tenant+timestamp) | Migration: índice `idx_audit_events_tenant_timestamp` presente |
| FR-INFRA-01 (retenção permanente) | Code review: ausência de TTL/delete em migration e service |
| FR-INFRA-02 (append-only) | RLS spec: ausência de FOR UPDATE/DELETE policies |
| FR-INFRA-03 (export BullMQ 3x) | Unit test: processor tem `attempts: 3` |

- [x] Todos os 14 FRs + 3 FR-INFRA têm testes mapeados

**Status**: PASS {auto}

---

## REQ-002 — Success Criteria são mensuráveis e testáveis {auto}

**Requisito**: spec §Success Criteria (SC-001 a SC-007)
**Item**: Cada SC define uma métrica objetiva verificável.

| SC | Métrica | Verificável? |
|----|---------|-------------|
| SC-001 100% requests mutativas auditadas | contagem de requests vs eventos | Sim (integration test) |
| SC-002 0 audit events modificados após criação | UPDATE/DELETE via role app falha | Sim (RLS spec) |
| SC-003 Viewer < 2s com 10k eventos | tempo de resposta com EXPLAIN + índice | Sim (performance test / EXPLAIN ANALYZE) |
| SC-004 Interceptor +≤50ms P99 | benchmark comparativo com/sem interceptor | Sim (load test) |
| SC-005 Encontrar evento em ≤3 interações | UX heurística (não automatizável facilmente) | Parcial (Playwright manual) |
| SC-006 Export 100k eventos < 5min | timing do job completo | Sim (load test) |
| SC-007 0 vazamento cross-tenant | RLS spec com 2 tenants | Sim (RLS spec) |

- [x] SC-001, SC-002, SC-003, SC-004, SC-006, SC-007 são mensuráveis e automatizáveis
- [x] SC-005 é heurístico (UX) — aceitável como critério qualitativo

**[Ambiguity]**: SC-003 menciona "com paginação server-side e índice ativo" mas não define como verificar que o índice está sendo usado (ex: `EXPLAIN ANALYZE` não é coberto por testes automatizados Vitest). O create-tasks deve incluir um teste de performance usando `EXPLAIN ANALYZE` ou seed de 10k eventos + medição de tempo real na integração spec.

**Status**: PASS com Ambiguidade {auto}

---

## REQ-003 — Rastreabilidade FRs → data-model {auto}

**Requisito**: Consistência entre spec e data-model
**Item**: Cada campo do data-model tem um FR correspondente; não há campos órfãos.

| Campo data-model | FR correspondente |
|-----------------|-------------------|
| `id` (UUID v7) | FR-002, constitution §II |
| `tenant_id` | FR-002, FR-004, constitution §I |
| `user_id` | FR-002 |
| `action` (enum) | FR-002 |
| `resource` | FR-002 |
| `resource_id` (nullable) | FR-002 |
| `ip_address` | FR-002 |
| `user_agent` | FR-002 |
| `previous_state` (JSONB, nullable) | FR-002 |
| `new_state` (JSONB, nullable) | FR-002 |
| `timestamp` | FR-002 |
| `severity` (enum) | FR-002 |
| índice `(tenant_id, timestamp DESC)` | FR-012 |
| RLS INSERT+SELECT only | FR-003, FR-004, FR-INFRA-02 |

- [x] 12 campos de dados mapeados para FR-002
- [x] Índice mapeado para FR-012
- [x] RLS policies mapeadas para FR-003, FR-004, FR-INFRA-02
- [x] `AuditExportJob` (Redis) mapeado para FR-007, FR-INFRA-03

**Status**: PASS {auto}

---

## REQ-004 — Edge cases documentados e tratados {auto}

**Requisito**: spec §Edge Cases
**Item**: Todos os 6 edge cases identificados têm tratamento especificado.

| Edge Case | Tratamento documentado |
|-----------|----------------------|
| Interceptor sem contexto de usuário | Não gerar evento (verificação de userId no interceptor) |
| previousState em creates = null | data-model: null explícito |
| Bulk operations = N eventos | data-model: "1 request afetando N recursos → N audit events" |
| Super Admin cross-tenant | prisma.client direto + @Roles(SUPER_ADMIN) |
| Conflito 9-2/9-3 | Delegado para 9-2; sem trigger BEFORE UPDATE |
| Tamanho de payload | AUDIT_PAYLOAD_TRUNCATE_BYTES = 65536; log de aviso |

- [x] 6 edge cases com tratamento especificado
- [x] Bulk operations: N eventos por N recursos documentado
- [x] Conflito 9-2/9-3: resolução formal delegada

**[Gap]**: O edge case "bulk operations → N eventos" está documentado mas não tem teste automatizado explicitamente especificado. Como o `AuditInterceptor` é global e baseado no request HTTP (não no service), um request que afeta N recursos por dentro do handler produzirá apenas 1 interceptor call. Para gerar N eventos de auditoria em bulk, o padrão do interceptor precisaria ser diferente — ou os services precisariam emitir eventos diretamente. Esta é uma **inconsistência arquitetural potencial**: a implementação via interceptor global não suporta naturalmente bulk de N eventos por request. O create-tasks deve resolver explicitamente: interceptor emite 1 evento por request (com `resourceId = null` e `resource = bulk`), ou os services emitem N eventos via `audit.service.createMany()`. A spec diz "N audit events" mas o interceptor só vê 1 request.

**Status**: PASS com Gap {auto} — gap arquitetural de bulk logging

---

## REQ-005 — Consistência de enums entre spec, data-model e contracts {auto}

**Requisito**: Consistência interna dos artefatos
**Item**: Os enums `action` e `severity` são iguais em todos os artefatos.

**action** enum verificado:

| Artefato | Valores |
|----------|---------|
| spec.md FR-002 | `create\|update\|delete\|login\|export\|config_change` |
| data-model.md | `create \| update \| delete \| login \| export \| config_change` |
| contracts/audit-events.md | `create\|update\|delete\|login\|export\|config_change` |
| contracts §Constantes | `AUDIT_ACTIONS` enum |

**severity** enum verificado:

| Artefato | Valores |
|----------|---------|
| spec.md FR-002 | `info/warning/critical` |
| data-model.md | `info \| warning \| critical` |
| contracts/audit-events.md | `info\|warning\|critical` |
| contracts §Constantes | `AUDIT_SEVERITIES` enum |

- [x] `action`: 6 valores consistentes em todos os artefatos
- [x] `severity`: 3 valores consistentes em todos os artefatos
- [x] Constantes exportadas de `packages/types`

**Status**: PASS {auto}

---

## REQ-006 — Mapeamento de severity é determinístico e completo {auto}

**Requisito**: spec US1 AC#4, data-model.md §Severity mapping
**Item**: O mapeamento `action → severity` cobre todos os 6 valores do enum `action`.

| action | severity mapeada |
|--------|-----------------|
| `delete` | `critical` |
| `config_change` | `critical` |
| `update` (roles/permissions) | `warning` |
| `create` | `info` |
| `export` | `info` |
| `update` (padrão, não roles) | `info` |
| `login` | `info` |

- [x] Todos os 6 valores de `action` cobertos
- [x] `update` tem dois cases (roles/permissions vs padrão) — ambos documentados

**[Ambiguity]**: O mapeamento de `update` depende do `resource` (roles/permissions → warning, padrão → info). A lógica no interceptor precisa conhecer quais `resource` values mapeiam para "roles/permissions". Quais são esses valores? `"role"`, `"permission"`, `"user-role"`, `"group-member-role"`? A lista não está enumerada nos artefatos. O `audit.severity.ts` (plan.md §Project Structure) implementará isso, mas sem a lista exata dos recursos "role-related", o mapeamento é incompleto. O create-tasks deve definir a lista canônica de `resource` values que disparam `warning`.

**Status**: PASS com Ambiguidade {auto} — lista de resources "role-related" não enumerada

---

## REQ-007 — Requisitos de performance têm baseline definida {auto}

**Requisito**: plan.md §Performance Goals, SC-003, SC-004
**Item**: Performance goals têm métricas objetivas e estratégia de verificação.

| Meta | Métrica | Estratégia |
|------|---------|-----------|
| Viewer 1ª pág < 2s com 10k eventos (SC-003) | Tempo de resposta endpoint | Índice `(tenant_id, timestamp DESC)` + EXPLAIN ANALYZE |
| Interceptor +≤50ms P99 (SC-004) | Latência adicional | Benchmark comparativo |
| Export 100k eventos < 5min (SC-006) | Tempo de job completo | Seed 100k + execução worker |

- [x] SC-003: índice definido (FR-012), seed de 10k eventos especificado
- [x] SC-004: tolerância de 50ms documentada
- [x] SC-006: 100k eventos + 5min documentados

**[Ambiguity]**: SC-004 menciona "+≤50ms no P99" mas não especifica se isso é medido em ambiente local (Docker Compose) ou staging. Em local, a latência do DB pode ser muito menor que em produção, tornando o teste irrelevante. Recomendação: verificar o índice via EXPLAIN ANALYZE (determinístico) e aceitar SC-004 como não-automatizável no MVP (log manual de latência).

**Status**: PASS com Ambiguidade {auto}

---

## REQ-008 — User Stories são independentes e testáveis {auto}

**Requisito**: Princípios de user stories (INVEST)
**Item**: As 4 user stories têm Independent Tests definidos.

| US | Independent Test definido? |
|----|--------------------------|
| US1 (captura automática) | Sim: POST grupo → verificar audit event criado |
| US2 (persistência imutável) | Sim: UPDATE/DELETE via role app → ambos falham |
| US3 (viewer Super Admin) | Sim: navegar `/app/admin/super/audit` → paginação + filtro |
| US4 (export assíncrono) | Sim: POST export → polling → download |

- [x] 4 Independent Tests documentados na spec
- [x] Tests são independentes entre si (não requerem ordem de execução)

**Status**: PASS {auto}

---

## REQ-009 — Módulo audit/ é supporting subdomain (sem repository) {auto}

**Requisito**: CLAUDE.md "Supporting subdomains: service direct with Prisma", plan.md §Structure Decision
**Item**: O módulo `audit/` usa `audit.service.ts` com Prisma direto (sem repository pattern), consistente com a estratégia de supporting subdomain da architecture.

**Evidência** (plan.md §Structure Decision): "módulo NestJS por bounded context (`audit/`) como supporting subdomain (service direto com Prisma, sem repository) — alinhado à Architecture Decision da constitution."
**Evidência** (CLAUDE.md): "Supporting subdomains: service direct with Prisma"

- [x] Sem repository layer para `audit/`
- [x] Alinhado com padrão de supporting subdomain
- [x] Diferente de core domains (Pastoral, Meetings, Content) que usam repository

**Status**: PASS {auto}

---

## REQ-010 — Viewer: apenas desktop, sem responsividade mobile {auto}

**Requisito**: spec US3 AC#5
**Item**: O viewer `/app/admin/super/audit` é otimizado para desktop. Nenhum requisito de responsividade mobile.

**Evidência** (spec US3 AC#5): "a interface é otimizada para desktop (audit é operação administrativa — não há requisito de responsividade mobile nesta tela)."

- [x] Escopo de responsividade explicitamente definido (desktop-only)
- [x] Sem requisito de mobile breakpoints para esta tela

**Status**: PASS {auto}

---

## REQ-011 — Branch e PR estratégia: 1 story = 1 branch = 1 PR {auto}

**Requisito**: constitution §VII (CLAUDE.md Git Workflow), plan.md §Constitution Check (Princípio VII)
**Item**: Implementação em `feat/story-9-3-auditoria-log` → 1 PR para dev.

**Evidência** (plan.md): "`feat/story-9-3-auditoria-log`" definido.
**Evidência** (CLAUDE.md): "1 story = 1 branch = 1 PR; conventional commits in Portuguese"

- [x] Branch name definido
- [x] PR único especificado
- [x] Commits convencionais em PT-BR

**[Gap]**: O feedback memory `feedback_feature00c_direct_push_dev_bypasses_ci.md` documenta que feature-00c pode pushar direto em dev sem PR → CI nunca roda. O create-tasks deve incluir checklist explícito de verificação de CI antes de declarar done, e deve forçar criação de PR (não push direto).

**Status**: PASS com Gap {auto} — risco de push direto em dev sem CI

---

## REQ-012 — a11y: jest-axe gate no viewer {auto}

**Requisito**: plan.md §Testing "jest-axe (viewer)", constitution §VI
**Item**: O viewer passa por `jest-axe` (WCAG AA gate) antes de done.

**Evidência** (plan.md §Project Structure): `apps/web/app/(authenticated)/app/admin/super/audit/__tests__/audit-page.a11y.spec.tsx # NOVO jest-axe gate`
**Evidência** (plan.md §Technical Context): "Vitest/Jest (`*.spec.ts`), [...] jest-axe (viewer)"

- [x] jest-axe test especificado no Project Structure
- [x] WCAG AA gate documentado
- [x] Faz parte do CI gate (constitution §VI: "CI verde antes de done")

**Status**: PASS {auto}

---

## REQ-013 — i18n: namespace PT-BR no viewer {auto}

**Requisito**: CLAUDE.md "User-facing messages: PT-BR", constitution §III
**Item**: Strings visíveis ao usuário no viewer usam `apps/web/messages/pt-BR.json` no namespace `superAdmin.audit.*`. Vocabulário pastoral (não corporativo).

**Evidência** (plan.md §Constitution Check III): "User-facing PT-BR em `apps/web/messages/pt-BR.json` namespace `superAdmin.audit.*`, vocabulário pastoral, ícone+texto. Viewer passa por revisão de vocabulário."
**Evidência** (plan.md §Project Structure): `apps/web/messages/pt-BR.json # +namespace superAdmin.audit.*`

- [x] Namespace `superAdmin.audit.*` definido
- [x] Vocabulário pastoral especificado
- [x] Revisão de vocabulário documentada como requisito

**Status**: PASS {auto}

---

## REQ-014 — Requisito de índice de banco de dados {auto}

**Requisito**: FR-012, SC-003 (performance)
**Item**: Índice `idx_audit_events_tenant_timestamp` em `(tenant_id, timestamp DESC)` é OBRIGATÓRIO (FR-012). Deve estar na migration SQL.

**Evidência** (data-model.md §Índices): "`idx_audit_events_tenant_timestamp` em `(tenant_id, timestamp DESC)` — obrigatório (FR-012), garante paginação server-side performática (SC-003: 10k eventos, primeira página < 2s)."

- [x] Índice composto `(tenant_id, timestamp DESC)` especificado
- [x] Nome canônico do índice documentado
- [x] Ligado a SC-003 (performance)

**[Ambiguity]**: FR-012 define índice mínimo em `(tenant_id, timestamp DESC)`. Mas os filtros suportados incluem `action`, `userId`, `severity` e texto livre `q`. Para queries com esses filtros adicionais, o índice `(tenant_id, timestamp DESC)` pode não ser suficiente e o banco fará seq scan após filtrar por tenant+timestamp. Para 10k eventos por tenant é aceitável; para 100k+ (export) pode ser lento. O create-tasks deve avaliar se índices adicionais (ex: `(tenant_id, action)`, `(tenant_id, severity)`) são necessários no MVP ou podem ser adicionados depois com observabilidade.

**Status**: PASS com Ambiguidade {auto}

---

## Resumo REQUIREMENTS

| Item | Status |
|------|--------|
| REQ-001 Todo FR tem teste mapeado | PASS |
| REQ-002 Success Criteria mensuráveis | PASS + [Ambiguity] SC-003 verificação |
| REQ-003 Rastreabilidade FR → data-model | PASS |
| REQ-004 Edge cases tratados | PASS + [Gap] bulk logging arquitectural |
| REQ-005 Enums consistentes entre artefatos | PASS |
| REQ-006 Severity mapping completo | PASS + [Ambiguity] lista resources "role-related" |
| REQ-007 Performance goals com baseline | PASS + [Ambiguity] ambiente de medição |
| REQ-008 User Stories independentes | PASS |
| REQ-009 Supporting subdomain (sem repository) | PASS |
| REQ-010 Desktop-only viewer | PASS |
| REQ-011 1 story = 1 branch = 1 PR | PASS + [Gap] risco push direto sem CI |
| REQ-012 a11y jest-axe gate | PASS |
| REQ-013 i18n PT-BR namespace | PASS |
| REQ-014 Índice banco obrigatório | PASS + [Ambiguity] índices adicionais |

**Gaps**: 2 (REQ-004 bulk logging, REQ-011 CI bypass)
**Ambiguidades**: 5 (REQ-002, REQ-006, REQ-007, REQ-014 — resolver no create-tasks)
