---
design_intent: S
design_status: not-started
---

# 02: Líder roda a reunião e fecha o loop

**Project:** metanoia-hub
**Created:** 2026-04-11
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios
**Scenario type:** Storyboard (mobile, Android gama média-baixa)
**Priority:** ⭐ Priority 1 — Critical Path (continuação do cenário-âncora)
**Release gate:** MVP Release 1a (core pastoral presence loop)

---

## Transaction (Q1)

**What this scenario covers:**
Consultar a agenda da reunião 5 minutos antes de começar, abrir a sala LiveKit do encontro (mesmo quando o grupo se reúne presencialmente — participantes conectam pelo celular na sala de casa, presença é capturada automaticamente por webhook), e capturar 1 ou 2 observações pastorais logo depois — sem que o app competisse com o momento relacional real.

**Modelo de presença:** Automático via LiveKit + webhooks (Epic 5, FR46, Story 5.3). O líder *não* marca presença manualmente; o pipeline `LiveKit webhook → Redis → BullMQ → PostgreSQL` registra presença integral/parcial a partir da telemetria de conexão. O ato humano do líder é *abrir a sala* e conduzir — o resto acontece sozinho. Isso vale para reunião 100% online, 100% presencial (modo híbrido — participantes conectam mesmo estando fisicamente juntos, consistente com Jornada 1 do PRD: *"Marcos não precisa fazer nada — conduz a reunião normalmente"*), ou mista.

---

## Business Goal (Q2)

**Goal:** `Pastoral Radar se alimenta do encontro real, não de formulário pós-fato` (Trigger Map · Business Goal B1 + B2)
**Objective:** `% reuniões do grupo com ≥1 registro capturado em ≤2h após o encontro` — feed de entrada do radar, mensurada a partir do MVP Release 1a-beta.

A transação materializa o princípio *"O encontro acontece na sala; o app só ajuda a lembrar depois"*. Presença (quem esteve na sala) vira sinal para o radar da próxima semana sem exigir que o líder vire operador.

---

## User & Situation (Q3)

**Persona:** Líder de Grupo Pequeno (⭐ Primary Target).

**Situation:**
Quinta-feira, 19h45. A reunião começa 20h na casa de um dos participantes (modo híbrido: todos fisicamente juntos, mas cada um conecta pelo celular à sala LiveKit do grupo — essa é a mecânica-padrão do MVP para capturar presença automaticamente). O líder acabou de chegar, o anfitrião está fazendo o café, duas pessoas já estão sentadas conversando sobre a semana. Ele tem 10 minutos antes do primeiro "vamos começar". O que ele precisa: (1) relembrar o tópico da noite e quem confirmou, (2) abrir a sala LiveKit para que todos possam conectar, (3) durante a reunião, *não* ficar olhando pro celular — o app cuida da presença sozinho enquanto ele está presente na sala, (4) ao sair, enquanto o momento ainda está quente, registrar o que vale lembrar até quarta que vem.

---

## Driving Forces (Q4)

**Hope:** Rodar o encontro *presente na sala*, não na tela — abrir a sala LiveKit e esquecer do app até o fim. Sair dali com 1 ou 2 observações curtas salvas enquanto a memória ainda está viva — sem se sentir secretário.

**Worry:** O celular competir com o momento relacional. Ser visto olhando pra tela enquanto alguém se abre. Ou pior: chegar em casa e esquecer a observação que importava. Medo extra do modo híbrido: a mecânica de "conectar pelo celular mesmo estando juntos" parecer artificial — o app precisa deixar invisível o fato de que tem infra acontecendo.

---

## Device & Starting Point (Q5 + Q6)

**Device:** Mobile — Android gama média-baixa (Moto G4/G5 como floor), PWA já instalada. Durante a reunião, telefone ficará com a tela para baixo a maior parte do tempo.

