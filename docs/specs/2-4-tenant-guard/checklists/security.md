# Security Checklist: 2-4-tenant-guard

**Purpose**: Validar qualidade e completude dos requisitos de segurança — autorização multicamada, isolamento de tenant, logging de rejeição e cobertura de testes.
**Created**: 2026-06-09
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md)
**Domain**: security (authorization, tenant isolation, guard chain)

> Items `{auto}` resolvidos pelo agente com citação de evidência.
> Items `{humano}` aguardam decisão do dono do produto.
> `[Gap]` = requisito ausente ou incompleto na spec/plan.

---

## Completude da Autorização

- [x] CHK001 - São os 3 níveis de autorização (JWT, roles, tenant) cobertos nos requisitos? [Completude, Spec §Context] {auto}
  > Spec §Context: "Layer 1 (JWT validation) e Layer 2 (role checking) já existem; This spec covers only the **residual gap**: Layer 3 tenant isolation guard."

- [x] CHK002 - Está o comportamento de bypass para `super_admin` definido em todos os contextos (RolesGuard e TenantGuard)? [Completude, Spec §P1, §FR-01] {auto}
  > Spec §P1 edge case: "super_admin role must bypass tenant check even if tenantId on user does not match the resource tenant." FR-01: "Automatically bypasses the tenant check for users holding the super_admin role."

- [x] CHK003 - Está definido o comportamento do TenantGuard quando `RequestContext` está ausente (middleware não registrado)? [Completude, Spec §FR-01] {auto}
  > Spec §FR-01 (pós-OWASP): "MUST fail-closed: if RequestContext is unavailable (store is null/undefined), reject with 403 — NEVER pass the request." Quickstart Scenario 9 cobre o teste.

- [x] CHK004 - Estão definidos os 4 papéis canônicos com seus valores de string exatos? [Completude, Spec §FR-02, §Key Entities] {auto}
  > Spec §FR-02: "Role enum containing exactly four values: super_admin, admin_tenant, lider, participante." data-model.md tabela de valores confirma correspondência com Keycloak realm_roles.

- [x] CHK005 - Estão cobertos nos requisitos os cenários de usuário sem tenant vs. usuário com tenant errado? [Completude, Spec §P1 Edge Cases] {auto}
  > Spec §P1 Edge Cases: "Request arrives with no tenant context in the resolved user object → reject with 403 (not 500)." Quickstart Scenarios 1 e 9 cobrem ambos os casos.

- [ ] CHK006 - São os callsites de `@Roles('pastor')` e `@Roles('admin')` documentados como débito técnico ativo com owner e prazo? [Completude, Plan §Complexity Tracking] {humano}
  > Plan §Complexity Tracking menciona os 5 callsites com TODO e "Epic 11" como destino — mas não há prazo, owner ou risco de segurança explicitamente aceito. Decisão de produto sobre prioridade.

---

## Clareza e Mensurabilidade

- [x] CHK007 - É "fail-closed" definido com critério verificável (não apenas como adjetivo)? [Clareza, Spec §FR-01] {auto}
  > Spec §FR-01: "if RequestContext is unavailable (store is null/undefined), reject with 403 — NEVER pass the request." Critério concreto e testável (Quickstart Scenario 9).

- [x] CHK008 - É o formato de resposta 403 especificado sem ambiguidade (campos, ausência de stack trace)? [Clareza, Spec §FR-04] {auto}
  > Spec §FR-04: "HTTP 403 with body { statusCode: 403, error: "Forbidden", message: "<human-readable reason>" }. No stack trace included." Success Criteria #5 complementa.

- [x] CHK009 - É "structured Pino log entry" especificada com campos concretos (não apenas "log estruturado")? [Clareza, Spec §FR-03] {auto}
  > Spec §FR-03 lista: action, user_id, endpoint, required_role (RolesGuard) / tenant_mismatch:true (TenantGuard). data-model.md §AuthRejectionLog detalha todos os campos por guard.

