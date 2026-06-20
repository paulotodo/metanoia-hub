# Relatorio do Agente-00C — feat-risco-evasao-20260620T001902Z

**Gerado em**: 2026-06-20T02:08:33Z
**Status no momento**: concluida
**Versao do schema**: 1.0.0

---

## 1. Resumo Executivo

| Campo | Valor |
|-------|-------|
| ID Execucao | feat-risco-evasao-20260620T001902Z |
| Projeto-Alvo | /var/lib/metanoia-hub |
| Descricao | Story 13.3 — Detecção de Risco de Evasão (FR66): job BullMQ detect-evasion-risk (cron diário, tenant-isolated) detecta participantes em risco (3+ ausências consecutivas OU 2+ semanas sem acesso via last_seen_at), transiciona semáforo (Epic 7), emite domain events pastoral.participant.risk-detected/resolved, suporta grupo em recesso, mostra motivo no Radar UI. Notificação ao líder DEFERIDA ao Epic 14 via evento. Migrations: User.last_seen_at + Group.status/breakUntil. Multi-tenant RLS, Zod, gate a11y. |
| Stack final | nao aplicavel — execucao abortada antes de definir |
| Status | concluida |
| Motivo termino | review-task-complete |
| Iniciada em | 2026-06-20T00:19:02Z |
| Terminada em | 2026-06-20T02:08:10Z |
| Ondas executadas | 8 |
| Tool calls totais | 0 |
| Decisoes registradas | 32 |
| Bloqueios humanos | 0 |
| Sugestoes para skills globais | 0 |
| Issues abertas no toolkit | 0 |
| Profundidade max de subagentes | 1 |

(Paragrafo de resumo nao fornecido — orquestrador deve gerar via --paragrafo-resumo na invocacao final.)

## 2. Linha do Tempo

| Onda | Inicio | Fim | Etapas | Tool calls | Wallclock | Termino |
|------|--------|-----|--------|------------|-----------|---------|
| onda-001 | 2026-06-20T00:20:45Z | 2026-06-20T00:25:13Z | specify | 0 | 268s | concluido |
| onda-002 | 2026-06-20T00:30:23Z | 2026-06-20T00:32:58Z | clarify | 0 | 155s | concluido |
| onda-003 | 2026-06-20T00:39:47Z | 2026-06-20T00:45:35Z | plan | 0 | 348s | etapa_concluida_avancando |
| onda-004 | 2026-06-20T00:52:12Z | 2026-06-20T00:57:32Z |  | 0 | 320s | concluido |
| onda-005 | 2026-06-20T01:01:33Z | 2026-06-20T01:28:09Z |  | 0 | 1596s | concluido |
| onda-006 | 2026-06-20T01:34:35Z | 2026-06-20T02:08:10Z |  | 0 | 2015s | concluido |

## 3. Decisoes

Total: 32 decisoes registradas.

### 3.1 Por agente

| Agente | Quantidade |
|--------|------------|
| agente-00c-feature-orchestrator | 32 |

### 3.2 Lista detalhada

#### dec-001 — model-routing — agente-00c-feature-orchestrator — 2026-06-20T00:19:03Z

**Contexto**: Selecao de modelo para onda init (fase specify)

**Opcoes consideradas**: haiku / sonnet / opus / manter-atual

**Escolha**: model:sonnet

**Justificativa**: sugerido=sonnet aplicado=sonnet origem=mapa | faixa=media fase=specify (mapa primario)

**Score**: 0

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-002 — specify — agente-00c-feature-orchestrator — 2026-06-20T00:21:12Z

**Contexto**: read-back PRE-DECISAO: K=4 achados injetados (anti-eco feature=risco-evasao)

**Opcoes consideradas**: injetar-achados / no-op

**Escolha**: injetar-achados

**Justificativa**: termos derivados da feature: story detec risco evas fr66 job bullmq

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-003 — specify — agente-00c-feature-orchestrator — 2026-06-20T00:21:23Z

**Contexto**: Inicio da etapa specify: spec autoritativa 13-3 disponivel, schema verificado

**Opcoes consideradas**: iniciar / abortar

**Escolha**: iniciar

**Justificativa**: Spec autoritativa 13-3 disponivel, epico-13 lido, schema analisado. Prosseguir com geracao de spec.md.

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-004 — specify — agente-00c-feature-orchestrator — 2026-06-20T00:25:06Z

**Contexto**: Spec risco-evasao criada em docs/specs/risco-evasao/spec.md

**Opcoes consideradas**: concluido / abortar / aguardar-clarify

**Escolha**: concluido

