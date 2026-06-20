# Requirements Checklist: Story 13.3 — Detecção de Risco de Evasão (FR66)

**Purpose**: Valida a QUALIDADE dos requisitos escritos em spec.md + plan.md — não a implementação.
Cobre: completude, clareza, mensurabilidade dos critérios de aceite, cobertura de cenários/edge-cases,
segurança, algoritmo, job/observabilidade, domain events e a11y.
**Created**: 2026-06-19
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [data-model.md](../data-model.md)
**Artefato autoritativo**: `_bmad-output/implementation-artifacts/13-3-deteccao-de-risco-de-evasao-fr66.md`

---

## 1. Completude de Requisitos Funcionais

- [x] CHK001 — Cada requisito funcional (FR66-01..FR66-09) tem critério de aceite mensurável definido na spec? [Completude, Spec §9]
  > **Evidência**: Spec §9 (Success Criteria) lista SC-01..SC-17 com coluna "Verificação" para cada FR. Todos os FRs mapeados. `{auto}`

- [x] CHK002 — Os critérios de detecção de risco (Critério A e B) estão definidos com valores numéricos precisos e não como "muitas faltas" ou "muito tempo"? [Clareza, Spec §FR66-02]
  > **Evidência**: Spec FR66-02: Critério A = "3+ reuniões consecutivas"; Critério B = "≥2 semanas via last_seen_at". Nenhum adjetivo vago. `{auto}`

- [x] CHK003 — As transições de semáforo (verde→amarelo→vermelho e retorno) estão todas definidas como pares (De→Para + Gatilho)? [Completude, Spec §FR66-03]
  > **Evidência**: Spec FR66-03 + Plan §5 definem tabela com 4 pares de transição: 🟢→🟡, 🟡→🔴, 🔴→🟡, 🟡→🟢. Todos cobertos. `{auto}`

- [x] CHK004 — O comportamento de recesso (FR66-05) está definido com todas as variáveis: quem aciona, como acionar, qual efeito na contagem de ausências e quando encerra? [Completude, Spec §FR66-05]
  > **Evidência**: Spec FR66-05: líder aciona via PATCH /api/v1/groups/:id com {status:'on_break', breakUntil}; ausências não contam enquanto on_break; auto-resume quando breakUntil passa. `{auto}`

- [x] CHK005 — O tratamento de erros no job (FR66-08) especifica comportamento para falha por tenant E comportamento após múltiplas falhas? [Completude, Spec §FR66-08]
  > **Evidência**: Spec FR66-08 + NFR: falha em 1 tenant = skip+log; 3 falhas consecutivas no mesmo tenant → alerta Super Admin. SC-11 e SC-12 verificam. `{auto}`

- [ ] CHK006 — O requisito de care timeline (FR66-09) define quais eventos de risco são registrados, em qual granularidade temporal e quem pode visualizar? [Completude, Spec §FR66-09]
  > **[Gap]**: Spec FR66-09 existe como seção mas o conteúdo (no artefato indexado) é mínimo — "registro na care timeline". Não especifica: quais eventos (detecção? transição? resolução?), granularidade (por ocorrência? diária?) ou permissões de visualização (líder? pastor?). Virar task "detalhar FR66-09 care timeline" em create-tasks. `{auto}`

- [x] CHK007 — O requisito de domain event para resolução de risco (SC-10) tem requisito funcional correspondente (FR) explícito na spec? [Completude, Spec §FR66-04]
  > **Evidência parcial / [Gap]**: SC-10 menciona "domain event pastoral.participant.risk-resolved" mas FR66-04 documenta apenas risk-detected. O evento de resolução não tem FR dedicado nem contrato contracts/risk-resolved.event.json. Virar task obrigatória no create-tasks. `{auto}`

---

## 2. Clareza e Mensurabilidade dos Critérios de Aceite

