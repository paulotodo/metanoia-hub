# Security Checklist: Preferências Granulares de Notificação por Tipo

**Purpose**: Validar qualidade dos requisitos de segurança — autenticação, autorização/RBAC, isolamento de tenant, input validation, logging de auditoria e proteção de dados para os endpoints e pipeline de notificação.
**Created**: 2026-06-26
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [research.md](../research.md)

---

## Autenticação e Autorização

- [x] CHK025 - O requisito de autenticação (`KeycloakAuthGuard`) está especificado para ambos os endpoints GET e PATCH? [Cobertura, plan.md §Camada 2] {auto}
  > plan.md §Camada 2: `@UseGuards(KeycloakAuthGuard)`, `@ApiBearerAuth()`. research.md D6: espelha padrão de `notifications.controller.ts`.

- [x] CHK026 - O modelo de autorização para o enforcement do Líder (RBAC: `Role.LIDER='lider'`) está documentado — quem lê, onde, em cada caminho (HTTP vs. worker)? [Completude, research.md D3.a / D3.b] {auto}
  > research.md D3.a: HTTP lê `roles: (Role|string)[]` de `AuthenticatedUser` via `@CurrentUser()`. research.md D3.b: worker lê `user_tenants.role` do DB via `withTenantTx`. Ambos documentados.

- [x] CHK027 - O requisito de que a restrição do Líder é inviolável via API (100% das tentativas de bypass rejeitadas) está especificado de forma mensurável? [Mensurabilidade, Spec §SC-005] {auto}
  > Spec §SC-005: "A restrição de `pastoral_alert.inApp` para Líderes é inviolável via API — 100% das tentativas de bypass são rejeitadas com erro de negócio." Mensurável via testes de integração T-G1.

- [x] CHK028 - O comportamento de fail-safe no worker para `pastoral_alert.inApp` está especificado (entrega a mais, nunca a menos)? [Completude, research.md D3.b] {auto}
  > research.md D3.b: "o pior caso para `pastoral_alert.inApp` é entregar a mais (fail-safe pastoral), nunca a menos." plan.md §Camada 2: "Worker fail-safe (entrega a mais, nunca a menos para `pastoral_alert.inApp`)." Documentado.

---

## Isolamento de Tenant (Multi-tenancy)

- [x] CHK029 - O requisito de RLS na tabela `notification_preferences` está especificado com a policy exata de `tenant_isolation`? [Completude, data-model.md §1.2] {auto}
  > data-model.md §1.2 inclui o SQL exato da policy `tenant_isolation` (espelha 14-1). Padrão `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` documentado.

- [x] CHK030 - Está definido que todo acesso à tabela usa `withTenantTx()` (nunca acesso direto ao Prisma sem `SET LOCAL app.current_tenant_id`)? [Cobertura, plan.md §Camada 2, research.md D6] {auto}
  > plan.md §Camada 2: "UPSERT idempotente, via `withTenantTx`". research.md D6: "`withTenantTx(this.prisma, ...)` (`apps/api/src/prisma/with-tenant-tx.ts`; faz `SET LOCAL app.current_tenant_id`)." Consistente.

- [x] CHK031 - O teste de isolamento RLS está especificado como obrigatório (roda 2x no CI para idempotência)? [Completude, data-model.md §1.3] {auto}
  > data-model.md §1.3: teste `notification-preferences.rls.spec.ts` com dois cenários (SELECT e UPDATE/DELETE cross-tenant). Lição Epic 13: roda 2x p/ idempotência no CI — documentado em MEMORY.md.

- [x] CHK032 - As preferências são por `(user_id, tenant_id)` — o contexto de tenant vem do request, nunca de parâmetro? [Consistência, Spec §Edge Cases, plan.md §Constituição] {auto}
  > Spec §Edge Cases: "Preferências são por `(user_id, tenant_id)` — cada tenant tem suas próprias preferências. O contexto de tenant é determinado pelo request corrente." plan.md §Constituição: "tenant via `AsyncLocalStorage` (`getRequestContext()`), NUNCA parâmetro."

---

## Input Validation

- [x] CHK033 - O requisito de validação de `notification_type` e `channel` contra enums fechados (rejeição com 400 BadRequest antes de tocar DB) está especificado? [Completude, Spec §Requirements FR-004, plan.md §Segurança] {auto}
  > Spec FR-004: "validar `notification_type` e `channel` contra os valores aceitos — requisições com valores fora do conjunto são rejeitadas com erro de validação antes de tocar o banco." plan.md §Segurança ponto 3: "400 Bad Request antes de tocar DB (FR-004)."

