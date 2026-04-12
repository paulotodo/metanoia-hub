---
design_intent: S
design_status: not-started
---

# 03: Pastor abre a vista agregada e sabe quem ligar até terça

**Project:** metanoia-hub
**Created:** 2026-04-11
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios
**Scenario type:** Storyboard (desktop, densidade invertida)
**Priority:** ⭐ Priority 1 — Critical Path (segundo comprador / secondary buyer)
**Release gate:** ⚠️ Parte em MVP Release 1a-beta · vista agregada tenant (FR60) atualmente em Release 2 → ver seção Release Gate Audit para débito explícito

---

## Nota terminológica (persona narrativa vs. role RBAC)

Neste outline, **"pastor"** é **vocabulário narrativo/pastoral** — captura o que a pessoa *faz* (pastorear líderes) e o que ela *sente* (responsabilidade relacional). **Não é um role RBAC**. Os 6 roles do sistema são: Super Admin, Admin Tenant, Editor de Conteúdo, Líder, Participante, Auditor (PRD §RBAC + Keycloak).

Na prática, **o Pastor Titular da igreja mapeia para o role `Admin Tenant`**. É quem assina o contrato, é quem administra o tenant, e é quem tem acesso ao FR60 (vista agregada do tenant). O Admin Tenant usa a experiência consolidada `/app/admin/*` (UX-DR22 a 25 — decisão arquitetural de 3 experiências, não 6 rotas role-based).

Quando o outline usa "pastor" na narrativa, trata-se do **humano por trás do Admin Tenant**. Quando aparece "Admin Tenant", trata-se do **role técnico no RBAC**. O UI visível ao usuário chama-o de "Admin" ou "Administração da Igreja" — nunca "Pastor" como rótulo de interface, para evitar presumir papel eclesiástico do usuário técnico.

---

## Transaction (Q1)

**What this scenario covers:**
Abrir a vista agregada dos grupos da igreja num notebook na sala pastoral, ver em 5 minutos onde a atenção do pastor é necessária (não de qualquer líder — do pastor), entrar no grupo específico, ver o contexto do líder que conduz aquele grupo, e sair com 1 ação concreta: *"Vou ligar para o João hoje à tarde."* A transação é de **cuidar do cuidado** — o pastor não está fiscalizando líderes, está sendo pastoreador deles.

---

## Business Goal (Q2)

**Goal:** `Pastor enxerga o cuidado acontecendo sem virar auditor` (Trigger Map · Business Goal B2)
**Objective:** `% semanas com ≥1 contato intencional pastor→líder originado na vista agregada` — métrica de health do loop pastoral, mensurada a partir do MVP Release 1a-beta.

A transação materializa o princípio raiz *"Presença digital ≠ saúde espiritual"* aplicado ao pastor: a vista existe para **abrir uma conversa humana**, nunca para substituí-la por um número no painel. Traduz o desejo do pastor de não ser pego de surpresa em conversas informais no corredor da igreja ("Pastor, o João sumiu do grupo do Pedro") sem transformá-lo em operador de central de vigilância.

---

## User & Situation (Q3)

**Persona:** Pastor Titular (⭐ Secondary Buyer · Desktop densidade invertida) — mapeamento RBAC: `Admin Tenant`. É o comprador do SaaS (decide o contrato anual), mas usa o produto diferente do líder: menos frequentemente, com mais densidade por sessão, num device melhor, numa janela de foco maior.

**Situation:**
Domingo, 14h20. O culto das 10h acabou, o almoço com a família foi rápido, e o pastor voltou ao escritório da igreja para 30 minutos de quieto antes da reunião de ministérios às 15h. Notebook na mesa, café ao lado, porta fechada. Essa é uma das duas janelas semanais em que ele olha para a vista agregada — a outra é segunda-feira de manhã. Ele precisa sair dessa janela com clareza de: (1) os 12 grupos da igreja estão bem em geral? (2) tem algum grupo onde a *dinâmica* merece conversa com o líder (não por métrica ruim, mas por sinal relacional)? (3) qual líder ele precisa procurar essa semana, e com qual pergunta abrir?

---

## Driving Forces (Q4)

**Hope:** Sair da tela em 10 minutos sabendo o nome de 1 ou 2 líderes que ele quer procurar essa semana, e uma pergunta de abertura para cada — não um diagnóstico, uma conversa. *"Vou ligar para o João e perguntar como ele está vendo o grupo, não como o grupo está."*