**Justificativa**: Spec gerada a partir de 13-3 autoritativo + schema analisado. FR66 completo com 9 FRs, 17 SCs, migrations identificadas, dependencias mapeadas, 4 itens para clarify documentados.

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-005 — model-routing — agente-00c-feature-orchestrator — 2026-06-20T00:28:15Z

**Contexto**: Selecao de modelo para onda 1 (fase clarify)

**Opcoes consideradas**: haiku / sonnet / opus / manter-atual

**Escolha**: model:sonnet

**Justificativa**: sugerido=sonnet aplicado=sonnet origem=mapa | faixa=media fase=clarify (mapa primario)

**Score**: 0

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-006 — clarify — agente-00c-feature-orchestrator — 2026-06-20T00:30:39Z

**Contexto**: C1: Mecanismo de populacao de User.last_seen_at

**Opcoes consideradas**: interceptor-keycloak-guard-redis-debounce / keycloak-webhook / presenca-checkin-apenas

**Escolha**: interceptor-keycloak-guard-redis-debounce

**Justificativa**: KeycloakAuthGuard eh ponto de intercep de toda request autenticada; request-context.middleware ja existe; debounce Redis TTL 15min (cache:last-seen:{userId}) eh idiomatico no projeto; escrita assincrona best-effort nao impacta latencia. Keycloak webhook adiciona dep externa; checkin-apenas perde usuarios que so leem conteudo.

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-007 — clarify — agente-00c-feature-orchestrator — 2026-06-20T00:30:51Z

**Contexto**: C2: Campo riskReason em ParticipantRadarStatus

**Opcoes consideradas**: persistir-coluna-varchar500 / derivar-on-demand

**Escolha**: persistir-coluna-varchar500

**Justificativa**: FR66-06 exige motivo visivel no Radar UI via tooltip; tooltip exige carga rapida sem recalcular; modelo ParticipantRadarStatus ja eh materializado; job tem todo contexto e pode gravar motivo junto com status; derivar on-demand imposaria query extra a cada render e seria inconsistente com padrao materializado.

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-008 — clarify — agente-00c-feature-orchestrator — 2026-06-20T00:31:00Z

**Contexto**: C3: Endpoint PATCH /api/v1/groups/:id para recesso — infraestrutura existente

**Opcoes consideradas**: extender-controller-existente / criar-endpoint-separado

**Escolha**: extender-controller-existente

**Justificativa**: GroupsController JA tem @Patch(':id') com ZodValidationPipe(UpdateGroupRequestSchema); KeycloakAuthGuard + RolesGuard + ADMIN_TENANT ja configurados; task e apenas extender UpdateGroupRequestSchema em packages/types com status e breakUntil opcionais, e GroupsService.update() para persistir. Endpoint separado seria over-engineering.

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-009 — clarify — agente-00c-feature-orchestrator — 2026-06-20T00:31:11Z

**Contexto**: C4: Trigger da resolucao de risco — batch diario vs real-time

**Opcoes consideradas**: batch-diario-mesmo-job / real-time-event-listener

**Escolha**: batch-diario-mesmo-job

**Justificativa**: Job detect-evasion-risk diario (cron 0 6 * * *) ja processa todos participantes; resolucao no mesmo job garante consistencia com deteccao; spec autoritativa 13-3 descreve batch diario; real-time aumentaria complexidade arquitetural sem beneficio UX claro para lideres que consultam Radar periodicamente.

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-010 — clarify — agente-00c-feature-orchestrator — 2026-06-20T00:32:44Z

**Contexto**: Avanco de fase: clarify concluido sem bloqueios, transitar para plan

**Opcoes consideradas**: avancar-para-plan / aguardar-humano

**Escolha**: avancar-para-plan

**Justificativa**: Todos 4 itens de clarify (C1-C4) resolvidos com score 3: evidencias empiricas do codebase (keycloak.guard.ts, groups.controller.ts, schema.prisma, radar-status.repository.ts) validam cada decisao. Nenhum item requer decisao de produto nem escopo sem default tecnico claro.

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-011 — model-routing — agente-00c-feature-orchestrator — 2026-06-20T00:37:14Z

**Contexto**: Selecao de modelo para onda 2 (fase plan)

**Opcoes consideradas**: haiku / sonnet / opus / manter-atual

**Escolha**: model:opus

**Justificativa**: sugerido=opus aplicado=opus origem=mapa | faixa=profunda fase=plan (mapa primario)

**Score**: 0

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-012 — plan — agente-00c-feature-orchestrator — 2026-06-20T00:39:47Z

**Contexto**: read-back PRE-DECISAO: K=4 achados injetados (anti-eco feature=risco-evasao)

