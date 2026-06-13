# Security Checklist: Dados de Demonstração por Tenant (Story 10-2)

**Purpose**: Validar que os requisitos de segurança — isolamento de tenant, autorização dos endpoints, não-vazamento de dados demo entre tenants, e operações transacionais — estão completos e verificáveis.
**Created**: 2026-06-13
**Feature**: [spec.md](../spec.md) | [contracts/api.md](../contracts/api.md) | [data-model.md](../data-model.md)

---

## Isolamento de Tenant (Multi-tenancy)

- [x] SEC001 - Está definido o requisito de isolamento absoluto para operações de limpeza (DELETE só afeta tenant do contexto)? [Isolamento, Spec §FR-11, Spec §Cenário 3.2, contracts/api.md]
  > **Evidência**: FR-11 define "Todas as operações de limpeza e visualização de dados de demonstração devem ser estritamente isoladas ao tenant do usuário autenticado. Nenhuma operação pode afetar dados de outro tenant." `contracts/api.md` §DELETE usa `tenant_id = ctx` em cada tabela. Cenário 3.2 cobre o teste com tenants A e B. {auto}

- [x] SEC002 - Está definido o requisito de RLS spec para verificar que `isDemoData` não vaza entre tenants via SELECT? [Isolamento, research Decision 9, plan.md §Fase 4]
  > **Evidência**: research Decision 9 define `demo-data-isolation.rls-spec.ts`: seed demo no tenant A, verificar que SELECT no contexto do tenant B retorna 0 registros. plan.md §Fase 4 Task 1 detalha o teste. {auto}

- [x] SEC003 - O endpoint `DELETE /onboarding/demo-data` usa `getRequestContext().tenantId` (AsyncLocalStorage) e não aceita `tenant_id` como parâmetro? [Isolamento, Spec §FR-11, RECONCILIACAO-EPIC10 §8.8]
  > **Evidência**: `contracts/api.md` especifica que `tenant_id` é resolvido via `AsyncLocalStorage`/`getRequestContext()`. O endpoint não tem parâmetro de tenant_id na URL nem no body. RECONCILIACAO-EPIC10 §8.8 reitera "tenant_id em toda tabela (nunca parâmetro — AsyncLocalStorage/withTenantTx)". {auto}

- [x] SEC004 - Está definido o uso de `withTenantTx` na transação de limpeza para garantir o RLS ativo durante a transação Prisma? [Isolamento, Spec §dec-008, research Decision 5]
  > **Evidência**: research Decision 5 define "Tudo em `prisma.$transaction()` com `withTenantTx` para RLS." dec-008 confirma o uso de `prisma.$transaction()`. {auto}

- [x] SEC005 - O endpoint `GET /onboarding/demo-status` está protegido contra retorno de dados de outros tenants? [Isolamento, contracts/api.md §GET demo-status]
  > **Evidência**: `contracts/api.md` §GET define que `hasDemoData`, `hasRealData` e `demoRecordCount` são computados via queries com `tenant_id = ctx`. O contexto é injetado via RLS/AsyncLocalStorage. {auto}

---

## Autorização e Autenticação

- [x] SEC006 - Todos os 3 novos endpoints exigem role `admin_tenant` (não apenas autenticação)? [Autorização, contracts/api.md]
  > **Evidência**: `contracts/api.md` define `@Roles('admin_tenant')` para os 3 endpoints: DELETE, GET e PATCH. Resposta 401 para token ausente/inválido e 403 para role insuficiente documentados. {auto}

- [x] SEC007 - O endpoint de limpeza (`DELETE`) está protegido contra acesso por `participant` ou `leader` roles? [Autorização, contracts/api.md §DELETE]
  > **Evidência**: `contracts/api.md` §DELETE define `Auth: admin_tenant role (guard: @Roles('admin_tenant'))`. A operação é administrativa — apenas admin_tenant tem permissão. {auto}

- [x] SEC008 - O seed no provisionamento (`seedDemoData` no `runSaga()`) executa com o contexto do tenant recém-criado (não com contexto do super-admin)? [Autorização, research Decision 4, plan.md §Fase 3]
  > **Evidência**: research Decision 4 mostra que `DemoDataService.seedDemoData(id)` recebe o `tenantId` explicitamente. O seed usa upserts com `tenantId` hardcoded por registro, não via AsyncLocalStorage (é uma function interna, não um endpoint HTTP). Sem risco de vazamento de contexto. {auto}

