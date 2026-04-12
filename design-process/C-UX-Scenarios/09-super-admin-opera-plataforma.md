---
design_intent: D
design_status: not-started
phase4_note: "DDRs obrigatórios no wireframe: URL paths /app/admin/super/*, persona formal ausente, UX da saga de provisionamento (DB→Keycloak→admin)"
---

# 09: Super Admin opera a plataforma sem invadir o pastoral

**Project:** metanoia-hub
**Created:** 2026-04-11
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios
**Scenario type:** Screen Flow (edge case · desktop-first · platform operations)
**Priority:** ⭐ Priority 2 — Edge case de governanca (operacao cross-tenant sem RLS)
**Release gate:**
- **Gestao de tenants (FR18, FR19, Story 3.2) — Release 1a (Sprint 4).**
- **Provisionamento de tenant (Story 3.1) — Release 1a (Sprint 4).**
- **Guard de limites por plano hardcoded (Story 3.3) — Release 1a (Sprint 4).**
- **MFA obrigatorio (Story 2.3) — Release 1a (Sprint 2).**
- **Planos dinamicos (Epic 11, FR13-FR17) — Release 1b.**
- **Metricas de plataforma (Epic 13, FR67, Story 13.4) — Release 2.**
- **Export CSV (Epic 8, FR68) — Release 1b.**

---

## ⚠️ Nota de rastreabilidade — rotulos semanticos

Seguindo o padrao 11, este outline usa **rotulos semanticos** para telas. Consolidacao no Step 06 hub (`00-ux-scenarios.md`).

**Rotulos semanticos usados neste outline:**
- **Tela de login com MFA** — rota `(public)/login` + TOTP challenge (Story 2.3)
- **Dashboard de tenants** — FR18 Story 3.2 (Release 1a, Sprint 4) — rota provavel `/app/admin/tenants`
- **Detalhe do tenant** — FR19 Story 3.2 (Release 1a) — rota provavel `/app/admin/tenants/[id]`
- **Formulario de provisionamento** — Story 3.1 (Release 1a) — rota provavel `/app/admin/tenants/novo`
- **Metricas de plataforma** — FR67 Story 13.4 (Release 2) — rota provavel `/app/admin/metricas`

---

## ⚠️ Nota de persona — Super Admin nao tem persona formal

O Super Admin **nao foi documentado como persona** nos artefatos da Phase 2 (Trigger Map). As 5 personas formais sao: Lider, Pastor Titular, Champion, Participante, Admin Tenant. Este outline e o **primeiro artefato a nomear o Super Admin como persona narrativa**, seguindo o precedente do outline 04 (Champion).

**Persona sintetica (para este outline):**

**Nome ficticio:** Paulo — mencionado no PRD Jornada 4 como *"Paulo, desenvolvedor/operador da plataforma"*. Paulo nao e pastor, nao lidera grupo, nao participa de comunidade. Ele e o **operador tecnico** que garante que o produto funciona para todas as igrejas. Desktop-first. Pensamento sistemico. Preocupacao: *"Nao quero ver dados pastorais — quero ver se a plataforma esta saudavel."*

**Acao de grooming:** considerar criar persona formal do Super Admin em `design-process/B-Trigger-Map/personas/07-operator-persona-super-admin.md` para completar o conjunto de 6 roles RBAC.

---

## Nota de design — separacao absoluta entre operacao e pastoral

O Super Admin e o **unico role que opera cross-tenant** — vê todos os tenants, provisiona novos, suspende existentes. Mas ele **nunca ve dados pastorais**: nao ve o radar de nenhum lider, nao ve presenca de participantes, nao ve acoes de cuidado. Ele ve **metadata operacional** (nome do tenant, plano, status, contagem de membros, data de criacao).