- [x] CHK008 — O SC-01 (SLA do job) é mensurável sem ambiguidade: métrica definida + valor de corte + meio de verificação? [Mensurabilidade, Spec §9]
  > **Evidência**: SC-01: "job.duration_ms < 1.800.000 ms" (30min), verificado via log Pino. Mensurável e sem ambiguidade. `{auto}`

- [x] CHK009 — Os SC-02 e SC-03 especificam fixtures determinísticas (não "algum participante", mas dados de teste precisos)? [Mensurabilidade, Spec §9]
  > **Evidência**: SC-02: "fixture 3 ausências" → amarelo; SC-03: "last_seen_at = 15 dias atrás" → amarelo. Determinístico. `{auto}`

- [x] CHK010 — O SC-04 (guarda de 24h) é verificável sem depender de timing real (não "esperar 24h")? [Mensurabilidade, Spec §9]
  > **Evidência**: SC-04: "race condition test" — teste unitário que controla manualmente o timestamp updatedAt/calculatedAt. Não depende de tempo real. `{auto}`

- [ ] CHK011 — A definição de "ausência" no Critério A está especificada sem ambiguidade para todos os valores de `presenceType`? [Clareza, Spec §FR66-02, Plan §3]
  > **[Ambiguity]**: Plan §3 define ausência como "sem linha MeetingAttendance OU presenceType nulo". Não especifica se presenceType='partial' (presença parcial) conta como presença ou ausência. Este é um edge case com impacto direto no algoritmo — dev pode implementar de forma diferente do esperado. Resolver via `/clarify` antes de create-tasks. `{auto}`

- [x] CHK012 — O SC-17 (gate a11y) especifica a ferramenta, o padrão (WCAG nível) e o ponto de execução (CI)? [Mensurabilidade, Spec §9, NFR]
  > **Evidência**: SC-17: "axe-core via CI", padrão WCAG AA. Mensurável. `{auto}`

- [x] CHK013 — O critério de retorno amarelo→verde (SC-08) especifica "próximas 2 reuniões do grupo específico" sem ambiguidade sobre o que conta como reunião válida? [Clareza, Spec §FR66-03]
  > **Evidência**: Plan §5 define: "2 reuniões realizadas mais recentes do grupo após a entrada em amarelo" via MeetingAttendance. "Realizada" = status ∈ {realizado, ended}. Claro. `{auto}`

---

## 3. Cobertura de Cenários e Edge Cases

- [x] CHK014 — O cenário de participante em múltiplos grupos está coberto: risco em grupo A não deve impactar status no grupo B? [Cobertura, Spec §FR66-01]
  > **Evidência**: Spec FR66-01: "A avaliação de risco é per-participant-per-group (não global)". Coberto explicitamente. `{auto}`

- [x] CHK015 — O cenário de ausência durante recesso está coberto como edge case com critério de teste explícito? [Cobertura de Edge Cases, Spec §FR66-05, SC-06]
  > **Evidência**: SC-06: "grupo on_break → ausências não contam", unit test "grupo on_break". Coberto. `{auto}`

- [x] CHK016 — O cenário de participante sem nenhum acesso histórico (`last_seen_at IS NULL`) está coberto para o Critério B? [Cobertura de Edge Cases, Plan §3]
  > **Evidência**: Plan §3 Critério B: "NULL + createdAt > 14d tratado corretamente". SC-03 implicitamente cobre. `{auto}`

- [ ] CHK017 — O cenário de grupo que sai do recesso e tem reuniões pendentes de contagem está coberto como critério de teste? [Cobertura de Edge Cases, Spec §FR66-05]
  > **[Gap]**: Spec/plan definem auto-resume quando breakUntil passa, mas não há critério de aceite explícito para o cenário: "grupo retorna de recesso → job seguinte recontabiliza ausências anteriores ao recesso". Virar task "adicionar SC para recontabilização pós-recesso" em create-tasks. `{auto}`

