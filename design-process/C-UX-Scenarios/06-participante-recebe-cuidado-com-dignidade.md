---
design_intent: S
design_status: not-started
---

# 06: Participante recebe cuidado com dignidade

**Project:** metanoia-hub
**Created:** 2026-04-11
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios
**Scenario type:** Screen Flow (mobile-first · toque mínimo · consumo, não gestão)
**Priority:** ⭐ Priority 1 — Core (valor sustentado do produto do lado do beneficiário final)
**Release gate:**
- **Convite via email transacional (FR23) — Release 1a-alpha (Epic 4).**
- **Participante visualiza seus grupos (FR26) — Release 1a-alpha (Epic 4).**
- **Tela de boas-vindas personalizada (FR69) — Release 1a-beta via Epic 7.**
- **NFR-X3 (≤ 2 min até primeira trilha) — ⚠️ dualidade de release gate, ver seção Release Gate Audit.**
- **Primeira trilha acessível (Epic 8 "Minhas Trilhas") — ⚠️ Release 1b.** Outline documenta essa fronteira explicitamente.
- **Push notification / WhatsApp / SMS — ❌ Release 2 (Epic 14). Explicitamente excluído do sunshine path.**

---

## ⚠️ Nota de rastreabilidade — rótulos semânticos no lugar de numeração

Os outlines 01–05 usam numeração provisória `#1`–`#27` para referenciar telas do inventário da Phase 3 Step 02/03. Esse inventário **não foi persistido como artefato** em disco — vive apenas na memória da sessão anterior. Para evitar que o outline 06 herde numeração de memória não verificada (padrão de rigor emergido nas revisões anteriores: "Epic 7 Pastor View", "rota /pastor/vista"), este outline adota **rótulos semânticos** para cada tela.

**Consolidação esperada:** no Step 06 (`00-ux-scenarios.md` hub), a numeração canônica das 38 páginas será atribuída de uma vez, inclusive retroativamente aos outlines 01–05 se houver necessidade de realinhamento. Até lá, a rastreabilidade se mantém pelos rótulos semânticos abaixo.

**Rótulos semânticos usados neste outline:**
- **Convite por email** — email transacional disparado por FR23
- **Tela de aceite de convite** — landing pós-clique, associada ao token de convite
- **Lista dos meus grupos** — tela autenticada do participante (FR26, `/app/consumo/grupos`)
- **Detalhe do meu grupo** — tela autenticada com contexto do grupo (líder, próximos encontros, trilha associada)

---

## Nota de persona — quem é o Participante e por que este cenário é o coração da tese

O **Participante** é o único dos 6 roles RBAC do produto que **não é usuário de poder** — ele é o **beneficiário final da tese**. Marcos (líder) age com o radar, Cláudia (admin) configura a igreja, Paulo (super admin) opera a plataforma. **O participante é cuidado.** É a pessoa humana que o princípio inviolável *"presença digital ≠ saúde espiritual"* protege todas as manhãs, em silêncio, sem saber.

**Regra absoluta puxada da persona 05** (`design-process/B-Trigger-Map/personas/05-tertiary-persona-participante.md`):

> *"O participante é cuidado por humanos, mecanicamente lembrado por máquinas — nunca o contrário. Ele nunca vê ranking, nunca vê score, nunca é transformado em lead."*

**Nome fictício do cenário:** Juliana, 28 anos, recém-convertida, inscrita no grupo "Fundamentos da Fé" pelo convite do líder Marcos (narrativa puxada do PRD, linhas 377–389). Não é técnica — usa o celular para tudo e se intimida com plataformas complicadas. Mobile Android gama média-baixa (mesma classe do líder Moto G4/G5 floor), Google account pessoal já existente, paciência curta para tela complicada.

**Mapeamento RBAC:** `Participante` é 1 dos 6 roles reais do sistema. Persona narrativa = role exatamente. Sem nota terminológica necessária (diferente de "Pastor Titular → Admin Tenant" do outline 03).

**⚠️ Divergência deliberada da PRD Jornada 1 (Juliana):** a Jornada 1 do PRD descreve o caminho completo da Juliana ao longo de 6 semanas, incluindo features que **não estão no Release 1a-alpha/1a-beta**: gamificação ("nível Semente"), notificações push de parabéns ("Parabéns! Você concluiu a jornada" via WhatsApp/in-app), lembretes via WhatsApp na sexta, progresso automático marcado em vídeo (Epic 8 Release 1b), comparação de avanços. **Este outline 06 cobre apenas o primeiro momento da jornada — o recebimento do cuidado inicial** — e documenta explicitamente que os demais momentos (progressão de trilhas, celebrações, lembretes) dependem de Epic 8 (R1b) e Epic 14 (R2). Ver seção Release Gate Audit para divergência detalhada.

---

## Transaction (Q1)

**What this scenario covers:**
Do momento *"recebi um email do Marcos que diz que ele pensou em mim pro grupo"* até *"abri o app, vi o meu grupo, confirmei que tá tudo bem, posso fechar agora"*, tudo **sem me sentir vigiada, sem me sentir forçada a preencher formulário, sem me sentir mais uma entrada num CRM**. A transação termina **no momento em que Juliana sente que foi acolhida sem ser capturada** — ela pode ativar, postergar sem culpa, ou ignorar sem ser cobrada. Qualquer um dos três desfechos é válido, e o produto precisa deixar isso honestamente claro.