**Worry:** Virar fiscal. Começar a julgar líderes por cartões coloridos. Aparecer no grupo pequeno com a cara de quem "já sabe tudo" e quebrar a dignidade do líder. Ou, no extremo oposto: ver tudo verde, relaxar, e perder o sinal de um grupo que está em dificuldade silenciosa.

---

## Device & Starting Point (Q5 + Q6)

**Device:** Desktop / notebook — 13" a 15", resolução mínima 1366×768, densidade invertida em relação ao líder mobile. Aqui a tela comporta mais informação por m² e o pastor *prefere* ver mais de uma vez — porque a sessão é rara e ele quer correlacionar. Mas **correlacionar não é ranquear**: mais densidade ≠ mais comparação pública entre líderes.

**Entry:** Abertura voluntária pelo navegador desktop. O pastor digita a URL ou usa um bookmark. Sessão persistente via Keycloak (Stories 1.7, 1.8, 2.1, 2.2 — fluxo de auth unificado). RBAC detecta role `Admin Tenant` → redirect para a **experiência consolidada de administração**: `/app/admin/` (home do admin) → `/app/admin/igreja/vista` (vista agregada dos grupos). Esta é uma sub-rota da experiência `/app/admin/*` definida pelo UX-DR22 a 25 (3 experiências consolidadas, não 6 rotas role-based). O `Líder` é redirecionado para `/app/gestao/`; o `Participante` para `/app/consumo/`. Nenhum trigger externo: sem push, sem email de resumo semanal no MVP. A cadência é humana e escolhida pelo pastor.

**Nota de release gate:** Email de resumo semanal pastoral é Epic 14 (Release 2). Não está neste sunshine path.

---

## Best Outcome (Q7)

**User Success:**
Em 10 a 15 minutos, o pastor fechou o notebook com 1 ou 2 nomes escritos no caderno físico ao lado (*"ligar João terça; mandar mensagem Paulo até quarta"*) e 1 pergunta de abertura para cada conversa — do tipo *"João, como você tá se sentindo conduzindo esse grupo?"*, não *"João, por que o Pedro está vermelho no seu radar?"*. A sensação é *"eu estou pastoreando meus líderes, não auditando eles"*.

**Business Success:**
+1 evento `pastor.view.session` (sessão de consulta concluída) e +1 a +2 eventos `pastor.outreach.intent` (registros opcionais de "vou procurar este líder", sem cobrança). Alimenta a métrica `% semanas com ≥1 contato intencional pastor→líder originado na vista agregada`. Meta MVP Release 1a-beta: ≥50% dos pastores ativos por semana. (Tier mais baixo que o do líder porque a cadência é menor — 2 sessões/semana vs. 5 do líder.)

---

## Shortest Path (Q8)

Caminho linear — zero branches críticos, mas densidade maior que os cenários do líder (o pastor *quer* ver contexto lado a lado, e o desktop permite). Cada tela é desenhada para que o pastor saia dela com uma pergunta respondida, nunca com uma decisão obrigatória.

