# Requirements Checklist: feature-toggles-tenant (Story 11-3)

**Purpose**: Valida qualidade, clareza e completude dos requisitos da Story 11-3 (Políticas & Feature Toggles por Tenant). "Unit tests para requisitos" — não testa implementação.
**Created**: 2026-06-14
**Feature**: [spec.md](../spec.md)
**Domínio**: requirements (multi-domain: api + security + data)

---

## Completude de Requisitos

- [x] CHK001 — Todos os toggles configuráveis estão documentados com nome camelCase, valor default e tier mínimo? [Completude, Spec §3] {auto}
  > Satisfeito: §3 tabela "Tier gating" lista 5 toggles (`focusMonitoring`, `mandatoryCamera`, `sequentialTrailAccess`, `autoPresenceTracking`, `expressMode`) com tier mínimo (`Free`/`Pro`) e §3 `POLICY_DEFAULTS` com defaults explícitos.

- [x] CHK002 — O mapeamento `focusMonitoring ↔ tenant.focusIndicatorEnabled` está especificado como requisito (ler e gravar na coluna existente, sem duplicar em JSONB)? [Completude, Spec §4.2, D1] {auto}
  > Satisfeito: §4.2 especifica "A coluna `tenant.focusIndicatorEnabled` já existe. Nenhuma migration toca nela." + fluxos GET §6.1.2c e PATCH §6.2.3c descrevem o mapeamento explicitamente.

- [x] CHK003 — Há requisito para o campo `policyVersion` (geração, incremento, header `X-Policy-Version` e impacto no re-fetch do FE)? [Completude, Spec §6.1, §6.2, §8.3] {auto}
  > Satisfeito: GET §6.1 passo 2e e passo 3; PATCH §6.2 passo 3e, 3f e 4; §8.3 especifica lógica de `invalidateQueries` por mismatch de `policyVersion`; dec-010 fixa "incrementa em todo PATCH".

- [x] CHK004 — O fluxo de audit log está especificado (action, resource, previousState/newState)? [Completude, Spec §6.2, D8, §9] {auto}
  > Satisfeito: §6.2 passo 3g especifica `audit.service.createEvent({ action: 'policy_change', resource: 'tenant_policies', payload: { previousState, newState } })`; §5.2 exige `'policy_change'` em `AUDIT_ACTIONS`.

- [x] CHK005 — O comportamento de consent exemption para `focusMonitoring` está completamente especificado (tipo de consent, impacto no banner e no toggle)? [Completude, Spec §6.2.h.ii, D7, §8.5] {auto}
  > Satisfeito: D7 define `consentType = 'focus_monitoring'`; §6.2.h.ii especifica "flag exempted (NÃO ativar para eles)"; §8.5 especifica que usuários com withdrawal "não recebem o banner".

- [x] CHK006 — A exclusão de escopo (§11) delimita claramente o que NÃO é implementado nesta story? [Completude, Spec §11] {auto}
  > Satisfeito: §11 lista 5 itens explicitamente fora de escopo: notificações push/email, histórico de versões, API pública para microserviços, `expressMode` enforcement global, `sequentialTrailAccess` enforcement em criação de trilha.

- [ ] CHK007 — Há requisito explícito para o conteúdo mínimo do evento `focus-monitoring.enabled` (EventEmitter2), incluindo payload e consumidor esperado? [Completude, Spec §6.2.h.i, Q2/dec-009] {humano}
  > §6.2.h.i menciona "emitir evento interno" e dec-009 define EventEmitter2 como mecanismo, mas o **payload** do evento e o **consumer** (módulo de reuniões/SSE) não são especificados na spec. Quais campos deve carregar o evento e qual módulo deve escutá-lo são decisões que afetam testabilidade.

---

## Clareza de Requisitos

- [x] CHK008 — O termo "write-through" está definido com precisão suficiente (SET com TTL, não DEL; comportamento no hit e no miss)? [Clareza, Spec §6.1.2, D5] {auto}
  > Satisfeito: D5 define "SET, não DEL"; §6.1 passo 2a (hit: parse e retorna), passo 2e (miss: SET após leitura); §6.2 passo 3f (SET após update); TTL 3600s especificado em §6.1.2e.

- [x] CHK009 — O caso "linha `TenantPolicies` ausente" (sem linha no banco) está especificado como comportamento válido com defaults bem definidos? [Clareza, Spec §3, D4, §9] {auto}
  > Satisfeito: D4 "Defaults em código (convention-over-config); linha em `TenantPolicies` é opcional"; `POLICY_DEFAULTS` em §3; teste "Defaults sem linha" em §9.