---

## Proteção de Dados e Privacidade

- [x] SEC009 - Está definido que usuários fictícios do seed não possuem credenciais Keycloak e não podem autenticar? [Privacidade, Spec §FR-12, Spec §Edge Cases §"Usuários fictícios sem conta de autenticação"]
  > **Evidência**: FR-12 define "Usuários criados pelo seed não possuem credenciais de acesso." Edge Cases define "não devem permitir login nem aparecer em fluxos de convite ou gestão de contas de autenticação." {auto}

- [x] SEC010 - Está definido que dados de demonstração não são automaticamente filtrados de relatórios e exportações (dec-010 — escopo excluído)? [Privacidade, Spec §dec-010, Spec §Escopo Excluído]
  > **Evidência**: dec-010 define explicitamente que filtro automático foi deferido. Spec §Escopo Excluído documenta a exclusão. O admin que não quiser ver dados demo executa a limpeza (FR-06). Aceito conscientemente. {auto}

- [ ] SEC011 - Estão definidos requisitos para que operações de exportação/LGPD (Epic 9 — Story 9-1) não incluam dados demo como dados pessoais reais? [Privacidade, Gap — interação com Epic 9]
  > **[Gap]**: O campo `isDemoData=true` em `users` (Ana Costa, Pedro Santos, Maria Oliveira, Marcos Silva) cria usuários fictícios sem Keycloak. O exportador LGPD da Story 9-1 opera sobre `users` do tenant — pode incluir esses registros demo no export de dados pessoais. A spec de 10-2 não define se usuários demo devem ser excluídos de exports LGPD (ou se podem ser exportados como dados não-pessoais). Registrar como interface entre 10-2 e Epic 9 para verificação na implementação. {auto}

---

## Operações Transacionais e Atomicidade

- [x] SEC012 - O requisito de atomicidade da transação de limpeza (tudo ou nada) está definido para prevenir estado parcialmente limpo? [Integridade, Spec §dec-008, contracts/api.md §DELETE]
  > **Evidência**: dec-008 define `prisma.$transaction()` obrigatório. "Em caso de falha parcial, retornar 500 (o admin pode re-executar; idempotência garante resultado correto na segunda tentativa)." O 500 sinaliza falha sem deixar estado inconsistente permanente. {auto}

- [x] SEC013 - A ordem de deleção na transação previne FK violations que poderiam causar deleções parciais silenciosas? [Integridade, research Decision 5, contracts/api.md §DELETE ordem]
  > **Evidência**: research Decision 5 e `contracts/api.md` §DELETE definem ordem explícita de 12 passos (filhos antes de pais). FK violations são prevenidas pela ordem. A transação garante rollback em caso de violação. {auto}

- [x] SEC014 - O seed (`seedDemoData`) é envolvido em try/catch no `runSaga()` para prevenir que falha de segurança/FK no seed aborte o provisionamento? [Resiliência, research Decision 4, Spec §FR-05]
  > **Evidência**: research Decision 4 mostra bloco try/catch explícito com `logger.error` em caso de falha. SC-04 mede 0% de falha de provisionamento. O seed é best-effort por design. {auto}

---

## Prevenção de Dados Cruzados

- [x] SEC015 - Está definido o mecanismo de prevenção de colisão de UUID entre seed 10-2 e seed 7-2? [Integridade, data-model.md §UUIDs fixos, research Decision 3]
  > **Evidência**: `data-model.md` documenta prefixo `01989b10-1002-7000-8000-` (vs. `019899a0-7002-...` do 7-2). As colisões são impossíveis por prefixo distinto. {auto}

- [x] SEC016 - O requisito de index `(tenant_id, is_demo_data)` previne consultas cross-tenant acidentais em operações de cleanup? [Integridade, Spec §FR-02, data-model.md]
  > **Evidência**: FR-02 exige índice composto `(tenant_id, is_demo_data)`. Com RLS ativo, queries já são filtradas por tenant — o índice garante eficiência, não isolamento (que é garantido pelo RLS). Correto por design. {auto}

---

## Notes

- Items `{auto}` resolvidos (`[x]`) incluem citação da seção ou evidência.
- Items `[Gap]` são candidatos a tarefas de requisito ou verificação na implementação.
- O isolamento de tenant é a propriedade de segurança mais crítica desta feature — coberta por FR-11, dec-008, Fase 4 (RLS specs) e SC-02.