- [x] CHK018 — O cenário de tenant sem participantes (ou tenant recém-criado) está coberto para o job não falhar? [Cobertura de Edge Cases, Spec §FR66-08]
  > **Evidência**: Plan §4: paginação por cursor (take:100, cursor) — se 0 participantes, loop não executa, não há falha. Comportamento implícito mas seguro. `{auto}`

- [ ] CHK019 — O cenário de participante que muda de grupo durante o período de avaliação está coberto nos requisitos? [Cobertura de Edge Cases, Spec §FR66-02]
  > **[Gap]**: Spec/plan não menciona o que acontece com o histórico de ausências de um participante que foi removido de um grupo e re-adicionado. A consulta Critério A pode contabilizar ausências de antes da remoção. Virar task "definir comportamento para participante re-adicionado ao grupo" em create-tasks. `{auto}`

- [x] CHK020 — O cenário de emissão duplicada de domain event (re-execução do job no mesmo dia) está coberto? [Cobertura de Edge Cases, Spec §FR66-04]
  > **Evidência**: Plan §8: dedup key `rt:risk-detected:{tenantId}:{participantId}:{groupId}:{yyyy-mm-dd}` — garante 1 evento por dia. `{auto}`

---

## 4. Segurança — Requisitos Testáveis

- [x] CHK021 — AC-SEC-01 (confinamento do cliente privilegiado) está definido como requisito testável com asserção explícita? [Segurança, Plan §12]
  > **Evidência**: Plan §12 AC-SEC-01: "Teste: asserção de que nenhuma query de domínio roda no cliente privilegiado + teste de isolamento multi-tenant (espelha multi-tenant-isolation.spec.ts)". Requisito testável. `{auto}`

- [x] CHK022 — AC-SEC-02 (fail-open do debounce) está especificado com comportamento de Redis-down sem ambiguidade (fail-open vs. fail-closed)? [Segurança, Plan §12, Plan §6]
  > **Evidência**: Plan §12 AC-SEC-02 + Plan §6 corrijo: "Redis down → FAIL-OPEN: pula escrita (best-effort), NUNCA cai para escrita direta não-debounced". Sem ambiguidade. `{auto}`

- [x] CHK023 — AC-SEC-03 (sem PII no domain event) tem lista explícita de campos proibidos, não apenas "sem PII"? [Segurança, Plan §12, contracts/risk-detected.event.json]
  > **Evidência**: Plan §12 AC-SEC-03: "NENHUM nome/email/telefone. Resolução de PII é responsabilidade do consumidor (Epic 14)". Contrato JSON: additionalProperties:false em data. Explícito. `{auto}`

- [x] CHK024 — AC-SEC-04 (SET LOCAL injection) está especificado com rastreabilidade até o ponto de sanitização no código? [Segurança, Plan §12]
  > **Evidência**: Plan §12 AC-SEC-04: "tenantId provém de SELECT id FROM tenants (UUIDs do DB) + withTenantTx reaplica guard UUID_RE antes do SET LOCAL". Rastreável ao código existente. `{auto}`

- [ ] CHK025 — O teste RLS para Migration M1 (users.last_seen_at) está especificado como OBRIGATÓRIO (não condicional)? [Segurança, Plan §10, Data Model §M1]
  > **[Gap — CRÍTICO]**: Plan §10 diz "Teste RLS se policy em users" (condicional). Sonda confirmou: tabela `users` TEM ENABLE ROW LEVEL SECURITY + policies `users_tenant_isolation` e `users_tenant_insert` desde migration 20260409231601. O teste RLS é OBRIGATÓRIO. Spec/plan deve remover o condicional. Virar task obrigatória: "criar test/rls/users-lastseen.rls.spec.ts". `{auto}`

- [x] CHK026 — O teste RLS para Migration M2 (groups.status) e M3 (participant_radar_status.risk_reason) estão especificados como obrigatórios? [Segurança, Plan §10]
  > **Evidência**: Plan §10: M2 e M3 ambos com "Teste RLS: sim". Explícito e sem condicional. `{auto}`

