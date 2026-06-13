# Requirements Quality Checklist: Wizard de Onboarding (Story 10-1)

**Purpose**: Validar a QUALIDADE dos requisitos do wizard de onboarding — completude, clareza, consistência, mensurabilidade e cobertura de cenários/edge cases. Não valida implementação.
**Created**: 2026-06-13
**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **FR de origem**: FR70

> Itens `{auto}` resolvidos pelo orquestrador contra spec/plan/data-model/contracts com evidência citada. Itens `{humano}` aguardam o dono do produto. `[Gap]`/`[Ambiguity]`/`[Conflict]` viram ação (`/clarify` ou `/create-tasks`).

## Completude de Requisitos

- [x] CHK001 - São definidos requisitos de disparo do wizard (quem vê, sob quais condições)? [Completude, Spec §FR-01] {auto}
  - Evidência: FR-01 define condição TRIPLA `completed=false AND skippedAt=null AND sem grupos reais`; dec-007 (Clarifications) ratifica manter as 3 condições.
- [x] CHK002 - São especificados requisitos de persistência de progresso por etapa? [Completude, Spec §FR-02] {auto}
  - Evidência: FR-02 define `onboardingProgress` JSONB `{currentStep, completedSteps[], stepData, completedAt?, skippedAt?}` + retomada da última etapa concluída.
- [x] CHK003 - Cada uma das 5 etapas tem requisitos funcionais próprios? [Completude, Spec §FR-03..07] {auto}
  - Evidência: FR-03 (perfil), FR-04 (comunidade), FR-05 (grupo/demo), FR-06 (convite condicional), FR-07 (radar). Cobertura 1:1 com Etapas 1-5.
- [x] CHK004 - São definidos requisitos de conclusão e de skip explícito? [Completude, Spec §FR-08] {auto}
  - Evidência: FR-08 grava `completedAt` (Etapa 5) OU `skippedAt` (saída antecipada), mutuamente exclusivos.
- [x] CHK005 - É definido o requisito de replay ("Rever tutorial")? [Completude, Spec §FR-09] {auto}
  - Evidência: FR-09 + dec-010 (modo leitura, `readOnly?: boolean`, sem persistir alterações).
- [x] CHK006 - São especificados os endpoints novos necessários? [Completude, Spec §FR-12] {auto}
  - Evidência: FR-12 + contracts/onboarding-api.md: `PATCH /tenants/me`, `PATCH /users/me`, `GET /onboarding/status` (todos NOVOS).
- [x] CHK007 - É definido requisito de eventos de domínio por etapa? [Completude, Spec §FR-10] {auto}
  - Evidência: FR-10 `onboarding.wizard.step_completed {tenantId, step, stepName, timestamp}`; dec-009 fixa EventEmitter2 in-process.
- [x] CHK008 - São especificados requisitos de degradação graciosa (demo indisponível, falha de upload)? [Completude, Spec §FR-13] {auto}
  - Evidência: FR-13 — demo indisponível oculta opção (b)/preview; falha de upload não bloqueia avanço.
- [ ] CHK009 - O requisito de analytics de conclusão (<10min, taxa ≥70%) tem fonte de dados de medição definida? [Completude, Spec §Success Criteria 1-2] {auto}
  - `[Gap]`: SC-1/SC-2 citam medição "via eventos `step_completed` e `onboarding.wizard.completed`", porém o evento `onboarding.wizard.completed` (conclusão) NÃO está especificado em FR-10 nem em contracts (só `step_completed` existe). Sem ele, SC-1/SC-2 não são mensuráveis pelo mecanismo declarado. → `/create-tasks`: definir evento de conclusão OU corrigir SC para usar `step_completed` da Etapa 5.

## Clareza de Requisitos

- [x] CHK010 - O termo "grupos reais" da condição de disparo está definido (vs demo)? [Clareza, Spec §FR-01] {auto}
  - Evidência: contracts GET /onboarding/status — `hasRealGroups = count(groups do tenant) > 0` server-side; demo data é distinta (isDemo). Definição operacional clara.
- [x] CHK011 - "Tela cheia" e "não pode ser fechado sem interação explícita" estão qualificados? [Clareza, Spec §P1] {auto}
  - Evidência: P1 — full-screen com 5 etapas numeradas + indicador de progresso; fecha só via concluir ou pular explícito.
- [x] CHK012 - Os campos obrigatórios vs opcionais de cada etapa estão explícitos? [Clareza, Spec §FR-03/FR-04] {auto}
  - Evidência: FR-03 nome obrigatório / título+foto opcionais; FR-04 nome comunidade obrigatório / denominação+cidade/UF+logo opcionais.
- [x] CHK013 - A semântica de mutual-exclusão das opções (a)/(b) da Etapa 3 está clara? [Clareza, Spec §FR-05] {auto}
  - Evidência: FR-05 "duas opções mutuamente exclusivas"; opção (b) implica skip automático da Etapa 4. data-model state machine confirma `stepData.mode='demo'→currentStep=5`.