- [x] CHK010 — O requisito de `@Res({ passthrough: true })` para injetar o header `X-Policy-Version` sem quebrar o envelope de resposta está especificado? [Clareza, Spec §6.1 passo 3, §6.2 passo 4, Plan §Convenções] {auto}
  > Satisfeito: spec §6.1 passo 3 "Controller: response.set('X-Policy-Version', String(policyVersion))"; plan §Arquitetura "Controller seta `X-Policy-Version` via `@Res({ passthrough: true })`".

- [x] CHK011 — O critério de tier gating (`'free'`/`'pro'` lowercase) está definido sem ambiguidade? [Clareza, Spec §3, D6, Plan §Arquitetura] {auto}
  > Satisfeito: plan §Arquitetura PATCH passo 2 especifica `PlanLimitsService.getPlan(tenantId)` retornando `'free'`; spec §3 lista tier mínimo por toggle; contexto do prompt da onda fixa tier `'free'`/`'pro'` lowercase.

- [x] CHK012 — O requisito de validação Zod no PATCH (pipe, schema, borda) é inequívoco quanto ao schema aplicado (`UpdatePoliciesSchema`, não `TenantPoliciesSchema`)? [Clareza, Spec §5.1, §6.2, D4] {auto}
  > Satisfeito: §5.1 define `UpdatePoliciesSchema = TenantPoliciesSchema.partial()` explicitamente; §6.2 passo 2 especifica `ZodValidationPipe(UpdatePoliciesSchema)`; plan §Convenções confirma "borda: PATCH request (`UpdatePoliciesSchema` via `ZodValidationPipe`)".

- [ ] CHK013 — O requisito de qual role pode chamar o PATCH (Admin Tenant somente?) especifica comportamento para `admin_super`? [Clareza, Spec §6.2 passo 1] {humano}
  > Spec §6.2 define `RolesGuard(@ADMIN_TENANT)` para o PATCH. Não está especificado se `admin_super` (super-admin criado em Story 9-3) pode ou não alterar políticas de qualquer tenant via este endpoint. Decisão de produto: super-admin precisa de endpoint diferente ou tem acesso ao PATCH também?

---

## Consistência de Requisitos

- [x] CHK014 — O `id` da linha `TenantPolicies` é gerado via `uuidv7()` no service (não `@default(uuid())` no Prisma)? Consistente com invariante UUID v7 do projeto? [Consistência, Spec §4.1, §10.2, D2 plan] {auto}
  > Satisfeito: §4.1 nota "id gerado via `uuidv7()` na camada de serviço (não `@default(uuid())`)"; §10 guardrail CI 7 confirma "nunca `@default(uuid())` no Prisma".

- [x] CHK015 — A FK `tenant_policies.tenant_id → tenants.id ON DELETE CASCADE ON UPDATE CASCADE` está consistente com o padrão do projeto (invariante cascade)? [Consistência, Spec §4.3, §10.1] {auto}
  > Satisfeito: §4.3 migration especifica `ON DELETE CASCADE ON UPDATE CASCADE`; §10.1 confirma "FK→tenants com `ON DELETE CASCADE ON UPDATE CASCADE`"; §4.1 nota "onUpdate: Cascade — invariante cascade-users-id não se aplica aqui (FK→tenants, não →users)".

- [x] CHK016 — Os campos JSONB (keys camelCase) são consistentes com o padrão de naming do projeto para payloads e DTOs? [Consistência, Plan §Convenções de Borda] {auto}
  > Satisfeito: plan §Convenções de Borda define "JSONB `policies` keys: camelCase (`mandatoryCamera`, `sequentialTrailAccess`, `autoPresenceTracking`, `expressMode`)" consistente com "Backend DTO/response: camelCase" e "API payload: camelCase".

- [x] CHK017 — O envelope de resposta `{ data: { policies, tierInfo } }` é consistente com o padrão de API do projeto (`{ "data": {...}, "meta?": {...} }`)? [Consistência, Spec §6.1 passo 4, Plan §Contratos de API] {auto}
  > Satisfeito: §6.1 passo 4 "Return `{ data: {policies, tierInfo} }`"; plan constitution check IV PASS confirma "envelope `{ data }`".

- [x] CHK018 — `PoliciesService` injeta `ConsentRepository` (não `ConsentService`) — consistente com dec-011 (ConsentRepository já exportado)? [Consistência, Spec §6.4, dec-011] {auto}
  > Satisfeito: §6.4 "PoliciesService injeta: `PrismaService`, `RedisService`, `PlanLimitsService`, `AuditService`, `ConsentRepository`"; dec-011 confirma `ConsentRepository` já exportado de `ConsentModule`.

