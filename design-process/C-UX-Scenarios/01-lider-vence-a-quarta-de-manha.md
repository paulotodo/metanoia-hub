---
design_intent: S
design_status: not-started
---

# 01: Líder de Grupo vence a quarta-feira de manhã

**Project:** metanoia-hub
**Created:** 2026-04-11
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios
**Scenario type:** Storyboard (mobile, Android gama média-baixa)
**Priority:** ⭐ Priority 1 — Cenário-âncora canônico
**Release gate:** MVP Release 1a (core pastoral radar loop)

---

## Transaction (Q1)

**What this scenario covers:**
Ver o radar pastoral antes do trabalho, abrir o 1 sinal que importa hoje, lembrar o contexto relacional da pessoa envolvida, e registrar uma ação de cuidado — tudo em 1 a 3 minutos no celular, antes da reunião da manhã.

---

## Business Goal (Q2)

**Goal:** `Pastoral Radar entrega visibilidade acionável sem virar fiscalização` (Trigger Map · Business Goal B1)
**Objective:** `% semanas-líder com ≥1 ação orientada pelo radar em ≤48h` — North Star metric do produto, mensurada a partir do MVP Release 1a-beta.

A transação materializa o núcleo do Pastoral Radar: traduzir sinais de participação digital em visibilidade pastoral prática, sem infringir o princípio raiz *"Presença digital ≠ saúde espiritual"*.

---

## User & Situation (Q3)

**Persona:** Líder de Grupo Pequeno (⭐ Primary Target) — define se o produto vive ou morre no dia a dia.

**Situation:**
Quarta-feira, 7h12 da manhã. O grupo encontra na quinta à noite. O líder ainda não tomou café, está no ônibus ou na mesa da cozinha, com o Android gama média-baixa na mão e uma aba de mente ocupada com o trabalho do dia. Ele tem 1 a 3 minutos antes de precisar sair. Ontem ele não conseguiu abrir o app. Hoje ele precisa saber *se há alguma coisa que ele não pode deixar passar antes da reunião de amanhã*.

---

## Driving Forces (Q4)

**Hope:** Descobrir em 30 segundos quem precisa de atenção esta semana e sair do app sabendo qual será o primeiro gesto antes do encontro de quinta.

**Worry:** Ser pego de surpresa na reunião por uma situação que ele deveria ter percebido antes — e carregar o peso de não ter agido a tempo.

---

## Device & Starting Point (Q5 + Q6)

**Device:** Mobile — Android gama média-baixa (Moto G4/G5 como floor de compatibilidade visual), PWA instalada na home screen após onboarding.

**Entry:** Abertura voluntária. O líder adquiriu o hábito semanal de checar o radar nas manhãs antes da reunião — quarta é o dia dele. Destrava o celular, toca no ícone da PWA na home screen, e cai direto na tela principal do líder, já autenticado pela sessão persistente (JWT + high-entropy session da Story 1.8). Em sessão expirada, o caminho alternativo é login rápido por email/senha ou Google OAuth (Stories 2.1/2.2 já mergeadas) com redirect para a tela principal.

**Nota de release gate:** Nenhum trigger externo (push notification, SMS, email) inicia este cenário no MVP. Notificações web/push são Epic 14 (Release 2) e ficam explicitamente fora do sunshine path de Release 1a/1a-beta. O radar vence pela confiabilidade do hábito, não pela interrupção do sistema — coerente com o princípio "o app oferece, nunca exige".

---

## Best Outcome (Q7)

**User Success:**
Em menos de 3 minutos, o líder sai do app com uma frase mental concreta: *"Vou mandar uma mensagem para [nome] antes de dormir — e na quinta vou sentar do lado dele."* A sensação é de *"dessa vez eu não fui pego de surpresa"* — o oposto de vigilância, é presença antecipada com dignidade.

**Business Success:**
+1 evento `radar.action.recorded` atribuído ao líder nesta semana → conta para o North Star metric `% semanas-líder com ≥1 ação orientada pelo radar em ≤48h`. Meta MVP Release 1a-beta: ≥60% dos líderes ativos por semana.

---

## Shortest Path (Q8)

Caminho linear — zero branches, zero condicionais. Cada passo move para o próximo sem decisão acessória. Cache-first de leitura garante que o radar nunca chega em branco no gama baixa.