- [x] CHK014 - A condição de exibição da Etapa 4 está sem ambiguidade? [Clareza, Spec §FR-06] {auto}
  - Evidência: FR-06 "apenas se Etapa 3 foi via opção criar grupo real"; P5 confirma skip automático em modo-demo.
- [x] CHK015 - O destino de cada campo (coluna tipada vs JSONB vs metadata) está definido sem ambiguidade? [Clareza, Spec §Clarifications/data-model] {auto}
  - Evidência: dec-008 (URLs em colunas `logoUrl`/`profilePhotoUrl`), dec-011 (`completedAt`/`skippedAt` dentro do JSONB), data-model §schema (denominação/cidade/UF em `metadata`).
- [x] CHK016 - A distinção entre tracking user-scoped e tenant-scoped está clara? [Clareza, Spec §Clarifications] {auto}
  - Evidência: Clarifications — `User.onboardingCompletedAt` (user) coexiste com `Tenant.onboardingProgress` (tenant); contracts confirma 2 endpoints distintos de status.
- [ ] CHK017 - "Vocabulário pastoral" está suficientemente especificado para ser verificável por etapa? [Clareza, Spec §FR-03] {auto}
  - `[Ambiguity]`: FR-03 exige "termos pastorais" e dá 1 exemplo ("Como seus discípulos te conhecem?"), mas não enumera os rótulos por etapa nem aponta as keys de `vocabulary.ts`. Verificação "passa/não-passa" por etapa fica subjetiva. → `/clarify`: confirmar se a fonte da verdade (vocabulary.ts) cobre todos os rótulos das 5 etapas ou se itens novos são necessários.

## Consistência de Requisitos

- [x] CHK018 - Os requisitos de conclusão (FR-08) são consistentes com a state machine do data-model? [Consistência, Spec §FR-08, data-model §state machine] {auto}
  - Evidência: FR-08 (completedAt XOR skippedAt) ↔ data-model "Transições terminais (completedAt ou skippedAt)". Consistente.
- [x] CHK019 - Há consistência entre Key Entities (cita `onboardingSkippedAt`) e dec-011 (sem coluna)? [Consistência, Spec §Key Entities/dec-011] {auto}
  - Evidência: Resolvido na Clarification dec-011 — "`onboardingSkippedAt` em Key Entities refere-se a `onboardingProgress.skippedAt` (não coluna separada)". data-model §schema confirma "Sem `onboardingSkippedAt`". Conflito aparente já reconciliado.
- [x] CHK020 - Os endpoints `/me` são consistentes com a convenção do repo (vs `/current` do artifact)? [Consistência, Spec §Clarifications, contracts] {auto}
  - Evidência: Clarifications "endpoints novos usam `/me`"; contracts reforça "o artifact dizia `/current` — não usar". Consistente.
- [x] CHK021 - O reuso de `User.name` como display name é consistente entre spec, data-model e contracts? [Consistência, Spec §FR-03, data-model, contracts] {auto}
  - Evidência: data-model "displayName reusa coluna `User.name`"; contracts PATCH /users/me `name` "reusa coluna `User.name`". Consistente.
- [x] CHK022 - A condição de disparo (FR-01) é consistente com a coexistência do guard existente? [Consistência, Spec §FR-01/Clarifications] {auto}
  - Evidência: FR-01 "engata no guard existente sem substituir"; Clarifications "`onboarding-redirect-guard.tsx` não é recriado". Consistente.

## Qualidade de Critérios de Aceite (mensurabilidade)

- [x] CHK023 - Os Success Criteria são quantificados? [Mensurabilidade, Spec §Success Criteria] {auto}
  - Evidência: SC-1 (80% <10min), SC-2 (≥70% chega à Etapa 5), SC-3 (100% retomada), SC-4 (zero cross-tenant), SC-5 (100% jest-axe WCAG AA), SC-6 (100% falhas de upload com mensagem acionável). Quantificados.
- [x] CHK024 - O critério de acessibilidade é objetivamente verificável? [Mensurabilidade, Spec §SC-5/FR-11] {auto}
  - Evidência: SC-5 "100% dos testes jest-axe WCAG AA sem exceções suprimidas"; plan Constitution Check VI confirma jest-axe como gate real.
- [x] CHK025 - O critério de isolamento de tenant é verificável? [Mensurabilidade, Spec §SC-4] {auto}
  - Evidência: SC-4 "verificável via testes de isolamento RLS"; plan Decision 9 inclui RLS isolation spec dos write paths novos.
- [ ] CHK026 - A medição de SC-3 (retomada) cobre os dois gatilhos da spec (reload E fechar navegador)? [Mensurabilidade, Spec §SC-3, P1 edge cases] {auto}
  - `[x]` parcial → trata como satisfeito: P1 Edge Cases especifica ambos (reload na etapa 3 e fechar navegador na etapa 2 retomam); SC-3 "100% que recarregam ou fecham". Mensurável via testes de persistência. Marcado `[x]`.