**Opcoes consideradas**: injetar-achados / no-op

**Escolha**: injetar-achados

**Justificativa**: termos derivados: story detec risco evas fr66 job bullmq; achados de 13-2b sobre privileged client + tenant iteration injetados no contexto do plan

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-013 — plan — agente-00c-feature-orchestrator — 2026-06-20T00:43:25Z

**Contexto**: Plano técnico gerado: job em reports/jobs com privileged client p/ listar tenants + withTenantTx por tenant; LastSeenInterceptor global; extensao UpdateGroupRequestSchema; 4 migrations; domain event sem PII

**Opcoes consideradas**: gerar-plano / abortar

**Escolha**: gerar-plano

**Justificativa**: Sondas confirmaram: createPrivilegedClient (DATABASE_URL superuser, RLS-bypass) em refresh-tenant-views.processor.ts; withTenantTx aceita opts.tenantId com SET LOCAL app.current_tenant_id; RadarStatusRepository.upsert raw INSERT ON CONFLICT(tenant_id,group_id,participant_id); GroupsController @Patch existente; UpdateGroupRequestSchema z.object().refine; schema.prisma sem last_seen_at/status/break_until/risk_reason

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-014 — plan — agente-00c-feature-orchestrator — 2026-06-20T00:45:06Z

**Contexto**: Gate doc-quality: skill validate-documentation ausente neste ambiente (nao registrada). Executado check inline deterministico no lugar.

**Opcoes consideradas**: rodar-skill / check-inline-com-justificativa / skip

**Escolha**: check-inline-com-justificativa

**Justificativa**: validate-documentation nao esta na lista de skills deste harness; check inline cobriu o essencial

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-015 — plan — agente-00c-feature-orchestrator — 2026-06-20T00:45:06Z

**Contexto**: Gate owasp-security: 3 findings LOW (privileged-client confinement, last_seen debounce fail-open, domain event sem PII) incorporados como AC-SEC-01..04. Nenhum critical/high.

**Opcoes consideradas**: incorporar-como-AC / escalar-para-humano / aceitar-risco

**Escolha**: incorporar-como-AC

**Justificativa**: Findings sao endurecimentos de baixo risco; constituicao exige seguranca como AC -> incorporados ao plan §12 e §6 corrigido

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-016 — model-routing — agente-00c-feature-orchestrator — 2026-06-20T00:49:15Z

**Contexto**: Selecao de modelo para onda 3 (fase checklist)

**Opcoes consideradas**: haiku / sonnet / opus / manter-atual

**Escolha**: model:sonnet

**Justificativa**: sugerido=sonnet aplicado=sonnet origem=mapa | faixa=media fase=checklist (mapa primario)

**Score**: 0

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-017 — checklist — agente-00c-feature-orchestrator — 2026-06-20T00:52:20Z

**Contexto**: Início da fase checklist: validação de requisitos FR66 risco-evasao

**Opcoes consideradas**: executar-checklist / abortar

**Escolha**: executar-checklist

**Justificativa**: specify+clarify+plan concluídos; sem bloqueios pendentes; artefatos spec.md, plan.md, data-model.md, contracts/risk-detected.event.json prontos para validação de qualidade de requisitos

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-018 — checklist — agente-00c-feature-orchestrator — 2026-06-20T00:56:46Z

**Contexto**: CHK025: Teste RLS users.last_seen_at era condicional — sonda confirmou RLS ativo

**Opcoes consideradas**: corrigir-para-obrigatorio / deixar-condicional

**Escolha**: corrigir-para-obrigatorio

**Justificativa**: migration 20260409231601 confirma ENABLE ROW LEVEL SECURITY + policies users_tenant_isolation e users_tenant_insert na tabela users. Condicional removido do plan §6 e §10.

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-019 — checklist — agente-00c-feature-orchestrator — 2026-06-20T00:57:04Z

**Contexto**: CHK036: SC-10 prevê risk-resolved mas contrato JSON ausente

**Opcoes consideradas**: criar-contrato-em-create-tasks / abortar-sc10

**Escolha**: criar-contrato-em-create-tasks

**Justificativa**: spec FR66-04 define o envelope do risk-resolved com todos os campos; só falta o arquivo JSON Schema. Task obrigatória para create-tasks: criar contracts/risk-resolved.event.json + RiskResolvedEventSchema Zod.

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-020 — checklist — agente-00c-feature-orchestrator — 2026-06-20T00:57:04Z

**Contexto**: CHK043: manualOverrideAt tratado como low-risk mas SC-04 não é verificável sem coluna de origem

**Opcoes consideradas**: elevar-para-task-obrigatoria / manter-como-nota