---

## 5. Algoritmo — Requisitos Testáveis com Cenários Determinísticos

- [x] CHK027 — A guarda de não-sobrescrita manual (24h) tem critério de teste que isola a origem (job vs. manual)? [Algoritmo, Spec §FR66-03, SC-04]
  > **Evidência parcial / [Ambiguity]**: SC-04 define "race condition test" mas a guarda usa apenas `updatedAt` sem coluna de origem. Se o job rodou e atualizou updatedAt há 2h, um segundo run do job NÃO sobrescreve (falso positivo da guarda). Research D-MANUAL propõe `manualOverrideAt` como solução. O critério de teste para SC-04 está incompleto sem definição de como distinguir origem. Virar task obrigatória em create-tasks. `{auto}`

- [x] CHK028 — O algoritmo de detecção Critério A especifica como lidar com reuniões futuras (não realizadas) na janela de contagem? [Algoritmo, Plan §3]
  > **Evidência**: Plan §3 Critério A: "ordenar as últimas reuniões **realizadas** do grupo (status ∈ {realizado, ended}) por scheduledFor DESC". Reuniões futuras ou pendentes não entram na contagem. Claro. `{auto}`

- [x] CHK029 — O critério de escalação amarelo→vermelho (+7 dias) especifica o campo de referência temporal usado para comparação? [Algoritmo, Plan §5]
  > **Evidência**: Plan §5: "compara `calculatedAt` do status amarelo atual". Campo específico, não "data de criação" ou "hoje". `{auto}`

- [ ] CHK030 — A granularidade de correlation_id está especificada para permitir rastreio de um job run completo nos logs? [Algoritmo/Observabilidade, NFR]
  > **[Ambiguity]**: NFR menciona "correlation_id por tenant" mas plan §4 usa "jobRunId" no contrato de evento (UUID v7 por execução de job). Há ambiguidade: 1 correlation_id por job run (correlaciona todos os tenants daquele run) ou 1 por tenant (correlaciona apenas os logs daquele tenant no run)? O contrato de evento sugere jobRunId=por job run. Resolver explicitamente no plan antes de create-tasks. `{auto}`

---

## 6. Job / Observabilidade — Requisitos Testáveis

- [x] CHK031 — As métricas Pino estão especificadas com nome exato, tipo e ponto de emissão? [Observabilidade, Spec §FR66-01, NFR]
  > **Evidência**: FR66-01 e NFR: `job.duration_ms` (ms, ao final), `job.tenants_processed` (count, ao final), `job.participants_flagged` (count, ao final). Nomes exatos. `{auto}`

- [x] CHK032 — O mecanismo de alerta ao Super Admin após 3 falhas consecutivas especifica o canal e o payload do alerta? [Observabilidade, Spec §FR66-08, SC-12]
  > **Evidência parcial / [Gap-minor]**: Spec FR66-08 e SC-12 definem "alerta Super Admin após 3 falhas" mas não especificam canal (email? notificação in-app? log especial?) nem payload. Data Model §M4 (EvasionJobLog) permite rastrear falhas. Canal não definido. Virar nota em create-tasks para definir canal antes de implementar. `{auto}`

- [x] CHK033 — O isolamento por tenant no job está especificado como requisito verificável com teste de isolamento explícito? [Segurança/Job, Spec §FR66-01, SC-13]
  > **Evidência**: SC-13: "RLS isolation test" explícito. FR66-01: "RequestContext.run() para injetar tenant_id via AsyncLocalStorage — nunca como parâmetro". Testável. `{auto}`

- [x] CHK034 — O batch de 100 participantes está especificado com o mecanismo de paginação (cursor vs. offset) para evitar resultados inconsistentes em concurrent updates? [Performance/Job, Plan §4]
  > **Evidência**: Plan §4: "cursor por participantId (take:100, cursor, skip:1)". Cursor-based — correto para evitar skip drift em concurrent inserts. `{auto}`

