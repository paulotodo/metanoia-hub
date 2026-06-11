# Checklist: Security — auditoria-log (9-3)

**Domínio**: Segurança, Imutabilidade, Isolamento Multi-tenant, Cross-tenant Super Admin
**Gerado em**: 2026-06-11 | **Wave**: onda-003 (fase checklist)
**Fonte da verdade**: spec.md, plan.md, data-model.md, contracts/audit-events.md

---

## SEC-001 — RLS append-only: política FOR UPDATE ausente {auto}

**Requisito**: FR-INFRA-02, spec US2 AC#1, data-model.md §RLS
**Item**: A migration SQL define APENAS policies `FOR INSERT` e `FOR SELECT` para `audit_events`. Nenhuma política `FOR UPDATE` é criada.

**Evidência** (data-model.md, linhas RLS):
```sql
CREATE POLICY audit_events_tenant_insert ON audit_events FOR INSERT ...
CREATE POLICY audit_events_tenant_select ON audit_events FOR SELECT ...
```
Comentário explícito: "SOMENTE INSERT + SELECT. SEM UPDATE. SEM DELETE."

- [x] Policy `FOR INSERT` definida com `WITH CHECK (tenant_id = NULLIF(...))`
- [x] Policy `FOR SELECT` definida com `USING (tenant_id = NULLIF(...))`
- [x] Ausência de `FOR UPDATE` é intencional e documentada
- [x] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` obrigatórios

**Status**: PASS {auto}

---

## SEC-002 — RLS append-only: política FOR DELETE ausente {auto}

**Requisito**: FR-INFRA-02, spec US2 AC#2, SC-002
**Item**: Nenhuma política `FOR DELETE` existe para `audit_events`. Tentativas de DELETE pelo role da app são bloqueadas pelo DB.

**Evidência** (data-model.md): "sem policy `FOR UPDATE`/`FOR DELETE`, o role da app não pode modificar/remover linhas — bloqueado pelo DB"

- [x] Ausência de `FOR DELETE` é explícita no data-model
- [x] `audit.service.ts` não expõe métodos `update()` ou `delete()` (plan.md: "Prisma direto; create + list/query; SEM update/delete")

**Status**: PASS {auto}

---

## SEC-003 — Teste de imutabilidade obrigatório no RLS spec {auto}

**Requisito**: spec US2 (Independent Test), SC-002, plan.md §Testing
**Item**: O arquivo `apps/api/test/rls/audit-events.rls-spec.ts` DEVE incluir testes que tentam `UPDATE` e `DELETE` como o role da aplicação e verificam falha (bloqueio por policy).

**Evidência** (plan.md, Project Structure):
```
apps/api/test/rls/
└── audit-events.rls-spec.ts  # NOVO: isolamento + imutabilidade UPDATE/DELETE
```
Spec Independent Test US2: "Conectar diretamente ao banco como `metanoia_app` e tentar executar `UPDATE audit_events SET action = 'fake'` e `DELETE FROM audit_events` → ambos devem falhar."

- [x] RLS spec obrigatório documentado no plan.md (não opcional)
- [x] Testes de imutabilidade (UPDATE + DELETE falham) especificados em US2 Independent Test
- [x] Scaffold reusar `group-members.rls-spec.ts` (plan.md §Reuso explícito)

**Status**: PASS {auto}

---

## SEC-004 — Isolamento cross-tenant: SELECT retorna apenas eventos do próprio tenant {auto}

**Requisito**: FR-004, spec US2 AC#3, SC-007
**Item**: Policy `FOR SELECT` usa `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` — garante que SELECT sem SET LOCAL (ou com tenant_id diferente) retorna 0 linhas.

**Evidência** (data-model.md):
```sql
CREATE POLICY audit_events_tenant_select ON audit_events
  FOR SELECT
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

- [x] Política usa `NULLIF` (padrão de RLS do projeto — migration `consolidate_rls_nullif`)
- [x] Teste de isolamento com 2 tenants distintos especificado (SC-007, plan.md §Testing)

**Status**: PASS {auto}

---

## SEC-005 — Cross-tenant Super Admin: mecanismo explícito, não bypass implícito {auto}

**Requisito**: spec Edge Case "Super Admin cross-tenant", plan.md §Constitution Check (Princípio I), contracts/audit-events.md §GET /admin/super/audit/events
**Item**: O viewer cross-tenant usa `prisma.client` direto (cliente não-RLS) + `@Roles(Role.SUPER_ADMIN)` — o mesmo mecanismo do módulo `super-admin/` existente. NÃO usa bypass inventado ou SET LOCAL com tenantId especial.

**Evidência** (contracts/audit-events.md): "Cross-tenant via `prisma.client` direto (padrão `super-admin/` — research.md Decision 3; **spike de 15min na FASE 0 do create-tasks confirma o mecanismo**)."