**Escolha**: elevar-para-task-obrigatoria

**Justificativa**: Sem coluna de origem manual, job pode falsamente ignorar recálculo se ele mesmo atualizou updatedAt nas últimas 24h. SC-04 race condition test não é determinístico sem manualOverrideAt. Elevado para task obrigatória no create-tasks.

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-021 — checklist — agente-00c-feature-orchestrator — 2026-06-20T00:57:04Z

**Contexto**: CHK011-RES: presenceType='partial' conta como presença no Critério A

**Opcoes consideradas**: partial-e-presenca / partial-e-ausencia / sem-definicao

**Escolha**: partial-e-presenca

**Justificativa**: Presença parcial indica engajamento — excluí-la geraria falso-positivo de risco para participante que compareceu parcialmente. Consistente com vocabulário pastoral do projeto.

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-022 — checklist — agente-00c-feature-orchestrator — 2026-06-20T00:57:04Z

**Contexto**: CHK030-RES: granularidade do correlation_id = 1 UUID v7 por execução de job

**Opcoes consideradas**: por-job-run / por-tenant-por-run / sem-correlation

**Escolha**: por-job-run

**Justificativa**: jobRunId no envelope do domain event sugere 1 por execução. Permite correlacionar todos os logs e eventos de um run cross-tenant para debug. Log por tenant inclui ambos jobRunId+tenantId.

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-023 — model-routing — agente-00c-feature-orchestrator — 2026-06-20T01:00:00Z

**Contexto**: Selecao de modelo para onda 4 (fase create-tasks)

**Opcoes consideradas**: haiku / sonnet / opus / manter-atual

**Escolha**: model:sonnet

**Justificativa**: sugerido=sonnet aplicado=sonnet origem=mapa | faixa=media fase=create-tasks (mapa primario)

**Score**: 0

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-024 — create-tasks — agente-00c-feature-orchestrator — 2026-06-20T01:01:43Z

**Contexto**: Decomposição da spec FR66 em backlog tasks.md com 8 gaps do checklist como tasks obrigatórias

**Opcoes consideradas**: decompor-em-10-fases / decompor-em-5-fases / flat-list-sem-fases

**Escolha**: decompor-em-10-fases

**Justificativa**: 10 fases espelham a sequência de dependências: migrations→types/Zod→contracts→interceptor→service/repo→job→recesso→ui→timeline→testes. Garante build order correto e permite paralelismo entre fases independentes.

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-025 — create-tasks — agente-00c-feature-orchestrator — 2026-06-20T01:05:11Z

**Contexto**: Gate template-fidelity: tasks.md validado deterministicamente via Bash

**Opcoes consideradas**: aprovado / reprovado-corrigir / skip-com-justificativa

**Escolha**: aprovado

**Justificativa**: 10 FASE sections, 80 checkboxes, 52 criticality tags, Matriz+Escopo presentes, todos os 8 gaps (CHK006/007/017/019/025/032/036/043) cobertos

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-026 — model-routing — agente-00c-feature-orchestrator — 2026-06-20T01:11:12Z

**Contexto**: Selecao de modelo para onda 5 (fase execute-task)

**Opcoes consideradas**: haiku / sonnet / opus / manter-atual

**Escolha**: model:sonnet

**Justificativa**: sugerido=sonnet aplicado=sonnet origem=mapa | faixa=rasa fase=execute-task (mapa primario)

**Score**: 0

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-027 — execute-task — agente-00c-feature-orchestrator — 2026-06-20T01:27:31Z

**Contexto**: Execução backend Story 13.3: FASES 1-7 (migrations, Zod, contratos, interceptor, detection service, job BullMQ, recesso) + FASE 10 parcial (RLS + unit SC-04). Build typecheck limpo (0 erros), 543 tests types + 6 detection + 5 interceptor + 10 groups passando.

**Opcoes consideradas**: executar-backend-completo-1onda / fatiar-backend-frontend

**Escolha**: fatiar-backend-frontend

**Justificativa**: Backend (FASES 1-7,10) é subconjunto coerente e testável local; FASE 8 (publisher) + FASE 9 (UI web) ficam para próxima onda. tsc --noEmit retornou 0 erros nos arquivos da feature; vitest: 543 types + 6 EvasionDetection + 5 interceptor + 10 groups verdes.

**Score**: 3

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-028 — execute-task — agente-00c-feature-orchestrator — 2026-06-20T01:54:01Z

**Contexto**: FASE 8 concluida: PastoralRiskEventPublisher criado, integrado no EvasionDetectionService, testes unitarios passando (9 testes: dedup, schema-fail-no-throw, no-PII, resolved-no-dedup)

