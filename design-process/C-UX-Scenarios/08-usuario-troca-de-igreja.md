---
design_intent: D
design_status: not-started
phase4_note: "DDRs obrigatórios no wireframe: rota (auth)/selecionar-igreja, posição do tenant switcher (header 1-tap), cache invalidation on tenant switch"
---

# 08: Usuario troca de igreja sem perder nada

**Project:** metanoia-hub
**Created:** 2026-04-11
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios
**Scenario type:** Screen Flow (edge case · mobile-first · multi-tenant switch)
**Priority:** ⭐ Priority 2 — Edge case de retenção (usuario pertence a 2+ tenants)
**Release gate:**
- **Multi-tenant association (FR03) — Release 1a.**
- **Tenant selection (FR10, Story 2.5) — Release 1a (Sprint 3).**
- **RLS isolation (Story 2.6) — Release 1a (Sprint 3).**
- **Plan association + upgrade prompt (FR13, FR17) — Release 1b.**

---

## ⚠️ Nota de rastreabilidade — rotulos semanticos

Seguindo o padrao 11 consolidado no outline 06, este outline usa **rotulos semanticos** para telas em vez de numeracao `#N` nao verificada. Consolidacao no Step 06 hub (`00-ux-scenarios.md`).

**Rotulos semanticos usados neste outline:**
- **Tela de login** — rota `(public)/login`, ja implementada (`apps/web/app/(public)/login/page.tsx`)
- **Tela de selecao de igreja** — FR10 Story 2.5 (Release 1a, Sprint 3) — rota provavel `(auth)/selecionar-igreja` (ver DDR abaixo)
- **Tenant switcher** — componente de navegacao (sidebar ou bottom tabs) para troca mid-session — FR10 Story 2.5 AC #4
- **Tela principal lider** — rota `/app/gestao/` (experiencia consolidada, UX-DR22-25)
- **Tela principal participante** — rota `/app/consumo/` (experiencia consolidada, UX-DR22-25)

---

## Nota de persona — por que este edge case e critico

No contexto evangelico brasileiro, **mobilidade entre igrejas e comum e nao e tabu.** Um lider pode servir como voluntario em 2 comunidades (grupo de jovens numa igreja, grupo de casais noutra). Um participante pode mudar de bairro e frequentar uma igreja nova sem romper lacos com a anterior. Um pastor pode ser convidado a assessorar uma igreja-filha por temporada.

O produto suporta isso by design (FR03: "um mesmo usuario associado a multiplos tenants"). Mas se a experiencia de **trocar de contexto** for confusa, burocrática ou lenta, o usuario mais fragil (lider voluntario com 3 minutos antes do trabalho) simplesmente para de usar o app na segunda igreja — e o ciclo pastoral daquela comunidade perde visibilidade.

**Este cenario e o teste de verdade do multi-tenancy:** nao como feature tecnica (RLS, AsyncLocalStorage, Prisma extension), mas como **experiencia pastoral** — trocar de igreja precisa ser tao natural quanto trocar de conversa no WhatsApp.

**Mapeamento RBAC:** este outline usa o **Lider** como persona primaria (role real, experiencia `/app/gestao/*`), mas o fluxo se aplica identicamente a qualquer dos 6 roles com multi-tenant association. A tela de selecao de igreja e universal.

---

## Transaction (Q1)

**What this scenario covers:**
Do momento *"fiz login e o app me pergunta em qual igreja eu quero entrar"* ate *"estou vendo o radar da igreja certa, com os dados certos, sem nada misturado"*. Cobre 2 situacoes:
- **(A) Login com 2+ tenants:** tela de selecao aparece automaticamente apos auth
- **(B) Troca mid-session:** usuario ja esta logado numa igreja e quer mudar para outra sem fazer logout

**O cenario NAO cobre:** criacao de novo tenant (outline 05, Epic 3), convite para novo tenant (outline 06, Epic 4), desvinculacao de tenant, migracao de dados entre tenants (fora do MVP), nem gestao de planos por tenant (FR13/FR17, Release 1b).