**O cenário NÃO cobre** (propositalmente, para não inflar o escopo): progressão ao longo da trilha (Epic 8 R1b), presença em reunião ao vivo (Epic 5 R1a-beta, outline 02 cobre do lado do líder), recebimento de mensagem de cuidado pastoral do líder (cenário do outline 01 do lado do líder, invisível para Juliana por design), celebrações de conclusão (Epic 8 + 14 R1b/R2).

---

## Business Goal (Q2)

**Goal:** `Habilitar a primeira sessão da Juliana sem violar o princípio da dignidade antes de dado — zero atrito, zero vigilância, caminho reversível` (Trigger Map · Business Goal B1 — retenção pastoral do beneficiário final · `design-process/B-Trigger-Map/01-business-goals.md`)

**Objective:** `% de participantes convidados que completam a primeira sessão (aceitar convite → ver o grupo → fechar o app com paz) sem desistir no meio` — medido a partir do evento de aceite do convite no Epic 4 até o evento de "primeira visualização do grupo" no Epic 4 (FR26), em ≤ 2 min (NFR-X3).

Este objetivo cruza com a **saúde do onboarding minimalista do Epic 7** (Welcome Screen + Demo Data) porque a Juliana só aceita bem a transação se a boas-vindas for calorosa em linguagem pastoral, não em linguagem de SaaS. Esta é a **única tela do produto que fala diretamente com o beneficiário final no Release 1a-beta** — antes de Epic 8 (R1b) trazer as trilhas navegáveis — então ela carrega um peso desproporcional.

---

## User & Situation (Q3)

**Persona:** Participante (🌱 Tertiary target · beneficiário final · mobile simples · uso esperado baixo)

**Nome fictício:** Juliana, 28 anos, recém-convertida na igreja há 2 meses, trabalha como auxiliar administrativa, volta pra casa de ônibus, mora com a mãe, não tem inglês, não usa Google Drive nem sabe o que é uma PWA. Faz tudo pelo celular — WhatsApp, Instagram, email do Gmail quando alguém manda contrato do trabalho. Google Account ativa há 6 anos. Nunca instalou um "app da igreja" na vida e tem uma leve desconfiança estética de qualquer coisa que pareça "corporativa demais".

**Situation:**
Terça, 19h45. Juliana acabou de chegar em casa, esquentou o jantar, sentou na cama com o celular. Viu a luz do email piscando — novidade, porque email pra ela é geralmente conta de luz ou boleto. Abre. *"Marcos (Fundamentos da Fé)"* no remetente. *"Juliana, você tá convidada pro nosso grupo — clica aqui pra confirmar quando puder"*. Ela sorri. **Marcos é o líder que a recebeu no culto domingo passado** e ela tinha dito que talvez fosse. Ela tem **5 a 10 minutos** de atenção agora, antes de ir assistir TV com a mãe. Se a experiência de confirmar for complicada, ela fecha e volta "algum dia". Se for leve, ela confirma e fica curiosa pelo que vem.

---

## Driving Forces (Q4)

**Hope:** Sentir que alguém de verdade pensou nela — que não é mais um "lead frio sendo nutrido", é uma pessoa sendo lembrada por uma pessoa. Confirmar a presença no grupo sem ter que criar mais uma senha complicada, sem ter que explicar pra ninguém o que ela faz, sem ter que preencher "cargo" ou "tamanho da família". Abrir o app e ver seu grupo lá — o grupo em que ela já decidiu entrar — com rostos humanos e zero burocracia.

**Worry:** Descobrir que pra aceitar o convite ela precisa de senha maiúscula com símbolo e número. Ou abrir uma tela que pergunta *"Como você descreveria seu nível espiritual?"* com um slider numérico. Ou ver um gráfico de barras com *"sua frequência do mês"*. Ou receber na hora uma notificação *"Bem-vinda Juliana! Comece agora sua jornada de 30 dias 🎉"* com emoji de festa e urgência sintética. Ou ser adicionada a um *"ranking de participação do grupo"*. Qualquer dessas coisas faz ela fechar a aba e nunca mais voltar — e o Marcos nunca vai saber por que.

---

## Device & Starting Point (Q5 + Q6)

**Device:** **Mobile Android gama média-baixa**, mesma classe de device do líder (Moto G4/G5 floor), conexão 4G instável dentro de casa, mão esquerda segurando o celular, mão direita no prato. O produto precisa funcionar **em uma mão**, com texto legível sem zoom, com touch-target generoso, com latência < 2s em cada tela. SPA pesada com bundle de 3MB não é opção.

**Entry:** **Email transacional recebido no Gmail do celular**, disparado por FR23 (Epic 4, Release 1a-alpha) quando o líder Marcos cria o convite na tela de Gestão de Grupos. Remetente visível como o nome do líder (*"Marcos — Fundamentos da Fé"*) com fallback do nome da igreja, assunto em linguagem pastoral (*"Juliana, pensamos em você pro grupo"*), corpo do email mínimo (1 parágrafo curto + 1 botão grande *"Confirmar presença no grupo"*). Zero tracking pixels, zero UTM comercial, zero footer corporativo com 4 links de rede social.