Essa separacao e **arquitetural, nao apenas visual.** O `PrismaAdminService` (Story 3.2) usa um connection pool separado sem RLS — mas os endpoints de Super Admin retornam apenas dados da tabela `tenants` e aggregates (count), nunca dados das tabelas de dominio pastoral (`care_actions`, `meeting_reflections`, `radar_signals`).

**Principio inviolavel aplicado:** *"Dignidade antes de dado"* — o Super Admin nao tem permissao de ver o que acontece dentro das comunidades. Ele ve o **envelope** (quantos tenants, quantos usuarios, qual plano), nunca a **carta** (quem precisa de cuidado, quem faltou, quem registrou reflexao).

---

## Transaction (Q1)

**What this scenario covers:**
Do momento *"preciso verificar a saude da plataforma e provisionar uma nova igreja"* ate *"tenant criado, admin convidado, plataforma estavel"*. Cobre 2 operacoes core do Super Admin no Release 1a:
- **(A) Dashboard operacional:** listar tenants, verificar status, visualizar metadata
- **(B) Provisionamento de novo tenant:** criar igreja, atribuir plano, convidar admin

**O cenario NAO cobre:** metricas de plataforma agregadas (FR67, Release 2), export CSV (FR68, Release 1b), planos dinamicos (Epic 11, Release 1b), deteccao de risco de evasao (Story 13.3, Release 2), nem qualquer acesso a dados pastorais (nunca, em nenhum release).

---

## Business Goal (Q2)

**Goal:** `Garantir que o operador da plataforma possa gerenciar tenants e monitorar saude operacional sem jamais acessar dados pastorais das comunidades`

**Objective:** `Tempo medio para provisionar novo tenant ≤ 5 min` (do formulario ao email de convite enviado ao Admin Tenant). Metrica secundaria: `% de provisionamentos bem-sucedidos sem retry` (Story 3.1 saga pattern — Keycloak realm + database).

---

## User & Situation (Q3)

**Persona:** Super Admin (operador tecnico · desktop · acesso raro mas critico)

**Nome ficticio:** Paulo — desenvolvedor/operador (PRD Jornada 4). Paulo nao acessa o produto diariamente. Ele entra quando: (1) uma nova igreja faz contrato e precisa ser provisionada, (2) um Admin Tenant reporta problema, (3) precisa verificar saude geral da plataforma. **Frequencia: 2–3x por semana.** Desktop com monitor grande. Navegador Chrome. Conexao estavel.

**Situacao:** segunda-feira de manha. O pastor da Igreja Restauracao entrou em contato pedindo acesso ao produto. Paulo precisa: (1) verificar se ja existe tenant com nome similar (evitar duplicata), (2) criar o tenant, (3) enviar convite ao Admin designado. Enquanto esta la, da uma olhada rapida na lista de tenants para ver se tem algum com status `provisioning_failed` pendente.

---

## Driving Forces (Q4)

**Hope:** *"Provisionar em 5 minutos, verificar que tudo esta rodando, e sair. Sem precisar entender nada do contexto pastoral de nenhuma igreja."*

**Worry:** *"Acessar sem querer dados pastorais de uma igreja e violar a confianca."* Ou: *"Provisionamento falhar no Keycloak (saga incompleta) e eu ter que debugar manualmente."* Ou: *"Suspender o tenant errado porque a lista e confusa."*

---

## Device & Starting Point (Q5 + Q6)

**Device:** Desktop (monitor 1080p+), Chrome, conexao estavel. Teclado e mouse. Nao e mobile-first — Super Admin opera em contexto de trabalho tecnico, nao pastoral.

**Entry:** Paulo faz login via email/senha em `(public)/login`. **MFA obrigatorio** (Story 2.3) — apos email/senha, tela de TOTP aparece (Google Authenticator / Authy). Apos MFA, ExperienceResolver detecta role `super_admin` → redirect para `/app/admin/` (experiencia admin). Nao ha tela de selecao de igreja (outline 08) — Super Admin opera cross-tenant, nao pertence a nenhum tenant especifico.

---

