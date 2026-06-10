# Plano de Execução Autônoma — metanoia-hub

> Implementação agêntica (~100% autônoma) das stories BMad pendentes usando o
> toolkit **cstk 5.12.0** (pipeline SDD). Gerado 2026-06-09.

## 1. Objetivo & princípios

- **O quê**: implementar as 67 stories ainda `ready-for-dev`/`in-review` em
  `sprint-status.yaml`, sem reabrir as 32 já `done`.
- **Como**: cada story vira uma execução autônoma `/feature-00c` (pipeline
  SDD `specify→clarify→plan→checklist→create-tasks→execute-task→review-task`
  + quality gates). O briefing/constitution do projeto já estão ratificados,
  então `feature-00c` (escopo feature) é o entrypoint correto — **não**
  `/agente-00c` (escopo projeto inteiro, que reabriria briefing/constitution).
- **Granularidade**: 1 story = 1 execução = 1 branch = 1 PR. Mantém o padrão
  histórico do repo (PRs #91, #92, #106… um por story) e evita ondas grandes.
- **Autonomia**: o `clarify` é respondido pelo `feature-00c-clarify-answerer`
  (heurística score 0..3 sobre briefing+constitution+spec). Score 0 → pausa
  humana. Demais decisões são auditáveis no `state.json`.

## 2. Estado atual (fonte: sprint-status.yaml)

| Release | Pendentes | Stories |
|---|---|---|
| 1a — MVP Core | 10 | 2-4, 2-5, 2-6, 2-9, 3-1, 3-2, 4-4, 4-5, 5-6(in-review), 7-1 |
| 1b — Plataforma | 34 | 6-1..6-6, 8-1..8-10, 9-1..9-4, 10-1..10-4, 11-1..11-4, 12-1..12-6 |
| 2 — Post-MVP | 23 | 13-1..13-5, 14-1..14-4, 15-1..15-4, 16-1..16-7 |

Todos os 67 story files existem em `_bmad-output/implementation-artifacts/`.

## 3. ⚠️ Pré-flight obrigatório: reconciliação WDS ↔ BMad (DRIFT)

A memória de sessões registra que **9 cenários WDS** já foram mergeados e
sobrepõem stories ainda marcadas `ready-for-dev`. Implementar cego = retrabalho
e conflito. Antes de cada wave, rodar um agente de auditoria que cruza o escopo
da story com o código real em `apps/api` + `apps/web`:

| Story `ready-for-dev` | Possível cobertura WDS já mergeada (verificar no código) |
|---|---|
| 2-5 seleção de tenant ativo | Cenário 08 (PRs #69-#71: `/selecionar-igreja`, TenantSwitcher, `my-tenants`/`select-tenant`) |
| 2-9 recuperação de senha | Cenário 07 (PRs #72-#75: password recovery full-stack) |
| 3-2 gestão de tenants (super-admin) | Cenário 09 (PRs #83-#86: super-admin/tenants saga) |
| 4-5 participante vê grupos | Cenário 06 (PRs #76-#81: participant-groups) |
| 6-* Radar Pastoral | Cenário 01 + 03 (radar full-stack, admin-pastoral) |
| 2-4 / 2-6 authz + RLS | base já consolidada por Stories 7-5/7-7 (withTenantTx, RLS NULLIF) |

**Saída do pré-flight** por story: `JÁ-COBERTA` (mover direto p/ `done` +
escrever evidência), `PARCIAL` (escopo residual reduzido → spec menor), ou
`NOVA` (implementar full). Isso pode derrubar bastante o número real de 67.

## 4. Ordenação por dependências (corrige a ordem ingênua do yaml)

- **4-4 "associar trilhas a grupo" depende de 8-1 (CRUD de trilhas)** — mover
  4-4 para depois da Wave 1b-Trilhas-1. Não implementar na Release 1a.
- **Epic 6 (Radar)** depende de Epic 5 (presença/telemetria) → já `done`. OK.
- **Epic 11 (planos/limites dinâmicos)** estende 3-3 PlanLimitsGuard (`done`).
- **Epic 14 (notificações)** estende o stub de notificação da 5-6.
- **Epic 12/15 (a11y)** dependem das telas já existirem → rodar por último em
  cada release.

## 5. Mapa de ondas (waves pequenas, ≤4 stories, respeitando deps)

### Aprendizados operacionais (W1a.1, 2026-06-09) — aplicar a toda wave
- **Ambiente**: `jq` é obrigatório p/ o runtime cstk (instalado via `conda install -c conda-forge jq`); os scripts em `skills/agente-00c-runtime/scripts/` **não** estão no PATH — exportar em toda invocação Bash.
- **Bug recorrente do orquestrador**: às vezes retorna após só 1 fase (ex.: specify) sem fechar a onda. Remédio (já no contrato do PAI): `state-ondas.sh reconcile-wave` avança `current_stage`; depois re-spawnar orquestrador em modo resume (SendMessage indisponível neste harness → re-spawn fresco lê o state + artefatos em disco).
- **CI ≠ review local**: o orquestrador abre a PR antes do CI fechar e o `review-task` local não pega tudo. SEMPRE verificar `gh pr checks` e corrigir. Falhas reais vistas: import não-usado (lint `no-unused-vars`) e **regressão de E2E** (o auto-select da 2-5 quebrou o happy-path 7-4, que foi atualizado).
- **Regressão cross-story**: features que mudam fluxos (ex.: auto-select pula tela) quebram E2E de stories anteriores — esperar e corrigir o teste no mesmo PR.
- **Git**: spawnar o orquestrador a partir de `dev` limpo (senão a feature-branch herda commits da branch atual, como ocorreu com #113 que absorveu o bootstrap). Pós-merge há um `tasks.md` não-commitado (status pós-onda) — `git stash` antes do `gh pr merge`.

### Wave 0 — Bootstrap cstk (CONCLUÍDA 2026-06-09)
Pré-requisito descoberto: `/feature-00c` exige `docs/01-briefing-discovery/briefing.md`
+ `docs/constitution.md` (formato cstk), que o projeto BMad não tinha. Gerados via
skills `briefing` + `constitution`, derivados de prd/architecture/project-context/CLAUDE.
Constitution v1.0.0 (7 princípios NON-NEGOTIABLE). Pré-flight feature-00c agora passa.


Cada wave = um lote sequencial de execuções `/feature-00c`. Stories dentro da
wave sem dependência entre si **podem** rodar em paralelo (worktrees isoladas);
o default seguro é sequencial para evitar conflito de migrations Prisma.

### Release 1a — fechamento do MVP
- **W1a.1 — Multi-tenancy core (bloqueia tudo)**: `2-4`, `2-6`, `2-5`
- **W1a.2 — Provisionamento & auth**: `3-1`, `3-2`, `2-9`
- **W1a.3 — Grupos & onboarding**: `4-5`, `7-1`, fechar `5-6` (só merge/review)

### Release 1b — plataforma estendida
- **W1b.1 — Trilhas core**: `8-1`, `8-2`, `8-3`
- **W1b.2 — Trilhas regras**: `8-4`, `8-5`, `8-6`, **`4-4`** (agora desbloqueada)
- **W1b.3 — Trilhas relatório/busca/UX**: `8-7`, `8-8`, `8-9`, `8-10`
- **W1b.4 — Radar Pastoral A**: `6-1`, `6-2`, `6-3`
- **W1b.5 — Radar Pastoral B**: `6-4`, `6-5`, `6-6`
- **W1b.6 — LGPD**: `9-1`, `9-2`, `9-3`, `9-4`
- **W1b.7 — Onboarding avançado**: `10-1`, `10-2`, `10-3`, `10-4`
- **W1b.8 — Planos & gating**: `11-1`, `11-2`, `11-3`, `11-4`
- **W1b.9 — A11y hardening**: `12-1`, `12-2`, `12-3`, `12-4`, `12-5`, `12-6`

### Release 2 — post-MVP
- **W2.1 — Relatórios avançados**: `13-1`, `13-2a`, `13-2b`, `13-3`, `13-4`, `13-5`
- **W2.2 — Notificações**: `14-1`, `14-2a`, `14-2b`, `14-2c`, `14-3`, `14-4`
- **W2.3 — A11y avançada**: `15-1`, `15-2`, `15-3`, `15-4`
- **W2.4 — Resiliência & futuro**: `16-1`..`16-7`

## 6. Motor de execução (por story)

```bash
# 1 story = 1 invocação. short-name = id da story (kebab curto).
/feature-00c "<título da story>" <short-name> --projeto /home/quad101restadores/metanoia-hub
```

Exemplo W1a.1:
```
/feature-00c "Autorização por papéis e guards NestJS (3 camadas)" 2-4-authz-guards
/feature-00c "Isolamento de dados por tenant (RLS)"               2-6-rls
/feature-00c "Seleção de tenant ativo e associação multi-tenant"  2-5-tenant-select
```

Fluxo interno de cada execução (autônomo):
1. **warm-up de permissões** (1ª vez na sessão) — aprova em batch specify,
   clarify, plan, checklist, create-tasks, execute-task, review-task +
   quality gates (validate-documentation, validate-docs-rendered,
   owasp-security) + os 3 sub-agentes. Depois roda sem interrupção.
2. pipeline SDD lê o story file como input de `specify`.
3. `clarify` → answerer decide (score≥2) ou pausa (score 0).
4. `execute-task` implementa; `review-task` revisa em contexto fresco.
5. Estado em `.claude/feature-00c-state/<short-name>/state.json` (resumível).

Comandos de controle: `/feature-00c-resume <short-name>`, `/feature-00c-abort
<short-name>`.

## 7. Guardrails inegociáveis (CLAUDE.md + docs/project-context.md)

Injetar como invariantes no `constitution`/checklist de cada story:
- `tenant_id` em toda tabela; RLS obrigatória; nunca passar `tenant_id` como
  parâmetro — usar `AsyncLocalStorage`/`withTenantTx`. Teste RLS em
  `apps/api/test/rls/` para toda migration que toque policy.
- UUID v7 via `uuidv7()` — nunca `@default(uuid())`.
- Contratos Zod compartilhados em `packages/types` + snapshot test.
- Mensagens user-facing em PT-BR (`apps/web/messages/pt-BR.json`); código/log
  em inglês; vocabulário pastoral na UI.
- Server Components com `fetch` nativo; TanStack Query só em Client Components.
- Conventional commits em PT-BR; branch `feat/`; 1 PR por story; CI verde
  (lint+test+build) antes de `done`.

## 8. Cadência de operação (semi-autônoma por wave)

1. **Antes da wave**: rodar pré-flight de reconciliação (§3) sobre as stories
   da wave → marca JÁ-COBERTA / PARCIAL / NOVA.
2. **Warm-up único** de permissões na 1ª `/feature-00c` da sessão.
3. Disparar as stories `NOVA`/`PARCIAL` da wave (sequencial; paralelo só com
   worktree quando não houver colisão de migration).
4. **Gate de wave**: ao fim, rodar `/code-review` no diff agregado + atualizar
   `sprint-status.yaml` (story→`done`, epic→`done` quando todas fecharem) +
   retrospectiva opcional via `bmad-retrospective`.
5. Só então abrir a próxima wave (SM-style: incorpora aprendizados).

## 9. Critérios de "done" por story

- PR mergeado em `dev`, CI verde.
- AC do story file satisfeitos; testes (unit + integration + RLS quando aplica).
- `sprint-status.yaml` atualizado.
- Sem violação dos guardrails da §7 (validado pelo `review-task` + `/code-review`).

## 10. Próximo passo

Aprovar este plano e autorizar o **pré-flight de reconciliação da W1a.1**
(2-4, 2-6, 2-5). Após o resultado, disparo o primeiro `/feature-00c` com o
warm-up de permissões.