**Opcoes consideradas**: concluir-fase-8 / deferir

**Escolha**: concluir-fase-8

**Justificativa**: pastoral-risk-event-publisher.service.ts + spec + integracao no evasion-detection.service.ts verificados via pnpm vitest run (9 pass)

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-029 — execute-task — agente-00c-feature-orchestrator — 2026-06-20T01:54:12Z

**Contexto**: FASE 9 concluida: RiskReasonBadge (PT-BR, a11y WCAG AA), RiskResolvedBanner (aria-live+polite, auto-dismiss 10s), participant-card.tsx atualizado, strings em vocabulary.ts + types barrel, mocks web atualizados, 875 testes web passando

**Opcoes consideradas**: concluir-fase-9 / deferir

**Escolha**: concluir-fase-9

**Justificativa**: risk-reason-badge.tsx + risk-resolved-banner.tsx + testes criados; pnpm web test 875/875 pass; a11y: icon+text+aria-label (nao so cor)

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-030 — execute-task — agente-00c-feature-orchestrator — 2026-06-20T01:54:23Z

**Contexto**: FASE 10 (parcial) concluida: 10.1 evasion-job-isolation.spec.ts (multi-tenant RLS), 10.4 detect-evasion-risk.processor.spec.ts (AC-SEC-01 disconnect+privileged-confinement, isolation, CHK030-RES) 4/4 pass, 10.6 risk-event.snapshot.spec.ts (inline snapshots Zod). Tasks 10.2+10.3+10.5 ja estavam concluidas em ondas anteriores.

**Opcoes consideradas**: concluir-fase-10-parcial / deferir

**Escolha**: concluir-fase-10-parcial

**Justificativa**: API test suite: evasion-detection 6/6, publisher 9/9, processor 4/4, tipos 553/553. Web: 875/875.

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-031 — model-routing — agente-00c-feature-orchestrator — 2026-06-20T01:59:12Z

**Contexto**: Selecao de modelo para onda 6 (fase review-task)

**Opcoes consideradas**: haiku / sonnet / opus / manter-atual

**Escolha**: model:haiku

**Justificativa**: sugerido=haiku aplicado=haiku origem=mapa | faixa=rasa fase=review-task (mapa primario)

**Score**: 0

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)

#### dec-032 — review-task — agente-00c-feature-orchestrator — 2026-06-20T02:07:46Z

**Contexto**: Auditoria review-task Story 13.3 (FR66) — lint+build+testes+corretude

**Opcoes consideradas**: concluido-sem-ressalvas / concluido-com-findings-menor / bloquear-humano

**Escolha**: concluido-sem-ressalvas

**Justificativa**: Lint verde (8 erros corrigidos em 4 arquivos), build verde, testes verdes (553+875+164). Algoritmo correto: ausencias consecutivas por participante/grupo, partial conta como presenca, 14d inatividade, SC-04 manualOverride 24h, recesso skip, semaforo transicao conforme spec. Domain events sem PII, envelope valido. a11y gate nao tocado.

**Score**: 2

**Referencias**: (nenhuma)

**Artefato originador**: (nenhum)


## 4. Bloqueios Humanos

Total: 0 bloqueios.

### 4.1 Pendentes (aguardando resposta)

(Nenhum bloqueio pendente neste momento.)

### 4.2 Respondidos

(Nenhum bloqueio respondido nesta execucao.)

### 4.3 Sem bloqueios

Nenhum bloqueio humano nesta execucao.

## 5. Sugestoes para Skills Globais

Total: 0 sugestoes.

### 5.1 Severidade impeditiva (viraram issues)

(Nenhuma sugestao impeditiva nesta execucao.)

### 5.2 Severidade aviso

(Nenhuma sugestao com severidade aviso.)

### 5.3 Severidade informativa

(Nenhuma sugestao informativa.)

### 5.4 Sem sugestoes

Nenhuma sugestao para skills globais nesta execucao.

## 6. Licoes Aprendidas

(Relatorio final invocado sem --licoes-aprendidas — operador deve preencher esta secao manualmente OU re-invocar com flag.)

---

**Apendice A — Caminhos relevantes**

- Estado: `/var/lib/metanoia-hub/.claude/agente-00c-state/state.json`
- Backups de estado: `/var/lib/metanoia-hub/.claude/agente-00c-state/state-history/`
- Sugestoes detalhadas: `/var/lib/metanoia-hub/.claude/agente-00c-suggestions.md`
- Whitelist: `/var/lib/metanoia-hub/.claude/agente-00c-whitelist`
- Artefatos da pipeline: `/var/lib/metanoia-hub/docs/specs/<feature>/`