---

## Business Goal (Q2)

**Goal:** `Garantir que usuarios multi-tenant percebam cada igreja como contexto isolado e seguro, sem atrito de troca, preservando confianca no isolamento de dados`

**Objective:** `% de usuarios multi-tenant que completam tenant switch em ≤ 5s` — metrica de fluidez do multi-tenancy. Se a troca for lenta ou confusa, o usuario consolida uso numa so igreja e a outra perde visibilidade pastoral.

---

## User & Situation (Q3)

**Persona:** Lider (⭐ Primary target · mobile Android gama media-baixa · rotina de quarta de manha)

**Nome ficticio:** Marcos — o mesmo Marcos do outline 01 e 07. Marcos lidera o grupo "Fundamentos da Fe" na **Igreja Vida Nova** (tenant principal). Recentemente, o pastor da **Igreja Graca Plena** (igreja vizinha, menor) pediu que Marcos tambem liderasse um grupo de acolhimento la nas quartas a noite. Marcos aceitou. Agora ele pertence a **2 tenants**.

**Situacao:** quarta de manha, 6h15. Marcos faz login no app (cenario 01 / cenario 07). O app detecta 2 tenants associados ao seu usuario. Em vez de ir direto pro radar, aparece a **Tela de selecao de igreja** perguntando: *"Em qual comunidade voce quer entrar?"*

**Segunda situacao (mid-session):** quarta a noite, 19h45. Marcos esta no radar da Igreja Vida Nova. Lembra que precisa ver o radar da Igreja Graca Plena antes da reuniao das 20h. Precisa trocar de contexto **sem fazer logout**.

---

## Driving Forces (Q4)

**Hope:** *"Entrar na igreja certa com 1 toque, ver so os dados daquela comunidade, e trocar quando precisar — como se fossem 2 apps separados que moram no mesmo lugar."*

**Worry:** *"Ver dados da Igreja Graca Plena enquanto estou olhando o radar da Vida Nova — ou pior, registrar uma acao de cuidado na igreja errada."* Ou: *"Ter que fazer logout e login de novo toda vez que trocar."* Ou: *"A igreja menor (Graca Plena) ver que eu tambem lidero na Vida Nova — isso nao e da conta deles."*

---

## Device & Starting Point (Q5 + Q6)

**Device:** Mobile Android gama media-baixa (Moto G4/G5 floor), conexao Wi-Fi (manha) ou 4G (noite, antes da reuniao). Uma mao.