## Best Outcome (Q7)

**User Success — Cenario A (dashboard operacional):**
Paulo faz login (email + TOTP ~15s). Dashboard de tenants aparece: lista paginada com nome, slug, plano, status, data de criacao. Filtros por status (active, suspended, provisioning_failed) e plano (free, pro, enterprise). Busca por nome/slug. Paulo ve que todos os tenants estao `active`. **~20s apos login.**

**User Success — Cenario B (provisionamento):**
Paulo toca em "Novo Tenant". Formulario: nome ("Igreja Restauracao"), slug (auto-sugerido: "igreja-restauracao", editavel), email do admin, plano (Free/Pro/Enterprise). Paulo preenche, toca "Criar". Saga executa: database → Keycloak realm → admin user. Confirmacao: *"Tenant criado. Convite enviado para admin@restauracao.org."* **~2 min do formulario ao convite.**

**Business Success:**
- Evento `tenant.provisioned` com `{ tenant_id, plan, provisioned_by }`
- Evento `tenant.status_changed` quando Paulo muda status
- Metrica: `provisioning_success_rate > 95%` (saga pattern resiliente)
- **Zero acesso a dados pastorais em qualquer endpoint de Super Admin**

---

## Shortest Path (Q8)

**Este outline tem 2 sunshine paths sequenciais** — Paulo faz A (verificar) e depois B (provisionar) na mesma sessao. Ambos lineares, zero branches.

### Cenario A — Dashboard operacional (≤ 30s apos MFA)

1. **Tela de login com MFA** — Paulo digita email/senha. Tela de TOTP aparece. Paulo abre authenticator, digita 6 digitos. Auth completa. ~15s.
2. **Dashboard de tenants** — Lista paginada de todos os tenants. Paulo filtra por status `provisioning_failed` para verificar se ha pendencias. Nenhuma. Filtra por `active` e busca por "Restauracao" para confirmar que nao existe duplicata. Nao existe. ~15s.

### Cenario B — Provisionamento de novo tenant (≤ 5 min)

3. **Formulario de provisionamento** — Paulo toca em "Novo Tenant". Preenche: nome, slug (auto-sugerido), email do admin, plano. Toca "Criar". ~1 min.
4. **Saga em execucao** — Loading indicator: *"Criando igreja... (banco de dados ✓, configurando acesso ✓, convidando admin...)"*. Se falha no Keycloak, status muda para `provisioning_failed` com opcao de retry. No sunshine path: sucesso. ~10s.
5. **Detalhe do tenant (confirmacao)** — Redirect para detalhe do tenant recem-criado. Metadata visivel: nome, slug, plano, status `active`, admin convidado, data de criacao. Convite enviado por email ao Admin designado. Paulo verifica e fecha. ✓

### Fora do sunshine (trilhos alternativos para Phase 4)

- **Provisioning falha no Keycloak (saga incompleta):** tenant status muda para `provisioning_failed`. Dashboard mostra badge. Paulo acessa detalhe → botao "Retry provisioning". Saga re-executa a partir do ponto de falha. Story 3.1 AC #4 cobre isso explicitamente.
- **Slug ja existe (conflito):** formulario retorna 409 Conflict inline. Paulo ajusta slug. Story 3.1 AC #5.
- **Paulo quer suspender um tenant:** detalhe do tenant → botao "Suspender" → confirmacao com warning (*"Todos os usuarios desse tenant serao desconectados"*) → sessoes Keycloak invalidadas. Story 3.2 AC #5. **Acao irreversivel com confirmacao obrigatoria.**
- **Paulo quer ver metricas agregadas da plataforma:** FR67 + Story 13.4 = **Release 2**. No MVP, Paulo ve apenas a lista de tenants com metadata (contagem de membros como aggregate). Dashboard de metricas e feature futura.
- **Paulo quer exportar lista de tenants:** FR68 = **Release 1b**. No MVP, nao ha export.
- **Paulo quer mudar plano de um tenant (Free → Pro):** Epic 11 Story 11.1 = **Release 1b**. No MVP, planos sao hardcoded (Story 3.3) e so mudam via banco diretamente.