- [x] CHK019 — A exigência de snapshot test para `TenantPoliciesSchema`, `PoliciesResponseSchema` e `AUDIT_ACTIONS` é consistente com o padrão do projeto (§9 e CLAUDE.md)? [Consistência, Spec §5.1, §5.2, §9] {auto}
  > Satisfeito: §5.1 "Snapshot test obrigatório"; §5.2 exige snapshot para `AUDIT_ACTIONS`; §9 lista "Zod snapshot" e "AUDIT_ACTIONS snapshot"; CLAUDE.md confirma "Snapshot tests required for Zod schemas".

---

## Qualidade dos Critérios de Aceite

- [x] CHK020 — Cada AC do epic-11 Story 11.3 tem cobertura rastreável a pelo menos uma seção da spec? [Mensurabilidade, Spec §12] {auto}
  > Satisfeito: §12 tabela de mapeamento AC→seções lista 9 ACs com referencias a §3, §5, §6.2, §7, §8.1-§8.5, §9. Cobertura completa.

- [x] CHK021 — O critério de aceite "403 acionável no Free para toggle Pro" é mensurável (código HTTP + ForbiddenException + mensagem de upgrade)? [Mensurabilidade, Spec §6.2 passo 3b, D6] {auto}
  > Satisfeito: D6 "403 acionável com mensagem de upgrade. Lógica via `PlanLimitsService.getPlan()`"; §6.2 passo 3b "throw ForbiddenException"; §9 "Tier gating Free → 403 ForbiddenException"; i18n key `upgradePrompt` em §8.4.

- [x] CHK022 — O critério "policyVersion mismatch → TanStack Query re-fetch" tem especificação mensurável no código FE (comparar header vs cache, invalidar se diferente)? [Mensurabilidade, Spec §8.3, dec-010] {auto}
  > Satisfeito: §8.3 código exato do hook `onSuccess` especificado com `Number(response.headers.get('X-Policy-Version'))`, comparação com `cachedVersion` e `invalidateQueries`.

- [x] CHK023 — O critério "RLS isolation" é mensurável com cenários de teste definidos? [Mensurabilidade, Spec §7] {auto}
  > Satisfeito: §7 lista 4 cenários obrigatórios (findFirst cross-tenant, UPDATE cross-tenant, insert com tenant_id errado, ausência de `SET LOCAL app.current_tenant_id`).

---

## Cobertura de Cenários

- [x] CHK024 — O fluxo happy-path GET com cache hit está especificado? [Cobertura, Spec §6.1 passo 2a] {auto}
  > Satisfeito: §6.1 passo 2a "Tenta Redis: GET cache:policies:{tenantId} → se hit, retorna (parse JSON)".

- [x] CHK025 — O fluxo happy-path GET com cache miss (banco + write-through) está especificado? [Cobertura, Spec §6.1 passos 2b-2e] {auto}
  > Satisfeito: §6.1 passos 2b a 2e especificam miss → lê banco → merge → write-through.

- [x] CHK026 — O fluxo PATCH com todos os toggles novos (exceto `focusMonitoring`) está coberto pela especificação de UPSERT JSONB? [Cobertura, Spec §6.2 passo 3d] {auto}
  > Satisfeito: §6.2 passo 3d "`omit(dto, 'focusMonitoring')`" garante separação; "UPSERT TenantPolicies: `newPolicies = { ...currentJSONB, ...omit(...) }`".

- [x] CHK027 — O cenário "PATCH com `focusMonitoring` que já estava ON (sem transição OFF→ON)" é coberto? Deve incrementar `policyVersion` e gravar, mas NÃO emitir evento? [Cobertura, Spec §6.2 passo 3h] {auto}
  > Satisfeito: §6.2 passo 3h especifica "Se `focusMonitoring` transita OFF→ON" (condicional explícita) — implica que se já estava ON, o evento não é emitido. `policyVersion` incrementa sempre (dec-010, sem condicional).

- [x] CHK028 — O cenário de tenant Free tentando ativar toggle Free (não deve dar 403) está implicitamente coberto? [Cobertura, Spec §3, §6.2 passo 3b] {auto}
  > Satisfeito: §6.2 passo 3b "Para cada toggle em dto que **exige Pro**" — só `focusMonitoring` e `mandatoryCamera` são Pro; os outros 3 não passam pelo gate, portanto Free pode ativá-los.