- [x] CHK026b - SC-3 é testável conforme declarado? [Mensurabilidade, Spec §SC-3] {auto}
  - Evidência: SC-3 "testável via testes automatizados de persistência"; quickstart Cenário 8 (citado no plan FR-02). Satisfeito.

## Cobertura de Cenários e Edge Cases

- [x] CHK027 - São cobertos os cenários de happy-path das 5 etapas + conclusão + skip? [Cobertura, Spec §P1-P8] {auto}
  - Evidência: P1 (disparo), P2-P6 (Etapas 1-5), P7 (conclusão), P8 (skip). Cobertura completa.
- [x] CHK028 - É coberto o edge case de `super_admin` não ver o wizard? [Cobertura, Spec §P1 Edge Cases] {auto}
  - Evidência: P1 Edge Cases "Admin com papel `super_admin` não vê o wizard (exclusivo de `admin_tenant`)".
- [x] CHK029 - São cobertos edge cases de retomada (reload/fechar navegador)? [Cobertura, Spec §P1 Edge Cases] {auto}
  - Evidência: P1 Edge Cases — retoma da etapa 3 (reload) e etapa 2 (fechar navegador).
- [x] CHK030 - É coberto o edge case de demo data indisponível? [Cobertura, Spec §P4/P6 Edge Cases, FR-13] {auto}
  - Evidência: P4 Edge "Demo data indisponível → opção (b) não aparece"; P6 Edge "sem prévia, sem erro".
- [x] CHK031 - São cobertos edge cases de nome de grupo duplicado e e-mail de líder já existente? [Cobertura, Spec §P4/P5 Edge Cases] {auto}
  - Evidência: P4 "nome duplicado → mensagem acionável"; P5 "e-mail já pertence ao tenant → informativa, sem convite duplicado".
- [x] CHK032 - São cobertos edge cases de falha de upload (foto/logo)? [Cobertura, Spec §P2/P3 Edge Cases, FR-13] {auto}
  - Evidência: P2/P3 Edge "falha de upload → mensagem acionável, campo opcional não bloqueia avanço".

## Requisitos Não-Funcionais

- [x] CHK033 - São definidos requisitos de acessibilidade e navegação por teclado? [NFR, Spec §FR-11] {auto}
  - Evidência: FR-11 navegação completa por teclado + WCAG AA via jest-axe.
- [x] CHK034 - São definidos requisitos de idioma (PT-BR user-facing, inglês código)? [NFR, plan §Constitution Check III] {auto}
  - Evidência: plan III — código/logs/Swagger inglês; user-facing PT-BR em `pt-BR.json`; labels via vocabulary.ts.
- [x] CHK035 - São definidos requisitos de multi-tenancy/isolamento para os write paths novos? [NFR, plan §Constitution Check I] {auto}
  - Evidência: plan I — colunas em tabelas com RLS já habilitada, writes RLS-scoped via `withTenantTx`/AsyncLocalStorage, RLS isolation spec dos novos paths.

## Dependências e Premissas

- [x] CHK036 - As dependências externas (grupos 4-1, convites 4-3, demo 10-2, radar Epic 6) estão documentadas? [Dependências, Spec §header/contracts §REUSO] {auto}
  - Evidência: spec header "Depende de: dados-demonstracao (10-2), grupos (Epic 4), convites (4-3), Radar (Epic 6)"; contracts §REUSO lista os endpoints reusados.
- [x] CHK037 - A premissa de que o guard de redirect existente está disponível foi validada? [Premissas, plan §Project Structure] {auto}
  - Evidência: plan lista `onboarding-redirect-guard.tsx` como "ENGATAR (não recriar)" + `boas-vindas/` como host; Clarifications confirma RECONCILIACAO §1.4.
- [x] CHK038 - A premissa de coluna JSONB já existente vs novas colunas está resolvida? [Premissas, Spec §infra/data-model] {auto}
  - Evidência: spec header trata onboardingProgress como "campo JSONB" novo; data-model esclarece — 4 colunas aditivas nullable (onboardingProgress, logoUrl, profilePhotoUrl, roleTitle). Reconciliado.

## Itens de julgamento (dono do produto)

- [ ] CHK039 - As metas de SC (80% <10min, ≥70% conclusão) refletem o apetite real do negócio para Release 1? [Risco/Negócio] {humano}
- [ ] CHK040 - A profundidade deste gate de requisitos (requirements+security) é suficiente antes de `/create-tasks`, ou outros domínios (ux, performance) são necessários para esta story? [Calibração/Escopo] {humano}

## Notes

- Itens `{auto}` resolvidos com evidência citada; `{humano}` aguardam decisão do dono do produto.
- Gaps abertos que viram ação:
  - **CHK009** `[Gap]` → `/create-tasks`: evento `onboarding.wizard.completed` ausente vs SC-1/SC-2.
  - **CHK017** `[Ambiguity]` → `/clarify`: cobertura de vocabulary.ts por etapa.
- Rastreabilidade: 38/40 itens com referência (`[Spec §]`/`[Gap]`/`[Ambiguity]`/plan) = 95% (≥80% OK).