**Nota de release gate — canal de entrada:** O canal canônico do Release 1a-alpha é **email transacional** via FR23. **WhatsApp/SMS não está disponível** — o Epic 14 (Notificações & Comunicação) é Release 2, e qualquer integração com provedor de WhatsApp (ex: ChatMaster Veloz) é pós-MVP. Este outline **não promete** WhatsApp como canal de entrada do sunshine path. Ver seção Release Gate Audit para a nota aspiracional de canal.

**Nota de release gate — auth pós-clique:** O Release 1a-alpha já tem auth email/senha (Story 2.1 mergeada) + Google OAuth (Story 2.2 mergeada). Juliana pode autenticar via Google em 2 toques ("Continuar com Google" → seleciona conta) sem criar senha. Esse é o caminho canônico do sunshine path. Auth via email/senha fica como fallback para quem não tem Google account, fora do sunshine path principal.

---

## Best Outcome (Q7)

**User Success:**
Juliana fecha o celular às 19h51 (≤ 6 min depois do clique no email) com a sensação:

> *"Foi acolhedor. Eu vi meu grupo, vi o rosto do Marcos, vi que vai ter encontro na quarta, e ninguém me pediu senha, formulário, nada. Agora eu posso ir jantar em paz — e decido depois se entro hoje à noite pra ver mais ou se deixo pra amanhã."*