---

## 7. Domain Events — Requisitos Testáveis

- [x] CHK035 — O contrato do domain event risk-detected define additionalProperties:false tanto no envelope quanto no objeto data? [Eventos, contracts/risk-detected.event.json, AC-SEC-03]
  > **Evidência**: contracts/risk-detected.event.json: `"additionalProperties": false` presente no nível raiz e dentro de `data`. `{auto}`

- [ ] CHK036 — Existe contrato (JSON Schema ou Zod) para o domain event pastoral.participant.risk-resolved previsto em SC-10? [Eventos, Spec §9, SC-10]
  > **[Gap — CRÍTICO]**: SC-10 prevê "domain event pastoral.participant.risk-resolved" mas contracts/risk-resolved.event.json NÃO existe. O create-tasks deve incluir task obrigatória: criar contracts/risk-resolved.event.json + Zod schema `RiskResolvedEventSchema`. `{auto}`

- [x] CHK037 — A chave de dedup do evento está especificada com todas as dimensões necessárias para evitar re-emissão intra-dia mas permitir re-emissão no dia seguinte? [Eventos, Plan §8]
  > **Evidência**: Plan §8: dedup key `rt:risk-detected:{tenantId}:{participantId}:{groupId}:{yyyy-mm-dd}`. 4 dimensões: escopo por tenant, participante, grupo e dia. `{auto}`

- [x] CHK038 — O snapshot test do Zod schema do evento está especificado como critério de aceite para detectar breaking changes silenciosos? [Eventos, Spec §9, SC-16]
  > **Evidência**: SC-16: "Snapshot tests dos schemas Zod passam" via vitest. Previsto. `{auto}`

---

## 8. Acessibilidade (a11y) — Requisitos Testáveis

- [x] CHK039 — O requisito de aria-live para o Radar card especifica o valor do atributo (polite vs. assertive) e o contexto de uso? [A11y, Plan §9, NFR]
  > **Evidência**: Plan §9: "aria-live='polite' para atualizações". O valor 'polite' é adequado para atualizações de status que não são urgentes. `{auto}`

- [x] CHK040 — O requisito de ícone+texto para o semáforo especifica que a cor NUNCA é o único indicador (WCAG 1.4.1 Use of Color)? [A11y, Plan §9, NFR, SC-17]
  > **Evidência**: Plan §9: "cor do semáforo **acompanhada de ícone + texto** (não cor isolada)". WCAG 1.4.1 satisfeito por requisito. `{auto}`

- [ ] CHK041 — O uso de FormField/text-secondary (mencionado no NFR) está especificado com critério verificável de conformidade ao design system a11y do projeto? [A11y, NFR]
  > **[Ambiguity]**: NFR menciona "FormField/text-secondary" como padrão a11y mas Plan §9 não detalha como e onde esses componentes devem ser usados no contexto do Radar card e do motivo do risco. Critério de code review não é suficiente sem referência ao design system. Virar critério de aceite explícito: "riskReason exibido via componente text-secondary conforme design system, com contraste verificado pelo axe-core". `{auto}`

---

## 9. Dependências e Premissas

- [x] CHK042 — A dependência de Epic 7 (rota de override pastoral) para a guarda manual de 24h está documentada como premissa com risco de impacto? [Dependências, Plan §5, Research D-MANUAL]
  > **Evidência**: Plan §5 e Research D-MANUAL: "sub-dependência de baixo risco; flag como item de verificação, não bloqueia o plano". Documentado. `{auto}`

- [ ] CHK043 — A premissa de que manualOverrideAt não precisa de migration adicional está validada ou há task para verificar/criar a migration? [Dependências/Premissas, Research D-MANUAL, Spec §FR66-03]
  > **[Gap — OBRIGATÓRIO]**: Research D-MANUAL reconhece que ParticipantRadarStatus não tem coluna de origem manual e propõe `manualOverrideAt DateTime?` como solução clean. O plano trata isso como "sub-dependência de baixo risco" mas a ausência desta coluna torna SC-04 não verificável de forma determinística. Virar task OBRIGATÓRIA em create-tasks: "verificar rota override Epic 7 → se sem flag de origem, criar migration manualOverrideAt + atualizar upsertRisk". `{auto}`