---

## Trigger Map Connections

**Persona:** Super Admin (operador tecnico · desktop · `/app/admin/*`)

**Nao ha persona formal no Trigger Map** — este outline usa persona sintetica (Paulo, PRD Jornada 4). Driving forces inferidas da separacao de concerns arquitetural:

- ✅ **Want:** *"Operar a plataforma sem entender o contexto pastoral — o produto deve funcionar para as igrejas, eu cuido da infra"*
- ❌ **Fear:** *"Acessar dados que nao sao da minha alcada — participantes, presencas, reflexoes"*
- ❌ **Fear:** *"Provisioning falhar e eu ter que intervir manualmente no banco/Keycloak"*

**Business Goal:** Operacao segura e escalavel — cada tenant criado em ≤ 5 min, zero acesso a dados pastorais, saga resiliente.

**Conexao com outline 05:** o Admin Tenant (Claudia) que faz onboarding no outline 05 **recebe o convite que Paulo enviou** no outline 09. O provisionamento do Paulo (outline 09 step B) e o passo anterior ao onboarding da Claudia (outline 05 step 05.1).

**Conexao com outline 08:** o tenant que Paulo cria no outline 09 e um dos tenants que aparecem na tela de selecao do outline 08 para usuarios multi-tenant.

---

## Scenario Steps

| Step | Rotulo semantico | Rota | Purpose | Exit Action |
|------|------------------|------|---------|-------------|
| 09.1 | `09.1-login-mfa/` | `(public)/login` + TOTP | Auth com MFA (Story 2.3) | Redirect para dashboard |
| 09.2 | `09.2-dashboard-tenants/` | `/app/admin/tenants` (FR18 Story 3.2) | Lista paginada + filtros + busca | Verificar status / clicar "Novo Tenant" |
| 09.3 | `09.3-provisionar-tenant/` | `/app/admin/tenants/novo` (Story 3.1) | Formulario + saga execution | Redirect para detalhe |
| 09.4 | `09.4-detalhe-tenant/` | `/app/admin/tenants/[id]` (FR19 Story 3.2) | Confirmacao + metadata | Fechar / voltar ao dashboard ✓ |

**Nota:** este e o primeiro outline com sunshine path **sequencial** (A → B), nao paralelo como 07 e 08. Paulo faz verificacao (steps 1-2) e depois provisiona (steps 3-4) na mesma sessao.

**Rotas referenciadas:**
- `(public)/login` — ja implementada (`apps/web/app/(public)/login/page.tsx`)
- `/app/admin/tenants` — **nao existe no codigo** (Story 3.2, Sprint 4)
- `/app/admin/tenants/novo` — **nao existe no codigo** (Story 3.1, Sprint 4)
- `/app/admin/tenants/[id]` — **nao existe no codigo** (Story 3.2, Sprint 4)

Todas as rotas de Super Admin estao no Sprint 4 (Epic 3) e serao implementadas apos Epic 2 (auth completa).

---

## Release Gate Audit

### Features com story/FR real no Release 1a

| Elemento | Release gate | Epic / Story | Nota |
|---|---|---|---|
| MFA obrigatorio (TOTP) | ✅ **Release 1a** | Story 2.3 (Sprint 2) | Keycloak conditional auth flow |
| Lista de tenants paginada | ✅ **Release 1a** | FR18, Story 3.2 (Sprint 4) | `GET /api/v1/admin/tenants` |
| Detalhe do tenant (metadata) | ✅ **Release 1a** | FR19, Story 3.2 (Sprint 4) | `GET /api/v1/admin/tenants/:id` |
| Editar tenant (nome, status) | ✅ **Release 1a** | Story 3.2 (Sprint 4) | `PATCH /api/v1/admin/tenants/:id` |
| Provisionamento transacional | ✅ **Release 1a** | Story 3.1 (Sprint 4) | Saga: database → Keycloak realm → admin user |
| Guard de limites hardcoded | ✅ **Release 1a** | Story 3.3 (Sprint 4) | Free/Pro/Enterprise com limites fixos |
| PrismaAdminService (bypass RLS) | ✅ **Release 1a** | Story 3.2 | Connection pool separado, sem RLS |

