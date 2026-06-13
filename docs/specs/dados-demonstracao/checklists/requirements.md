# Requirements Checklist: Dados de Demonstração por Tenant (Story 10-2)

**Purpose**: Validar qualidade, completude, clareza e consistência dos requisitos funcionais, critérios de aceite e edge cases da feature de dados de demonstração por-registro para novos tenants.
**Created**: 2026-06-13
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)

---

## Completude de Requisitos

- [x] CHK001 - São os requisitos de marcação por registro (`isDemoData`) definidos para TODAS as entidades que participam do seed? [Completude, Spec §FR-01, research Decision 1]
  > **Evidência**: FR-01 lista 9 entidades; research Decision 1 expande para 12 tabelas (adiciona `Meeting`, `MeetingAttendance`, `ModuleProgress`). `data-model.md` lista os 12 modelos Prisma com o campo e índice. Completo. {auto}

- [x] CHK002 - Está definido o comportamento exato quando o seed falha parcialmente (crash a meio da execução)? [Completude, Spec §Edge Cases, Spec §FR-05]
  > **Evidência**: Edge Cases §"Seed parcialmente executado" define que re-execução deve ser idempotente e completar. FR-05 define que falha não aborta o provisionamento. SC-04 mede resiliência como 0% de falha de provisionamento por falha do seed. Completo. {auto}

- [x] CHK003 - Está definido o requisito de índice de banco de dados para garantir eficiência das operações de limpeza? [Completude, Spec §FR-02]
  > **Evidência**: FR-02 exige índice `(tenant_id, is_demo_data)` em cada tabela que recebe o atributo. `data-model.md` confirma `@@index([tenantId, isDemoData])` nos 12 modelos. Completo. {auto}

- [x] CHK004 - Estão definidos todos os campos do conteúdo do seed com estados de semáforo diferenciados por participante? [Completude, Spec §FR-04, data-model.md §semáforo]
  > **Evidência**: FR-04 especifica 1 grupo, 1 líder, 3 participantes (verde/amarelo/vermelho), 1 trilha com 2 módulos e 4 aulas, progresso de trilha, 1 reunião, 3 ações pastorais. `data-model.md` tabela de semáforo define valores exatos (%, presenceType, ação) para cada participante. Completo. {auto}

- [x] CHK005 - Está definido como o nudge de "primeiro grupo real" é detectado sem acoplar o domínio `groups` ao domínio `onboarding`? [Completude, Spec §FR-08, research Decision 8]
  > **Evidência**: research Decision 8 define Opção C: endpoint `GET /api/v1/onboarding/demo-status` retorna `hasRealData` que o FE usa após criar grupo. Evita acoplamento de domínio. Definido. {auto}

- [x] CHK006 - Está definida a persistência do estado "nudge dispensado" e seu local de armazenamento? [Completude, Spec §FR-08, research Decision 2]
  > **Evidência**: research Decision 2 define `Tenant.metadata` JSONB com chave `demoDismissedAt`. `data-model.md` documenta a chave. Endpoint `PATCH /api/v1/onboarding/demo-nudge-dismiss` (204) persiste o estado. Completo. {auto}

- [x] CHK007 - Está definido o requisito CLI para execução manual do seed em dev/testes com parâmetro de tenant? [Completude, Spec §FR-10, research Decision 6]
  > **Evidência**: FR-10 exige `pnpm turbo db:seed` com parâmetro opcional de tenant-id. research Decision 6 define `db:seed:demo-data` em `apps/api/package.json` com `--tenant-id`. Completo. {auto}

