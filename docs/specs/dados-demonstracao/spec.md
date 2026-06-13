# Feature Specification: Dados de Demonstração por Tenant (Story 10-2)

**Short name**: `dados-demonstracao`
**Epic**: 10 — Onboarding Avançado
**Status**: Draft
**Versão**: 1.0.0
**Data**: 2026-06-13

> Decisões de infraestrutura: N/A — feature stateless entre ondas; sem scheduling periódico. A idempotência do seed é garantida por upsert com chaves fixas, não por infra de scheduling.

---

## User Scenarios & Testing

### User Story 1 — Admin vê plataforma com dados reais desde o primeiro acesso (Priority: P1)

**Como** administrador de um tenant recém-provisionado,
**quero** encontrar a plataforma pré-populada com dados fictícios de demonstração ao fazer meu primeiro acesso,
**para** entender imediatamente o valor do Radar Pastoral sem precisar cadastrar dados manualmente antes de explorar.

**Acceptance Scenarios:**

**Cenário 1.1 — Dados criados no provisionamento:**
- **Dado** que um super-admin conclui o provisionamento de um novo tenant via painel de super-admin
- **Quando** o processo de provisionamento termina com sucesso
- **Então** o novo tenant contém automaticamente: 1 grupo ("Grupo Alpha"), 4 usuários fictícios (líder Marcos Silva + participantes Ana Costa/Pedro Santos/Maria Oliveira), 1 trilha ("Fundamentos da Fé" com 2 módulos e 4 aulas), registros de progresso coerentes com o estado de semáforo de cada participante, 1 reunião passada com presença no banco de dados, e 3 ações pastorais
- **E** todos esses registros carregam a marcação de dado de demonstração
- **E** a falha eventual do seed não impede o provisionamento de concluir

**Cenário 1.2 — Semáforo diferenciado por participante:**
- **Dado** que o tenant recém-provisionado foi populado com dados de demonstração
- **Quando** o admin navega para o Radar Pastoral
- **Então** Ana Costa aparece com sinal verde (engajamento alto — alta presença e progresso elevado na trilha)
- **E** Pedro Santos aparece com sinal amarelo (engajamento moderado — presença e progresso em queda)
- **E** Maria Oliveira aparece com sinal vermelho (engajamento baixo — baixa presença e progresso mínimo, faltas recentes)

**Cenário 1.3 — Idempotência do seed:**
- **Dado** que o seed foi executado para um tenant
- **Quando** o seed é executado novamente para o mesmo tenant (re-provisionamento, testes)
- **Então** não são criados registros duplicados
- **E** os dados existentes permanecem inalterados

---

### User Story 2 — Admin distingue visualmente dados demo de dados reais (Priority: P2)

**Como** administrador explorando a plataforma,
**quero** saber claramente quais registros são de demonstração e quais são reais,
**para** não confundir dados fictícios com informações pastorais reais de minha comunidade.

**Acceptance Scenarios:**

**Cenário 2.1 — Badge de demonstração:**
- **Dado** que existem dados de demonstração no tenant
- **Quando** o admin visualiza grupos, trilhas ou o painel do Radar
- **Então** cada item de demonstração exibe um badge discreto "Dados de demonstração"
- **E** registros de demonstração são visualmente diferenciados dos dados reais (ex.: opacidade reduzida ou borda tracejada)

**Cenário 2.2 — Nudge ao criar primeiro grupo real:**
- **Dado** que o tenant contém dados de demonstração
- **Quando** o admin cria seu primeiro grupo que não é de demonstração
- **Então** é exibida a mensagem: "Você já tem dados reais! Deseja remover os dados de demonstração?"
- **E** o admin pode escolher "Remover agora" ou "Manter por enquanto"

---

### User Story 3 — Admin limpa dados de demonstração quando não precisar mais (Priority: P2)

**Como** administrador que já cadastrou dados reais,
**quero** remover todos os dados fictícios de demonstração com um único gesto,
**para** manter a plataforma com informações exclusivamente reais da minha comunidade.

**Acceptance Scenarios:**

**Cenário 3.1 — Limpeza via Configurações:**
- **Dado** que existem dados de demonstração no tenant
- **Quando** o admin acessa Configurações e clica em "Limpar dados de demonstração"
- **Então** é exibido um diálogo de confirmação: "Isso removerá todos os dados de exemplo. Seus dados reais não serão afetados."
- **Quando** o admin confirma
- **Então** todos os registros marcados como demonstração são removidos do tenant corrente
- **E** nenhum dado real é afetado
- **E** dados de outros tenants não são afetados

**Cenário 3.2 — Isolamento de tenant:**
- **Dado** que dois tenants A e B contêm dados de demonstração
- **Quando** o admin do tenant A limpa os dados de demonstração
- **Então** apenas os dados de demonstração do tenant A são removidos
- **E** os dados de demonstração do tenant B permanecem intactos

---

### Edge Cases