### Features em Release 1b+ (fora do escopo deste outline)

| Elemento | Release gate | Epic / Story | Nota |
|---|---|---|---|
| Planos dinamicos (CRUD) | Release 1b | Epic 11, FR13, Story 11.1 | Substitui hardcoded limits |
| Upgrade requests (aprovacao) | Release 1b | Epic 11, FR17, Story 11.4 | Super Admin aprova pedidos |
| Export CSV | Release 1b | Epic 8, FR68 | Nao ha export no MVP |
| Branding por tenant | Release 1b | FR15 | Sem customizacao visual no MVP |
| Feature toggles por tenant | Release 1b | FR16 | Todos os tenants iguais no MVP |
| Metricas de plataforma | Release 2 | Epic 13, FR67, Story 13.4 | Dashboard agregado futuro |
| Deteccao de risco de evasao | Release 2 | Epic 13, Story 13.3 | Semaforo automatico futuro |

### Debitos e DDRs

**DDR 1 — URL paths especificos dentro de `/app/admin/super/*` nao definidos:**
UX-DR25 em `docs/architecture.md` ja lista as telas do Super Admin sob `/app/admin/super/*`: *"control plane dashboard, provisionamento tenant (wizard 3 steps), audit log, metricas cross-tenant"*. O que **falta** sao os URL paths especificos dentro desse subtree (ex: `/app/admin/super/tenants`, `/app/admin/super/tenants/novo`, `/app/admin/super/tenants/[id]`). As rotas existem como conceito; os paths concretos nao.

**Proposta:** definir paths canonicos: `/app/admin/super/tenants` (lista), `/app/admin/super/tenants/novo` (provisionamento), `/app/admin/super/tenants/[id]` (detalhe). Guard `@Roles('super_admin')` no route group.

**Acao de grooming:** documentar URL paths especificos em `docs/architecture.md` sob UX-DR25.

**DDR 2 — Persona do Super Admin nao existe como artefato formal:**
Este outline usa persona sintetica (Paulo, PRD Jornada 4) mas nao ha arquivo em `design-process/B-Trigger-Map/personas/`. Os 6 roles RBAC deveriam ter personas correspondentes para completude.

**Proposta:** criar `design-process/B-Trigger-Map/personas/07-operator-persona-super-admin.md` com: Snapshot (Paulo, desenvolvedor/operador), Mental Model (infraestrutura > pastoral), Driving Forces (eficiencia operacional vs. medo de invadir dados), UX Implications (desktop-dense, tabular, zero dados pastorais).

**Acao de grooming:** agendar criacao da persona antes do Phase 4 wireframes.

**DDR 3 — Feedback visual da saga de provisionamento:**
Story 3.1 documenta o saga pattern (database → Keycloak → admin user) e o status `provisioning_failed` com retry. Mas **nao especifica a UX do loading state** — o Paulo ve um spinner generico? Um stepper com checkmarks? Uma barra de progresso?

**Proposta:** stepper com 3 etapas visuais: *"Criando banco de dados ✓"* → *"Configurando acesso ✓"* → *"Convidando administrador..."*. Se falhar, o step com falha fica vermelho com botao retry. Tom tecnico (nao pastoral — Paulo e operador, nao pastor).

**Acao de grooming:** definir componente de loading da saga no Phase 4 wireframes.

---

## Vetos permanentes