- [x] CHK034 - A ausência de texto livre do usuário no campo `metadata` (proteção contra stored-XSS) está documentada? [Cobertura, plan.md §Segurança ponto 3, research.md D9] {auto}
  > plan.md §Segurança ponto 3: "Sem texto livre em `metadata` (só constante server-side `reason='user_preference'` — sem superfície stored-XSS, research.md D9)." Documentado.

- [x] CHK035 - A proteção contra SQL injection via bind params (nunca interpolação de input do usuário) está especificada? [Cobertura, plan.md §Segurança ponto 6] {auto}
  > plan.md §Segurança ponto 6: "todo acesso ao DB usa `$N::uuid`/`$N` bind params, NUNCA interpolação de input do usuário. A única interpolação no caminho é o `tenant_id` no `SET LOCAL` de `withTenantTx`, já validado contra `UUID_RE`."

- [ ] CHK036 - Existe requisito de limite de tamanho de payload para o PATCH (proteção contra payloads gigantes com 14 entradas × campos extras)? [Cobertura, Gap] {humano}
  > Os artefatos não definem tamanho máximo de payload. O `.strict()` do Zod rejeita chaves extras, limitando estruturalmente o payload a 7 tipos × 2 canais. Mas não há `maxBodySize` explicitado. Para MVP com payload máximo ~200 bytes estruturalmente, é aceitável — mas decisão de produto se adicionar limite explícito.

---

## Proteção de Cache

- [x] CHK037 - O requisito de que a chave de cache é derivada apenas de `userId` autenticado (sem input do usuário na chave) está documentado? [Clareza, plan.md §Segurança ponto 5, data-model.md §6] {auto}
  > plan.md §Segurança ponto 5: "chave derivada só de `userId` autenticado; valor é JSON server-controlled; TTL curto; fallback DB." data-model.md §6: chave `cache:notif-prefs:{userId}`.

- [x] CHK038 - O valor cacheado é JSON server-controlled (sem input do usuário no valor) — proteção contra cache poisoning? [Completude, plan.md §Segurança ponto 5] {auto}
  > plan.md §Segurança ponto 5 explicitamente: "valor é JSON server-controlled". O objeto cacheado é o resultado do service (pós-defaults, pré-enforcement), nunca um valor de input do usuário.

---

## Logging e Auditoria

- [x] CHK039 - O requisito de que a supressão por preferência é auditável (auditores podem verificar via `status='failed' AND metadata->>'reason'='user_preference'`) está especificado? [Cobertura, Spec §US2 AC2, data-model.md §2] {auto}
  > Spec US2 AC2: "auditores/admins possam verificar que ela existiu e foi suprimida intencionalmente (razão: preferência do usuário)." data-model.md §2: "Auditores filtram por `status='failed' AND metadata->>'reason'='user_preference'`." Documentado.

- [ ] CHK040 - Eventos de mudança de preferência (PATCH bem-sucedido) são logados em nível de auditoria (quem mudou, quando, qual tipo/canal, de qual valor para qual valor)? [Cobertura, Gap] {humano}
  > Os artefatos não especificam logging de auditoria para mudanças de preferência via PATCH. A tabela tem `updated_at`, mas não `created_at` separado nem trilha de valor anterior. Para LGPD (consentimento e histórico), pode ser relevante. Decisão de produto se um audit log de preferências é necessário no MVP.

- [x] CHK041 - O requisito de log `warn` em falha de Redis (sem logar detalhes de conexão sensíveis) está especificado? [Clareza, Spec §Requirements FR-006] {auto}
  > Spec FR-006: "a indisponibilidade do cache é registrada como aviso nos logs". research.md D5: "on error: `logger.warn`". Sem menção de log de credenciais.

---

## Migração "Silenciar" (Superfície de Segurança)

- [x] CHK042 - O requisito de remoção da chave localStorage após migração (sem persistência de estado de silêncio no cliente) está especificado? [Completude, Spec §US3 AC3/5] {auto}
  > Spec US3 AC3: "o localStorage é removido". AC5: "o modal não é exibido novamente e o banner de silêncio não aparece (o estado de silêncio global não existe mais para esse usuário)." research.md D8: confirma a key `'metanoia:notificationSilence'`.

- [x] CHK043 - O fluxo de migração "Manter silenciado" persiste a preferência no servidor (não apenas remove o localStorage), prevenindo re-ativação por limpeza do browser? [Completude, Spec §US3 AC3] {auto}
  > Spec US3 AC3: "todas as preferências in-app são gravadas como `false` no servidor, o localStorage é removido." plan.md §Camada 4: "PATCH all `inApp:false` + remove key." Sem ambiguidade.