- **Seed parcialmente executado (falha a meio):** Re-execução do seed deve ser idempotente e completar sem erro; registros já criados não são duplicados.
- **Admin que nunca teve dados demo:** Botão "Limpar dados de demonstração" deve responder com sucesso mesmo quando não há dados a remover (operação no-op, retorna 204).
- **Usuários fictícios sem conta de autenticação:** Registros de usuários de demonstração não possuem credenciais de acesso — não devem aparecer em listagens de contas do sistema de autenticação nem permitir login.
- **Dados demo visíveis em relatórios:** Relatórios de análise/exportação devem poder filtrar ou identificar dados de demonstração para não distorcer métricas reais.
- **Coexistência com modelo de demo da Story 7-2:** O modelo por-tenant (Story 7-2 — `Tenant.isDemo`) continua servindo ambiente de dev/E2E; o modelo por-registro desta feature (10-2) serve o onboarding do admin real. Os dois modelos são independentes e não se afetam.

---

## Requirements

### Functional Requirements

**FR-01 — Marcação por registro:**
Cada registro de demonstração criado deve carregar um atributo booleano indicando que é dado de demonstração (padrão: falso para todos os dados reais). Esse atributo deve estar presente nas seguintes entidades: usuários, grupos, membros de grupo, trilhas, módulos de trilha, aulas, progresso de trilha, telemetria de reunião e ações pastorais.

**FR-02 — Índice de consulta eficiente:**
Para cada tabela que recebe o atributo de marcação, deve existir um índice cobrindo o par `(tenant_id, is_demo_data)` para garantir que operações de limpeza e consulta por tenant sejam eficientes.

**FR-03 — Seed idempotente via upsert:**
A função de seed deve usar upsert com identificadores fixos e determinísticos para que múltiplas execuções no mesmo tenant produzam exatamente o mesmo conjunto de dados, sem duplicatas. Todos os identificadores gerados usam UUID versão 7.

**FR-04 — Conteúdo do seed:**
O seed deve criar:
- 1 grupo: "Grupo Alpha"
- 1 líder: "Marcos Silva" (fictício, sem conta de autenticação)
- 3 participantes com estados de semáforo distintos: Ana Costa (verde — alta presença e progresso), Pedro Santos (amarelo — presença e progresso moderados em queda), Maria Oliveira (vermelho — baixa presença e progresso mínimo)
- 1 trilha: "Fundamentos da Fé" com 2 módulos e 4 aulas (mistura de vídeo stub e texto rico)
- Registros de progresso de trilha coerentes com o estado de semáforo de cada participante
- 1 reunião passada com dados de presença em banco de dados relacional (não em memória/cache)
- 3 ações pastorais: 1 concluída (para Ana), 1 pendente (para Pedro), 1 urgente (para Maria)

**FR-05 — Hook no provisionamento:**
O seed deve ser disparado automaticamente ao final do fluxo de provisionamento de novo tenant. Falha no seed não deve abortar nem reverter o provisionamento; deve apenas registrar o erro em log.

**FR-06 — Endpoint de limpeza:**
O sistema deve expor um endpoint que, quando acionado por um administrador autenticado, remove todos os registros marcados como demonstração do tenant corrente. Deve retornar resposta sem corpo (204) em caso de sucesso. A operação é idempotente: se não houver dados de demonstração, retorna 204 igualmente.

**FR-07 — Badge visual de demonstração:**
A interface deve exibir um badge discreto "Dados de demonstração" em listas e detalhes que contenham registros de demonstração. Registros de demonstração devem ter distinção visual (ex.: opacidade ou borda diferenciada) dos dados reais.

**FR-08 — Nudge de primeiro grupo real:**
Quando o admin cria seu primeiro grupo que não é de demonstração, o sistema deve exibir um aviso contextual perguntando se o admin deseja remover os dados de demonstração agora. O admin pode aceitar ou adiar. O nudge deve ser exibido apenas uma vez por tenant (ou até que o admin tome uma decisão explícita).

**FR-09 — Limpeza via Configurações:**
A área de Configurações deve exibir uma opção "Limpar dados de demonstração" com diálogo de confirmação. O botão deve ser visível somente enquanto existirem dados de demonstração no tenant.

**FR-10 — Seed disponível por linha de comando para desenvolvimento:**
O seed deve poder ser executado manualmente via comando de pipeline do projeto (ex.: `pnpm turbo db:seed`), aceitando parâmetro opcional de identificador de tenant para ambientes de dev e testes. O comando existente de seed de dev/E2E (Story 7-2) não deve ser alterado.

**FR-11 — Isolamento de tenant:**
Todas as operações de limpeza e visualização de dados de demonstração devem ser estritamente isoladas ao tenant do usuário autenticado. Nenhuma operação pode afetar dados de outro tenant.

**FR-12 — Usuários fictícios sem autenticação:**
Usuários criados pelo seed não possuem credenciais de acesso. Devem existir como registros de dados para fins de visualização no radar e em listas, mas não devem permitir login nem aparecer em fluxos de convite ou gestão de contas de autenticação.

---

### Key Entities