**Entry:** A partir da tela principal do líder (#16) onde ele já estava nas manhãs — toca no card "Próxima reunião" que mostra o encontro de hoje. Sessão persistente (Story 1.8). Nenhum trigger externo: não há lembrete, não há notificação, não há contagem regressiva. A pontualidade é responsabilidade humana; o app só está pronto quando for consultado.

**Nota de release gate:** Nenhum push/nudge antes da reunião. Notificações são Epic 14 (Release 2) e ficam fora deste sunshine path.

---

## Best Outcome (Q7)

**User Success:**
Ao dirigir para casa (ou caminhar até o ônibus), o líder já deixou 1 ou 2 frases curtas gravadas no app — do tipo *"João abriu sobre o pai. Vale retomar com ele antes da próxima reunião."* A sensação é *"estive presente na sala e não perdi o que importava"*. O celular ficou guardado durante a maior parte do encontro — a sala LiveKit rodou sozinha em background.

**Business Success:**
+N eventos `meeting.presence.recorded` via webhook LiveKit (integral/parcial por participante — Epic 5, Story 5.3) e +1 a +2 eventos `meeting.reflection.captured` (campo livre pós-reunião — ver nota de mapeamento abaixo). Esses sinais entram no cálculo do radar da próxima semana (loop fechado com o cenário 01). Meta MVP Release 1a-beta: ≥70% das reuniões dos grupos ativos com ≥1 reflexão capturada em ≤2h.

---

## Shortest Path (Q8)

Caminho linear — zero branches, zero formulários. Durante a reunião, a interação é mínima e tátil: toques grandes, tipografia grande, zero scroll durante momentos de fala. Nada do que é capturado é obrigatório — tudo é convite.

1. **Agenda do grupo (#19)** — 19h47, ainda antes de começar. Toca no card "Próxima reunião" da tela principal e vê: tópico da noite (definido na semana anterior), lista curta de quem confirmou, 1 ou 2 marcos do grupo que ajudam a lembrar o contexto (ex: *"Pedro compartilhou sobre desemprego semana passada — vale ver como ele está"*) e o botão único "Abrir sala". Sem checklist. Sem "preparar material".
2. **Reunião ao vivo (#20)** — 19h58, o líder toca "Abrir sala" e a sala LiveKit fica ativa. Instrução curta ao grupo: *"Cada um conecta pelo celular, pode deixar a tela bloqueada."* Cada participante entra pelo próprio device (link do convite ou da home do app), a sala LiveKit mantém a sessão, webhooks registram presença automaticamente (Story 5.3). O celular do líder pode ficar guardado durante o encontro — **zero toque necessário**. A tela #20 só é consultada se algum participante não conseguiu conectar (edge case), caso em que mostra status da sala em cards simples. Ao final, o líder toca "Encerrar sala".
3. **Pós-reunião (#21)** — 21h35, encostado no carro ou no ponto de ônibus. Abre o app e vê um campo único: *"O que vale lembrar dessa noite?"* Digita 1 ou 2 frases curtas — pode ser sobre 1 pessoa, sobre o grupo todo, sobre uma oração específica. Zero tags, zero categorias, zero participante obrigatório. Toca em "Salvar". A tela de confirmação: *"Obrigado por estar presente. Vemos você quarta."* ✓

---

## Trigger Map Connections

**Persona:** Líder de Grupo Pequeno (⭐ Primary Target · Mobile-first Android gama média-baixa)

**Driving Forces Addressed:**
- ✅ **Want:** *"Presença antes de produtividade"* — o app se afasta durante o encontro (persona doc §Mental Model)
- ✅ **Want:** *"Mecânica sem complexidade"* — 1 campo livre pós-reunião, sem formulário (persona doc §Positive Forces)
- ❌ **Fear:** *"Virar secretário do rebanho"* — sistema nunca cobra presença, nunca questiona ausência (persona doc §Negative Forces)
- ❌ **Fear:** *"Competir com o momento relacional"* — UI tátil de 15s durante a reunião, nada de tela longa

**Business Goal:** Pastoral Radar alimentado pelo encontro real (Trigger Map §01-business-goals.md tier 1 flywheel — loop de feedback)

**Design Implications aplicadas (§05-key-insights.md):**
- **A — Radar humilde:** nada do que é capturado é obrigatório; tudo é convite
- **B — Cache-first de leitura:** agenda carrega instantânea mesmo sem sinal bom na casa do anfitrião (TanStack Query `staleTime` longo)
- **C — Redundância cor+ícone+texto:** status da sala (verde/cinza/vermelho) + ícone + texto para o edge case de consulta durante a reunião
- **D — Tipografia grande e toque generoso:** botão "Abrir sala" e "Encerrar sala" com alvo de ≥56dp, zero scroll obrigatório
- **F — Improviso Sagrado:** o app não sugere o que capturar, não oferece templates, não categoriza a reflexão

**Anti-patterns bloqueados:**
- ❌ Nenhum uso de: *frequência, monitorar, rastrear, checklist de presença, célula, relatório, dashboard (ao líder), score, engajamento*
- ❌ Nenhum registro manual de presença pelo líder (o sistema captura via webhook; forçar o líder a ser secretário é anti-padrão)
- ❌ Nenhum formulário estruturado pós-reunião (zero campos obrigatórios além da frase livre)
- ❌ Nenhuma pergunta sobre ausentes ("por que faltou?", "está bem?")
- ❌ Nenhum push, nudge, ou lembrete antes do horário da reunião

---

## Scenario Steps

| Step | Page | Purpose | Exit Action |
|------|------|---------|-------------|
| 02.1 | `02.1-agenda-do-grupo/` (#19) | Relembrar tópico, confirmados e 1–2 marcos pastorais, 5 min antes de começar | Toca "Abrir sala" → sala LiveKit ativa |
| 02.2 | `02.2-reuniao-ao-vivo/` (#20) | Abrir/encerrar sala LiveKit; presença é capturada automaticamente via webhook | Toca "Encerrar sala" → guarda o celular |
| 02.3 | `02.3-pos-reuniao/` (#21) | Capturar 1–2 frases livres enquanto a memória está viva | Salvar → confirmação → sair do app ✓ |

**First step (02.1)** inclui o contexto de entrada completo: chegada 5 min antes + situation (Q3) + mental state (Q4). Per-page detalhes ficam para Phase 4 (UX Design / wireframes).

**On-step interactions** (que não saem do step): empty state se o grupo ainda não definiu tópico (exibir *"Sem tópico definido — tudo bem"*), fallback se um participante não conseguir conectar ao LiveKit (erro de rede/permissão — exibe status no #20 sem culpabilizar ninguém), toque em participante específico durante a reunião para abrir perfil rápido (opcional, não pré-requisito), retomar captura interrompida do #21 se o líder saiu no meio. Todos documentados como storyboard items dentro de cada page spec na Phase 4.

---

## Release Gate Audit

| Elemento | Release gate | Nota |
|---|---|---|
| Agenda do grupo com tópico e confirmados | ✅ Release 1a (Epic 5 Group Lifecycle) | Dados do próprio grupo, zero cálculo pastoral |
| Marcos pastorais mínimos no card da reunião | ✅ Release 1a-beta (Epic 6 Radar) | Mesma fonte do cenário 01 |
| Abrir/encerrar sala LiveKit pelo líder | ✅ Release 1a-beta (Epic 5, Story 5.2) | Fluxo já planejado |
| Presença automática via webhook LiveKit | ✅ Release 1a-beta (Epic 5, FR46, Story 5.3) | Pipeline `LiveKit → Redis → BullMQ → PostgreSQL` |
| Participante conecta pelo próprio celular (modo híbrido) | ✅ Release 1a-beta (Epic 5) | Mesma mecânica de reunião online; PRD Jornada 1 |
| Campo livre pós-reunião (reflexão do encontro) | ⚠️ Release 1a-beta (**design-driven requirement**) | **Ver nota de mapeamento abaixo** |
| Cache-first de leitura (agenda + lista de membros) | ✅ Release 1a | TanStack Query runtime, sem Service Worker |
| Push lembrete antes da reunião | ❌ Release 2 (Epic 14) | **Explicitamente excluído** — pontualidade é humana |
| Histórico de presença/tendência do participante | ❌ Release 1b+ | Visão pastoral agregada fica com o pastor (cenário 03) |
| Check-in manual pelo líder | ❌ Não previsto | Presença é automática, não manual |
| Gravação de reuniões | ❌ Release 3+ (post-MVP) | Alinhado com posicionamento do PRD como Phase 3 |
| Transcrição automática de notas | ❌ Release 3+ ou veto | Requer reavaliação sob Improviso Sagrado quando Release 3 for planejado |

### Nota de mapeamento: Campo livre pós-reunião (design-driven requirement)

O campo *"O que vale lembrar dessa noite?"* no #21 é uma **reflexão no nível do encontro**, não uma ação de cuidado direcionada a um participante específico. Ele *não* mapeia diretamente para:

- **FR49** (Relatório pós-reunião automático, Epic 5) — este é gerado pelo sistema, não pelo líder
- **FR57** (Ações de cuidado pastoral, Epic 6) — este é uma ação direcionada a *uma pessoa*, não uma reflexão sobre o encontro como um todo

**Proposta de mapeamento:** extensão da Story 6.x (Ações de Cuidado) com um novo subtipo `meeting.reflection` — mesmo modelo de dados que a ação de cuidado do cenário 01, mas com `target_type=meeting` em vez de `target_type=participant`. Mantém coerência de schema, evita criar novo bounded context, e preserva o mesmo loop de feedback para o radar.

**Ação requerida antes da implementação:** Story nova (ou extensão da 6.x) formalizando `meeting.reflection` como subtipo de ação de cuidado. Este outline serve como driver do requisito — design-driven requirement que deve virar FR/story no grooming da sprint do Epic 6.

Exceto por essa nota de mapeamento, nenhuma feature deste sunshine path cai fora do MVP Release 1a/1a-beta. Zero débito de release gate cru.

---

## Tone audit (glossário banido)

Verificação interna antes de salvar — nenhuma ocorrência user-facing de: *monitorar, rastrear, frequência, célula, relatório (ao líder), engajamento (substantivo humano), lead, pipeline, dashboard (ao líder), rebanho, amado vocativo, score, ranking, check-in, attendance, faltou (interrogativo)*. ✅

**Substituições deliberadas:**
- "frequência" → "presença" (o ato, não o índice)
- "check-in" → "entrar na sala" (ato LiveKit orgânico)
- "relatório" → "reflexão" / "o que vale lembrar"
- "formulário" → "1 frase livre"

Vocabulário substitutivo adotado: *presença, reflexão, marco, encontro, momento, cuidado, memória, sala.*

---

_Outlined sob Phase 3 — UX Scenarios · Mode: Suggest com checkpoint por cenário · Override pastoral × edtech: linha pastoral governa em qualquer conflito · Loop explícito com cenário 01 (captura de hoje alimenta o radar de quarta que vem)._