1. **Login Admin Tenant (#23)** — Abre o navegador, autentica pelo fluxo unificado Keycloak (email/senha · Google OAuth · Stories 2.1/2.2). RBAC identifica role `Admin Tenant` → redirect para `/app/admin/` e dali para a sub-rota `/app/admin/igreja/vista` (vista agregada dos grupos). Em sessão persistente, o passo é transparente (<1s). A tela de login desktop tem o mesmo visual do mobile — densidade cresce a partir da #24.
2. **Vista agregada (#24)** — Vê os 12 grupos da igreja em cards desktop de densidade média: nome do grupo, nome do líder, 1 linha de status pastoral em linguagem humana (*"Conversa saudável essa semana"* · *"Vale acompanhar"* · *"Pastor, vale uma ligação"* — a gradação é qualitativa, não numérica, jamais pontuação 0–100). A ordenação default é *por atenção pastoral sugerida*, não por alfabética nem por tamanho de grupo. Filtro superior opcional: "Ver tudo" · "Vale acompanhar" · "Sem sinal essa semana". O pastor identifica 2 cards que merecem um olhar. Toca no primeiro.
3. **Drill-down por grupo (#25)** — Entra no grupo escolhido. Vê: última reunião (data, presença agregada sem nomes expostos no topo, tópico), últimos marcos registrados pelo líder (as reflexões `meeting.reflection` do cenário 02 e os sinais do cenário 01, agregados em narrativa temporal — não em gráfico). Nada de série histórica, nada de tendência numérica. O foco é *"o que esse grupo tem vivido nas últimas 2 semanas em linguagem pastoral"*, construído a partir dos próprios registros do líder. O pastor lê, entende o contexto, toca em "Ver o líder desse grupo".
4. **Visão do líder específico (#26)** — Vê o líder (não o grupo): há quanto tempo o pastor não conversou com ele (campo opcional, só se o próprio pastor registrou), quais foram as últimas reflexões que o líder escreveu, e — crucialmente — um campo livre com o convite *"O que você quer levar para essa conversa?"*. O pastor digita 1 frase (ex: *"João tem conduzido esse grupo há 2 anos, vale perguntar como ele está — não o grupo"*) e toca em "Anotar para essa semana". Sai com o nome escrito e a pergunta pronta.

---

## Trigger Map Connections

**Persona:** Pastor Titular (⭐ Secondary Buyer · Desktop densidade invertida)

**Driving Forces Addressed:**
- ✅ **Want:** *"Enxergar a saúde pastoral dos grupos sem abrir 12 conversas"* — 1 tela resume as 12 dinâmicas em linguagem humana (persona doc §Positive Forces)
- ✅ **Want:** *"Iniciar conversas melhores com os líderes"* — a vista agregada termina em *uma pergunta humana pronta*, não num relatório (persona doc §Mental Model)
- ❌ **Fear:** *"Virar auditor de ministério"* — nunca há ranking, nunca há pontuação, nunca há comparação pública entre líderes (persona doc §Negative Forces)
- ❌ **Fear:** *"Ser visto como espião"* — a vista é privada do pastor, e o pastor só vê o que os líderes *registraram*, nunca dados brutos de participação

**Business Goal:** Vista pastoral agregada acionável sem fiscalização (Trigger Map §01-business-goals.md tier 1 — loop de supervisão pastoral)

**Design Implications aplicadas (§05-key-insights.md):**
- **A — Radar humilde (invertido ao pastor):** o pastor vê agregado, o líder vê individual; nenhum dos dois vê pontuação
- **B — Cache-first de leitura:** TanStack Query em `/app/admin/igreja/vista` com `staleTime` generoso — a cadência é semanal, não em tempo real
- **C — Redundância cor+ícone+texto:** o status pastoral de cada grupo usa cor (paleta suave, zero vermelho saturado) + ícone + frase humana — nunca *só* cor
- **D — Densidade invertida:** no desktop, cards apresentam mais contexto textual por m²; mas o número de cards *na tela* ainda é ≤12 (não infinite scroll, não paginação agressiva)
- **F — Improviso Sagrado:** o sistema *nunca* diz ao pastor "ligue para o João" — só mostra o contexto. A decisão de agir, o tom da conversa, e o timing são 100% do pastor

**Anti-patterns bloqueados:**
- ❌ Nenhum uso de: *monitorar, rastrear, frequência, célula, relatório (visão de auditoria), rebanho, score, ranking, pontuação, KPI, leaderboard, engajamento (substantivo humano)*
- ❌ Nenhuma ordenação pública por desempenho de líder ou grupo
- ❌ Nenhuma série histórica ou gráfico de tendência na vista pastoral do MVP
- ❌ Nenhuma sugestão automatizada do tipo "ligue para este líder" — o sistema mostra, o pastor decide
- ❌ Nenhum email/push de "resumo semanal pastoral" (é Epic 14, Release 2)
- ❌ Nenhum acesso do pastor aos dados brutos de participação — apenas às narrativas que os líderes registraram

---

## Scenario Steps

| Step | Page | Purpose | Exit Action |
|------|------|---------|-------------|
| 03.1 | `03.1-login-admin-tenant/` (#23) | Autenticar, RBAC identifica role `Admin Tenant`, redirect para `/app/admin/igreja/vista` | Sessão válida → carrega vista agregada |
| 03.2 | `03.2-vista-agregada/` (#24) | Ver os grupos em linguagem pastoral qualitativa, escolher 1–2 merecedores de conversa | Toque num card de grupo |
| 03.3 | `03.3-drill-down-grupo/` (#25) | Entender o contexto pastoral das últimas 2 semanas como narrativa, não como gráfico | Toque em "Ver o líder desse grupo" |
| 03.4 | `03.4-visao-lider/` (#26) | Anotar 1 frase de intenção pastoral: o que levar para a conversa com aquele líder | Salvar intenção → fechar notebook ✓ |

**First step (03.1)** inclui o contexto de entrada completo: situation (Q3) + mental state (Q4) + device invertido (Q5). Per-page detalhes ficam para Phase 4 (UX Design / wireframes).

**On-step interactions** (que não saem do step): filtro "Sem sinal essa semana" no #24 (grupo sem reunião ou sem registro — *não é "ruim"*, é *desconhecido*), abrir reflexão específica do líder no #25 para leitura completa, limpar/editar a intenção anotada no #26, e fluxo de "ver outro grupo" após concluir um drill-down. Todos documentados como storyboard items dentro de cada page spec na Phase 4.

---

## Release Gate Audit

⚠️ **Este cenário tem débito de release gate explícito.** A vista agregada do tenant (FR60) está atualmente posicionada em Release 2 no PRD. O radar do líder (FR54–59, Epic 6) está em 1a-beta, mas a vista agregada pelo Admin Tenant depende do mesmo motor de sinais *e* de uma camada de agregação que não foi confirmada como 1a-beta. O sunshine path deste cenário só se realiza plenamente quando FR60 é promovido para 1a-beta — **decisão de escopo que precisa ser tomada no grooming**.

| Elemento | Release gate | Nota |
|---|---|---|
| Login Admin Tenant + RBAC role-based redirect | ✅ Release 1a (Stories 1.7, 1.8, 2.1, 2.2 + Epic 2 RBAC) | Fluxo unificado |
| Experiência consolidada `/app/admin/*` | ✅ Release 1a (UX-DR22 a 25) | Sub-rotas do Admin Tenant |
| Radar por líder (sinais de origem) | ✅ Release 1a-beta (Epic 6, FR54–59) | Motor compartilhado com o cenário 01 |
| **Vista agregada do tenant (FR60)** | ⚠️ **Release 2 no PRD atual** | **Débito de release gate — precisa ser promovido para 1a-beta ou o cenário 03 vira Release 2** |
| Ordenação por atenção pastoral sugerida | ⚠️ Depende de FR60 | Mesmo débito acima |
| Filtro "Ver tudo · Vale acompanhar · Sem sinal" | ⚠️ Depende de FR60 | Mesmo débito acima |
| Drill-down por grupo com narrativa temporal | ⚠️ Depende de FR60 | Construída a partir de `meeting.reflection` e sinais do radar |
| Visão do líder com campo livre "Anotar para essa semana" | ⚠️ **Design-driven requirement** | **Ver nota de mapeamento abaixo** |
| Cache-first de leitura em `/app/admin/igreja/vista` | ✅ Release 1a (pattern geral) | TanStack Query, staleTime longo |
| Série histórica / gráficos de tendência | ❌ Release 1b+ | Excluído do MVP por design |
| Exportação de relatório pastoral em PDF | ❌ Release 2+ | Fora do sunshine path |
| Email de resumo semanal pastoral | ❌ Release 2 (Epic 14) | Cadência é humana no MVP |
| Comparação pública entre líderes / leaderboard | ❌ Veto permanente | Viola princípio raiz — nunca entra |
| Sugestão automatizada "ligue para este líder" | ❌ Veto permanente | Viola Improviso Sagrado — nunca entra |
| Acesso a dados brutos de participação (não narrativas) | ❌ Veto permanente | Admin Tenant lê o que o líder registrou, não telemetria |

### Decisão de escopo requerida (release gate)

**Opção A — Promover FR60 para Release 1a-beta:** a vista agregada do tenant entra como feature core do MVP junto com o radar por líder. Justificativa: sem ela, o secondary buyer (Pastor Titular → Admin Tenant) não tem razão para continuar comprando o produto depois do piloto. O loop de 3 cenários (01+02+03) só fecha economicamente com FR60 no MVP. **Impacto:** aumenta escopo de 1a-beta em ~1 story no Epic 6 (agregação) e ~1 story no Epic de admin-tenant UX.

**Opção B — Manter FR60 em Release 2:** o cenário 03 é outlined como previsto para 1a-beta mas não entregue até Release 2. **Impacto:** o primeiro pastor cliente vive 3–6 meses sem a vista agregada; o risco é de churn antes do valor completo aparecer.

**Recomendação do design:** Opção A. Este outline deve alimentar a conversa de scope do grooming, não decidi-la sozinho. Até a decisão ser tomada pelo time, o cenário 03 fica marcado como **⚠️ Release 1a-beta condicionado à promoção de FR60**.

**Status (2026-04-11):** Recomendação de Opção A validada pelo user review do outline. FR60 é "Comparativo por Grupo" com KPIs agregados qualitativos — não é sistema analítico complexo. Custo de implementação baixo vs. risco de churn alto do secondary buyer pós-piloto. Levar ao grooming do Epic 6 com essa recomendação explícita.

### Nota de mapeamento: Campo livre "Anotar para essa semana" (design-driven requirement)

O campo livre no #26 é uma **intenção pastoral no nível do relacionamento Admin Tenant → líder** — uma categoria nova que não mapeia diretamente para FRs existentes. Não é FR57 (ação de cuidado participante, Epic 6), não é FR49 (relatório pós-reunião, Epic 5), não é o `meeting.reflection` do cenário 02.

**Proposta de mapeamento:** novo subtipo `admin.outreach_intent` (ou `pastoral.outreach_intent` conforme convenção de bounded context) **no Epic 6 (Pastoral Radar)**, onde FR60 já vive. Modelo de dados:

```
{
  id: uuidv7(),
  tenant_id: string,           // RLS base
  user_id: string,             // author — Admin Tenant RLS: só o próprio autor lê
  target_leader_id: string,    // líder alvo da intenção
  week_of: date,
  note: text,
  created_at: timestamp
}
```

**RLS:** escopada a `tenant_id = current_tenant()` + `user_id = current_user()`. O próprio `target_leader_id` nunca vê a entrada. Nenhum relatório agregado expõe este dado — é um bloco de notas pastoral privado.

**Ação requerida antes da implementação:** Story nova no **Epic 6 (Pastoral Radar)** — *não no Epic 7, que é Onboarding Mínimo (Stories 7.1 Tela de Boas-Vindas + 7.2 Dados de Demonstração) e não tem relação com vista pastoral*. A nova story formaliza `outreach_intent` como entidade dentro do bounded context `pastoral`. Driver: este outline. Design-driven requirement que deve virar FR/story no grooming da sprint do Epic 6.

### Resumo do débito

Duas ações requeridas no grooming antes da implementação da Sprint do Epic 6:

1. **Decisão de escopo:** FR60 promovido para 1a-beta (Opção A) ou cenário 03 entregue em Release 2 (Opção B).
2. **Story nova:** `outreach_intent` formalizado como entidade no Epic 6 com RLS `tenant_id + user_id`.

Ambas são explícitas e documentadas. Nada de débito escondido.

---

## Tone audit (glossário banido)

Verificação interna antes de salvar — nenhuma ocorrência user-facing de: *monitorar, rastrear, frequência, célula, relatório (visão de auditoria), engajamento (substantivo humano), lead, pipeline, dashboard, rebanho, amado vocativo, score, ranking, pontuação, KPI, leaderboard, benchmark, performance do líder*. ✅

**Substituições deliberadas:**
- "dashboard pastoral" → "vista agregada" / "a vista" (a palavra "dashboard" está banida também ao pastor para evitar drift corporativo)
- "KPI do grupo" → "status pastoral" / "sinal do grupo"
- "ranking de líderes" → **nunca existe** (anti-pattern permanente)
- "relatório" → "narrativa" / "contexto das últimas semanas"
- "alerta" → "Vale acompanhar" / "Vale uma ligação" (linguagem humana, sem urgência sintética)

Vocabulário substitutivo adotado: *vista, sinal, contexto, conversa, intenção, narrativa, acompanhar, pastorear, cuidado do cuidado.*

---

_Outlined sob Phase 3 — UX Scenarios · Mode: Suggest com checkpoint por cenário · Override pastoral × edtech: linha pastoral governa em qualquer conflito · Loop explícito com cenários 01 e 02 — as reflexões que o líder escreve são o que o Admin Tenant lê aqui, nunca telemetria crua · Débito de release gate documentado: FR60 promoção + story nova `outreach_intent` no Epic 6._