| Entidade | Atributo adicionado | Papel na feature |
|---|---|---|
| Usuário | `isDemoData` | Líder e participantes fictícios |
| Grupo | `isDemoData` | Grupo "Grupo Alpha" de demonstração |
| Membro de grupo | `isDemoData` | Vínculos dos fictícios ao grupo demo |
| Trilha | `isDemoData` | Trilha "Fundamentos da Fé" demo |
| Módulo de trilha | `isDemoData` | 2 módulos demo |
| Aula | `isDemoData` | 4 aulas demo |
| Progresso de trilha | `isDemoData` | Progresso fictício por participante |
| Telemetria de reunião | `isDemoData` | 1 reunião passada demo |
| Ação pastoral | `isDemoData` | 3 ações pastorais demo |

**Nota de confirmação (§10.5 da RECONCILIACAO-EPIC10):** Os modelos Prisma confirmados são: `User` → `users`, `Group` → `groups`, `GroupMember` → `group_members`, `Trail` → `trails`, `Module` → `modules` (não `trail_modules`), `Lesson` → `lessons`, `TrailProgress` → `trail_progress`, `MeetingTelemetry` → `meeting_telemetry`, `PastoralAction` → `pastoral_actions`. Existem também `LessonProgress` → `lesson_progress` e `ModuleProgress` → `module_progress` — verificar no schema se os registros de progressos granulares também precisam de `isDemoData` para garantir limpeza completa.

---

## Success Criteria

### Measurable Outcomes

**SC-01 — Primeiro valor em segundos:**
Um administrador recém-provisionado visualiza o Radar Pastoral com dados de demonstração em menos de 30 segundos após concluir o provisionamento, sem nenhuma ação de cadastro manual.

**SC-02 — Limpeza total e isolada:**
100% dos registros marcados como demonstração do tenant são removidos por uma única ação de limpeza. Zero registros de outros tenants são afetados. Verificável por teste de isolamento com 2 tenants simultâneos.

**SC-03 — Idempotência verificada:**
Executar o seed duas vezes consecutivas no mesmo tenant produz o mesmo número de registros. Zero duplicatas detectadas em teste.

**SC-04 — Resiliência do provisionamento:**
Mesmo que o seed falhe por qualquer motivo, o tenant é provisionado com sucesso e o admin consegue fazer login. Taxa de falha do provisionamento por falha do seed: 0%.

**SC-05 — Distinção visual imediata:**
Em teste de usabilidade com 5 administradores, 100% identificam quais itens são de demonstração sem explicação prévia, apenas pela interface.

**SC-06 — Coexistência sem interferência:**
O ambiente de desenvolvimento/testes (modelo Story 7-2 com `Tenant.isDemo`) funciona sem alteração após a entrega desta feature. Zero regressões em testes existentes relacionados ao seed de dev.

---

## Clarifications

Decisões resolvidas autonomamente pela fase clarify (answerer score >=2). Restou 1 bloqueio humano (Q4).

**dec-006 — Q1: Escopo de isDemoData ampliado para 11 tabelas (score 3)**

`TrailProgress` e `ModuleProgress` NÃO possuem `@relation` com `onDelete: Cascade` para `User` no schema Prisma — ao deletar usuários demo, esses registros ficariam órfãos. `LessonProgress` É coberta por cascade da `Lesson` (onDelete: Cascade confirmado). Decisão: adicionar `isDemoData` em `trail_progress` e `module_progress` além das 9 tabelas originais. `lesson_progress` não precisa do campo (cascade suficiente). Total: 11 tabelas na migration.

Tabelas completas com `isDemoData`: `users`, `groups`, `group_members`, `trails`, `modules`, `lessons`, `trail_progress`, `module_progress`, `meeting_telemetry`, `pastoral_actions`, e opcionalmente `lesson_progress` (por precaução, embora coberta por cascade). Implementação final a confirmar no plan com base no seed criado.

**dec-007 — Q2: Nudge "Manter por enquanto" fecha permanentemente (score 2)**

FR-08 define "exibido apenas uma vez por tenant (ou até que o admin tome uma decisão explícita)". "Manter por enquanto" é tratado como decisão explícita de manter os dados — o nudge não reaparece. O admin que mudar de ideia acessa a limpeza via FR-09 (Configurações). O estado de "nudge dispensado" é persistido por tenant.

**dec-008 — Q3: Limpeza deve ser transacional (score 3)**

SC-02 exige "100% dos registros marcados como demonstração do tenant são removidos por uma única ação de limpeza". FR-06 define a operação como idempotente. A limpeza de 11 tabelas deve ser envolvida em `prisma.$transaction()` — tudo ou nada. Em caso de falha parcial, retornar 500 (o admin pode re-executar; idempotência garante resultado correto na segunda tentativa).

**block-001 — Q4: Filtro de dados demo em relatórios (aguardando humano)**

Edge case menciona que relatórios e exportações devem poder filtrar dados demo para não distorcer métricas reais. Nenhum FR foi criado para isso na spec. O answerer não conseguiu decidir (score 0 — empate entre deferir vs. documentar como NFR). Bloqueio registrado aguardando decisão do PO: (A) implementar filtro automático nesta story, (B) deferir para story posterior, ou (C) documentar como NFR sem implementação agora.