**Entry (Cenario A):** Login bem-sucedido (Story 2.1/2.2, ja implementado) → sistema detecta `user_tenants.count > 1` → redirect para **Tela de selecao de igreja** (FR10, Story 2.5, Release 1a). Se `user_tenants.count == 1`, auto-select e skip (Story 2.5 AC #3).

**Entry (Cenario B):** Usuario ja esta logado e no contexto da Igreja Vida Nova. Acessa o **Tenant switcher** no menu de navegacao (sidebar desktop / bottom sheet mobile) → seleciona Igreja Graca Plena → contexto troca imediatamente.

---

## Best Outcome (Q7)

**User Success — Cenario A (login com 2 tenants):**
Marcos faz login. Tela de selecao mostra 2 cartoes: *"Igreja Vida Nova"* (role: Lider) e *"Igreja Graca Plena"* (role: Lider). Marcos toca em *"Vida Nova"*. Radar aparece com os dados so da Vida Nova. **≤ 3s apos o toque.** Sensacao: *"Simples. Cada igreja e cada igreja."*

**User Success — Cenario B (troca mid-session):**
Marcos toca no nome da igreja no header/sidebar → bottom sheet com 2 opcoes → toca *"Graca Plena"* → tela recarrega com dados da Graca Plena. **≤ 2s.** Zero logout. Zero re-auth. Sensacao: *"Troquei de igreja como troco de conversa."*

**Business Success:**
- Evento `tenant.switch.completed` com `{ from_tenant_id, to_tenant_id, switch_duration_ms }`
- Metrica: `tenant_switch_time ≤ 5s` (target operacional)
- **Zero vazamento de dados cross-tenant** — RLS + Prisma extension + AsyncLocalStorage garantem isolamento (Story 2.6)
- Usuarios multi-tenant mantem uso ativo em **ambos** os tenants (retenção do tenant secundario)

---

## Shortest Path (Q8)

**Este outline tem 2 sunshine paths paralelos** — ambos lineares, zero branches. O cenario A (selecao pos-login) e o caminho padrao; o cenario B (troca mid-session) e o caminho recorrente.

### Cenario A — Selecao de igreja pos-login (≤ 5s apos auth)

1. **Login** — Marcos faz login via email/senha ou Google OAuth (Story 2.1/2.2, ja implementado). Auth bem-sucedida. ~8s.
2. **Tela de selecao de igreja** — Sistema detecta 2 tenants. Mostra cartoes com: nome da igreja, role do Marcos naquela igreja (ex: "Lider"), status do plano. Marcos toca em **"Igreja Vida Nova"**. ~3s.
3. **Tela principal lider** — `tenant_id` da Vida Nova injetado no RequestContext via AsyncLocalStorage. ExperienceResolver redireciona para `/app/gestao/`. Radar aparece com dados so da Vida Nova. ✓

### Cenario B — Troca mid-session (≤ 2s)

1. **Tela principal lider (Igreja Vida Nova)** — Marcos esta no radar. Toca no **nome da igreja** no header da navegacao (ou icone de troca). ~1s.
2. **Tenant switcher** — Bottom sheet (mobile) ou dropdown (desktop) mostra lista de igrejas associadas. Marcos toca em **"Igreja Graca Plena"**. ~1s.
3. **Tela principal lider (Igreja Graca Plena)** — `tenant_id` atualizado no RequestContext. TanStack Query invalida cache do tenant anterior. Dados da Graca Plena carregados. Radar aparece com dados so da Graca Plena. ✓

### Fora do sunshine (trilhos alternativos para Phase 4)

- **Marcos tem 1 so tenant:** tela de selecao e skippada automaticamente (Story 2.5 AC #3). Vai direto pro dashboard. Nao ve o switcher? **Decisao de design para Phase 4:** (a) esconder switcher completamente se 1 tenant, ou (b) mostrar switcher desabilitado com hint "Voce esta em 1 comunidade". Recomendacao: (a) esconder — menos ruido visual.
- **Um dos tenants tem plano expirado (FR13, FR17 — Release 1b):** Story 2.5 AC #5 preve indicador visual ("Plano expirado") e acesso limitado com prompt de upgrade. **Fora do escopo 1a-beta** — no MVP, todos os tenants sao acessiveis sem restricao de plano (planos sao hardcoded Free, Story 3.3).
- **Marcos e convidado para um terceiro tenant:** a associacao acontece via convite (outline 06, Epic 4 FR23). Apos aceitar, o terceiro tenant aparece na tela de selecao e no switcher automaticamente. Nao requer acao extra.
- **Admin Tenant de uma igreja ve que Marcos tambem lidera noutra:** **impossivel by design.** RLS garante que Admin da Igreja Vida Nova nao ve a associacao do Marcos com Igreja Graca Plena. A tabela `user_tenants` e filtrada por `tenant_id`. Cada tenant so ve seus proprios membros.
- **Marcos quer sair de um tenant:** desvinculacao de tenant e feature nao mapeada (sem FR, sem Story). Edge case de segundo nivel — para MVP, Admin Tenant remove o membro via Story 2.7 (Gestao de Usuarios).

---

## Trigger Map Connections

**Persona:** Lider (⭐ Primary target · `/app/gestao/*` · mobile Android)

**Driving Forces Addressed** (puxadas de `design-process/B-Trigger-Map/personas/02-primary-persona-lider-de-grupo.md`):

- ✅ **Want:** *"Vencer a quarta-feira de manha no celular"* — a selecao de tenant NAO pode adicionar atrito ao cenario-ancora 01. Se Marcos pertence a 2 igrejas, o passo extra deve ser ≤ 3s
- ❌ **Fear:** *"Fadiga de ferramenta"* — se trocar de igreja for complicado (logout, re-login, configuracao), Marcos para de usar o app na segunda igreja
- ❌ **Fear:** *"Medo de virar fiscal"* — o isolamento de dados deve ser tao claro que Marcos nunca teme que "a outra igreja" veja o que ele faz aqui

**Business Goal:** Retencao do tenant secundario — garantir que usuarios multi-tenant mantenham uso ativo em todas as comunidades, nao so na principal.

**Conexao com outline 01:** a **Tela de selecao de igreja** e um passo intermediario entre o login (step 01.0 implicito) e o radar (step 01.1). Se Marcos tem 1 tenant, esse passo e invisivel (auto-select). Se tem 2+, adiciona ~3s. O outline 08 garante que esse passo extra nao quebra a cadencia do cenario-ancora.

**Conexao com outline 05:** o Admin Tenant (Claudia) que fez onboarding no outline 05 criou o tenant. Se ela administra 2 igrejas, ela tambem ve a tela de selecao — mas com role "Admin Tenant" em vez de "Lider". O switcher e universal.

**Conexao com outline 06:** quando Juliana (participante) aceita o convite do outline 06 e depois e convidada para outra igreja, ela herda automaticamente o fluxo do outline 08.

---

## Scenario Steps

| Step | Rotulo semantico | Rota | Purpose | Exit Action |
|------|------------------|------|---------|-------------|
| 08.A1 | `08.A1-login/` | `(public)/login` | Auth bem-sucedida (Story 2.1/2.2) | Redirect para selecao de igreja |
| 08.A2 | `08.A2-selecionar-igreja/` | `(auth)/selecionar-igreja` (FR10 Story 2.5) | Escolher tenant ativo entre 2+ opcoes | Toque no cartao → redirect para experiencia |
| 08.A3 | `08.A3-radar-lider/` | `/app/gestao/` | Radar pastoral com dados do tenant selecionado | Ciclo pastoral retomado ✓ |
| 08.B1 | `08.B1-radar-lider-vida-nova/` | `/app/gestao/` | Usuario no contexto da Igreja Vida Nova | Toque no tenant switcher |
| 08.B2 | `08.B2-tenant-switcher/` | Componente overlay (bottom sheet / dropdown) | Selecionar outro tenant | Toque na igreja → context switch |
| 08.B3 | `08.B3-radar-lider-graca-plena/` | `/app/gestao/` | Radar pastoral com dados do novo tenant | Ciclo pastoral da segunda igreja ✓ |

**Nota de cenarios paralelos:** mesmo padrao do outline 07 — 2 sunshine paths (A e B), ambos lineares. O cenario A (selecao pos-login) tem 3 steps. O cenario B (troca mid-session) tem 3 steps. Nao ha branches condicionais.

**Rotas referenciadas:**
- `(public)/login` — ja implementada (`apps/web/app/(public)/login/page.tsx`)
- `(auth)/selecionar-igreja` — **rota nao documentada em architecture.md** (ver DDR abaixo)
- `/app/gestao/` — experiencia consolidada do lider (UX-DR22-25)

---

## Release Gate Audit

### Features com story/FR real no Release 1a

| Elemento | Release gate | Epic / Story | Nota |
|---|---|---|---|
| Multi-tenant association | ✅ **Release 1a** | FR03 | Usuario pode estar em 2+ tenants |
| Tenant selection on access | ✅ **Release 1a** | FR10, Story 2.5 (Sprint 3) | Tela de selecao + auto-select se 1 tenant |
| RLS isolation | ✅ **Release 1a** | Story 2.6 (Sprint 3) | Prisma extension + PostgreSQL RLS + AsyncLocalStorage |
| Tenant switcher mid-session | ✅ **Release 1a** | Story 2.5 AC #4 | Explicitamente no acceptance criteria |
| Login email/senha + Google OAuth | ✅ **Release 1a (mergeado)** | Story 2.1 (PR #19), Story 2.2 (PR #20) | Prerequisito |

### Features em Release 1b+ (fora do escopo deste outline)

| Elemento | Release gate | Epic / Story | Nota |
|---|---|---|---|
| Indicador de plano expirado na selecao | Release 1b | FR13, FR17, Story 2.5 AC #5 | No MVP, planos sao hardcoded Free (Story 3.3) |
| Branding por tenant (logo, cores) | Release 1b | FR15 | Cartoes de selecao sem branding customizado no 1a |
| Feature toggles por tenant | Release 1b | FR16 | Todos os tenants tem mesmas features no 1a |

### Debitos e DDRs

**DDR 1 — Rota da tela de selecao de igreja:**
A Story 2.5 documenta o comportamento (tela de selecao, auto-select, switcher mid-session) mas **nenhuma rota especifica** e definida em `docs/architecture.md`. As 3 experiencias consolidadas (`/app/consumo/*`, `/app/gestao/*`, `/app/admin/*`) sao pos-tenant-selection. A tela de selecao vive em um **estado intermediario pos-auth, pre-experience**.

**Proposta (2 variantes):**
- **Opcao A (recomendada):** rota `(auth)/selecionar-igreja` sob route group `(auth)/` — requere autenticacao mas nao requere tenant_id no contexto (porque e justamente o momento de escolher). Middleware Next.js redireciona para ca se `user_tenants.count > 1` e nenhum tenant esta selecionado.
- **Opcao B:** componente modal pos-login em vez de rota dedicada — menos clean mas evita rota adicional.

**Acao de grooming:** definir rota canonica para tenant selection e documentar em `docs/architecture.md` como quarto estado de rota (`(public)/` → `(auth)/` → `(app)/`).

**DDR 2 — Tenant switcher: componente de navegacao:**
A Story 2.5 AC #4 diz *"tenant switcher allows selection; context switches immediately"* mas nao especifica **onde** na UI o switcher fica. Para mobile (sidebar/bottom tabs do layout base Story 1.8), o switcher precisa ser acessivel sem scroll, sem menu profundo.

**Proposta:** nome da igreja como elemento tappable no **header** da navegacao (topo da sidebar em desktop, topo do bottom sheet em mobile). Toque abre bottom sheet com lista de igrejas. Padrao visual: similar ao seletor de workspace do Slack/Notion.

**Acao de grooming:** definir posicao exata do tenant switcher no layout base (Story 1.8) e documentar interacao.

**DDR 3 — Cache invalidation on tenant switch:**
Quando Marcos troca de Vida Nova para Graca Plena, todos os dados cacheados pelo TanStack Query precisam ser invalidados ou re-fetched com o novo `tenant_id`. A Story 2.5 AC #4 diz *"previous tenant's data no longer accessible in UI"* mas nao documenta a estrategia de cache.

**Proposta:** TanStack Query `queryClient.invalidateQueries()` global on tenant switch, ou — mais eficiente — usar `tenant_id` como parte da query key (ex: `['groups', tenantId]`), fazendo com que a troca de tenant busque dados frescos automaticamente sem invalidar cache do tenant anterior (util se Marcos voltar para Vida Nova depois).

**Acao de grooming:** definir estrategia de cache key com `tenant_id` prefix e documentar em `docs/architecture.md` (TanStack Query patterns).

**Nota de grooming — ExperienceResolver e roles diferentes por tenant:**
Quando Marcos tem roles diferentes nos 2 tenants (ex: **Lider** na Vida Nova → `/app/gestao/`, **Participante** na Graca Plena → `/app/consumo/`), o ExperienceResolver muda a experiencia inteira no switch. A transicao de layout/navegacao (sidebar de gestao → bottom tabs de consumo) pode ser perceptivel e desorientadora. **Acao de UX para Phase 4:** wireframe de transicao suave entre experiencias no tenant switch, com feedback visual claro de qual role o usuario tem naquele contexto (*"Voce lidera aqui"* vs. *"Voce participa aqui"*). O cartao de selecao ja mostra o role — garantir que a transicao honre essa expectativa.

---

## Vetos permanentes

| Elemento | Status |
|---|---|
| Logout/re-login para trocar de tenant | ❌ Veto permanente (Story 2.5 AC #4 garante switch sem re-auth) |
| Dados de um tenant visiveis no contexto de outro | ❌ Veto permanente (RLS + AsyncLocalStorage + Prisma extension) |
| Admin de um tenant ver associacoes do usuario com outros tenants | ❌ Veto permanente (RLS filtra `user_tenants` por `tenant_id`) |
| Tenant switcher escondido em menu profundo (3+ taps para acessar) | ❌ Veto permanente (deve estar acessivel em 1 tap do header) |
| Mensagem "Voce esta saindo da Igreja X" com tom de alerta | ❌ Veto permanente (troca e natural, nao e "saida" — tom pastoral) |

---

## Tone audit (glossario banido)

Verificacao interna — nenhuma ocorrencia user-facing de termos banidos. ✅

**Vocabulario adotado para multi-tenant:**
- "tenant" (tecnico) → *"comunidade"* ou *"igreja"* (user-facing)
- "switch tenant" → *"trocar de igreja"* ou *"entrar em [nome]"*
- "tenant selection" → *"Em qual comunidade voce quer entrar?"*
- "multi-tenant" → nunca aparece user-facing
- "isolated context" → nunca aparece user-facing
- "data isolation" → nunca aparece user-facing (RLS e invisivel ao usuario)

**Tom dos cartoes de selecao:** cada cartao mostra o **nome da igreja** (nao "Tenant #2"), o **role do usuario** naquela igreja em linguagem pastoral (*"Voce lidera aqui"* em vez de *"Role: Lider"*), e opcionalmente um indicador visual de ultima visita (*"Ultima vez: segunda passada"*).

---

## Conexao com outros outlines

- **Outline 01 (lider-vence-a-quarta-de-manha):** a tela de selecao de igreja e um passo intermediario que pode aparecer antes do step 01.1 (radar). Para usuarios com 1 tenant, esse passo e invisivel. Para usuarios com 2+, adiciona ~3s. O outline 08 garante que esse passo nao quebra a rotina da quarta.
- **Outline 05 (admin-faz-onboarding-minimo):** o Admin Tenant que fez onboarding criou o tenant. Se essa pessoa administra 2 igrejas, o fluxo de selecao e identico — muda apenas o role exibido no cartao.
- **Outline 06 (participante-recebe-cuidado-com-dignidade):** Juliana que aceitou convite para 1 igreja nao ve tela de selecao (auto-select). Se for convidada para segunda igreja, passa a ver — com role "Participante" nos cartoes.
- **Outline 07 (lider-recupera-acesso):** apos recovery de senha (cenario B do outline 07), se Marcos tem 2+ tenants, o redirect pos-recovery vai para a tela de selecao (nao direto pro radar). O outline 08 e o passo seguinte do outline 07 para usuarios multi-tenant.

---

_Outlined sob Phase 3 — UX Scenarios · Mode: Suggest com checkpoint por cenario · Override pastoral × edtech: linha pastoral governa em qualquer conflito · Este cenario testa o multi-tenancy como **experiencia pastoral** (nao como feature tecnica) — trocar de igreja precisa ser tao natural quanto trocar de conversa · 3 DDRs identificados: rota de selecao de igreja, posicao do tenant switcher na UI, estrategia de cache invalidation on switch · Vocabulario user-facing: "comunidade" e "igreja", nunca "tenant" · Isolamento cross-tenant e invisivel ao usuario mas absoluto por design (RLS + AsyncLocalStorage + Prisma extension) · Padrao replicado: outline 08 segue mesmo formato de 2 sunshine paths paralelos do outline 07._