- [x] CHK010 - Está explicitado que tenant UUIDs NÃO devem aparecer nos logs de rejeição do TenantGuard? [Clareza, Spec §FR-03] {auto}
  > Spec §FR-03 (pós-OWASP): "Tenant UUIDs MUST NOT appear in the log entry for TenantGuard rejections — logging them would expose cross-tenant UUID discovery to any operator with log access (IDOR via log leakage). Use the boolean tenant_mismatch: true field instead."

- [x] CHK011 - É "migrar callsites para o enum" delimitado — quais callsites migrar vs. quais manter como string? [Clareza, Plan §Source Code] {auto}
  > Plan §Source Code lista explicitamente: grupos.controller, group-members, admin-invites, admin-pastoral, super-admin, admin-users, meetings/reflections → migrar; meetings.controller, reports, sse, telemetry, pastoral → manter como string com TODO.

- [x] CHK012 - São os Success Criteria mensuráveis e verificáveis (não apenas qualitativos)? [Mensurabilidade, Spec §Success Criteria] {auto}
  > SC1 "verified by integration test with 403 assertion", SC2 "verified by integration test", SC3 "verified by the type system", SC4 "verified by unit test asserting logger call arguments", SC5 "verified by response body assertion", SC6 "all existing authorization-related unit tests continue to pass", SC7 "CI green". Todos têm critério de verificação.

---

## Consistência de Requisitos

- [x] CHK013 - São os requisitos de FR-01 (TenantGuard) consistentes com a arquitetura declarada no plan (AsyncLocalStorage como fonte)? [Consistência, Spec §FR-01, Plan §Decision 3] {auto}
  > Plan research.md Decision 3: "guard compares user.tenantId (from request.user) against requestContext.getStore().tenantId". Spec FR-01: "Reads the resource's tenant_id from AsyncLocalStorage/RequestContext — never from function parameters." Consistente.

- [x] CHK014 - O `super_admin` bypass no TenantGuard é consistente com ele ainda precisar passar pelo RolesGuard? [Consistência, Spec §P1, OWASP INFO-01] {auto}
  > Plan §Convenções de Borda: "TenantGuard lê tenant via AsyncLocalStorage/RequestContext; super_admin bypass explícito." OWASP review INFO-01 documenta: "super_admin bypass in TenantGuard must NOT also bypass RolesGuard (they are independent guards)." Consistent — guards são independentes (APP_GUARD chain).

- [x] CHK015 - O tipo `(Role | string)[]` no `AuthenticatedUser.roles` é consistente com a backward-compatibility declarada em FR-06? [Consistência, Spec §FR-06, Plan §data-model] {auto}
  > data-model.md §AuthenticatedUser: "roles: (Role | string)[] — Widened for backward compat". FR-06: "MUST NOT break existing behavior". A ampliação de tipo é backward-compatible (string é subconjunto de string | Role). Consistente.

- [x] CHK016 - O `@Roles()` decorator atualizado é consistente com os callsites existentes (nenhuma quebra de contrato)? [Consistência, Plan §research.md Decision 2] {auto}
  > research.md Decision 2: "decorator signature changes from (...roles: string[]) to (...roles: (Role | string)[]). [...] The canonical callsites that use 'admin_tenant', 'lider', 'super_admin', 'participante' are migrated to Role.ADMIN_TENANT, etc." Widening de tipo não quebra chamadas existentes com strings.

---

## Cobertura de Cenários

- [x] CHK017 - São todos os 4 papéis cobertos nos cenários de teste (não apenas admin_tenant e super_admin)? [Cobertura, Spec §P4, §FR-05] {auto}
  > FR-05: "super_admin bypasses tenant check; admin_tenant blocked on cross-tenant access; participante/lider blocked on insufficient role; valid same-tenant access succeeds." P4 Acceptance Scenarios cobre super_admin, admin_tenant, participante. Lider está implícito em Scenario 3 (quickstart). Cobertura satisfatória.