1. **Login líder (#10)** — Abre a PWA pela home screen. Em sessão ativa (caminho esperado no hábito semanal), o passo é transparente (<1s). Em sessão expirada, login rápido por email/senha · Google OAuth e redirect para a tela principal.
2. **Tela principal líder (#16)** — Vê o radar humilde: 1 a 3 sinais destacados na ordem de atenção sugerida. Cada sinal é cor + ícone + texto curto (WCAG AA, redundância para lente embaçada). Toca no sinal de maior prioridade.
3. **Detalhe do sinal (#17)** — Lê o porquê daquele sinal em linguagem pastoral, sem jargão técnico, sem imperativo automatizado ("Vale uma mensagem?" em vez de "Envie uma mensagem"). Entende o que o sistema viu e o que *não* viu. Toca em "Ver essa pessoa".
4. **Perfil participante (#18)** — Memória relacional mínima: última conversa registrada pelo próprio líder, última oração, próximo marco do grupo. Não há histórico de métricas, não há gráfico. Só o que ajuda a relembrar a pessoa. Toca em "Registrar cuidado".
5. **Loop fechado (#22)** — Registra a ação em 1 frase livre (ex: *"Vou mandar mensagem hoje à noite"*). Um toque para salvar. A tela de confirmação é uma linha seca: *"Obrigado. Vemos você quinta."* ✓

---

## Trigger Map Connections

**Persona:** Líder de Grupo Pequeno (⭐ Primary Target · Mobile-first Android gama média-baixa)

**Driving Forces Addressed:**
- ✅ **Want:** *"Mecânica sem complexidade"* — 1 tela resume a semana, 1 ação óbvia, fechar o app em 1–3 min (persona doc §Positive Forces)
- ❌ **Fear:** *"Ser pego de surpresa"* e *"Virar fiscal do rebanho"* — sistema entrega visibilidade, nunca imperativo (persona doc §Negative Forces + Mental Model)

**Business Goal:** Pastoral Radar acionável sem fiscalização (Trigger Map §01-business-goals.md tier 1 flywheel)

**Design Implications aplicadas (§05-key-insights.md):**
- **A — Radar humilde:** o app oferece, nunca exige. Sem push, sem nudge; o líder vem pelo hábito.
- **B — Cache-first no gama baixa:** TanStack Query com `staleTime` longo + cache em memória para o radar — nunca chega em branco. Service Worker offline (escrita pós-MVP) **não** é pressuposto aqui; cache de leitura opera em runtime normal.
- **C — Redundância cor+ícone+texto:** WCAG AA para lente embaçada na manhã
- **F — Improviso Sagrado:** o produto *não* automatiza a mensagem, o tom, nem a decisão de agir

**Anti-patterns bloqueados:**
- ❌ Nenhum uso de: *monitorar, rastrear, dashboard (ao líder), frequência, célula, engajamento (substantivo), score, ranking*
- ❌ Nenhum imperativo automatizado do sistema
- ❌ Nenhum gráfico ou histórico métrico na tela do líder

---

## Scenario Steps

| Step | Page | Purpose | Exit Action |
|------|------|---------|-------------|
| 01.1 | `01.1-login-lider/` (#10) | Abrir PWA pelo ícone, entrar por sessão ativa ou login email/senha · Google OAuth | Sessão válida → carrega tela principal |
| 01.2 | `01.2-tela-principal-lider/` (#16) | Ver radar humilde com 1–3 sinais priorizados, escolher o mais urgente | Toque no sinal de maior atenção |
| 01.3 | `01.3-detalhe-do-sinal/` (#17) | Entender o porquê do sinal em linguagem pastoral, sem imperativo | Toque em "Ver essa pessoa" |
| 01.4 | `01.4-perfil-participante/` (#18) | Relembrar contexto relacional mínimo (última conversa, última oração) | Toque em "Registrar cuidado" |
| 01.5 | `01.5-loop-fechado/` (#22) | Registrar ação de cuidado em 1 frase livre, fechar com gratidão | Salvar → confirmação → sair do app ✓ |

**First step (01.1)** inclui o contexto de entrada completo: situation (Q3) + mental state (Q4) + discovery method (Q6). Per-page detalhes ficam para Phase 4 (UX Design / wireframes).

**On-step interactions** (que não saem do step): empty states de cache frio, sessão expirada no meio do fluxo, toque em participantes secundários — todos documentados como storyboard items dentro de cada page spec na Phase 4.

---

## Release Gate Audit

| Elemento | Release gate | Nota |
|---|---|---|
| Abertura voluntária da PWA (hábito) | ✅ Release 1a (Epic 1) | PWA instalável + home screen icon, zero trigger externo |
| Login email/senha · Google OAuth + sessão persistente | ✅ Release 1a (Stories 1.7, 1.8, 2.1, 2.2 mergeadas) | Coerência com `main` garantida |
| Radar humilde com 1–3 sinais | ✅ Release 1a (core) / 1a-beta (cálculo) | Epic 6 Pastoral Radar |
| Cache-first de leitura (TanStack Query) | ✅ Release 1a | Runtime normal, sem Service Worker offline |
| Detalhe do sinal com "o que o sistema viu e não viu" | ✅ Release 1a-beta | Explicabilidade obrigatória do MVP |
| Perfil participante com memória relacional mínima | ✅ Release 1a | Sem histórico métrico no MVP |
| Loop fechado com registro de ação em frase livre | ✅ Release 1a (core) | Campo texto simples, sem tags |
| Push notification / web notification | ❌ Release 2 (Epic 14) | **Explicitamente excluído deste cenário** — radar vence pelo hábito |
| Service Worker offline de escrita | ❌ Release 1b+ | Excluído do MVP por design |
| Timeline de Cuidado modo correlacionado | ❌ Release 3 | No MVP, memória relacional é cronológica simples |
| Histórico agregado de ações do líder | ❌ Release 1b+ | Visão para o pastor no cenário 03 |

Nenhuma feature deste sunshine path cai fora do MVP Release 1a/1a-beta. Zero débito de release gate.

---

## Tone audit (glossário banido)

Verificação interna antes de salvar — nenhuma ocorrência user-facing de: *monitorar, rastrear, frequência, célula, relatório (ao líder), engajamento (substantivo humano), lead, pipeline, dashboard (ao líder), rebanho, amado vocativo, score, ranking*. ✅

Vocabulário substitutivo adotado: *radar, sinal, cuidado, atenção, memória relacional, ação, presença, dignidade.*

---

_Outlined sob Phase 3 — UX Scenarios · Mode: Suggest com checkpoint por cenário · Override pastoral × edtech: linha pastoral governa em qualquer conflito._