**Evidência** (plan.md §Reuso): "Cross-tenant SELECT super-admin | `super-admin/super-admin-tenants.repository.ts` (`prisma.client` direto + `@Roles(SUPER_ADMIN)`) | research.md D3 — spike 15min na FASE 0 do create-tasks"

- [x] Mecanismo cross-tenant documentado (prisma.client direto)
- [x] `@Roles(SUPER_ADMIN)` explícito no controller
- [x] Spike empírico de 15min agendado na FASE 0 do create-tasks (pendente — execução)
- [x] Padrão reutiliza `super-admin-tenants.repository.ts` verificado em research.md D3

**[Gap]**: O spike de 15min está agendado para FASE 0 do create-tasks, mas ainda não foi executado. Existe risco de que o mecanismo `prisma.client` direto não funcione exatamente como descrito (ex: adapter-pg ou middleware Prisma interceptando). create-tasks deve incluir task de spike ANTES de qualquer implementação cross-tenant. Registrar como dependência bloqueante da FASE 1.

**Status**: PASS com Gap {auto} — gap documentado acima

---

## SEC-006 — Captura de ipAddress e userAgent: fonte e confiabilidade {auto}

**Requisito**: spec FR-002, US1 AC#1, data-model.md
**Item**: O `AuditInterceptor` captura `ipAddress` e `userAgent` do request. Ambos são NOT NULL no schema.

**Evidência** (spec FR-002): "O sistema DEVE persistir cada audit event com os campos: [...] `ipAddress`, `userAgent`."
**Evidência** (data-model.md): `ip_address text NOT NULL`, `user_agent text NOT NULL`.

- [x] Campos `ipAddress` e `userAgent` definidos como NOT NULL no data-model
- [x] Captura pelo interceptor (pós-guard, tenantId/userId já no AsyncLocalStorage)

**[Ambiguity]**: O schema define `ip_address` como `string (text/inet)`. A spec não especifica se usar tipo `text` ou `inet` (PostgreSQL). `inet` permite validação no DB mas pode causar problemas se o IP vier com porta (IPv6 bracket notation, proxies). A migration SQL deve especificar o tipo exato. Recomendação: usar `text` no MVP e documentar a decisão.

**Status**: PASS com Ambiguidade {auto}

---

## SEC-007 — previousState e newState: captura e truncamento {auto}

**Requisito**: spec FR-002, Edge Case "Tamanho de payload", data-model.md
**Item**: Campos `previousState` e `newState` são JSONB nullable. Para creates, `previousState = null`. Para deletes, `newState = null`. Truncar a 64KB/campo com log de aviso.

**Evidência** (data-model.md): "Snapshot antes da mudança; **null para creates**; truncado a 64KB" / "Snapshot após a mudança; **null para deletes**; truncado a 64KB"
**Evidência** (contracts/audit-events.md §Constantes): `AUDIT_PAYLOAD_TRUNCATE_BYTES = 65536`

- [x] `previousState = null` para creates documentado
- [x] `newState = null` para deletes documentado
- [x] Constante `AUDIT_PAYLOAD_TRUNCATE_BYTES = 65536` definida
- [x] Log de aviso ao truncar especificado (spec Edge Case)

**[Ambiguity]**: A spec especifica truncamento a 64KB mas não define a estratégia de truncamento: truncar bytes (pode quebrar UTF-8/JSON no meio) ou serializar, limitar e re-serializar? O interceptor precisa de uma estratégia que produza JSON válido após truncamento. Recomendação: serializar o objeto, verificar tamanho do string resultante, e se > 64KB armazenar `{ "__truncated": true, "__originalSize": N }` mais os primeiros campos serializados. Isso deve ser especificado no create-tasks.

**Status**: PASS com Ambiguidade {auto}

---

## SEC-008 — Interceptor: requests sem userId não geram audit event {auto}

**Requisito**: spec Edge Case "Interceptor sem contexto de usuário", FR-001
**Item**: Requests que chegam a endpoints públicos ou que falharam na autenticação antes do interceptor NÃO devem gerar audit event (sem userId = sem auditoria válida).

**Evidência** (spec Edge Case): "Requests que passam por endpoints públicos (ex: marketing) ou falham na autenticação antes de chegar ao interceptor — NÃO devem gerar audit event (sem userId = sem auditoria válida)."
**Evidência** (plan.md §Constitution Check): "tenantId e userId já estão no contexto quando o evento é capturado"

- [x] Interceptor roda APÓS guards — guards rejeitam antes se sem auth
- [x] Verificação de userId presente antes de criar evento documentada

**[Ambiguity]**: O interceptor global é o PRIMEIRO do repositório (plan.md: "1 interceptor global (primeiro do repo)"). A ordem de execução no NestJS é: Guards → Interceptors (before) → Handler → Interceptors (after). Endpoints públicos (marketing) usam `@Public()` decorator que bypassa os guards — mas o interceptor ainda roda. O interceptor DEVE checar se userId está disponível no AsyncLocalStorage e, se ausente, pular silenciosamente. Este comportamento deve ser explicitamente testado (unit test do interceptor). A spec menciona isso no Edge Case mas o `quickstart.md` e os testes do plan.md devem cobrir.