Ela tem **agência real** sobre o próximo passo — pode ativar, pode postergar com intenção, pode ignorar sem culpa. Nenhum desses desfechos é interpretado pelo produto como fracasso; todos os três são compatíveis com a dignidade do silêncio (persona 05, Driving Force positiva #4).

**Business Success:**
- +1 evento `participant.invite.accepted` no momento em que Juliana confirma presença no grupo
- +1 evento `participant.group.first_view` no momento em que ela vê a tela *"Lista dos meus grupos"*
- Métrica de NFR-X3 respeitada: ≤ 2 min do clique no email até a primeira visualização da tela do grupo
- **Zero evento de "nutrição automatizada"** disparado — nenhum lembrete, nenhuma celebração sintética, nenhuma cobrança de próximo passo. O silêncio pós-primeira-sessão é **tratado como estado válido**, não como churn risk.

**O que NÃO conta como sucesso deste cenário** (e é importante anotar): completar a primeira trilha (Epic 8 R1b), entrar na primeira reunião ao vivo (Epic 5 R1a-beta, outline 02), ter presença automaticamente registrada. Esses são sucessos de cenários adjacentes. O outline 06 é só o **momento da porta aberta com calma**.

---

## Shortest Path (Q8)

**Sessão única, mobile, 5–7 min do clique no email ao fechamento do app.** Zero branches no sunshine path — todos os ramos alternativos (email de recuperação, Google não disponível, link expirado) são documentados em "Fora do sunshine" ao final da seção.

1. **Convite por email** — Juliana toca no email na inbox do Gmail. Remetente é o nome do líder com sufixo do nome do grupo, assunto curto em voz pastoral. O email tem 1 parágrafo que diz, em linguagem humana, *"Oi, Juliana. A gente começou um grupo pequeno aqui na igreja que eu acho que pode te servir. Se quiser, clica no botão pra confirmar que você topa — sem compromisso nenhum além disso."* + botão grande **"Confirmar presença no grupo"**. Juliana toca no botão. Chrome abre. **~3 segundos.**

2. **Tela de aceite de convite** — Landing mobile SSR carregada pelo Next.js via rota do route group público associada ao token de convite. O que Juliana vê: nome do líder + foto real (se houver) + nome do grupo + 1 linha de contexto *"O Marcos te convidou pro grupo Fundamentos da Fé"* + 2 botões grandes equivalentes: **"Continuar com Google"** e **"Usar email e senha"**. Zero formulário visível antes de escolher o método. Zero "termos e condições" obstrutivos — consentimento LGPD está no rodapé discreto como link, não como checkbox gate. Juliana toca em "Continuar com Google". **~4 segundos.**

3. **OAuth Google (fora do produto)** — Juliana seleciona a conta Google dela (já logada no celular). Google mostra a tela padrão *"Metanoia-hub quer acessar seu nome e email"*. Ela toca em "Continuar". Redirect de volta ao produto. **~6 segundos.**

4. **Lista dos meus grupos** — Primeira tela autenticada. Rota `/app/consumo/grupos` (experiência consolidada do participante — UX-DR22–25 · `docs/architecture.md` linha 502). O que Juliana vê: **1 card** (apenas "Fundamentos da Fé") com nome do grupo, nome do líder, próximo encontro agendado (quarta às 20h), botão discreto **"Ver meu grupo"**. **Não há**: gráficos, porcentagens, semáforos, rankings, botões de "Completar perfil", pop-ups, tour guiado forçado, confetti. Nada. Só o grupo dela, no qual ela acabou de ser recebida. Juliana toca em "Ver meu grupo". **~2 segundos.**

5. **Detalhe do meu grupo** — Última tela do sunshine path. O que Juliana vê: foto do líder + linha *"Marcos lidera esse grupo"*, 1 frase que o próprio Marcos escreveu sobre o propósito do grupo (texto puro, sem bullets corporativos), **quando é o próximo encontro** (data + hora em linguagem humana *"quarta, 20h — em 2 dias"*), **como acontece** (presencial, híbrido, online — aqui via sala LiveKit quando chegar), e 1 linha honesta no final: *"Sem pressa. Quando você vier, a gente tá aqui."* Nenhum CTA de "começar trilha agora", nenhum badge de "nível iniciante", nenhuma celebração sintética. Juliana lê com calma, sorri, **fecha o app**. ✓

**Sessão termina.** Daqui, nenhum comportamento automatizado é disparado. Se Juliana não voltar por 2 semanas, o radar do outline 01 eventualmente mostra esse silêncio **ao Marcos**, que decide se e como falar com ela com base no discernimento dele — nunca por automação. **Esta é a cola entre o outline 06 e o outline 01.**

### Fora do sunshine (trilhos alternativos documentados para Phase 4, não para o sunshine path)

- **Link de convite expirado:** tela de aceite de convite mostra mensagem pastoral curta (*"Esse convite tem uma semana e acabou vencendo — avise o líder que te convidou, ele pode mandar outro rapidinho"*) + botão único *"Entendi"* que fecha o app. Sem formulário, sem dashboard, sem dead-end.
- **Google account não disponível:** Juliana escolhe "Usar email e senha" → cadastro mínimo (email + senha + nome, zero campos extras) reutilizando o fluxo mergeado na Story 2.1. Volta pro mesmo sunshine path a partir do step 4.
- **Conexão 4G instável:** cada tela tem estado de loading curto + fallback otimista. SSR na tela de aceite garante Time-to-First-Byte rápido mesmo em 4G ruim. Lista dos meus grupos tem estado de cache-first via TanStack Query runtime (**não** Service Worker — decisão consolidada do outline 01).
- **Juliana não tem Gmail visível no celular:** ela abre o link direto por outro canal (mensagem via pastor, copy-paste do email no navegador). O token de convite funciona via qualquer navegador; a rota é agnóstica ao canal de origem.
- **Juliana aceita o convite mas não volta nunca mais:** **comportamento válido e previsto**. O radar do outline 01 eventualmente mostra o silêncio ao Marcos. Nenhuma notificação automática pra Juliana. Dignidade do silêncio preservada.

---

## Trigger Map Connections

**Persona:** Participante (🌱 Tertiary target · mobile Android simples · role RBAC real)

**Driving Forces Addressed** (puxadas de `design-process/B-Trigger-Map/personas/05-tertiary-persona-participante.md`):

- ✅ **Want:** *"Sentir-se visto sem sentir-se vigiado"* — a tela de aceite mostra o rosto do Marcos e o nome do grupo, mas zero campo de perfil coletado; o aceite é um *gesto humano do Marcos*, não um *evento de captura do sistema*
- ✅ **Want:** *"Jornada pessoal útil"* — a tela de detalhe do grupo mostra o próximo encontro + propósito em voz pastoral, sem empurrar para trilha ainda (trilhas = Epic 8 R1b, fora do escopo)
- ✅ **Want:** *"Privacidade sobre estado interno"* — zero pergunta sobre estado espiritual, zero slider de nível, zero self-assessment; o produto aceita que o estado interno da Juliana é dela
- ✅ **Want:** *"Direito ao silêncio saudável"* — a frase de fecho *"Sem pressa. Quando você vier, a gente tá aqui"* é literalmente o princípio inviolável 6 (Dignidade do silêncio) em UI
- ❌ **Fear:** *"Sensação de vigilância"* — **red flag absoluto** da persona 05; o sunshine path foi projetado para nunca passar perto desse gatilho: zero monitoramento user-facing, zero métrica visível, zero badge de progresso
- ❌ **Fear:** *"Ser tratada como métrica"* — zero score, zero ranking, zero "frequência do mês", zero gráfico de barras
- ❌ **Fear:** *"Ser adjetivada por estado espiritual"* — zero label do tipo "iniciante", "morno", "em crescimento"; nomenclatura vetada user-facing (lint de code review + glossário banido)
- ❌ **Fear:** *"Fadiga de app e notificação"* — zero push, zero lembrete automático, zero celebração sintética; o app não puxa atenção da Juliana depois que ela fecha
- ❌ **Fear:** *"Abandono na 1ª semana por onboarding frio"* — a primeira sessão é **≤ 6 min** em linguagem pastoral, com calor humano real (nome do líder, rosto, propósito) em vez de tour corporativo
- ❌ **Fear:** *"Dúvida sobre LGPD"* — consentimento explícito no rodapé da tela de aceite (não gate), política de export/delete em linguagem humana na Epic 9 (R1b), logs de acesso auditáveis

**Business Goal:** Retenção pastoral do beneficiário final sem violar o princípio-raiz (*"presença digital ≠ saúde espiritual"*). A primeira sessão da Juliana é **a porta de entrada emocional do produto inteiro** para o único role que o produto existe para proteger.

**Design Implications aplicadas** (`design-process/B-Trigger-Map/05-key-insights.md`):

- **A — Radar humilde (invertido ao consumo):** o produto **oferece** o grupo com calma, nunca **exige** ação — o botão "Ver meu grupo" é convite, não imperativo
- **D — Linguagem-primeiro:** cada frase user-facing passa por auditoria de tom antes de ir pra Phase 4 — glossário banido é hard gate
- **F — Improviso Sagrado (aplicado ao consumo):** zero chatbot de boas-vindas, zero assistente virtual presumindo o estado emocional da Juliana, zero *"Como você tá se sentindo hoje?"*
- **Performance-first:** TTI ≤ 2s no Moto G4/G5 via SSR na tela de aceite + lazy load agressivo na tela autenticada

**Anti-patterns bloqueados** (extraído da persona 05 + consolidação dos padrões dos outlines 01–05):

- ❌ Nenhum formulário pós-OAuth pedindo campos extras (cargo, idade, telefone, tempo de igreja)
- ❌ Nenhum tour guiado forçado na primeira visualização
- ❌ Nenhuma tela *"Complete seu perfil em 3 passos"*
- ❌ Nenhum badge, nível, XP, coin, star ou gamificação de qualquer tipo
- ❌ Nenhum ranking de participação do grupo, mesmo disfarçado de "celebrar os presentes"
- ❌ Nenhum pop-up de *"Ative as notificações pra não perder"* (Epic 14 é Release 2; mesmo quando chegar, o default é opt-in silencioso)
- ❌ Nenhum *"Estudar agora"* / *"Começar trilha"* forçado (Epic 8 é R1b; antes disso, a tela de detalhe do grupo não tem CTA de trilha)
- ❌ Nenhum termo do glossário banido: *monitorar, rastrear, frequência, célula, engajamento (substantivo humano), lead, pipeline, dashboard (ao participante), rebanho, amado vocativo, score, ranking, check-in, KPI, leaderboard, pontuação, benchmark, CSV*
- ❌ **Nenhuma referência a FR57** (ação de cuidado pastoral) no release gate audit ou no sunshine path — FR57 é ferramenta do líder (outline 01), a persona Juliana nunca vê, nunca interage, e **nunca sabe que uma ação de cuidado existe no sistema** (decisão consolidada: cada outline audita apenas as features que sua persona toca diretamente)

---

## Scenario Steps

| Step | Rótulo semântico | Rota | Purpose | Exit Action |
|------|------------------|------|---------|-------------|
| 06.1 | `06.1-convite-por-email/` | Externa (Gmail/cliente de email) | Receber email transacional do líder com link personalizado | Toque no botão *"Confirmar presença no grupo"* |
| 06.2 | `06.2-tela-de-aceite-de-convite/` | `(public)/convite/[token]` (a confirmar — DDR ver abaixo) | Landing com nome do líder + grupo + 2 botões de auth; zero formulário pré-auth | Toque em *"Continuar com Google"* |
| 06.3 | `06.3-oauth-google/` | Externa (Google OAuth) | Autenticação em 2 toques com Google account pré-existente | Redirect automático após consentimento Google |
| 06.4 | `06.4-lista-dos-meus-grupos/` | `/app/consumo/grupos` | Ver o único card do grupo no qual a Juliana acabou de ser recebida | Toque em *"Ver meu grupo"* |
| 06.5 | `06.5-detalhe-do-meu-grupo/` | `/app/consumo/grupos/[id]` | Ver líder + propósito + próximo encontro + frase de fecho pastoral | Fechar o app em paz ✓ |

**First step (06.1)** inclui o contexto de entrada completo: situation (Q3) + mental state (Q4) + device (Q5) + discovery method (Q6). Per-page detalhes ficam para Phase 4 (UX Design / wireframes).

**Rotas referenciadas** (validadas contra `docs/architecture.md`):
- `/app/consumo/*` — experiência consolidada do participante (linha 502, UX-DR22–25)
- `(public)/` — route group SSR para rotas públicas sem auth (linha 876)
- `modules/auth/` via middleware + `(public)/` — padrão já estabelecido para FR01–FR11 (linha 1282)

**On-step interactions** (que não saem do step, documentados como storyboard items na Phase 4): estado de loading em cada transição (≤ 2s target), empty state da lista de grupos se por alguma razão o vínculo não tiver sido criado, erro de token de convite expirado com mensagem pastoral, fallback de auth via email/senha se Google falhar, cache-first via TanStack Query runtime na lista e detalhe do grupo.

---

## Release Gate Audit

### Features com story/FR real no Release 1a-alpha / 1a-beta

| Elemento | Release gate | Epic / FR | Nota |
|---|---|---|---|
| Convite por email (token + validação) | ✅ **Release 1a-alpha** | Epic 4 FR23 (`_bmad-output/planning-artifacts/epics.md` linha 533) | `docs/prd.md` linha 1188: *"Admin/Líder convide participantes via e-mail ou link de convite"* |
| Participante visualiza seus grupos | ✅ **Release 1a-alpha** | Epic 4 FR26 (`epics.md` linha 533–535) | Rota autenticada `/app/consumo/grupos`, já coberta |
| Auth Google OAuth (Continuar com Google) | ✅ **Release 1a** (mergeado) | Story 2.2 (PR #20, merge `6f99b63`) | Já em produção, coerência com código atual |
| Auth email/senha (fallback) | ✅ **Release 1a** (mergeado) | Story 2.1 | Já em produção |
| Tela de boas-vindas personalizada | ✅ **Release 1a-beta** | Epic 7 FR69 | Ver nota sobre dualidade de release gate abaixo |
| Vocabulário pastoral user-facing | ✅ **Release 1a-beta** | Epic 6 FR62 + glossário banido root | Gate de linguagem obrigatório |

### Dualidade de release gate: NFR-X3 (≤ 2 min até primeira trilha)

**⚠️ Dualidade detectada** — mesmo padrão da FR60 resolvida no outline 03 e da FR57 do Epic 6:

- **Master NFR table** (`docs/prd.md` linha 1494): *"NFR-X3 | Participante deve conseguir acessar sua primeira trilha | ≤ 2 min após aceitar convite | **1b**"*
- **Epic 7 header** (`_bmad-output/planning-artifacts/epics.md` linha 560–563): *"Epic 7: Onboarding Mínimo (Release 1a-beta) · NFRs cobertos: NFR-X1, **NFR-X2, NFR-X3**"*

**Problema para o outline 06:** o sunshine path promete ≤ 2 min do clique no email à visualização do grupo — alinhado com o *espírito* do NFR-X3, mas **o texto do NFR-X3 fala de "primeira trilha", não de "primeiro grupo"**. Primeira trilha (Epic 8 Minhas Trilhas) é **Release 1b** explicitamente. Então há dois gaps:

1. **O NFR-X3 em si tem dualidade de release gate** — 1b no master table, 1a-beta no Epic 7. Precisa ser resolvido.
2. **O escopo do NFR-X3 ainda está para "primeira trilha"** — se aplicado literalmente, o outline 06 não pode prometer nada até Epic 8 (R1b).

**Proposta de mapeamento (replicando a resolução Opção A do outline 03):**

- **Opção A — Promover NFR-X3 para Release 1a-beta com escopo ajustado:** texto vira *"Participante deve conseguir acessar **seu primeiro grupo** (e a primeira trilha quando Epic 8 estiver pronto) em ≤ 2 min após aceitar convite."* Mantém a intenção original do NFR (velocidade da primeira sessão) e separa o marco "primeiro grupo" (R1a-alpha via Epic 4 FR26) do marco "primeira trilha" (R1b via Epic 8). Alinha com Epic 7 que já lista NFR-X3 como 1a-beta.
- **Opção B — Manter NFR-X3 como 1b literal e aceitar gap:** outline 06 explicita que *"o caminho até o grupo funciona em 1a-alpha/1a-beta mas o NFR-X3 oficial só é cumprido no Release 1b quando a primeira trilha estiver acessível"*. Gera débito de UX explícito para R1a-beta.

**Recomendação:** **Opção A** — promover NFR-X3 para 1a-beta com o escopo ajustado. É coerente com o precedente do outline 03 (FR60 promovido a 1a-beta por endosso do user), é coerente com o Epic 7 que já lista NFR-X3 como 1a-beta, e é a única forma de o outline 06 fazer sentido sem inflar débito.

**Ação requerida no grooming:**
1. Validar Opção A como correção formal do master NFR table
2. Atualizar `docs/prd.md` linha 1494 com o novo texto e release gate
3. Anotar este outline como fonte da correção

### Tela de aceite de convite pré-auth — débito menor

**Problema:** o sunshine path assume uma tela (*step 06.2*) renderizada sob `(public)/convite/[token]` que mostra nome do líder + foto + nome do grupo **antes** de auth. Isso exige:
- Rota pública associada ao token de convite
- Resolver (leve, sem auth) que carrega nome do líder + grupo + eventualmente foto do líder
- Zero dado sensível exposto (nada além do que já está no email, que é nome do líder + nome do grupo)

FR23 (Epic 4) diz *"convide participantes via e-mail ou link de convite"* — o **link de convite** implícito no FR23 é exatamente essa tela. Não é um DDR forte, mas é um ponto de rastreabilidade que merece confirmação.

**Proposta:**
- **Opção A — Tela de aceite como parte natural do FR23 (recomendado):** interpretação ampla do FR23 — o "link de convite" inclui a landing pré-auth com contexto mínimo do líder + grupo. Zero story nova, zero DDR. Scaffolding na Epic 4. ✅
- **Opção B — Tela de aceite como DDR explícita:** criar uma story nova na Epic 4 específica para a landing de convite (renderização + resolver pré-auth + consentimento LGPD discreto + CTA de auth). Gera visibilidade maior na engineering queue mas é overhead.

**Recomendação:** **Opção A** — tratar como interpretação ampla de FR23, sem criar DDR formal. A tela é minimalista (nome do líder, nome do grupo, 2 botões de auth) e não carrega lógica complexa. Ação de grooming: confirmar com engenharia que a interpretação ampla é aceita.

### Vetos permanentes (mesmo padrão do outline 04)

| Elemento | Status |
|---|---|
| Push notification de boas-vindas / celebração | ❌ Epic 14 = Release 2 · **veto permanente no MVP** |
| WhatsApp/SMS como canal canônico de convite | ❌ Epic 14 = Release 2 · veto permanente no MVP (ver nota aspiracional abaixo) |
| Formulário pós-OAuth pedindo campos de perfil | ❌ Veto permanente (anti-padrão de vigilância) |
| Tour guiado forçado na primeira visualização | ❌ Veto permanente (fadiga de app, persona 05 Driving Force negativa) |
| Gamificação, badges, XP, níveis, rankings | ❌ Veto permanente (persona 05: "ser tratado como métrica") |
| Celebrações sintéticas automatizadas (*"Parabéns! 🎉"*) | ❌ Veto permanente |
| Labels de estado espiritual (*"iniciante", "em crescimento"*) | ❌ Veto permanente (lint de glossário banido) |
| Comparação com outros participantes ("X% dos membros do grupo") | ❌ Veto permanente |
| Pop-up de *"Ative as notificações"* | ❌ Veto permanente (quando Epic 14 chegar, default = opt-in silencioso) |

### Nota aspiracional de canal — WhatsApp no pós-MVP

Este outline usa **email transacional como canal canônico** do Release 1a-alpha porque é a única coisa que o FR23 garante no gate do MVP. Há um reconhecimento honesto de que, pastoralmente, **o canal emocionalmente ideal para a Juliana seria WhatsApp** — é onde ela já vive, onde o email é "coisa do trabalho", onde a voz do líder chega de forma mais calorosa.

**Quando WhatsApp estiver disponível** (Epic 14 Release 2, ou integração ChatMaster Veloz pós-MVP), este outline deve ser **revisitado** — a estrutura do sunshine path permanece idêntica (o step 06.1 muda de canal, tudo o mais se mantém), mas o tom emocional do primeiro contato pode ser recalibrado para explorar WhatsApp como entry point preferencial.

**Não é débito do outline 06** — é *reconhecimento de oportunidade futura*. O sunshine path do 1a-alpha funciona honestamente com email, mesmo que email seja menos pastoralmente rico que WhatsApp.

### Divergência da PRD Jornada 1 (Juliana) — documentada

**⚠️ Divergência deliberada:** a Jornada 1 da Juliana no PRD (`docs/prd.md` linhas 377–389) descreve o caminho completo da Juliana ao longo de 6 semanas, incluindo features que **não estão no Release 1a-alpha/1a-beta**:

- **Gamificação ("nível Semente", marcos visuais)** → Epic 8 R1b + gate estético Release 2 (gamificação pastoralizada ainda precisa de decisão de produto; ver glossário banido)
- **Notificações push de celebração ("Parabéns! Você concluiu 🎉")** → Epic 14 R2, mais vetado explicitamente pelo tone audit
- **Lembretes via WhatsApp na sexta ("Juliana, sua próxima aula está te esperando")** → Epic 14 R2
- **Progresso automático em vídeo ("conclusão quando assiste 90%")** → Epic 8 R1b
- **Notificação ao líder de celebração → "Marcos a parabeniza pessoalmente na reunião seguinte"** → depende de Epic 8 + eventualmente Epic 14

**Este outline 06 cobre apenas o primeiro momento da jornada da Juliana — o recebimento do cuidado inicial e o primeiro contato com o grupo.** Os momentos subsequentes (progressão de trilha, presença em reunião ao vivo, celebrações, silêncios mapeados pelo radar) são cobertos por outros cenários (outline 02 líder-roda-reunião para presença em LiveKit; outline 01 líder-vence-a-quarta para o radar agir sobre o silêncio) ou dependem de Releases posteriores (Epic 8 R1b para trilhas, Epic 14 R2 para notificações).

**Justificativa da divergência:**
- A Jornada 1 do PRD é **aspiracional de produto completo** — ela descreve como o produto funciona quando todos os Epics estiverem entregues, não o estado do Release 1a-alpha/1a-beta
- A gamificação pastoralizada ainda precisa de decisão de produto (não é só "habilitar tudo" — é *"repensar a gamificação pelos 4 filtros pastorais e decidir se entra ou não"*)
- O canal WhatsApp requer Epic 14 ou integração ChatMaster Veloz pós-MVP
- O outline 06 é honesto com o gate atual: promete apenas o que existe no 1a-alpha/1a-beta

**Ação requerida no grooming:**
1. **Validar a divergência com o time de produto** — esta decisão precisa ser aceita formalmente como "cenário parcial do MVP, não cenário completo da jornada da Juliana"
2. **Confirmar que a gamificação está sob revisão pastoral** — o "nível Semente" da PRD Jornada 1 não pode entrar direto no produto; precisa passar pelos 4 filtros antes do Release 1b
3. **Registrar este outline como fonte da divergência temporária** na entrada do design log da Phase 3

### Resumo dos débitos

Este cenário gera **3 débitos explícitos** + 1 reconhecimento aspiracional:

1. **NFR-X3 dualidade de release gate** — master table diz R1b, Epic 7 diz R1a-beta. Recomendação Opção A: promover para R1a-beta com escopo ajustado ("primeiro grupo" em 1a-beta; "primeira trilha" em 1b). Ação de grooming: corrigir `docs/prd.md` linha 1494.
2. **Tela de aceite de convite pré-auth** — interpretação ampla de FR23 (recomendado) ou DDR formal. Ação de grooming: confirmar interpretação ampla com engenharia.
3. **Divergência da PRD Jornada 1 (Juliana)** — outline 06 cobre só o primeiro momento da jornada; o restante depende de Epic 8 (R1b), Epic 14 (R2) e decisão de produto sobre gamificação pastoralizada. Ação de grooming: validar divergência e registrar este outline como fonte.
4. **Reconhecimento aspiracional de canal WhatsApp (não é débito):** o canal emocionalmente ideal para a Juliana seria WhatsApp, mas o sunshine path do 1a-alpha funciona honestamente com email. Revisitar quando Epic 14 ou ChatMaster Veloz chegarem.

---

## Tone audit (glossário banido)

Verificação interna antes de salvar — nenhuma ocorrência user-facing de: *monitorar, rastrear, frequência (como métrica), célula, engajamento (substantivo humano), lead, pipeline, dashboard (ao participante), rebanho, amado vocativo, score, ranking, check-in, KPI, leaderboard, pontuação, benchmark, CSV (sem explicação), analytics, real-time, funnel, conversão, churn, enterprise, best-in-class, AI-powered, game-changing, engagement metrics*. ✅

**Substituições deliberadas:**
- "monitorar seu progresso" → "ver sua trilha quando quiser" (mas Epic 8 R1b, não aparece no outline 06)
- "seu engajamento na reunião" → nunca aparece (métrica user-facing vetada pra participante)
- "frequência do mês" → nunca aparece (veto absoluto)
- "dashboard do participante" → "meus grupos" + "meu grupo"
- "onboarding" (UI) → nunca aparece — usamos "primeira sessão", "primeiro contato", "boas-vindas"
- "check-in" → nunca aparece — presença acontece via LiveKit webhook no outline 02, zero tile-tap manual
- "ativar conta" → "confirmar presença no grupo" (linguagem humana)
- "Complete your profile" → não existe; zero campos pós-OAuth

**Vocabulário substitutivo adotado:** *cuidado, grupo, encontro, líder, convite, presença (como fato humano), meu grupo, confirmar, acolher, sem pressa, a gente tá aqui.*

**Frases-fecho pastorais** (puxadas do tom do outline 01 e da persona 05):
- *"Sem pressa. Quando você vier, a gente tá aqui."* — fecho da tela de detalhe do grupo
- *"A gente começou um grupo pequeno aqui na igreja que eu acho que pode te servir."* — abertura do email do Marcos
- *"Sem compromisso nenhum além disso."* — fecho do email

---

## Conexão com outros outlines

- **Outline 01 (líder-vence-a-quarta-de-manha):** quando a Juliana fica em silêncio por 2 semanas após a primeira sessão, é o radar do outline 01 que eventualmente leva o Marcos a pensar nela na quarta de manhã. **O cuidado que a Juliana recebe no futuro (outline 01) nasce do fato de ela ter sido recebida com dignidade no outline 06.** Sem uma porta de entrada digna, não há silêncio a ser notado — há apenas abandono na 1ª semana (o red flag crítico da persona 05).
- **Outline 02 (líder-roda-reunião-e-fecha-loop):** se a Juliana voltar na quarta para o primeiro encontro ao vivo, ela participa pelo celular (mesmo estando presencial ou remota) via LiveKit — e a presença dela é registrada via webhook do Epic 5 FR46 (Story 5.3) automaticamente, sem tile-tap manual. **A Juliana nunca é pedida para "fazer check-in"**, porque check-in é anti-pastoral (glossário banido + persona 05 Driving Force negativa).
- **Outline 05 (admin-faz-onboarding-minimo):** o grupo "Fundamentos da Fé" que a Juliana vê na tela 06.4 foi criado pelo admin (Cláudia) no outline 05 passo 5. A continuidade narrativa 05 → 06 é: Cláudia cria a igreja → Cláudia cria o grupo → Marcos convida a Juliana → Juliana recebe o cuidado inicial.

**O que o outline 06 intencionalmente NÃO cobre** (será coberto por outros cenários):
- Primeira trilha navegada pela Juliana — Epic 8 R1b, não há outline dedicado ainda
- Primeira reunião ao vivo da Juliana — outline 02 cobre do lado do líder, a experiência do participante na sala fica para Phase 4 como anotação
- Silêncio da Juliana sendo notado pelo radar — outline 01 (lado do líder)
- Ação de cuidado registrada pelo líder — outline 01 (lado do líder); FR57 é ferramenta do líder, fora do escopo do 06

---

_Outlined sob Phase 3 — UX Scenarios · Mode: Suggest com checkpoint por cenário · Override pastoral × edtech: linha pastoral governa em qualquer conflito · Este cenário é o **coração da tese do produto** — é o único cenário onde o beneficiário final aparece em primeira pessoa, e é a prova de que o produto consegue traduzir o princípio inviolável "dignidade antes de dado" em uma experiência de 5 minutos · 3 débitos de release gate + 1 reconhecimento aspiracional documentados para grooming · Padrão emergido do outline 06: **cada outline audita apenas as features que sua persona toca diretamente** — FR57 fora do escopo, mencionado apenas narrativamente como cola entre 06 e 01 · Padrão emergido: **rótulos semânticos no lugar de numeração não verificada** — inventário canônico das 38 páginas será consolidado no Step 06 (hub 00-ux-scenarios.md)._