| Elemento | Status |
|---|---|
| Super Admin ver dados pastorais (radar, presencas, acoes de cuidado) | ❌ Veto permanente (separacao arquitetural via PrismaAdminService) |
| Super Admin ver dados de participantes individuais | ❌ Veto permanente (so aggregates — contagem, nao nomes) |
| Suspensao de tenant sem confirmacao explicita | ❌ Veto permanente (acao irreversivel com warning obrigatorio) |
| MFA desabilitado para Super Admin | ❌ Veto permanente (Story 2.3 obrigatorio) |
| Tom pastoral nas telas de Super Admin | ❌ Veto — tom **tecnico/operacional**, nao pastoral (Paulo nao e pastor) |
| Provisioning sem saga (operacao nao-transacional) | ❌ Veto permanente (Story 3.1 exige saga: rollback se Keycloak falhar) |

---

## Tone audit (glossario banido)

Verificacao com **nuance:** o glossario banido se aplica a mensagens user-facing **para personas pastorais** (lider, participante, pastor). Para o Super Admin (operador tecnico), o vocabulario muda:

**Termos OK para Super Admin que sao banidos para outros roles:**
- "dashboard" → **OK** para Super Admin (e dashboard operacional, nao "dashboard ao lider")
- "metricas" → **OK** como metricas de plataforma (nao metricas de engajamento humano)
- "relatorio" → **OK** como relatorio operacional (nao "relatorio ao lider")
- "status" → **OK** como status do tenant (nao status pastoral)

**Termos AINDA banidos mesmo para Super Admin:**
- monitorar (pessoas) · rastrear (pessoas) · frequencia (de participantes) · engajamento (humano) · rebanho · score · ranking · check-in (de pessoas) · KPI (pastoral) · leaderboard

**Regra:** o Super Admin opera sobre **tenants e infraestrutura**, nunca sobre **pessoas e pastoral**. Termos operacionais sobre coisas sao OK; termos de vigilancia sobre pessoas sao veto permanente.

---

## Conexao com outros outlines

- **Outline 05 (admin-faz-onboarding-minimo):** o provisionamento do outline 09 (Paulo cria tenant) e o **passo anterior** ao onboarding do outline 05 (Claudia recebe convite e configura a igreja). O email que Paulo envia no step 09.4 e o que Claudia recebe no step 05.0 (implicito).
- **Outline 08 (usuario-troca-de-igreja):** os tenants que aparecem na tela de selecao do outline 08 foram criados pelo Super Admin no outline 09. Se Paulo criar "Igreja Restauracao" e Marcos for convidado para la, Marcos vera 3 tenants no switcher.
- **Outline 03 (pastor-abre-vista-agregada):** o Pastor (Admin Tenant) ve dados pastorais do seu tenant. O Super Admin **nunca** ve esses mesmos dados — mesmo tendo acesso cross-tenant. A separacao e absoluta: Admin Tenant ve carta, Super Admin ve envelope.
- **Outline 01 (lider-vence-a-quarta-de-manha):** o radar que Marcos ve no outline 01 funciona porque o tenant foi provisionado corretamente no outline 09. Se a saga falhar, o tenant nao existe, e o Marcos nao tem app para abrir.

---

_Outlined sob Phase 3 — UX Scenarios · Mode: Suggest com checkpoint por cenario · Override pastoral × edtech: neste outline, a linha **operacional** governa (Super Admin nao e pastor, e operador) · Separacao absoluta: Super Admin ve **envelope** (tenants, planos, status), nunca **carta** (pastoral, presencas, cuidado) · PrismaAdminService como padrao arquitetural unico — connection pool separado, sem RLS · 3 DDRs: rotas de Super Admin, persona formal, UX da saga de provisionamento · Tom tecnico/operacional, nao pastoral — glossario banido ajustado para contexto de operador · Persona sintetica (Paulo, PRD Jornada 4) — acao de grooming para formalizar · Este e o 9o e ultimo outline da Phase 3 Step 05._