- [x] CHK018 - Existe cenário de teste explícito para a cadeia de 3 guards em sequência (não apenas cada guard isolado)? [Cobertura, Spec §P4, Quickstart §Scenario 5] {auto}
  > Quickstart Scenario 5: "Create NestJS test module with APP_GUARD providers: KeycloakAuthGuard, RolesGuard, TenantGuard [...] Simulate request: valid JWT for admin_tenant user on tenant-A, endpoint context is tenant-A → controller handler invoked (200). Simulate cross-tenant [...] → TenantGuard rejects with 403."

- [x] CHK019 - Estão cobertos nos cenários os casos de resposta bem-sucedida (não apenas rejeições)? [Cobertura, Spec §P4, Quickstart §Scenario 3, 5] {auto}
  > Quickstart Scenario 3: "valid token for tenant A → returns true"; Scenario 5: "controller handler invoked (200)". Spec P4: "valid token for tenant A is accepted when the resource belongs to tenant A."

- [x] CHK020 - Existe requisito explícito cobrindo o formato de log quando user_id é indisponível? [Cobertura, Spec §P3 Edge Cases] {auto}
  > Spec §P3 Edge Cases: "If user_id is unavailable at log time, the entry uses a placeholder ('unknown') rather than omitting the field or throwing." Quickstart Scenario 6 também cobre.

- [x] CHK021 - Existe cenário de teste para o comportamento de fail-closed (RequestContext ausente)? [Cobertura, Quickstart §Scenario 9] {auto}
  > Quickstart Scenario 9 (adicionado pós-OWASP): "requestContext.getStore() === undefined → TenantGuard throws ForbiddenException(403) [...] guard MUST NOT return true."

- [ ] CHK022 - Existe requisito cobrindo o comportamento quando o usuário está autenticado mas sem nenhum role (roles array vazio)? [Cobertura, Spec §P4, Gap] {humano}
  > Spec e quickstart cobrem 'participante' bloqueado por role insuficiente (array não vazio), mas não definem explicitamente o caso roles=[]. O RolesGuard já lança ForbiddenException nesse caso (evidência: roles.guard.spec.ts linha 105-116), mas o requisito na spec não documenta esse edge case. Decisão: adicionar ao spec ou aceitar como coberto implicitamente?

---

## Requisitos Não-Funcionais

- [x] CHK023 - Está o requisito de performance do guard documentado (não pode introduzir latência significativa)? [NFR, Plan §Technical Context] {auto}
  > Plan §Technical Context: "Performance Goals: Guard execution < 1ms per request (pure synchronous logic)." Satisfatório para guards síncronos.

- [x] CHK024 - Está a ausência de stack trace em respostas 403 especificada como requisito (não apenas intenção)? [NFR, Spec §FR-04, §SC5] {auto}
  > Spec FR-04: "No stack trace included." SC5: "No authorization rejection returns a stack trace to the caller — verified by response body assertion in tests."

- [x] CHK025 - Está explicitado que a feature é stateless (sem side effects, sem escrita em DB)? [NFR, Plan §Technical Context, §Data Model] {auto}
  > Plan §Technical Context: "Storage: N/A (stateless feature; no new DB tables or migrations)." data-model.md: "This feature introduces no new database tables or migrations."

- [x] CHK026 - Está o escopo de impacto nos testes existentes documentado? [NFR, Spec §FR-06, SC6] {auto}
  > Spec FR-06: "The RolesGuard refactor MUST NOT break existing behavior." SC6: "All existing authorization-related unit tests continue to pass after the Role enum migration."

---

## Dependências e Premissas

- [x] CHK027 - Estão documentadas as dependências em componentes existentes que NÃO devem ser modificados? [Dependências, Spec §Context, Spec §Out of Scope] {auto}
  > Spec §Context: "Layer 1 (JWT validation via Keycloak) and Layer 2 (role checking via RolesGuard) already exist and must not be modified." Out of Scope: "KeycloakAuthGuard modifications — Layer 1 is production-ready and must not be changed."