- [x] CHK044 — A dependência de Epic 14 (notificações) para o consumo do domain event está documentada com escopo explicitamente excluído desta story? [Dependências, Spec §10, contracts/risk-detected.event.json]
  > **Evidência**: Spec §10 "Dependência Futura — Epic 14"; contrato x-consumer: "Epic 14 (notifications) — deferido, não implementado nesta story". Escopo excluído explicitamente. `{auto}`

- [x] CHK045 — A dependência de Epic 6-5 (CelebrationBanner existente) está confirmada por referência a código/módulo real? [Dependências, Spec §10, Plan §9]
  > **Evidência**: Plan §9 e Research D-MANUAL: "Transições positivas gravam ParticipantStatusImproved (CelebrationBanner Epic 6-5, já existente)". Componente referenciado como existente. `{auto}`

---

## Notes

- Items `{auto}` estão marcados com `[x]` e evidência citada, ou `[Gap]`/`[Ambiguity]` com ação recomendada.
- Items `{humano}` ficam `[ ]` aguardando decisão do dono do produto.
- Total: 45 items gerados. Prioridade dada a riscos de algoritmo, segurança e contratos de evento.

### Resolução

| Status | Quantidade |
|--------|-----------|
| `[x]` auto-resolvidos com evidência | 29 |
| `[Gap]` requisito ausente → create-tasks | 8 |
| `[Ambiguity]` → clarify/resolução antes de create-tasks | 3 |
| `{humano}` aguardando decisão | 0 |

### Gaps Obrigatórios → Tasks no create-tasks

| ID | Gap | Ação |
|----|-----|------|
| CHK006 | FR66-09 care timeline sem detalhamento de eventos/permissões | Task: "detalhar FR66-09: quais eventos registrar, granularidade, permissões" |
| CHK007/CHK036 | Evento risk-resolved sem FR nem contrato | Task OBRIGATÓRIA: "criar contracts/risk-resolved.event.json + RiskResolvedEventSchema" |
| CHK017 | Sem SC para recontabilização de ausências pós-recesso | Task: "adicionar SC para cenário grupo-retorna-de-recesso" |
| CHK019 | Participante re-adicionado a grupo sem comportamento definido | Task: "definir comportamento para re-adição de participante ao grupo" |
| CHK025 | Teste RLS para users.last_seen_at especificado como condicional mas é OBRIGATÓRIO | Task OBRIGATÓRIA: "criar test/rls/users-lastseen.rls.spec.ts (users tem RLS)" |
| CHK032 | Canal do alerta Super Admin não definido | Task: "definir canal de alerta para 3 falhas consecutivas antes de implementar" |
| CHK043 | manualOverrideAt tratado como low-risk mas torna SC-04 não verificável | Task OBRIGATÓRIA: "verificar override Epic 7 → migration manualOverrideAt se necessário" |

### Ambiguidades → Resolver antes de create-tasks

| ID | Ambiguidade |
|----|-------------|
| CHK011 | presenceType='partial' conta como presença ou ausência no Critério A? |
| CHK030 | correlation_id: 1 por job run ou 1 por tenant por run? |
| CHK041 | FormField/text-secondary: onde e como no Radar card de riskReason? |

### Próximos Passos

1. Resolver CHK011 e CHK030 como adições ao `spec.md §11 Clarifications` (sem necessidade de novo ciclo clarify — são definições precisas sem decisão de produto)
2. CHK041 resolver via critério em tasks (code review gate)
3. `/create-tasks` — os 7 `[Gap]` viram tasks obrigatórias (já mapeados acima)