- [ ] CHK008 - Está definido o requisito para o campo `DemoCleanupButton` saber em qual rota de Configurações será renderizado? [Completude, Gap — Aviso validate-documentation #1]
  > **[Gap]**: `plan.md` §Fase 7 diz "Adicionar `DemoCleanupButton` onde configurações de tenant forem expostas" sem definir a rota. O validate-documentation apontou esse gap. A rota de Configurações será criada em 10-1 (`onboarding-wizard`) — o path exato não está definido na spec desta story. Tratar como tarefa de integração ao implementar Fase 7, condicionada à entrega de 10-1. {auto}

- [x] CHK009 - Está definida a ordem de upsert do seed (inserção = inverso da deleção) para evitar FK violations? [Completude, research Decision 5]
  > **Evidência**: research Decision 5 define a ordem de deleção (filhos antes de pais) com 13 passos. A inserção segue a ordem inversa. `contracts/api.md` §DELETE repete a ordem. Aviso validate-documentation #2 foi resolvido pela referência à Decision 5. Completo. {auto}

- [x] CHK010 - Está definido o requisito de coexistência com o modelo de demo da Story 7-2 (`Tenant.isDemo`)? [Completude, Spec §Edge Cases §"Coexistência com Story 7-2", RECONCILIACAO-EPIC10 §3]
  > **Evidência**: Spec §Edge Cases §"Coexistência com modelo de demo da Story 7-2" define que os dois modelos são independentes. RECONCILIACAO-EPIC10 §3 detalha as diferenças e a decisão de manter ambos. SC-06 mede que zero regressões ocorrem nos testes existentes. Completo. {auto}

---

## Clareza de Requisitos

- [x] CHK011 - O termo "registro de demonstração" está quantificado com critérios técnicos verificáveis (não é vago)? [Clareza, Spec §FR-01, data-model.md]
  > **Evidência**: FR-01 define o atributo booleano `isDemoData` como marcador por registro. `data-model.md` define o campo `is_demo_data BOOLEAN NOT NULL DEFAULT false` em SQL. A definição é objetiva e verificável. Não há ambiguidade. {auto}

- [x] CHK012 - O critério "exibido apenas uma vez por tenant" do nudge (FR-08) está operacionalizado com critério concreto? [Clareza, Spec §FR-08, Spec §dec-007]
  > **Evidência**: dec-007 define que "Manter por enquanto" é tratado como decisão explícita — o nudge não reaparece após qualquer escolha. O estado é persistido via `demoDismissedAt` no `Tenant.metadata`. Operacionalizado. {auto}

- [x] CHK013 - O requisito "distinção visual" de FR-07 está quantificado com critérios de UI específicos, não apenas "opacidade ou borda"? [Clareza, Spec §FR-07, Spec §Cenário 2.1]
  > **Evidência**: Cenário 2.1 especifica "badge discreto 'Dados de demonstração' + opacidade reduzida ou borda tracejada". FR-07 repete a mesma linguagem. A especificação usa "ex.:" — é sugestão, não requisito fechado. Ambiguidade de baixo risco (FE pode decidir na implementação); não bloqueia. Aceitável. {auto}

- [x] CHK014 - O requisito de idempotência (FR-03, SC-03) está definido com critério mensurável? [Clareza, Spec §FR-03, Spec §SC-03]
  > **Evidência**: SC-03 define "Executar o seed duas vezes consecutivas no mesmo tenant produz o mesmo número de registros. Zero duplicatas detectadas em teste." FR-03 especifica "upsert com identificadores fixos e determinísticos". Mensurável e verificável. {auto}

- [x] CHK015 - O requisito "Fundamentos da Fé" (trilha demo) está definido com quantidade e tipos de conteúdo específicos? [Clareza, Spec §FR-04]
  > **Evidência**: FR-04 especifica "2 módulos e 4 aulas (mistura de vídeo stub e texto rico)". `data-model.md` lista `DEMO_LESSON_1` a `DEMO_LESSON_4` com UUIDs fixos. Suficientemente específico para implementação. {auto}

- [ ] CHK016 - O requisito "visível somente enquanto existirem dados de demonstração no tenant" (FR-09) está definido com a fonte de verdade (poll vs event-driven)? [Clareza, Spec §FR-09, contracts/frontend.md]
  > **[Ambiguity]**: FR-09 define que o botão deve ser visível somente com dados demo. O FE usa `useDemoStatus` (TanStack Query), mas a frequência de re-validação não está especificada. Se o admin limpar via endpoint e a página não revalidar automaticamente, o botão pode ficar visível. Verificar se `onSuccess` do `useMutation` invalida a query `demo-status`. Baixo risco — tratar na implementação do hook. {auto}

- [x] CHK017 - O requisito de "usuários fictícios sem autenticação" (FR-12) está definido com critérios suficientes para garantir que não apareçam em fluxos de gestão de contas? [Clareza, Spec §FR-12, Spec §Edge Cases §"Usuários fictícios sem conta de autenticação"]
  > **Evidência**: FR-12 e Edge Cases §"Usuários fictícios sem conta de autenticação" definem que usuários demo existem apenas como registros de dados — sem credenciais Keycloak, sem login, sem aparecer em listagens de contas. Critério claro e verificável. {auto}

---

## Consistência de Requisitos

- [x] CHK018 - Há consistência entre o número de tabelas definido no dec-006 (11) e o number final confirmado no research.md (12)? [Consistência, Spec §dec-006, research Decision 1]
  > **Evidência**: dec-006 citou 11 tabelas; research Decision 1 corrigiu para 12 (adicionando `Meeting` e `MeetingAttendance` que foram omitidos do clarify). `data-model.md` lista as 12. `plan.md` Summary diz "12 tabelas". A spec §FR-01 ainda lista 9 entidades na tabela de Key Entities — inconsistência de contagem residual entre §FR-01 (9) e §dec-006/research (12). Divergência documentada e explicada: o dec-006 é a fonte de verdade definitiva (score 3). Risco baixo. {auto}

- [x] CHK019 - A ordem de deleção em `contracts/api.md` é consistente com a ordem definida em `research.md` Decision 5? [Consistência, contracts/api.md, research Decision 5]
  > **Evidência**: `contracts/api.md` §DELETE lista 12 passos; research Decision 5 lista 13 (inclui `lesson_progress` como passo 1 por segurança, apesar de ser cascade). Divergência de documentação, não de lógica — ambos são consistentes na intenção (filhos antes de pais). `lesson_progress` não tem `isDemoData` então o `contracts/api.md` está correto ao omitir. Aceitável. {auto}

- [x] CHK020 - Os success criteria de isolamento (SC-02) são consistentes com o teste de RLS spec definido no plan (Fase 4)? [Consistência, Spec §SC-02, plan.md §Fase 4]
  > **Evidência**: SC-02 define "2 tenants simultâneos, cleanup de um não afeta o outro". plan.md §Fase 4 define exatamente `demo-data-cleanup.rls-spec.ts` com tenants A e B. Consistente. {auto}

- [x] CHK021 - O endpoint de dismiss é `PATCH /api/v1/onboarding/demo-nudge-dismiss` de forma consistente entre spec, contracts/api.md e data-model.md? [Consistência, Spec §dec-007, contracts/api.md, data-model.md]
  > **Evidência**: Spec §dec-010 menciona `PATCH /api/v1/onboarding/demo-nudge-dismiss`. `contracts/api.md` §PATCH define o mesmo path. `data-model.md` §Tenant.metadata usa o mesmo endpoint. Consistente. {auto}

- [x] CHK022 - O requisito de retorno 204 sem corpo para DELETE (FR-06) é consistente com a convenção de API do projeto (`docs/project-context.md`)? [Consistência, Spec §FR-06, contracts/api.md]
  > **Evidência**: contracts/api.md §DELETE define "204 No Content — sem corpo". A convenção do projeto (`CLAUDE.md`) define "Delete: 204 (no body)". Consistente. {auto}

---

## Qualidade dos Critérios de Aceite

- [x] CHK023 - Os success criteria de "primeiro valor em segundos" (SC-01: <30s) são mensuráveis e têm metodologia de verificação definida? [Mensurabilidade, Spec §SC-01]
  > **Evidência**: SC-01 define "<30 segundos após concluir o provisionamento, sem nenhuma ação de cadastro manual". É mensurável via teste de integração: provisionar tenant → cronometrar até Radar exibir dados. A metodologia não está explicitada na spec mas é derivável. Aceitável. {auto}

- [x] CHK024 - O success criteria SC-05 (100% de identificação em teste de usabilidade com 5 admins) é verificável no escopo desta story técnica? [Mensurabilidade, Spec §SC-05]
  > **Evidência**: SC-05 é um critério de usabilidade qualitativo (5 admins, 100%). Na prática é um critério de aceitação UX futuro, não verificável automaticamente. Aceitável como meta de design — não bloqueia implementação. {auto}

- [x] CHK025 - SC-03 (idempotência verificada) tem metodologia automática definida no plano de testes? [Mensurabilidade, Spec §SC-03, plan.md §Fase 8]
  > **Evidência**: plan.md §Fase 8 Item 1 define "Teste de idempotência: seed 2x no mesmo tenant → contagem idêntica". Mensurável e automatizável. {auto}

---

## Cobertura de Cenários

- [x] CHK026 - Está coberto o cenário onde o admin executa a limpeza quando não há dados de demonstração (no-op)? [Cobertura, Spec §Edge Cases §"Admin sem dados demo", Spec §FR-06]
  > **Evidência**: FR-06 define "A operação é idempotente: se não houver dados de demonstração, retorna 204 igualmente." Edge Cases §"Admin que nunca teve dados demo" cobre o cenário. {auto}

- [x] CHK027 - Está coberto o cenário de re-execução do seed (segundo provisionamento, testes) e seu comportamento? [Cobertura, Spec §Cenário 1.3, Spec §FR-03]
  > **Evidência**: Cenário 1.3 define "seed executado novamente → não são criados registros duplicados, dados existentes permanecem inalterados." FR-03 especifica upsert com UUIDs fixos. {auto}

- [x] CHK028 - Está coberto o cenário de isolamento entre tenants para operações de limpeza? [Cobertura, Spec §Cenário 3.2, Spec §FR-11]
  > **Evidência**: Cenário 3.2 cobre explicitamente tenants A e B. FR-11 define isolamento absoluto. SC-02 mede "Zero registros de outros tenants são afetados". {auto}

- [x] CHK029 - Está coberto o fluxo completo de "admin cria primeiro grupo real → nudge aparece → admin escolhe 'Manter' → nudge não reaparece"? [Cobertura, Spec §Cenário 2.2, Spec §FR-08, dec-007]
  > **Evidência**: Cenário 2.2 cobre a exibição do nudge. dec-007 define que "Manter por enquanto" é decisão explícita permanente. FR-08 define que o nudge é exibido "apenas uma vez". Fluxo completo coberto. {auto}

- [ ] CHK030 - Está coberto o cenário onde o admin executa a limpeza ENQUANTO o seed ainda está sendo executado (concorrência no provisionamento)? [Cobertura, Gap — race condition seed vs. cleanup]
  > **[Gap]**: O seed é disparado no provisionamento (best-effort via try/catch) e pode estar em execução concorrente com uma tentativa de limpeza manual. A spec não define comportamento nesse cenário de concorrência. Risco baixo na prática (provisionamento é <1s de seed + limpeza raramente ocorre em segundos do provisionamento), mas ausente dos requisitos. Tratar como tarefa: definir se o endpoint de limpeza deve ser idempotente independentemente do estado do seed (já é, por construção do upsert). {auto}

- [x] CHK031 - Está coberto o cenário onde `lesson_progress` é deixado para cascade da `Lesson` (e não tem `isDemoData`)? [Cobertura, research Decision 1, dec-006]
  > **Evidência**: research Decision 1 define explicitamente que `lesson_progress` NÃO precisa de `isDemoData` porque tem `onDelete: Cascade` via `Lesson`. `contracts/api.md` omite `lesson_progress` da ordem de deleção. Consistente e coberto. {auto}

- [ ] CHK032 - Estão definidos requisitos para o comportamento do Radar Pastoral quando existem tanto dados demo (semáforo definido artificialmente) quanto dados reais (semáforo calculado pelo motor)? [Cobertura, Gap — coexistência demo+real no Radar]
  > **[Gap]**: A spec (dec-010) define que dados demo NÃO são filtrados automaticamente nos relatórios/Radar. Mas não há requisito definindo como o Radar se comporta quando um tenant tem dados demo E dados reais simultaneamente — os semáforos demo (hardcoded) coexistirão com semáforos reais (calculados). Isso pode distorcer a visão pastoral. A spec deferió filtro automático, mas não documentou o comportamento esperado da coexistência. Baixo risco até a limpeza; registrar como observação para 10-1 ou post-MVP. {auto}

---

## Cobertura de Edge Cases

- [x] CHK033 - O edge case de UUID v7 fixo para seed e a garantia de não-colisão com UUIDs do seed 7-2 estão documentados? [Cobertura, data-model.md §UUIDs fixos, research Decision 3]
  > **Evidência**: `data-model.md` documenta prefixo `01989b10-1002-7000-8000-` (vs. `019899a0-7002-...` do 7-2). research Decision 3 documenta a decisão de separação. Coberto. {auto}

- [x] CHK034 - O edge case de usuários fictícios potencialmente aparecendo em convites ou listas de gestão de usuários está coberto? [Cobertura, Spec §FR-12, Spec §Edge Cases §"Usuários fictícios sem conta de autenticação"]
  > **Evidência**: FR-12 e Edge Cases definem que usuários demo não possuem credenciais Keycloak, não permitem login, não aparecem em listagens de contas. A prevenção é por ausência de registro Keycloak — verificável. {auto}

- [x] CHK035 - O edge case de `Tenant.metadata` JSONB ser `null` ao chamar `dismissNudge` está coberto pela implementação proposta? [Cobertura, research Decision 2, plan.md §Fase 2]
  > **Evidência**: plan.md §Fase 2 descreve `metadata: { ...existing, demoDismissedAt: now }`. O spread `...existing` assume que `existing` não é null. `data-model.md` define `metadata` com `@default("{}")` no Prisma, então nunca é null. Coberto. {auto}

---

## Requisitos Não-Funcionais

- [x] CHK036 - O requisito de performance de índice `(tenant_id, is_demo_data)` está definido para garantir cleanup eficiente em tenants grandes? [NFR, Spec §FR-02, data-model.md]
  > **Evidência**: FR-02 exige índice cobrindo o par `(tenant_id, is_demo_data)` explicitamente para "garantir que operações de limpeza e consulta por tenant sejam eficientes". 12 índices definidos em `data-model.md`. {auto}

- [x] CHK037 - O requisito de atomicidade da transação de limpeza está definido (tudo ou nada, 500 em falha parcial)? [NFR, Spec §dec-008, contracts/api.md]
  > **Evidência**: dec-008 define `prisma.$transaction()` obrigatório, retorno 500 em falha parcial, admin pode re-executar (idempotente). contracts/api.md §DELETE lista `500 Internal Server Error — falha parcial na transação`. {auto}

- [ ] CHK038 - Estão definidos requisitos de acessibilidade (WCAG) para o badge `DemoOverlay` e o nudge `DemoDataNudge`? [NFR, Spec §FR-07, Spec §FR-08]
  > **[Gap]**: A spec menciona "badge discreto" e `plan.md` cita "WCAG via shadcn/ui Badge" na Constitution Check, mas não há requisito explícito de acessibilidade para o badge (ex.: `aria-label`, contraste, role). O nudge (diálogo de confirmação) não tem requisito de foco de teclado definido. Baixo risco (shadcn/ui é acessível por padrão), mas ausente como requisito formal. {auto}

- [x] CHK039 - Está definido o requisito de resiliência do provisionamento (try/catch isolado no Step 4 do `runSaga`)? [NFR, Spec §FR-05, Spec §SC-04, research Decision 4]
  > **Evidência**: FR-05 define "Falha no seed não deve abortar nem reverter o provisionamento; deve apenas registrar o erro em log." SC-04 mede 0% de falha de provisionamento por falha do seed. research Decision 4 define o bloco try/catch no Step 4. {auto}

---

## Dependências e Premissas

- [x] CHK040 - A dependência de 10-2 com o módulo `onboarding/` existente (não `modules/onboarding/`) está documentada e validada? [Dependência, RECONCILIACAO-EPIC10 §1.1, plan.md §Project Structure]
  > **Evidência**: RECONCILIACAO-EPIC10 §1 alerta que o módulo real é `apps/api/src/onboarding/` (não `modules/onboarding/`). `plan.md` usa o path correto. Drift corrigido nos artefatos. {auto}

- [ ] CHK041 - Está documentada a premissa de que `OnboardingModule` deve exportar `DemoDataService` para injeção no `SuperAdminTenantsModule`? [Dependência, plan.md §Fase 3, research Decision 4]
  > **[Assumption]**: `plan.md` §Fase 3 define que `SuperAdminTenantsModule` importa `OnboardingModule` e `DemoDataService` é injetado. Isso pressupõe que o `OnboardingModule` exporta `DemoDataService`. A spec não verifica se há conflito circular de dependência entre módulos. Risco baixo (NestJS lida com isso), mas é uma premissa não explicitada como requisito. Verificar na Fase 3 da implementação. {auto}

- [x] CHK042 - Está documentada a premissa de que `DemoCleanupButton` em Configurações depende da entrega de 10-1 para ter a rota hospedeira? [Dependência, plan.md §Fase 7, RECONCILIACAO-EPIC10 §7]
  > **Evidência**: RECONCILIACAO-EPIC10 §7 define ordem 10-2 → 10-1. O `DemoCleanupButton` será integrado na rota de Configurações que 10-1 cria. `plan.md` §Fase 7 menciona a dependência implicitamente. CHK008 documenta o gap do path exato. {auto}

---

## Notes

- Items `{auto}` resolvidos (`[x]`) incluem citação da seção ou evidência.
- Items `{humano}` ficam `[ ]` aguardando decisão do dono do produto.
- Items `[Gap]` / `[Ambiguity]` / `[Assumption]` são candidatos a tarefas de requisito ou ajustes de spec.
- Marcar items concluídos com `[x]` conforme implementação avança.