- [x] CHK028 - Está documentada a premissa de que `realm_roles` no JWT corresponde exatamente aos valores do enum Role? [Premissas, Plan §research.md Decision 5, LOW-01] {auto}
  > research.md Decision 5 + OWASP LOW-01: "The Role enum values are the authoritative source of truth. Keycloak realm configuration MUST match exactly. Integration tests MUST assert: JWT with realm_roles=['super_admin'] resolves to Role.SUPER_ADMIN bypass." Documentado.

- [x] CHK029 - Está documentado que `TenantGuard` depende do `KeycloakAuthGuard` ter rodado antes (para `request.user` estar populado)? [Dependências, Plan §data-model TenantGuard] {auto}
  > data-model.md §TenantGuard: "Depends on: requestContext [...] AuthenticatedUser [...] populated by KeycloakAuthGuard." Plan §Implementation Tasks: Task 6 (TenantGuard) tem dependência em Task 1 (Role enum) e Task 3 (AuthenticatedUser update), implícito que KeycloakAuthGuard já existe.

- [ ] CHK030 - Está explicitado a ordem de execução dos APP_GUARDs no módulo (KeycloakAuthGuard → RolesGuard → TenantGuard)? [Dependências, Plan §auth.module.ts, Gap] {humano}
  > Plan §Source Code menciona "auth.module.ts [MODIFICAR] — +TenantGuard APP_GUARD" mas não documenta a ordem de registro dos APP_GUARDs. Em NestJS, `APP_GUARD` providers são executados na ordem de registro no array providers. Se TenantGuard for registrado antes de KeycloakAuthGuard, `request.user` estará undefined. Decisão: tornar a ordem explícita no plan e no task de implementação?

---

## Ambiguidades e Conflitos

- [x] CHK031 - O que acontece se o TenantGuard é aplicado a um endpoint @Public()? [Ambiguidade, Spec §FR-01] {auto}
  > data-model.md §TenantGuard §State transitions: "IS_PUBLIC? → bypass (true)" — o guard verifica `IS_PUBLIC_KEY` antes de qualquer validação de tenant. Consistente com o padrão existente no RolesGuard. Ambiguidade resolvida.

- [x] CHK032 - O campo `required_role` no log do RolesGuard — é o valor do decorator ou o role do usuário? [Ambiguidade, Spec §FR-03] {auto}
  > Spec §FR-03: "required_role (for RolesGuard)" — contexto indica roles requeridas (do decorator), não roles do usuário. data-model.md §AuthRejectionLog: "required_role: string | string[] | RolesGuard only | From @Roles() metadata". Ambiguidade resolvida na tabela.

- [x] CHK033 - O comportamento do TenantGuard quando `user.tenantId` está vazio (string vazia, não undefined)? [Edge Case, Spec §P1 Edge Cases] {auto}
  > Spec §P1 Edge Cases: "Request arrives with no tenant context in the resolved user object → reject with 403 (not 500)." Implica que string vazia ≠ qualquer tenantId válido → rejeita. data-model.md confirma: "user.tenantId == requestContext.tenantId? → pass (true) / ForbiddenException (403)". String vazia ≠ UUID → 403. Coberto.

---

## Notes

- Items `{auto}` foram resolvidos pelo agente com citação de evidência direta dos artefatos.
- Items `{humano}` ficam `[ ]` aguardando decisão do dono do produto:
  - **CHK006**: prioridade/owner dos callsites `'pastor'`/`'admin'` (débito de segurança latente)
  - **CHK022**: comportamento com `roles=[]` (edge case de completude de spec)
  - **CHK030**: ordem explícita dos `APP_GUARD` no módulo (risco de implementação)
- **CHK030 é o item de maior risco prático**: ordem errada de APP_GUARD quebra silenciosamente a cadeia de guards em runtime.