**Status**: PASS com Ambiguidade {auto}

---

## SEC-009 — Retenção permanente: sem mecanismo de auto-delete {auto}

**Requisito**: FR-INFRA-01, spec US2 AC#4
**Item**: Nenhum mecanismo de expiração, TTL no banco, pg_cron, trigger de limpeza ou job automático de delete deve existir para `audit_events`.

**Evidência** (spec FR-INFRA-01): "Audit events são retidos permanentemente — nenhum mecanismo de expiração ou auto-delete deve ser implementado."
**Evidência** (data-model.md §State Transitions): "Retenção PERMANENTE (FR-INFRA-01 — nenhum auto-delete)."

- [x] Retenção permanente explicitamente documentada
- [x] Data-model confirma sem state transitions (imutável)
- [x] Diferente do `AuditExportJob` que tem TTL Redis (não confundir)

**Status**: PASS {auto}

---

## SEC-010 — Conflito 9-2/9-3: escopo de imutabilidade definido {auto}

**Requisito**: spec Edge Case "Conflito com 9-2", plan.md §Nota cross-story
**Item**: A Story 9-2 (anonimização) precisará modificar `user_id` em audit events (conflito com imutabilidade). Esta spec declara imutabilidade absoluta no contexto da aplicação e delega a resolução para 9-2.

**Evidência** (spec Edge Case): "Este conflito com a imutabilidade deve ser resolvido explicitamente na Story 9-2 (fora do escopo desta spec) — possíveis caminhos: função `SECURITY DEFINER` restrita à coluna `user_id`, ou flag lógica `is_anonymized`."
**Evidência** (plan.md): "O design da 9-3 **não usa trigger BEFORE UPDATE** justamente para não impedir um futuro caminho privilegiado"

- [x] Conflito documentado explicitamente
- [x] Decisão de design (sem trigger BEFORE UPDATE) para não bloquear 9-2
- [x] Resolução delegada formalmente para 9-2

**Status**: PASS {auto}

---

## SEC-011 — Falhas no interceptor são não-bloqueantes {auto}

**Requisito**: FR-010, spec US1 AC#3, SC-004
**Item**: Se a persistência do audit event falhar (banco indisponível, timeout, etc.), o request original NÃO é interrompido. A falha é logada, não propagada.

**Evidência** (spec FR-010): "Falhas na persistência do audit event NÃO devem bloquear o request original — o interceptor deve ser tolerante a falhas de auditoria."
**Evidência** (spec US1 AC#3): "o request original NÃO é bloqueado — falhas no audit log são não-bloqueantes e logadas."

- [x] Tolerância a falhas especificada explicitamente
- [x] Impacto de latência documentado (SC-004: +≤50ms P99)

**[Ambiguity]**: O interceptor captura `previousState` e `newState`. Para capturar `previousState` em updates, o interceptor precisa ler o estado ANTES do request ser processado (before hook), e `newState` DEPOIS (after hook). Interceptores NestJS têm acesso ao `next.handle()` via RxJS — o `tap()` roda after. Mas capturar `previousState` before é mais complexo: requer leitura do DB antes do handler. A spec não especifica se `previousState` é capturado "before handler" (leitura extra ao DB) ou extraído do payload do request. Esta ambiguidade pode impactar significativamente a latência (SC-004) e a complexidade da implementação. **Recomendação**: definir no create-tasks que `previousState` será extraído do handler response/context (não por leitura separada ao DB no interceptor), ou scoped para ser opcionalmente preenchido pelo service (não pelo interceptor).

**Status**: PASS com Ambiguidade {auto} — ambiguidade HIGH PRIORITY para create-tasks

---

## Resumo SEC

| Item | Status |
|------|--------|
| SEC-001 RLS sem UPDATE policy | PASS |
| SEC-002 RLS sem DELETE policy | PASS |
| SEC-003 Teste imutabilidade obrigatório | PASS |
| SEC-004 Isolamento cross-tenant SELECT | PASS |
| SEC-005 Cross-tenant Super Admin mecanismo explícito | PASS + [Gap] spike pendente |
| SEC-006 ipAddress/userAgent NOT NULL | PASS + [Ambiguity] text vs inet |
| SEC-007 previousState/newState truncamento | PASS + [Ambiguity] estratégia de truncamento |
| SEC-008 Sem userId = sem audit event | PASS + [Ambiguity] endpoints @Public() |
| SEC-009 Retenção permanente | PASS |
| SEC-010 Conflito 9-2/9-3 escopo | PASS |
| SEC-011 Falhas não-bloqueantes | PASS + [Ambiguity] previousState capture strategy |

**Gaps**: 1 (SEC-005 — spike cross-tenant pendente, bloqueante para FASE 1)
**Ambiguidades**: 4 (SEC-006, SEC-007, SEC-008, SEC-011 — resolver no create-tasks)