- [x] CHK029 — O cenário "tenant sem linha `TenantPolicies` fazendo PATCH" é coberto (UPSERT deve criar linha com `uuidv7()`)? [Cobertura, Spec §6.2 passo 3d, §10.7] {auto}
  > Satisfeito: §6.2 passo 3d "UPSERT `TenantPolicies`" + §10.7 guardrail CI "uuidv7() no create" cobrem o caso de criação na primeira modificação.

---

## Cobertura de Edge Cases

- [x] CHK030 — O edge case "PATCH com `focusMonitoring: true` e tenant Free" é especificado como 403? [Edge Cases, Spec §6.2 passo 3b, D6] {auto}
  > Satisfeito: D6 e §6.2 passo 3b cobrem este caso; §9 teste "Tier gating Free" confirma `ForbiddenException`.

- [x] CHK031 — O edge case "usuário com withdrawal ativo para `focus_monitoring` ao ativar `focusMonitoring`" está coberto (flag `exempted`, não ativar para ele)? [Edge Cases, Spec §6.2.h.ii, D7, §9] {auto}
  > Satisfeito: D7 define o mecanismo; §6.2.h.ii especifica "flag exempted (NÃO ativar para eles)"; §9 teste "Consent exemption" especifica `hasActiveWithdrawal → true → feature OFF para ele".

- [x] CHK032 — O edge case "PATCH sem `focusMonitoring` no dto" (não atualizar `tenant.focusIndicatorEnabled`) está coberto? [Edge Cases, Spec §6.2 passo 3c] {auto}
  > Satisfeito: §6.2 passo 3c "Separa: `focusMonitoring` (se presente) → UPDATE tenants" — o "se presente" é condicional; se ausente, `focusIndicatorEnabled` não é tocado.

- [ ] CHK033 — O edge case "PATCH enviando `{}` (dto vazio) deve resultar em quê?" está especificado? [Edge Cases, Spec §6.2] {humano}
  > `UpdatePoliciesSchema = TenantPoliciesSchema.partial()` aceita `{}` como válido via Zod. Não está especificado se PATCH com dto vazio deve: (a) retornar 200 sem alterar nada mas incrementar `policyVersion`, ou (b) retornar 400 (sem utilidade). Impacta a lógica de `policyVersion = currentVersion + 1` ser ou não condicional.

- [ ] CHK034 — O edge case "Redis indisponível no PATCH (write-through falha)" é especificado quanto ao comportamento (falha silenciosa ou propagação de erro)? [Edge Cases, Spec §6.2 passo 3f] {humano}
  > Spec define write-through no PATCH mas não especifica o tratamento de falha Redis. O padrão do projeto para outros serviços (ex: branding, 11-2) aplica fail-silent no Redis? Decidir antes de implementar para evitar surpresas em produção.

- [ ] CHK035 — O edge case "scroll de `policyVersion` (overflow de Int)" está coberto? [Edge Cases, Spec §4.1] {humano}
  > `policyVersion` é `Int` Prisma → `integer` PostgreSQL (max ~2.1 bilhões). Para fins práticos não é problema, mas se a spec exige `positive()` no Zod (`z.number().int().positive()`), overflow → overflow negativo quebraria a validação. Confirmar se há guardrail ou se o campo é safe-to-ignore.

---

## Requisitos Não-Funcionais

- [x] CHK036 — Há requisito de performance para o GET (Redis hit deve evitar query ao banco)? [NFR-Performance, Spec §6.1.2a] {auto}
  > Satisfeito: fluxo GET §6.1.2 define hit Redis antes de qualquer acesso ao banco — implicitamente garante que hit não vai ao banco. TTL 3600s reduz carga de leitura.

- [x] CHK037 — Os requisitos de segurança (auth, RLS, tier gating, audit) estão todos especificados? [NFR-Segurança, Spec §6.1 passo 1, §6.2 passo 1, §7, D8] {auto}
  > Satisfeito: Auth (`KeycloakAuthGuard + RolesGuard(@ADMIN_TENANT)`) em §6.1.1 e §6.2.1; RLS em §4.3 e §7; Tier gating em §6.2.3b e D6; Audit em §6.2.3g e D8.

- [x] CHK038 — O requisito de privacidade (`focusMonitoring: false` por padrão — NFR-L4) está documentado com justificativa? [NFR-Privacidade, Spec §3] {auto}
  > Satisfeito: §3 `POLICY_DEFAULTS` contém comentário "NFR-L4 — privacidade, deve ser OFF por padrão" em `focusMonitoring: false`.

- [x] CHK039 — Há requisito de acessibilidade WCAG AA para o dialog de confirmação de privacidade? [NFR-Acessibilidade, Spec §9, Plan §Constitution Check VI] {auto}
  > Satisfeito: plan §Constitution Check VI PASS nota "WCAG AA na UI (dialog de confirmação acessível)"; spec §9 não lista teste de a11y mas plan §Arquitetura Frontend confirma "`PrivacyConfirmDialog` antes de ativar... (WCAG AA)".

- [x] CHK040 — O requisito de vocabulário pastoral PT-BR (labels e descrições no FE) está mapeado para todas as 5 toggles? [NFR-Idioma, Spec §3, §8.4] {auto}
  > Satisfeito: §3 tabela "Vocabulário pastoral PT-BR" lista label + descrição para os 5 toggles; §8.4 bloco i18n `pt-BR.json` com todas as keys necessárias.

---

## Dependências e Premissas

- [x] CHK041 — A premissa "`ConsentRepository` já exportado de `ConsentModule`" foi verificada empiricamente e documentada? [Dependências, Spec dec-011] {auto}
  > Satisfeito: dec-011 score 3 com evidência "Evidência direta: `apps/api/src/consent/consent.module.ts` exporta explicitamente `[ConsentService, ConsentGuard, ConsentRepository]`".

- [x] CHK042 — A premissa "EventEmitter2 global já configurado" está documentada? [Dependências, Spec §6.4, dec-009] {auto}
  > Satisfeito: §6.4 nota "EventEmitter2 vem do `EventEmitterModule.forRoot()` global do app"; dec-009 confirma "já usado em tenants.service.ts, meetings.service.ts, groups.service.ts, onboarding".

- [x] CHK043 — A premissa "`transparency-banner.tsx` existente (Story 5-5) pronta para reuso" está referenciada? [Dependências, Spec §8.5] {auto}
  > Satisfeito: §8.5 "Quando `focusMonitoring` é ativado via PATCH, o backend emite evento interno que aciona a `transparency-banner.tsx` existente".

- [ ] CHK044 — A necessidade de adicionar `'focus_monitoring'` a `ConsentDocumentType` (se ausente) foi verificada empiricamente antes de documentar como requisito? [Dependências, Spec §6.2 passo 3.DI, Spec §6.3] {humano}
  > Plan §Sequência "Confirmar `'focus_monitoring'` em `ConsentDocumentType` (adicionar se ausente)" indica que isso é condicional — mas a spec não documenta o resultado da verificação. O implementador deve verificar antes de codar; idealmente a spec diria se já existe ou não.

- [x] CHK045 — As dependências de módulos NestJS (`AuditModule`, `ConsentModule`, `PlanLimitsModule`) estão identificadas como já existentes no projeto? [Dependências, Spec §6.4, Plan §DI] {auto}
  > Satisfeito: plan §DI/módulo "(`PlanLimitsModule`/`RedisModule` já presentes)"; dec-011 confirma `ConsentModule` exporta o necessário; D8 reusa `audit.service.createEvent` (já existente).

---

## Notes

- Items `{auto}` resolvidos com citação de evidência direta da spec ou plan.
- Items `{humano}` ficam `[ ]` — requerem decisão do dono do produto ou verificação empírica.
- **Gaps abertos** (`[Gap]`): nenhum requisito crítico ausente — spec é abrangente.
- **Ambiguidades** (`[Ambiguity]`): CHK007 (payload EventEmitter2), CHK013 (super-admin no PATCH), CHK033 (PATCH dto vazio), CHK034 (Redis fail no PATCH), CHK044 (ConsentDocumentType existente?).
- **Itens sem impacto no go/no-go**: CHK035 (policyVersion overflow — edge remoto).

### Resolução

- **`{auto}` resolvidos**: 34 (`[x]` com citação)
- **`{humano}` aguardando decisão**: 6 (CHK007, CHK013, CHK033, CHK034, CHK035, CHK044)
- **`[Gap]`/`[Ambiguity]`**: 0 gaps críticos; 5 ambiguidades leves documentadas nos `{humano}`

### Próximos Passos

- Decidir os 6 itens `{humano}` (dono do produto / tech lead) — prioritários: CHK033 e CHK034 (afetam comportamento da implementação).
- `/create-tasks` — prosseguir no pipeline (spec é aprovável; ambiguidades são leves e não bloqueantes para begin de impl.).
- Revisitar CHK007 para garantir que `focus-monitoring.enabled` event tem payload documentado antes da task de backend.
