---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - auxiliar/metanoia-hub-prd.md
  - _bmad-output/planning-artifacts/metanoia-hub-prd-validation-report.md
workflowType: 'prd'
classification:
  projectType: web_app + saas_b2b
  domain: edtech
  complexity: high
  projectContext: greenfield
  buyerProfile: non-technical B2B
  earlyAdopterSegment: escolas bíblicas e ministérios de formação
  mobileStrategy: mobile_responsive (crítico)
  productDNA: cuidado pastoral (não vigilância)
  developmentApproach: AI-assisted development
  whatsappProvider: ChatMaster Veloz (clihelper.chatmasterveloz.com)
  domainConcerns:
    - child_safety
    - realtime_communications
    - tenant_hierarchy
    - proactive_alerts
    - pastoral_care_framing
    - devotional_content
    - api_public
    - sla_defined
    - tiering_pricing
  lovableMVP:
    - Auth + Grupos
    - Trilhas + Conteúdo
    - Reunião (integração agnóstica com webhooks)
    - Presença + Engajamento (sinais de cuidado)
    - Relatórios para Líder (dashboard semáforo)
    - Lembretes WhatsApp (API ChatMaster Veloz)
  elicitationInsights:
    premortem: complexidade high, mobile-first, child_safety, buyer non-technical, scope creep risk
    focusGroup: content templates, alertas evasão, câmera configurável, hierarquia tenants, resumo pré-reunião
    roundTable: tiering pricing, reframing controle→cuidado, conteúdo devocional, API pública, SLA
    firstPrinciples: reunião agnóstica, single-tenant tenant-aware, trilhas catálogo N:N, jornada pessoal não ranking, P0 Líder+Participante
    sharkTank: TAM/SAM/SOM, análise competitiva, go-to-market, lovable MVP 5 domínios, early adopter segment
    warRoom: WhatsApp API real, Daily.co MVP, dashboard semáforo, 6 domínios factíveis
---

# Product Requirements Document - metanoia-hub

**Author:** Paulo
**Date:** 2026-04-05

## Executive Summary

O Metanoia Hub é uma plataforma web SaaS para discipulado cristão que conecta encontro ao vivo, trilhas de formação, acompanhamento de presença e visibilidade pastoral numa experiência integrada. O produto resolve a fragmentação atual — onde igrejas usam WhatsApp + videoconferência + Google Drive sem nenhuma visibilidade sobre quem está engajado, quem está se afastando e quem completou a formação.

A plataforma funciona como um **radar pastoral**: revela sinais digitais de participação e distanciamento para que o líder saiba quem precisa de atenção antes que seja tarde. O radar é bidirecional — monitora participantes, líderes e grupos. O produto mede sinais, não almas: presença digital não equivale a saúde espiritual, e o discernimento pastoral permanece com o líder.

O público inicial são escolas bíblicas e ministérios de formação com 30+ participantes em programas estruturados de discipulado — organizações que já sentem a dor de não conseguir acompanhar formação em escala. O modelo de negócio prevê 3 tiers (free, pro, enterprise) com crescimento orgânico via redes de igrejas.

O MVP ("Lovable MVP") abrange 6 domínios: autenticação e grupos, trilhas e conteúdo, reunião ao vivo por integração, presença e engajamento, relatórios para o líder e lembretes via WhatsApp (API ChatMaster Veloz). Um líder cria sua primeira trilha em ≤ 5 minutos usando modelos prontos e configura seu primeiro grupo operacional em ≤ 10 minutos. A complexidade é progressiva, nunca obrigatória — modo express para quem começa, modo avançado para quem precisa.

A visão de longo prazo evolui de radar para **copiloto pastoral com IA** — de "mostrar quem precisa de atenção" para "recomendar ações de cuidado".

### What Makes This Special

O Metanoia Hub não substitui ferramentas — substitui a **fragmentação**. É a única solução que integra encontro ao vivo, trilha de formação, sinais de engajamento e visão pastoral num produto desenhado especificamente para discipulado cristão.

Diferenciadores concretos:
- **Dashboard semáforo** (🟢🟡🔴) que traduz dados de participação em linguagem pastoral — "painel de saúde dos meus grupos"
- **Vocabulário pastoral** nativo — jornada de formação, sinal de atenção, marco de crescimento — não linguagem corporativa
- **Escala responsável** — amplia o alcance do cuidado sem fingir que substitui o limite humano de relacionamentos profundos
- **Confiabilidade do sinal** — prioriza padrões sobre eventos isolados, permite correção humana, e nunca penaliza por falhas técnicas
- **Complexidade progressiva** — modo express para líder não-técnico (primeiro grupo em ≤ 10 min), modo avançado para escolas bíblicas com estrutura pedagógica

## Project Classification

| Atributo | Valor |
|----------|-------|
| Tipo de projeto | Web App + SaaS B2B |
| Domínio | EdTech (discipulado cristão e formação online) |
| Complexidade | Alta (domínio composto: edtech + realtime + SaaS multi-tenant) |
| Contexto | Greenfield |
| Perfil do buyer | Non-technical B2B (pastores, líderes ministeriais) |
| Early adopter | Escolas bíblicas e ministérios de formação |
| Estratégia mobile | Mobile-responsive (crítico — maioria acessa por celular) |
| DNA do produto | Cuidado pastoral, não vigilância |
| Desenvolvimento | AI-assisted development |
| Integração WhatsApp | ChatMaster Veloz (API já disponível) |

## Glossário

| Termo | Definição |
|-------|-----------|
| **Tenant** | Organização cliente (igreja, escola bíblica, ministério) com espaço isolado na plataforma |
| **Líder** | Responsável por um ou mais grupos de discipulado; conduz reuniões e acompanha participantes |
| **Participante** | Pessoa vinculada a um grupo que consome trilhas e participa de reuniões |
| **Grupo** | Turma de discipulado com líder(es) e participantes vinculados |
| **Trilha** | Percurso de formação composto por módulos e aulas |
| **Semáforo** | Classificação visual (🟢🟡🔴) do status de engajamento de um participante |
| **Radar Pastoral** | Conceito de produto: dashboard que traduz sinais digitais em visibilidade pastoral |
| **Presença Integral** | Participante que cumpre todos os critérios de presença configurados pelo tenant |
| **Presença Parcial** | Participante que entrou na reunião mas não cumpriu todos os critérios |
| **RLS** | Row-Level Security — isolamento de dados no nível do banco de dados por tenant |
| **SSE** | Server-Sent Events — canal de comunicação unidirecional para atualizações em tempo real |
| **RPO** | Recovery Point Objective — perda máxima de dados aceitável em caso de falha |
| **RTO** | Recovery Time Objective — tempo máximo para restaurar o serviço após falha |
| **DLQ** | Dead-Letter Queue — fila para mensagens que falharam no processamento |
| **Feature Toggle** | Flag de configuração que ativa/desativa funcionalidade por tenant sem deploy |
| **Copiloto Pastoral** | Evolução futura do radar: de mostrar sinais para recomendar ações de cuidado via IA |
| **Wizard of Oz** | Técnica de validação onde um humano simula comportamento de IA antes de implementá-la |

## Princípios de Design & Constraints

> Estas constraints são transversais a todo o produto. Devem ser respeitadas em todas as fases de design, implementação e revisão.

### UX para Buyer Não-Técnico

A UX do Metanoia Hub parte do princípio de que o comprador e o operador principal não são usuários técnicos. A interface deve ser clara, acolhedora e autoexplicativa.

**Princípios práticos:**
- Sem termos técnicos desnecessários na interface do usuário
- Ícone sempre acompanhado de texto
- CTA claro e direto — explicar o valor da ação, não apenas o nome da funcionalidade
- Poucos caminhos por tela — reduzir carga cognitiva
- Feedback imediato após cada ação (confirmação visual, mensagem de status)
- Interface pensada para uso em celular (touch targets ≥ 44px, tipografia legível)

### Vocabulário Pastoral como Constraint

Linguagem não é detalhe de copy — é parte do produto. O vocabulário usado na interface varia conforme o papel do usuário e respeita o contexto pastoral.

**Auditoria de linguagem por role:**

| Role | Tom | Exemplos |
|------|-----|----------|
| Admin | Operacional, direto | "Configurar grupo", "Gerenciar trilha", "Publicar conteúdo" |
| Líder | Acompanhamento e cuidado | "Acompanhar jornada", "Ver sinais de cuidado", "Participantes que precisam de atenção" |
| Participante | Acolhedor, motivador | "Próximo passo", "Sua trilha", "Seu progresso" |

**Regra:** Toda nova tela ou componente deve passar por revisão de vocabulário antes de ser considerada pronta.

### Posicionamento Anti-Vigilância

O Metanoia Hub não comunica monitoramento como fiscalização. A regra de design é: a interface reforça que o sistema oferece **sinais para cuidado**, não instrumentos de vigilância.

**Reframing obrigatório:**

| Evitar | Preferir |
|--------|----------|
| "Usuários inativos" | "Precisam de atenção" |
| "Falha de presença" | "Baixo engajamento recente" |
| "Baixa performance" | "Sinais de afastamento" |
| "Monitoramento" | "Acompanhamento" |
| "Controle" | "Visibilidade pastoral" |

**Princípios:**
- Evitar linguagem punitiva e métricas expostas de forma agressiva
- Tornar visível que presença digital é um sinal limitado
- A decisão final é sempre humana — o sistema informa, não julga

### Complexidade Progressiva

A plataforma adota complexidade progressiva: a maioria dos usuários começa rápido sem ser exposta a todas as possibilidades.

**Modo Express (padrão para novos usuários):**
- Criar grupo, agendar reunião, acompanhar presença, ver semáforo, enviar lembrete
- Fluxos essenciais já organizados, baixa necessidade de configuração

**Modo Avançado (admin e operações maduras):**
- Configurar trilhas com regras de progresso, automações, permissões granulares, relatórios detalhados e integrações
- Disponível sob demanda, nunca imposto

**Regra:** Funcionalidades avançadas não devem poluir a experiência express. Revelação progressiva via menus secundários, seções colapsáveis ou configurações dedicadas. A transição do modo express para avançado é sempre iniciada pelo usuário (nunca automática) via configuração do tenant.

**Mecanismo de transição:** O Admin Tenant ativa funcionalidades avançadas no painel de configurações do tenant (toggle por feature: trilhas avançadas, automações, relatórios detalhados, permissões granulares). O sistema pode exibir um banner informativo sugerindo a ativação quando detecta uso maduro (ex.: >3 grupos ativos, >50 participantes, >10 reuniões realizadas), mas nunca auto-transiciona. A sugestão é dismissável e não reaparece após ser descartada.

### Acessibilidade como Princípio de Design

Acessibilidade não é checklist técnico — é extensão do DNA pastoral. Incluir é cuidar. O produto deve ser utilizável por pessoas com deficiências visuais, motoras ou cognitivas desde o design, não como remediação posterior.

**Princípios:**
- Acessibilidade é considerada em cada decisão de design, não apenas na validação final
- Componentes custom (semáforo, player, dashboard) devem ser projetados acessíveis desde o início
- Semáforo nunca depende apenas de cor — ícones e texto complementar são obrigatórios
- Targets técnicos: WCAG 2.1 AA (ver NFRs de Acessibilidade para critérios mensuráveis)

## Success Criteria

### User Success

O líder experimenta sucesso quando o sistema transforma dados de participação em **sinais acionáveis de cuidado pastoral**. O momento "aha!" acontece quando o dashboard semáforo (🟢🟡🔴) revela um participante em risco de afastamento — e o líder age antes que a pessoa se desconecte do discipulado.

Critérios mensuráveis:
- **Tempo para primeiro valor**: líder cria sua primeira trilha em ≤ 5 minutos e configura seu primeiro grupo operacional em ≤ 10 minutos usando onboarding guiado
- **Ação pastoral baseada em dados**: líder acessa perfil de participante com sinal 🟡/🔴 e registra ação de cuidado (mensagem, ligação, visita) dentro de 48h do alerta — pelo menos 1 caso por grupo ativo nos primeiros 90 dias
- **Uso recorrente semanal**: líderes acessam o dashboard e conduzem reuniões semanalmente, sem abandono da ferramenta
- **Presença consistente**: taxa de presença dos participantes se mantém estável ou cresce ao longo das semanas dentro de cada grupo
- **NPS do líder**: ≥ 40 aos 3 meses de uso, confirmando valor percebido além da funcionalidade

### Business Success

**3 meses (validação interna):**
- 3 a 5 grupos ativos operando de forma recorrente no primeiro tenant
- Líderes usando a plataforma semanalmente (≥ 80% de semanas com ao menos 1 sessão por grupo ativo)
- Presença consistente dos participantes (≥ 70% de presença média por reunião)
- Casos concretos documentados de reengajamento pastoral baseado em sinais do sistema
- NPS do líder ≥ 40

**12 meses (tração comercial):**
- ≥ 5 tenants pagantes ativos
- Retenção alta de tenants (churn mensal ≤ 3%)
- ARR alvo: ~R$66.000 (referência: 3 Pro + 2 Enterprise)
- Tempo de ativação do tenant ≤ 7 dias (do cadastro ao primeiro grupo ativo)
- CAC rastreado desde o início para calibrar go-to-market
- Pipeline ativo de novos tenants via rede de igrejas (crescimento orgânico)

### Technical Success

- **Disponibilidade MVP (primeiros 6 meses)**: 99,5% de uptime (≤ 44h/ano) — escala para 99,9% após estabilização da infra
- **Performance web**: LCP < 2,5s, FID < 100ms, CLS < 0,1 (Core Web Vitals dentro dos padrões modernos)
- **Reuniões confiáveis**: entrada na sala em < 3s em conexão 4G (mobile-first), presença auditável com registro automático, zero perda de dados de engajamento
- **Monitoramento**: qualidade de reunião monitorada em tempo real (latência, perda de pacotes, status de câmera/áudio)
- **Capacidade MVP**: suportar até 100 participantes simultâneos no primeiro tenant
- **Resiliência de dados**: RPO ≤ 1h (perda máxima de dados) e RTO ≤ 4h (tempo máximo de recuperação)

### Measurable Outcomes

| Métrica | Alvo 3 meses | Alvo 12 meses |
|---------|-------------|---------------|
| Grupos ativos recorrentes | 3–5 | 30+ (across tenants) |
| Uso semanal por líder | ≥ 80% das semanas | ≥ 80% das semanas |
| Presença média por reunião | ≥ 70% | ≥ 75% |
| Reengajamento pastoral documentado | ≥ 1 por grupo | Métrica consolidada por tenant |
| NPS do líder | ≥ 40 | ≥ 50 |
| Tenants pagantes | 1 (validação) | ≥ 5 |
| Churn mensal de tenants | N/A | ≤ 3% |
| ARR | N/A | ~R$66.000 |
| Tempo de ativação do tenant | N/A | ≤ 7 dias |
| Uptime | 99,5% | 99,9% |
| Core Web Vitals | Dentro do padrão | Dentro do padrão |
| RPO / RTO | ≤ 1h / ≤ 4h | ≤ 1h / ≤ 4h |

### Notas de Rastreabilidade

> Os seguintes critérios de sucesso dependem de mecanismos ainda não cobertos por FRs específicos:

| Critério | Gap | Resolução |
|----------|-----|-----------|
| NPS do líder ≥ 40 | Não há FR para coleta de NPS | Coleta manual nos primeiros 3 meses; FR para coleta in-app planejado para Phase 3 |
| Reengajamento pastoral documentado | Modo de reengajamento movido para Phase 3 | No MVP, o registro de ações de cuidado (FR57) substitui como proxy |
| Tempo de ativação ≤ 7 dias | "7 dias" = do cadastro ao primeiro grupo ativo (não confundir com onboarding UX de ≤ 10 min) | NFR-X1 cobre o onboarding técnico; ativação inclui também adoção organizacional |

## Estratégia de Distribuição & Crescimento

O crescimento do Metanoia Hub segue uma lógica de **rede e confiança**, não de mídia paga. O canal mais natural não é o usuário individual, mas a **liderança que influencia outras lideranças**: igrejas locais, ministérios, redes de discipulado, escolas bíblicas e comunidades com operação multicampus ou células.

### Modelo de Go-to-Market

1. **Implantação de referência** — Sucesso documentado no primeiro tenant (3-5 grupos ativos, métricas de presença e engajamento comprovadas)
2. **Case real** — Transformar uso em case com dados concretos: retenção, reengajamento pastoral, ganho de escala
3. **Expansão por rede** — Crescimento orgânico via:
   - Indicação direta entre líderes e pastores
   - Relacionamento pastoral e confiança institucional
   - Eventos ministeriais e conferências de liderança
   - Treinamentos e workshops práticos
   - Parceiros estratégicos (seminários, editoras cristãs, associações ministeriais)
   - Redes ministeriais e denominações com estrutura de formação

### Canais Prioritários

| Canal | Fase | Custo |
|-------|------|-------|
| Indicação entre líderes (word of mouth) | Desde o Release 1 | Zero |
| Case de referência documentado | Pós-validação (3 meses) | Baixo |
| Eventos e conferências ministeriais | 6-12 meses | Médio |
| Parcerias com seminários e escolas bíblicas | 6-12 meses | Médio |
| Redes denominacionais (top-down) | 12+ meses | Baixo (relacionamento) |

### Princípio Operacional

O Metanoia Hub não vende features — vende **resultado pastoral documentado**. Cada tenant bem-sucedido é um canal de distribuição. O produto cresce quando líderes contam para outros líderes que "agora consigo enxergar quem precisa de mim".

## Product Scope

> Para detalhes de implementação, timeline por release e gates de aprovação, ver seção **Project Scoping & Phased Development**.

### Mapeamento Fase ↔ Release

| Fase (Product Scope) | Release (Implementação) | Foco |
|---|---|---|
| Fase 1 — Fundação | Release 1a (Core Loop) | Auth + Grupos + Trilhas |
| Fase 2 — Reuniões | Release 1b (Polish) + Release 2 (Radar) | Operacional + Reunião + Visibilidade |
| Fase 3 — Growth | Phase 3 / Post-MVP | Automações, WhatsApp, gravação |
| Fase 4 — Enterprise | Phase 4 | Quiz, gamificação, API pública, hierarchy |
| Fase 5 — Vision | Phase 5 | IA, copiloto pastoral, busca semântica |

### MVP — Minimum Viable Product (Fases 1 + 2)

**Fase 1 — Fundação:**
- Autenticação centralizada (e-mail/senha + Google) e multi-tenant base
- Grupos/turmas com vínculo de líderes e participantes
- Trilhas de ensino com módulos, aulas e conteúdo multiformato
- Upload e visualização controlada de conteúdo
- Dashboards básicos e relatórios operacionais
- Auditoria base e conformidade LGPD inicial

**Fase 2 — Reuniões ao vivo:**
- Módulo de reuniões com integração de videoconferência
- Registro de presença com regras objetivas (integral/parcial)
- Indicadores de engajamento (câmera, tempo de sala, foco)
- Dashboard semáforo (🟢🟡🔴) para visibilidade pastoral
- Gravação de reuniões
- Relatórios pós-reunião

### Growth Features — Post-MVP (Fase 3)

- Lembretes e automações via WhatsApp (API ChatMaster Veloz)
- Alarmes configuráveis de evasão e inatividade
- Logs de envio/entrega de notificações
- Recorrência operacional de reuniões
- Templates de conteúdo devocional

### Enterprise/Scale (Fase 4)

- Quiz e avaliações com banco de questões
- Progresso granular por aula/módulo/trilha
- Gamificação (pontos, níveis, ranking)
- Hierarquia avançada de tenants (redes de igrejas)
- Isolamento dedicado para tenants enterprise
- API pública e SLA contratual

### Vision — Future (Fase 5)

- Copiloto pastoral com IA — de "mostrar quem precisa de atenção" para "recomendar ações de cuidado"
- Geração de quiz baseada no conteúdo via IA
- Busca semântica com pgvector e embeddings
- Insights preditivos de retenção e engajamento
- Resumo pré-reunião gerado por IA

## User Journeys

### Jornada 1 — Líder: O Radar Pastoral em Ação

**Persona:** Pastor Marcos, 42 anos, coordena 3 grupos de discipulado numa escola bíblica com 60 participantes. Conhece bem seus alunos presenciais, mas nos encontros online perde visibilidade — não sabe quem está realmente engajado e quem está "apenas conectado".

**Opening Scene:** É segunda-feira à noite. Marcos abre o Metanoia Hub para preparar a reunião de quarta. No dashboard, o semáforo do grupo "Fundamentos da Fé" mostra 2 participantes em 🔴 — Ana e Pedro não participaram das últimas 2 reuniões e não avançaram na trilha. Marcos não tinha percebido.

**Rising Action:** Marcos clica no perfil de Ana. Vê o histórico: presença integral nas primeiras 6 semanas, depois presença parcial, depois ausência. O sinal mudou de 🟢 para 🟡 há 3 semanas e para 🔴 na semana passada. Marcos registra uma ação de cuidado: "Enviar mensagem pessoal pelo WhatsApp." Faz o mesmo com Pedro.

Na quarta, Marcos inicia a reunião pelo Hub. Os participantes entram em < 3 segundos. Durante a reunião, o sistema registra presença, câmera e engajamento automaticamente. Marcos não precisa fazer nada — conduz a reunião normalmente. Ao final, o relatório pós-reunião aparece: 85% de presença integral, 2 participantes com câmera desligada, tempo médio na sala de 58 minutos (de 60).

**Climax:** Na quinta, Ana responde a mensagem de Marcos. Estava passando por dificuldade pessoal e achou que ninguém notaria sua ausência. Marcos responde: "Eu notei." Ana volta na reunião seguinte. Marcos percebe que, sem o semáforo, teria perdido Ana silenciosamente.

**Resolution:** Marcos agora começa cada semana pelo dashboard. Em 5 minutos, sabe exatamente quem precisa de atenção. Seu cuidado pastoral ganhou escala sem perder humanidade. Ele não monitora — ele cuida com dados.

**Edge case — Falha técnica individual:** Durante uma reunião, a conexão de Marcos cai. O sistema detecta a desconexão e não penaliza sua presença. Quando reconecta em 2 minutos, o registro de presença é restaurado automaticamente. O relatório pós-reunião marca a interrupção como "desconexão técnica", não como ausência.

**Edge case — Falha sistêmica:** O serviço de videoconferência fica indisponível. O sistema detecta a falha, notifica automaticamente o líder e os participantes ("Reunião temporariamente indisponível — estamos trabalhando na resolução"). Marcos reagenda com 1 clique. A presença de ninguém é afetada. O sistema registra o incidente para análise operacional.

**Capabilities reveladas:** Dashboard semáforo, perfil de participante com histórico, registro de ação de cuidado, reunião integrada, presença automática, relatório pós-reunião, tolerância a falhas técnicas, notificação automática de indisponibilidade, reagendamento simplificado.

---

### Jornada 2 — Participante: Da Matrícula ao Marco de Crescimento

**Persona:** Juliana, 28 anos, recém-convertida, inscrita no grupo "Fundamentos da Fé" pelo convite do Pastor Marcos. Não é técnica — usa o celular para tudo e se intimida com plataformas complicadas.

**Opening Scene:** Juliana recebe um link de convite pelo WhatsApp. Clica e vê uma tela de boas-vindas personalizada: "Marcos te convidou para Fundamentos da Fé" com a foto do líder e o nome do grupo. Isso reduz a ansiedade — ela sabe que está no lugar certo. Cria conta com Google em 2 toques e já vê seu grupo e a trilha "Primeiros Passos na Fé" com 8 aulas. A interface é limpa, responsiva no celular, e usa linguagem que ela entende — "sua jornada", "próximo passo", "marco alcançado".

**Rising Action:** Durante a semana, Juliana assiste uma videoaula de 15 minutos pelo celular no ônibus. O sistema marca conclusão quando ela assiste 90% do vídeo. Na quarta, entra na reunião ao vivo pelo mesmo app — toque único, sem instalar nada extra. A reunião abre em 2 segundos no 4G. Marcos conduz a discussão, Juliana participa com câmera ligada.

Após a reunião, Juliana vê seu progresso atualizado: 2 de 8 aulas concluídas, presença integral na reunião, nível "Semente" na gamificação. Recebe um lembrete pelo WhatsApp na sexta: "Juliana, sua próxima aula está te esperando: 'O que é oração?'"

**Climax:** Na semana 6, Juliana completa a trilha inteira. Recebe uma notificação: "Parabéns! Você concluiu a jornada Primeiros Passos na Fé 🎉". Vê seu marco de crescimento no perfil. Marcos também é notificado e a parabeniza pessoalmente na reunião seguinte.

**Resolution:** Juliana se sente vista e acompanhada. A experiência é simples — ela nunca precisou de ajuda técnica. O discipulado online não parece distante; parece cuidado.

**Edge case — Dispositivo limitado:** Juliana tenta entrar na reunião mas o navegador do celular antigo não carrega o vídeo. O sistema detecta a limitação e sugere participar pelo app nativo do provedor de vídeo, mantendo o registro de presença via webhook. A presença é registrada como parcial com nota "limitação de dispositivo". Marcos vê isso no relatório e sabe que não é desinteresse.

**Edge case — Retorno após afastamento:** Ana (da jornada do Líder) volta após 3 semanas ausente. Em vez de ver uma lista de aulas perdidas que gera vergonha, o sistema a recebe com um **modo de reengajamento**: "Bem-vinda de volta, Ana! Aqui está um resumo do que aconteceu enquanto você estava fora." Mostra as aulas que o grupo avançou e sugere por onde retomar. O tom é de acolhimento, não de cobrança — coerente com o DNA de cuidado pastoral.

**Capabilities reveladas:** Tela de boas-vindas personalizada, onboarding simplificado (link + Google auth), trilha mobile-first, conclusão automática de conteúdo, reunião com entrada rápida, progresso individual, gamificação, lembretes WhatsApp, presença via webhook para dispositivos limitados, modo de reengajamento com resumo contextual.

---

### Jornada 3 — Admin do Tenant: Configuração e Visibilidade Operacional

**Persona:** Pastora Cláudia, 50 anos, coordenadora geral da Escola Bíblica Betânia. Gerencia 8 líderes, 12 grupos e ~200 participantes. Não é técnica, mas é extremamente organizada e quer visibilidade do todo.

**Opening Scene:** Cláudia acessa o painel administrativo do tenant. Vê a visão geral: 12 grupos ativos, 3 trilhas publicadas, reunião mais próxima em 2 dias. O dashboard semáforo agregado mostra a saúde de todos os grupos: 9 🟢, 2 🟡, 1 🔴.

**Rising Action:** Cláudia clica no grupo 🔴 — "Discipulado Jovem Adulto". O líder não conduziu reunião nas últimas 2 semanas e 40% dos participantes estão em risco. Cláudia verifica o perfil do líder: também em 🟡 — sinais de afastamento. O radar é bidirecional: monitora participantes E líderes.

Cláudia acessa a gestão de líderes: pode reatribuir o grupo a outro líder ou redistribuir participantes entre grupos ativos. Decide conversar com o líder primeiro, mas sabe que tem ferramentas para agir se necessário.

Cláudia cria uma nova trilha usando um template do catálogo: "Vida em Comunidade". Associa aos 3 grupos de nível intermediário. Configura a política de presença do tenant: 75% de tempo de sala + câmera ligada ≥ 50% do tempo = presença integral.

**Climax:** No relatório mensal, Cláudia vê que a taxa de retenção geral subiu de 68% para 82% após o semáforo ser adotado pelos líderes. Apresenta os dados para a liderança pastoral com orgulho: "Não estamos apenas fazendo discipulado online — estamos cuidando de cada pessoa."

**Resolution:** Cláudia tem visibilidade operacional total sem precisar cobrar relatórios de cada líder. Gerencia 12 grupos como se fossem 1 — o sistema faz o trabalho pesado de consolidação.

**Capabilities reveladas:** Dashboard agregado por tenant, visibilidade de saúde de grupos e líderes, gestão de líderes (reatribuição de grupo, redistribuição de participantes), catálogo de templates de trilha, configuração de políticas de presença por tenant, relatórios consolidados, associação de trilhas a múltiplos grupos.

---

### Jornada 4 — Super Admin: Provisionamento e Operações da Plataforma

**Persona:** Paulo, Super Admin da plataforma Metanoia Hub. Responsável por provisionar novos tenants, monitorar a saúde da infra e garantir que tudo funcione.

**Opening Scene:** Paulo recebe uma solicitação: a Igreja Nova Aliança quer usar o Metanoia Hub. Paulo acessa o control plane e inicia o provisionamento de um novo tenant.

**Rising Action:** Paulo configura o tenant: nome, branding básico (logo + cores), plano (Pro), líderes iniciais com convite por e-mail. O sistema cria o espaço isolado com todas as configurações padrão. Em poucos minutos, o tenant está pronto. Paulo envia o link de acesso para o admin do novo tenant.

No dia a dia, Paulo monitora o painel de operações com stack de observabilidade (Grafana + Prometheus + Loki): saúde dos serviços, métricas de uso por tenant, alertas de infra. Recebe um alerta no celular quando a latência de reunião ultrapassa o threshold — acessa Grafana, identifica o gargalo, escala o serviço. Vê que um tenant está se aproximando do limite de armazenamento — envia uma notificação proativa antes que impacte o uso.

**Climax:** Após 3 meses, Paulo consulta as métricas consolidadas: 5 tenants ativos, 30+ grupos, uptime de 99,6%, zero incidentes de perda de dados. Os dados confirmam que a plataforma está pronta para escalar.

**Resolution:** Paulo opera a plataforma inteira de um único painel. Provisionamento, monitoramento, alertas — tudo centralizado. A infra é invisível para quem usa, mas visível para quem opera.

**Capabilities reveladas:** Provisionamento de tenant, configuração de branding e plano, control plane centralizado, observabilidade com Grafana/Prometheus/Loki, alertas proativos com threshold configurável, métricas de uso por tenant, gestão de limites por plano.

---

### Jornada 5 — Adoção: Do Primeiro Contato ao Primeiro Grupo Ativo

**Persona:** Pastor Ricardo, 38 anos, coordena uma escola bíblica com 80 alunos em 5 grupos. Usa Zoom + WhatsApp + Google Drive. Frustrado porque não consegue saber quem está realmente engajado.

**Opening Scene:** Ricardo ouve sobre o Metanoia Hub num encontro de pastores da sua rede de igrejas. Um colega mostra o dashboard semáforo no celular: "Olha, eu sei exatamente quem precisa de atenção essa semana." Ricardo pede o link.

**Rising Action:** Ricardo acessa o site, vê a proposta de valor e cria uma conta free. O onboarding guiado o conduz: criar tenant → configurar primeiro grupo → convidar 3 líderes → publicar uma trilha usando os **dados de demonstração pré-populados** (FR71). Em menos de 10 minutos, Ricardo tem o básico funcionando. O sistema mostra o dashboard semáforo com participantes fictícios em 🟢, 🟡 e 🔴. O impacto é imediato: ele entende o valor antes de trazer uma única pessoa real. Convida 10 participantes do grupo mais ativo como piloto.

**Climax:** Na segunda semana, o semáforo mostra 1 participante real em 🟡. Ricardo age. Pela primeira vez em 2 anos de discipulado online, ele tem visibilidade real. Decide: "Vou migrar todos os 5 grupos para cá."

**Resolution:** Ricardo converte para o plano Pro e ativa os 5 grupos em menos de 7 dias. A rede de igrejas dele começa a perguntar: "O que é essa ferramenta que você está usando?" O crescimento orgânico começa.

**Capabilities reveladas:** Landing page com proposta clara, onboarding guiado (NFR-X1: ≤ 10 min), conta free para experimentação, dados de demonstração pré-populados (FR71), conversão self-service para plano pago, experiência de primeiro valor em < 10 minutos.

---

### Journey Requirements Summary

| Jornada | Capabilities Críticas Reveladas |
|---------|--------------------------------|
| **Líder** | Dashboard semáforo, perfil com histórico, registro de ação de cuidado, reunião integrada, presença automática, relatório pós-reunião, tolerância a falhas técnicas, notificação de indisponibilidade, reagendamento |
| **Participante** | Tela de boas-vindas personalizada, onboarding simplificado, trilha mobile-first, conclusão automática, entrada rápida na reunião, progresso individual, gamificação, lembretes WhatsApp, presença via webhook, modo de reengajamento |
| **Admin tenant** | Dashboard agregado, visibilidade de líderes e grupos, gestão de líderes (reatribuição/redistribuição), catálogo de templates, configuração de políticas por tenant, relatórios consolidados |
| **Super Admin** | Provisionamento de tenant, control plane, observabilidade (Grafana/Prometheus/Loki), alertas proativos com threshold, métricas por tenant, gestão de limites por plano |
| **Adoção** | Landing page, onboarding guiado, conta free, dados demo pré-populados, templates prontos, conversão self-service, primeiro valor em < 10 min |

**Capabilities transversais** identificadas nas jornadas:
- Autenticação simples (Google + e-mail)
- Mobile-first em todas as jornadas
- WhatsApp como canal de comunicação
- Auditoria e rastreabilidade em todas as ações
- Vocabulário pastoral consistente (não corporativo)
- Resiliência e recuperação (tolerância a falhas, fallback para dispositivos limitados, notificação de indisponibilidade, reagendamento, modo de reengajamento)

## Domain-Specific Requirements

### Compliance & Regulatory

**LGPD (Lei Geral de Proteção de Dados):**
- Consentimento e transparência adequados ao tratamento de dados pessoais
- Base legal mapeada por operação de tratamento
- Direitos do titular: exportação de dados, exclusão quando aplicável, revogação de consentimento
- RIPD (Relatório de Impacto à Proteção de Dados) inicial desde o MVP
- Trilha de consentimento auditável
- Política de privacidade e termos de uso publicados

**Exclusão de conta e portabilidade de dados:**
- Dados agregados/anonimizados permanecem nos relatórios (para não quebrar métricas históricas)
- Dados pessoais identificáveis são excluídos conforme solicitação do titular
- Gravações contendo o rosto/voz da pessoa tratadas separadamente (remoção ou anonimização)
- Exportação de dados do titular em formato legível por máquina
- Registro auditável de cada solicitação de exclusão/portabilidade

**Child Safety (fase posterior ao MVP):**
- MVP atende exclusivamente adultos (≥ 18 anos)
- Atendimento a adolescentes (12-17 anos) planejado para fase posterior, com:
  - Consentimento parental/responsável obrigatório
  - Controles adicionais de gravação e acesso
  - Mecanismos de aferição de idade
  - Conformidade com LGPD e orientações da ANPD para tratamento de dados de menores
  - Aprovação humana obrigatória para conteúdo voltado a menores

**Acessibilidade:**
- Nível mínimo MVP: WCAG 2.1 AA
- Direção técnica para WCAG 2.2 AA em novas interfaces (conforme recomendação W3C)
- Conformidade com 2.2 cobre automaticamente 2.1

**SLA por tier (contratual):**
- Free: best-effort, sem garantia de SLA
- Pro: 99,5% de disponibilidade mensal
- Enterprise: 99,9% de disponibilidade mensal, com penalidades contratuais
- Política de crédito/compensação em caso de violação de SLA
- Limites de uso documentados por tier (participantes simultâneos, armazenamento, gravações, grupos)

### Technical Constraints

**Segurança:**
- Autenticação centralizada (Keycloak) com suporte a e-mail/senha e Google OAuth
- Autorização por papéis e permissões granulares, escopo por tenant
- Isolamento por tenant: Row-Level Security (RLS) + schema separation no MVP; database-per-tenant para tiers enterprise em escala
- Criptografia em trânsito (TLS) obrigatória
- Criptografia at rest para dados sensíveis: server-side encryption no MinIO (gravações, mídia), criptografia por coluna ou TDE no PostgreSQL (dados pessoais, logs de auditoria)
- Proteção de upload e acesso a mídia (URLs assinadas com expiração)

**Backup e Disaster Recovery:**
- Backups automatizados com criptografia
- Segregação geográfica de backups (fora do mesmo datacenter da produção)
- Teste periódico de restore (pelo menos trimestral)
- Plano de disaster recovery documentado
- Alinhamento com RPO ≤ 1h e RTO ≤ 4h definidos nos Success Criteria

**Privacidade de reuniões e gravações:**
- Gravação sinalizada ao usuário antes e durante a sessão
- Retenção padrão de 90 dias, configurável por tenant
- Acesso restrito: líder do grupo, admin do tenant, suporte administrativo sob exceção auditada
- Política de exclusão automática ao fim do período de retenção
- Segurança by design e minimização de dados conforme LGPD

**Retenção diferenciada por tipo de dado:**
- Gravações de reunião: 90 dias (configurável por tenant)
- Logs de auditoria: mínimo 1 ano (boa prática de compliance)
- Dados de presença/engajamento: alinhados ao ciclo do programa de formação
- Notificações enviadas: 6 meses (resolução de disputas)
- Dados pessoais inativos: política de purgação após período de inatividade definido
- Arquivos versionados de conteúdo: conforme política do tenant

**Monitoramento de foco/aba (feature sensível):**
- Feature toggle habilitável/desabilitável por tenant
- Transparência ao usuário via UX:
  - Banner persistente durante reunião quando monitoramento está ativo: "Este encontro registra presença e engajamento"
  - Primeiro acesso: tela de consentimento explícita explicando quais dados são coletados e por quê, em linguagem pastoral (não jurídica)
  - Página acessível a qualquer momento: "Como seus dados são usados" — linguagem simples e acolhedora
- Indicador tratado como proxy técnico de engajamento, não como prova de atenção
- Finalidade documentada e comunicada ao titular dos dados

**Auditoria:**
- Trilha de auditoria completa desde o MVP
- Eventos auditáveis: login, alterações de usuários/permissões, CRUD de trilhas/reuniões, disparos de notificação, eventos de progresso, presença e engajamento
- Retenção de logs de auditoria mínimo 1 ano
- Exportação para compliance

### Integration Requirements

**WhatsApp via ChatMaster Veloz:**
- Tratado como compartilhamento mínimo de dados com operador/suboperador
- Dados compartilhados limitados ao estritamente necessário (nome + número + conteúdo do lembrete)
- Contrato de tratamento de dados (DPA) com o provedor
- Transparência ao titular sobre o uso do canal
- Registro de todas as operações de envio (logs de despacho e entrega)
- Gestão de preferências granular por tipo de notificação (reunião, trilha, progresso, administrativo)
- Opt-out parcial sem perda de funcionalidade core
- Registro de cada alteração de preferência para compliance
- Avaliação de transferência internacional quando aplicável

**Videoconferência (integração agnóstica):**
- Integração via webhooks para captura de eventos de presença e engajamento
- Registro de presença auditável independente do provedor
- Suporte a fallback para dispositivos limitados (presença via webhook mesmo sem vídeo)

**API pública (governança para Fase 4):**
- Rate limiting por tier e por chave de API
- Versionamento semântico da API (v1, v2) com período de deprecação definido
- Termos de uso da API documentados
- Política de dados acessíveis via API (nunca expor dados pessoais sem autorização explícita)
- Autenticação via OAuth 2.0 / API keys com escopo por tenant

### Content Governance

**Publicação curada no MVP:**
- Apenas admins do tenant e editores autorizados podem publicar conteúdo
- Fluxo obrigatório: rascunho → aprovação → publicação
- Versionamento de conteúdo com histórico de alterações
- Para conteúdo voltado a menores (fase posterior): aprovação humana obrigatória pré-publicação

### Tenant Hierarchy & Data Governance

**Modelo de governança para hierarquia de tenants (redes de igrejas):**
- Tenant pai (rede) vê dados agregados dos sub-tenants, nunca dados individuais de participantes
- Base legal específica para compartilhamento entre tenants hierárquicos
- Isolamento de dados pessoais entre níveis hierárquicos
- Controlador de dados definido por nível: cada tenant local é controlador dos seus dados; tenant pai é controlador apenas dos dados agregados
- Configuração de visibilidade por nível hierárquico (o que o tenant pai pode ver)

### Risk Mitigations

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Menores acessando MVP sem controles adequados | Legal/reputacional | MVP restrito a adultos; mecanismo de age gate; fase dedicada para menores |
| Gravação armazenada além do necessário | LGPD/privacidade | Exclusão automática após período de retenção; configurável por tenant |
| Monitoramento de foco interpretado como vigilância | Reputacional/ético | Feature toggle por tenant; transparência total via UX; framing pastoral |
| Dados compartilhados com ChatMaster Veloz sem base legal | LGPD | DPA obrigatório; minimização de dados; registro de operações |
| Conteúdo inadequado publicado em trilhas | Reputacional | Fluxo curado com aprovação; apenas editores autorizados |
| Videoconferência instável impactando presença | Confiança no sistema | Tolerância a falhas técnicas; presença não penalizada por desconexão |
| Perda de dados sensíveis sem backup adequado | Operacional/legal | Backups criptografados; segregação geográfica; testes trimestrais de restore |
| Exclusão de conta quebrando relatórios | Integridade de dados | Anonimização de dados agregados; exclusão apenas de dados pessoais identificáveis |
| Tenant pai acessando dados individuais de sub-tenants | LGPD/privacidade | Visibilidade apenas agregada; base legal separada; isolamento por nível |
| Criptografia insuficiente em repouso | LGPD/segurança | Criptografia at rest em PostgreSQL e MinIO para dados sensíveis |

## Innovation & Novel Patterns

### Detected Innovation Areas

#### 1. Radar Pastoral — Novo conceito de produto

O diferencial central do Metanoia Hub não está em mostrar dados, mas em **traduzir sinais digitais em linguagem pastoral de cuidado**. Existem LMS que acompanham progresso (Moodle, Teachable) e plataformas de reunião que registram presença (Zoom, Meet), mas nenhuma solução pública identificada oferece uma experiência desenhada para discipulado cristão que transforme sinais comportamentais em um radar pastoral com leitura simples, contextual e orientada à ação.

O reframing central: sair de "controle de atividade" para "cuidado com pessoas". O dashboard semáforo (🟢🟡🔴) é a materialização dessa inovação — traduz complexidade em linguagem que qualquer pastor entende.

**Fallback de design:** Se o semáforo gerar ansiedade em líderes, o fallback não é remover as cores — é adicionar contexto. **"Modo contexto expandido"**: semáforo + resumo em texto da situação completa. Exemplo: "🔴 Ana — 2 faltas recentes (mas completou toda a trilha anterior)" é menos ansioso que "🔴 Ana" sozinho. Contexto resolve ansiedade melhor que remoção visual.

#### 2. Copiloto Pastoral com IA — De "o que está acontecendo?" para "o que fazer agora?"

A evolução natural do radar é um sistema que sugere ações de cuidado concretas:

**Tipos de recomendação da IA:**
- **Reengajamento individual**: "Sugiro que você fale com Ana nesta semana — 2 ausências seguidas, queda no progresso da trilha"
- **Diagnóstico de desconexão**: "Carlos está engajado no conteúdo, mas desconectado da reunião ao vivo — considere abordagem 1:1 ou revisar horário"
- **Saúde do grupo**: "Grupo Esperança tem boa presença mas baixo avanço na trilha — revisar formato das aulas"
- **Alerta de evasão**: "3 participantes do Grupo Atos em risco — disparar lembrete personalizado + contato do líder"
- **Otimização de formato**: "Este grupo pode se beneficiar de uma reunião extra ou encontro mais curto"
- **Saúde do líder**: "Líder com alta frequência de encontros, mas baixo follow-up individual — priorizar contato com os 2 mais em risco"
- **Promoção de talentos**: "Este participante concluiu tudo rapidamente e demonstra constância — convidar para próxima trilha ou papel de apoio"

**Regra ética inviolável:** O copiloto não interpreta espiritualidade, não diagnostica alma, não substitui discernimento pastoral. Sugere ações com base em sinais observáveis de participação, constância e progresso.

**Princípio de transparência da IA:** O copiloto sempre mostra os dados que geraram a sugestão — nunca uma caixa preta. Se o líder vê que a sugestão é baseada em "2 faltas + 0 aulas concluídas esta semana", ele entende que é um padrão, não uma profecia. Isso preserva o DNA ético mesmo quando a IA fica muito boa.

**Estratégia de validação — Wizard of Oz:** Antes de construir IA real, gerar "sugestões de cuidado" baseadas em regras simples (if ausência ≥ 2 semanas → sugerir contato). Se líderes acharem útil com regras simples, a IA só melhora. Se não acharem útil nem com regras, IA não resolve. Valida a inovação com custo zero de IA.

Essa visão conversa com o movimento atual do mercado: Pushpay já posiciona IA como ferramenta de engajamento, Subsplash comunica IA como apoio a decisões ministeriais. O ponto inovador do Metanoia Hub é aplicar IA não para produtividade ou conteúdo, mas para **recomendar ações pastorais concretas**.

#### 3. Combinação Inédita de Domínios

O que torna o produto especial não é cada componente isolado, mas a integração de quatro elementos que nenhuma solução pública identificada une no mesmo produto:

1. **Discipulado ao vivo** (reunião integrada)
2. **Sinais comportamentais em tempo real** da reunião
3. **Trilha formativa estruturada** com progresso
4. **Interpretação pastoral** em linguagem de cuidado (não apenas analytics)

#### 4. DNA Ético como Diferenciador de Mercado

"Mede sinais, não almas" e "presença digital ≠ saúde espiritual" posicionam o Metanoia Hub de forma única. Na comunicação pública dos competidores analisados, a ênfase está em eficiência, engajamento, crescimento e produtividade — não foi encontrada a mesma ênfase explícita em **reconhecer os limites interpretativos do próprio produto**.

Essa postura ética deliberada:
- Gera confiança com buyers pastorais que desconfiam de tecnologia invasiva
- Diferencia de soluções que vendem "medir crescimento espiritual" sem qualificação
- Posiciona como ferramenta que apoia o discernimento pastoral sem fingir substituí-lo

#### 5. Radar Bidirecional — Inovação de maturidade

O conceito de monitorar não apenas participantes mas também **a saúde operacional dos líderes** é um diferenciador estratégico para fases posteriores ao MVP.

**Posicionamento estratégico:**
- MVP: radar focado em participantes
- Evolução: radar bidirecional (participantes + líderes)
- Narrativa: "Discipulado saudável não depende só de participantes presentes; depende também de líderes sustentáveis, consistentes e acompanhados"

**Sinais do radar para líderes (visão futura):**
- Frequência de reuniões realizadas
- Regularidade de follow-up individual
- Grupos sem contato individual
- Sobrecarga por número de participantes
- Tendência de queda no ritmo de condução

#### 6. Modo de Reengajamento — Acolhimento como inovação

O modo de reengajamento ("Bem-vinda de volta! Aqui está o que aconteceu enquanto você estava fora") é uma inovação de produto real, não apenas um edge case de UX. Nenhum LMS identificado recebe o aluno de volta com acolhimento contextual — a maioria mostra uma barra de progresso que comunica atraso.

O modo de reengajamento é a materialização do DNA ético: **o produto trata o retorno como acolhimento, não como cobrança.** Isso reforça que o sistema cuida, não julga.

### Defensibilidade Estratégica

O Metanoia Hub possui três moats (fossos defensivos) que levam tempo para replicar:

**1. Dados longitudinais de discipulado** — Após 12 meses de operação, o sistema acumulará padrões de evasão, reengajamento e formação que nenhum competidor tem. Esses dados alimentam a IA e criam lock-in de valor crescente.

**2. Vocabulário pastoral como padrão de mercado** — Se escolas bíblicas começarem a falar "semáforo pastoral", "sinal de atenção", "marco de crescimento" usando a linguagem do Metanoia Hub, o produto define o vocabulário do segmento. Isso é poder de plataforma.

**3. Rede de igrejas como canal de distribuição** — Cada tenant que adota vira evangelista do produto. O go-to-market orgânico via redes de igrejas é um moat de distribuição que players globais não possuem neste nicho.

**Proteção de marca:** Os termos "Radar Pastoral" e "Copiloto Pastoral" devem ser avaliados para registro de marca. Se competidores entrarem no nicho, não poderão usar esses termos se registrados.

### Market Context & Competitive Landscape

| Player | Forças | Lacuna vs Metanoia Hub |
|--------|--------|----------------------|
| **Disciple.Tools** | CRM pastoral, gestão de contatos, progresso espiritual | Sem reunião ao vivo, sem sinais em tempo real |
| **Planning Center** | ChMS completo, presença de grupos | Sem trilhas formativas, sem radar pastoral |
| **Breeze/ChurchTrac** | Alertas de inatividade, simplicidade | Básico, sem sinais comportamentais |
| **Pushpay/CCB** | Dashboards de congregação, IA emergente | Foco em métricas gerais, não em discipulado estruturado |
| **Subsplash** | App de igreja, conteúdo, IA emergente | Sem reunião integrada, sem radar por participante |
| **Moodle/Teachable** | LMS completo, trilhas, progresso | Genérico, sem vocabulário pastoral, sem reunião |
| **Zoom/Meet** | Reunião confiável, escala | Sem trilha, sem progresso, sem cuidado pastoral |
| **Soluções locais BR** | Proximidade cultural, suporte em português | A verificar: MinhaIgreja, Churchfy e similares — potenciais competidores no early adopter brasileiro |

**Posição do Metanoia Hub:** Único na interseção de discipulado ao vivo + trilha formativa + sinais de engajamento + linguagem pastoral. Compete tangencialmente com todos, diretamente com nenhum.

**Janela competitiva:** Estimativa de 18-24 meses antes que players grandes (Pushpay, Subsplash) adicionem features equivalentes de radar pastoral ao seu stack. A velocidade de execução e a profundidade no nicho de discipulado estruturado são a principal defesa.

**Vocabulário do produto — Dois níveis:**
- **Para líderes/admins**: vocabulário pastoral completo (radar pastoral, sinal de atenção, marco de crescimento, jornada de formação)
- **Para participantes**: vocabulário simplificado e acolhedor (sua jornada, próximo passo, progresso, parabéns)
- Ambos os níveis devem ser testados com os respectivos públicos

### Validation Approach

| Inovação | Método de Validação | Critério de Sucesso |
|----------|--------------------|--------------------|
| Dashboard semáforo | Teste com 3-5 líderes reais nos primeiros 90 dias | Líderes acessam o dashboard ≥ 3x/semana; relatam ações de cuidado baseadas nos sinais |
| Vocabulário pastoral | Teste qualitativo com líderes E participantes | Buyers descrevem o produto em termos pastorais; participantes entendem o vocabulário simplificado |
| Combinação de domínios | Operação recorrente em grupos reais | Líder usa reunião + trilha + dashboard como fluxo integrado (não features isoladas) |
| DNA ético | NPS + feedback qualitativo + taxa de opt-out | NPS ≥ 40; ausência de feedback sobre "vigilância"; opt-out do monitoramento de foco < 10% |
| Copiloto IA (futuro) | Wizard of Oz: regras simples antes de IA real | Líderes acham útil as sugestões baseadas em regras; aceitam ≥ 60% das ações sugeridas |
| Radar bidirecional (futuro) | Piloto com admin de tenant monitorando líderes | Admin identifica líder em risco antes de impacto nos grupos |
| Modo de reengajamento | Acompanhamento de retorno de participantes | Taxa de retorno efetivo após reengajamento ≥ 40% |

### Innovation Risk Mitigation

| Risco de Inovação | Impacto | Mitigação | Fallback |
|-------------------|---------|-----------|----------|
| Semáforo gera ansiedade em vez de cuidado | Rejeição pelo líder | Calibração de thresholds; linguagem de "atenção", não "problema" | Modo contexto expandido (semáforo + resumo textual da situação completa) |
| Vocabulário pastoral não ressoa com todos os segmentos | Limitação de mercado | Testar com early adopters; dois níveis de vocabulário (pastoral + simplificado) | Vocabulário configurável por tenant |
| IA sugere ações inadequadas ao contexto pastoral | Perda de confiança | Transparência: sempre mostrar dados que geraram a sugestão; opção "não se aplica" | Wizard of Oz: sugestões por regras simples sem IA |
| Radar bidirecional percebido como vigilância de líderes | Resistência organizacional | Implementar apenas com visibilidade e consentimento do líder | Radar apenas para participantes |
| Competidores grandes copiam o conceito | Comoditização | Registro de marca; velocidade de execução; lock-in por dados longitudinais | Foco em escolas bíblicas como segmento defensável |
| Paradoxo da transparência: IA muito boa parece "ler almas" | Erosão do DNA ético | Princípio inviolável: sempre mostrar os dados brutos por trás da sugestão | Modo manual de priorização sem IA |
| Janela competitiva se fecha antes de tração | Irrelevância | Time-to-market agressivo; early adopters ativados nos primeiros 6 meses | Pivot para nicho ainda mais específico (ex: seminários teológicos) |

## SaaS B2B + Web App Specific Requirements

### Project-Type Overview

O Metanoia Hub é um **Web App SaaS B2B** construído com Next.js App Router, operando como plataforma multi-tenant com experiência híbrida: páginas públicas otimizadas para SEO e aquisição, área autenticada reativa e interativa para o produto core. O projeto combina requisitos de SaaS enterprise (multi-tenancy, RBAC, tiers, compliance) com requisitos de web app moderna (real-time, responsive, accessibility, performance).

### Technical Architecture Considerations

#### Estratégia de Rendering — Hybrid SSR/CSR

**Um único projeto Next.js** com separação por route groups:

| Route Group | Rendering | Propósito |
|-------------|-----------|-----------|
| `/(marketing)` | SSR/SSG | Landing, pricing, blog, recursos, páginas institucionais — SEO crítico |
| `/(auth)` | SSR | Login, cadastro, recuperação de senha — sem foco SEO |
| `/(app)` | App Router com Server + Client Components | Dashboard, trilhas, reunião, semáforo — reatividade e interação |

**Decisões de rendering por contexto:**
- Páginas públicas: Server Components + SSG para performance e SEO
- App autenticado: Server Components onde fizer sentido (carregamento inicial de dados, layouts)
- Telas altamente interativas (dashboard ao vivo, trilha em progresso, reunião, semáforo): Client Components com comportamento majoritariamente client-side
- Streaming e Suspense para carregamento progressivo em telas de dados pesados

#### Browser Support Matrix

| Navegador | Versão Mínima | Nível de Suporte |
|-----------|--------------|-----------------|
| Chrome | Últimas 2 versões (111+) | Suporte oficial |
| Edge | Últimas 2 versões (111+) | Suporte oficial |
| Firefox | Últimas 2 versões (111+) | Suporte oficial |
| Safari iOS/macOS | 16.4+ | Suporte oficial |
| Samsung Internet | Versões atuais | Best effort — validação manual em QA |
| Navegadores antigos | — | Sem suporte oficial no MVP |

#### SEO Strategy

- **SEO crítico**: landing page, pricing, blog, recursos, páginas institucionais — metadata API e OG images do Next.js
- **Sem foco SEO**: login, área autenticada, dashboard, reunião, trilhas privadas
- **Conteúdo de trilhas**: privado por padrão, atrás de autenticação, sem indexação pública no MVP
- SEO serve exclusivamente para **aquisição** — o valor principal está dentro da área autenticada

#### Real-Time Architecture

**Decisão de transporte:**
- **SSE (Server-Sent Events)** para dashboard ao vivo e notificações in-app — simples, unidirecional, funciona com HTTP/2, compatível com Server Components do Next.js
- **WebSocket do provedor de vídeo** para chat dentro da reunião — já incluso na integração de videoconferência
- **Não adicionar Socket.io ao stack** — dependência desnecessária quando SSE + WS do provedor cobrem os casos de uso

**No MVP:**
- **Dashboard do líder ao vivo durante reunião**: atualização em tempo real do semáforo e indicadores de presença/engajamento via SSE
- **Notificações in-app**: "reunião começa em 5 min", "novo módulo liberado", "quiz disponível" via SSE
- **Chat em tempo real dentro da reunião**: via WebSocket do provedor de videoconferência

**Fora do MVP:**
- Chat persistente entre participantes fora da reunião
- Mensageria tipo comunidade/feed
- DM entre usuários dentro do app

**Cache de reunião ativa:** Eventos de presença (join, leave, camera on/off, focus lost) atualizam **Redis em tempo real**. Dashboard do líder lê do Redis durante a reunião. Quando a reunião encerra, flush para PostgreSQL como registro permanente. Isso evita bottleneck de queries diretas no PostgreSQL durante reuniões ativas.

#### Rate Limiting

- **API pública (Fase 4)**: rate limiting por tier e por chave de API
- **Frontend autenticado (MVP)**: rate limiting por sessão no API Gateway (Traefik)
  - Endpoints normais: 100 req/min
  - Endpoints pesados (relat��rios, exports): 10 req/min

### Tenant Model

**Arquitetura multi-tenant desde o MVP:**
- Single-tenant tenant-aware: um deployment compartilhado com isolamento lógico forte
- **Isolamento MVP: RLS (Row-Level Security) puro** com `tenant_id` em todas as tabelas — sem schema separation no MVP (simplifica migrations e operação)
- Evolução para database-per-tenant em tiers enterprise quando houver demanda real
- Cada tenant com: branding configurável, políticas próprias (presença, retenção, monitoramento), feature flags por tenant
- Provisionamento de tenant pelo Super Admin (MVP) com visão de self-service futuro

### RBAC Matrix — Modelo de Permissões

**Modelo: RBAC + permissões customizáveis por tenant (ABAC leve por escopo)**

**Autorização em 3 camadas (defesa em profundidade):**
1. **Keycloak**: autenticação + roles base (Super Admin, Admin Tenant, etc.)
2. **NestJS Guards**: autorização por endpoint — verifica role + tenant_id + group_id
3. **RLS no PostgreSQL**: última linha de defesa — mesmo que um bug no backend passe, o banco não retorna dados de outro tenant

#### Roles do Sistema

| Role | Escopo | Descrição |
|------|--------|-----------|
| **Super Admin** | Plataforma | Administração global, provisionamento de tenants, monitoramento de infra |
| **Admin do Tenant** | Tenant | Gestão operacional, configuração, políticas, relatórios consolidados |
| **Editor de Conteúdo** | Tenant | Criação e publicação de trilhas e conteúdo — escopo de tenant (qualquer trilha), com fluxo de aprovação pelo Admin |
| **Líder / Discipulador** | Grupos próprios | Condução de reuniões, acompanhamento pastoral, dashboard semáforo dos seus grupos |
| **Participante / Aluno** | Próprio perfil + grupos | Consumo de reuniões, trilhas, conteúdo; visualização do próprio progresso |
| **Auditor / Suporte** | Tenant (enterprise) | Acesso de leitura para compliance e resolução de problemas — role opcional |

#### Regras de Acesso do Líder

- **Por padrão**: líder vê APENAS seus próprios grupos — nenhuma visão global por default
- Acesso restrito a: reuniões dos seus grupos, trilhas atribuídas aos seus grupos, progresso dos seus participantes, semáforo dos seus grupos
- **Acesso cross-group** apenas via permissão explícita do tenant: `groups.read.all`, `meetings.read.cross_group`, `participants.read.cross_group`

#### Modelo Técnico

```
RBAC base + ABAC leve por escopo:
- tenant_id (isolamento de tenant)
- group_id (isolamento de grupo)
- ownership (recursos próprios)
- granted_permissions (permissões adicionais por tenant)
```

### Subscription Tiers

| Recurso | Free | Pro | Enterprise |
|---------|------|-----|------------|
| **SLA** | Best effort | 99,5% | 99,9% + penalidades |
| **Grupos** | 3 | 20 | Ilimitado |
| **Participantes por grupo** | 15 | 50 | Custom |
| **Participantes simult��neos** | 30 | 100 | Custom |
| **Trilhas publicadas** | 2 | 20 | Ilimitado |
| **Armazenamento** | 1 GB | 50 GB | Custom |
| **Gravação** | Não incluída | 90 dias, 10 GB | Custom |
| **Branding** | Padrão | Logo + cores | White-label completo |
| **Suporte** | Comunidade | E-mail | Dedicado |
| **Isolamento** | Shared (RLS) | Shared (RLS) | Database dedicado |
| **API pública** | Não | Rate limited | Custom limits |
| **Feature flags** | Padrão | Configurável | Totalmente custom |

**Jornada de upgrade entre tiers:** Quando um tenant Free atinge o limite (ex: 3 grupos), o sistema exibe upgrade prompt contextual ("Você atingiu o limite de grupos do plano gratuito. Conheça o plano Pro para até 20 grupos."). O tenant não é bloqueado abruptamente — pode continuar usando o que já criou, mas não pode criar novos recursos além do limite. Conversão self-service para Pro; Enterprise via contato comercial.

### Integration List

| Integração | Tipo | Status |
|------------|------|--------|
| Keycloak | Auth/IAM | Release 1a — autenticação centralizada |
| MinIO | Object storage | Release 1a — mídia e documentos |
| Redis | Cache + jobs + estado de reunião | Release 1a — cache, sessões, BullMQ |
| Provedor de videoconferência | Reunião ao vivo | Release 2 — integração agnóstica via webhooks |
| NATS JetStream | Event bus interno | Release 2+ — introduzir quando houver 3+ serviços; até lá, chamadas diretas + BullMQ para async |
| ChatMaster Veloz | WhatsApp API | Phase 3 — lembretes e automações |
| Grafana/Prometheus/Loki | Observabilidade completa | Phase 3+ — Release 1 usa logs estruturados + Sentry |
| pgvector | Busca semântica | Preparado no MVP, ativo na Phase 5 (IA) |

### Responsive Design

**Prioridade por contexto de tela:**

| Abordagem | Telas | Justificativa |
|-----------|-------|---------------|
| **Mobile-first** | Entrada na reunião, consumo de conteúdo/trilha, progresso individual, semáforo simplificado, notificações | Público acessa majoritariamente por celular |
| **Desktop-first** | Dashboard completo do líder, relatórios consolidados, configuração de trilha, admin do tenant, editor de conteúdo | Criação e gestão são feitas no desktop |

**Breakpoints:** mobile (< 640px), tablet (640-1024px), desktop (> 1024px)
**Touch-friendly:** áreas de toque mínimo 44x44px (WCAG)

### Performance Targets

**Targets diferenciados por contexto:**

| Métrica | Desktop/Wi-Fi | Mobile 4G |
|---------|--------------|-----------|
| LCP | < 2,0s | < 3,5s |
| FID | < 100ms | < 100ms |
| CLS | < 0,1 | < 0,1 |

**Justificativa:** O público-alvo acessa majoritariamente por celular em redes 4G com dispositivos medianos. Testar apenas em Wi-Fi de escritório é insuficiente — o teste real é no celular do participante no ônibus.

**Otimizações:**
- Code splitting por route group (marketing, auth, app)
- Lazy loading de componentes pesados (player de vídeo, editor de conteúdo)
- Prefetching inteligente para navegação fluida dentro do app
- Bundle size monitorado e com budget definido

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Abordagem: Platform MVP com entrega incremental**

O Metanoia Hub adota uma estratégia de Platform MVP — uma base técnica robusta que suporta evolução, entregue de forma incremental para validar valor progressivamente. A decisão é intencional: o produto precisa da combinação integrada (reunião + trilha + semáforo) para se diferenciar, mas a entrega é sequenciada para permitir validação antecipada e reduzir risco.

**Equipe:** 1-2 desenvolvedores com suporte de IA para desenvolvimento assistido. Planejamento assume 1 dev + IA como baseline; segundo dev como acelerador quando disponível.

**Cadência:** Sprints de 2 semanas, demo a cada sprint (mesmo interna), cada sprint entrega algo deployável, CI/CD (GitHub Actions) desde o dia 1 com deploy automático para staging.

**Estratégia de alocação do segundo dev:**
- Release 1a: 1 dev + IA (foco, sem dependência externa)
- Release 1b: 1-2 devs (segundo dev no frontend enquanto primeiro faz backend/infra)
- Release 2: idealmente 2 devs (um no backend de presença, outro no frontend do semáforo)

### Infra Simplificada para Time Enxuto

| Componente | Release 1 | Release 2+ |
|------------|-----------|------------|
| Next.js + NestJS | Sim | Sim |
| PostgreSQL + RLS | Sim | Sim |
| Redis + BullMQ | Sim | Sim |
| Keycloak | Sim | Sim |
| MinIO | Sim | Sim |
| NATS JetStream | **Não** — chamadas diretas + BullMQ | Introduzir quando 3+ serviços precisem de EDA |
| Grafana/Prometheus/Loki | **Não** — logs estruturados + Sentry | Stack completa quando tiver tráfego real |
| Docker Compose | Sim | Sim (sem Swarm/K3s até 5+ tenants) |

**Release 1: 5 componentes de infra.** Release 2+: introduzir gradualmente conforme complexidade justificar.

### MVP Feature Set — Entrega Incremental

#### Release 1a — Core Loop (6-8 semanas)

**Objetivo:** Loop funcional mínimo — líder cria grupo, publica trilha, participante consome e progride. Validação antecipada com usuários reais.

**Capabilities:**
- Autenticação centralizada (Keycloak) — e-mail/senha + Google OAuth
- Multi-tenant com RLS puro (`tenant_id` em todas as tabelas)
- RBAC base (3 roles: Admin Tenant, Líder, Participante)
- Grupos/turmas com vínculo de líderes e participantes
- Trilhas de ensino com módulos e aulas (vídeo + texto inicialmente)
- Upload básico para MinIO com URLs assinadas
- Conclusão automática de conteúdo (90% vídeo)
- Progresso individual por aula/módulo/trilha
- Layout responsivo base (mobile-first para consumo)
- CI/CD com GitHub Actions + deploy automático staging

**Gate Release 1a:**
- [ ] Auth funcional com Google + e-mail
- [ ] Zero falha de isolamento multi-tenant (teste automatizado)
- [ ] Líder cria grupo e publica trilha
- [ ] Participante consome conteúdo e vê progresso

#### Release 1b — Polish + Operacional (4-6 semanas)

**Objetivo:** Completar a fundação com dashboard operacional, auditoria, LGPD e onboarding. Produto pronto para early adopters em modo formação (sem reunião ao vivo).

**Capabilities:**
- Dashboard operacional básico por tenant
- Auditoria base (eventos de login, CRUD, progresso)
- Conformidade LGPD inicial (política de privacidade, consentimento, termos)
- Onboarding guiado + dados de demonstração pré-populados
- Tela de boas-vindas personalizada para convites
- Conteúdo multiformato (documentos com tracking de scroll)
- Editor de Conteúdo como role (escopo de tenant, com aprovação)
- Fluxo de publicação curado (rascunho → aprovação → publicação)
- Relatórios básicos (progresso por trilha, participantes por grupo)
- Versionamento de conteúdo

**Gate Release 1b:**
- [ ] Dashboard operacional funcional
- [ ] Onboarding guiado completo (primeiro valor em < 10 min com dados demo)
- [ ] LGPD baseline implementada (consentimento, termos, política)
- [ ] Fluxo de publicação curado funcionando

#### Release 2 — Reunião ao Vivo + Radar Pastoral (8-10 semanas)

**Objetivo:** Adicionar o diferenciador central — reunião integrada com presença automática e dashboard semáforo. Transforma o produto de "LMS pastoral" em "radar pastoral".

**Capabilities (escopo enxuto):**
- Módulo de reunião com integração de videoconferência (agnóstica, via webhooks)
- Presença automática com regras objetivas (integral/parcial)
- Indicadores de engajamento (câmera, tempo de sala, foco — com feature toggle)
- Dashboard semáforo (🟢🟡🔴) para líder — atualização em tempo real via SSE
- Cache de reunião ativa em Redis (flush para PostgreSQL ao encerrar)
- Registro de ação de cuidado pelo líder
- Relatório pós-reunião automático
- Banner de transparência durante reunião (monitoramento ativo)
- Tolerância a falhas técnicas (desconexão não penaliza presença)
- Notificação de indisponibilidade + reagendamento com 1 clique

**Movido para Phase 3 (não bloqueia o radar pastoral):**
- Gravação de reuniões (complexa: storage, retenção, acesso restrito)
- Gestão de líderes: reatribuição de grupo, redistribuição de participantes (pode ser manual no MVP)
- Modo de reengajamento ("Bem-vinda de volta!") — inovador mas não bloqueia valor

**Gate Release 2:**
- [ ] Reunião funciona com entrada < 3s no 4G
- [ ] Semáforo atualiza em tempo real durante reunião
- [ ] Presença registrada corretamente (integral/parcial)
- [ ] Load test com 50 usuários simultâneos aprovado
- [ ] Pelo menos 1 caso de reengajamento pastoral documentado

### Post-MVP Features

#### Phase 3 — Growth (Automações + Completude)

- Gravação de reuniões (retenção 90 dias, acesso restrito)
- Lembretes e automações via WhatsApp (API ChatMaster Veloz)
- Alarmes configuráveis de evasão e inatividade
- Modo de reengajamento ("Bem-vinda de volta!")
- Gestão de líderes (reatribuição, redistribuição)
- Notificações in-app em tempo real (SSE)
- Preferências de notificação granulares por tipo
- Recorrência operacional de reuniões
- Templates de conteúdo devocional
- NATS JetStream para EDA entre serviços
- Grafana/Prometheus/Loki (observabilidade completa)

#### Phase 4 — Enterprise/Scale

- Quiz e avaliações com banco de questões
- Gamificação completa (pontos, níveis, ranking)
- Hierarquia avançada de tenants (redes de igrejas)
- Isolamento dedicado (database-per-tenant) para enterprise
- API pública com rate limiting, versionamento, OAuth 2.0
- SLA contratual com penalidades (tier Enterprise)
- White-label completo
- Role Auditor/Suporte
- Jornada self-service de upgrade entre tiers

#### Phase 5 — Vision (IA + Copiloto Pastoral)

- Copiloto pastoral com IA — recomendações de ações de cuidado
- Validação via Wizard of Oz (regras simples) antes de IA real
- Radar bidirecional (participantes + saúde operacional do líder)
- Geração de quiz baseada no conteúdo via IA
- Busca semântica com pgvector e embeddings
- Insights preditivos de retenção e engajamento
- Resumo pré-reunião gerado por IA

### Dependencies Between Phases

```
Release 1a (Core Loop)
    └──→ Release 1b (Polish + Operacional)
              └──→ Release 2 (Reunião + Radar)
                        │
                        ├──→ Phase 3 (Growth: gravação, WhatsApp, NATS, observabilidade)
                        │         │
                        │         ├──→ Phase 4 (Enterprise: quiz, gamificação, API, hierarchy)
                        │         │         │
                        │         │         └──→ Phase 5 (Vision: IA, copiloto, busca semântica)
                        │         │
                        │         └──→ Phase 5 (parcial: Wizard of Oz com regras simples)
                        │
                        └──→ Phase 4 (parcial: tiers, limites, upgrade prompts)
```

- Phase 3 depende de Release 2 (gravação e automações precisam de reunião e presença)
- Phase 4 pode começar parcialmente após Release 2 (tiers, limites) mas gamificação depende de trilhas maduras
- Phase 5 depende de dados acumulados (mínimo 6 meses de operação para IA ter padrões)

### Risk Mitigation Strategy

**Riscos Técnicos:**

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Integração de videoconferência mais complexa que esperado | Alta | Crítico | Abordagem agnóstica via webhooks; provedor substituível; Releases 1a/1b funcionam sem reunião |
| Stack muito grande para 1-2 devs | Alta | Alto | Infra simplificada (5 componentes no Release 1); introdução gradual; AI-assisted dev |
| RLS mal configurado expõe dados entre tenants | Média | Crítico | Testes automatizados de isolamento como gate obrigatório do Release 1a; defesa em profundidade (3 camadas) |
| Performance degradada com muitos simultâneos | Média | Alto | Cache Redis para estado ativo; load testing como gate do Release 2; target de 50 simultâneos para early adopters |

**Riscos de Mercado:**

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Early adopters não adotam por complexidade | Média | Crítico | Onboarding guiado; dados demo; primeiro valor em < 10 min |
| Semáforo percebido como vigilância | Baixa | Alto | DNA ético; transparência via UX; feature toggle; vocabulário pastoral |
| Pushpay/Subsplash entram no nicho | Média | Alto | Janela 18-24 meses; registro de marca; lock-in por dados longitudinais |

**Riscos de Recursos:**

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Segundo dev indisponível por longos períodos | Alta | Alto | Baseline = 1 dev + IA; segundo dev acelera, não bloqueia |
| Escopo do Release 2 muito grande para 1 dev | Média | Alto | Release 2 enxuto (sem gravação/gestão/reengajamento); priorizar reunião + presença + semáforo |
| Burnout do dev principal | Média | Crítico | Entrega incremental com milestones celebráveis (3 gates); sprints de 2 semanas; demos regulares |

### Timeline Estimada

| Release | Duração | Acumulado | Dev(s) |
|---------|---------|-----------|--------|
| Release 1a (Core Loop) | 6-8 semanas | 6-8 sem | 1 dev + IA |
| Release 1b (Polish) | 4-6 semanas | 10-14 sem | 1-2 devs |
| Release 2 (Radar Pastoral) | 8-10 semanas | 18-24 sem | 1-2 devs |
| **MVP completo** | — | **~5-6 meses** | — |

### MVP Acceptance Criteria (Final)

O MVP (Release 1a + 1b + 2) está completo quando todos os gates de release foram aprovados e adicionalmente:
- [ ] 3-5 grupos ativos operando de forma recorrente
- [ ] Líderes usando semanalmente (≥ 80% das semanas)
- [ ] Presença média por reunião ≥ 70%
- [ ] Uptime ≥ 99,5% em 30 dias contínuos
- [ ] Zero vazamento de dados entre tenants (teste automatizado contínuo)

## Requisitos Funcionais

> As seções anteriores definem QUEM usa, POR QUÊ, e EM QUE ORDEM. Os requisitos funcionais a seguir formalizam O QUE o sistema deve fazer — o contrato de capabilities que será decomposto em épicos e stories.
>
> **Convenção de leitura:** Cada FR especifica O QUE o sistema deve fazer, não COMO implementar. A coluna "Release" indica a entrega planejada. FRs marcados como "Post-MVP" estão documentados para rastreabilidade mas não fazem parte do escopo contratual do MVP.

### Legenda de Releases

| Release | Foco | FRs |
|---------|------|-----|
| 1a — Core Loop | Auth + Grupos + Trilhas + Conteúdo | 24 |
| 1b — Polish | Operacional + Configuração + Onboarding | 23 |
| 2 — Radar Pastoral | Reunião + Presença + Semáforo + Relatórios | 27 |
| Post-MVP | Automações, IA, Enterprise | 8 |
| **Total** | | **82** |

---

### 1. Identidade & Acesso

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR01 | O sistema deve permitir cadastro de usuário com e-mail e senha | 1a |
| FR02 | O sistema deve permitir login via provedor OAuth (Google) | 1a |
| FR03 | O sistema deve permitir que um mesmo usuário esteja associado a múltiplos tenants | 1a |
| FR04 | O sistema deve autenticar usuários de forma centralizada via provedor de identidade | 1a |
| FR05 | O sistema deve autorizar ações com base em papéis do usuário e contexto do tenant, garantindo que cada papel acesse apenas os recursos permitidos | 1a |
| FR06 | O sistema deve suportar os papéis: Super Admin, Admin Tenant, Líder, Participante | 1a |
| FR07 | O sistema deve isolar dados e operações por tenant, impedindo acesso cruzado | 1a |
| FR08 | O sistema deve permitir que um Admin Tenant gerencie usuários e papéis dentro do seu tenant | 1a |
| FR09 | O sistema deve implementar defesa em profundidade com 3 camadas de autorização independentes: (1) Keycloak identity provider, (2) NestJS Guards por rota, (3) PostgreSQL RLS por tenant. Cada camada opera independentemente — falha em uma não compromete as demais | 1a |
| FR10 | O sistema deve permitir que o usuário selecione o tenant ativo ao acessar a plataforma | 1a |
| FR11 | O sistema deve revogar sessões e tokens quando um usuário for removido de um tenant | 1a |
| FR83 | O sistema deve permitir que o usuário recupere acesso à conta via email quando esquecer a senha, utilizando o fluxo nativo de reset do provedor de identidade (Keycloak) | 1a-beta |

---

### 2. Tenant & Configuração

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR12 | O sistema deve permitir o provisionamento de novos tenants com dados mínimos (nome, admin, plano) | 1a |
| FR13 | O sistema deve associar cada tenant a um plano de assinatura (Free, Pro, Enterprise) com limites definidos | 1b |
| FR14 | O sistema deve aplicar limites numéricos por plano (grupos, participantes, storage, reuniões simultâneas) | 1b |
| FR15 | O sistema deve permitir que o Admin Tenant configure branding básico (logo, cores, nome de exibição) | 1b |
| FR16 | O sistema deve permitir que o Admin Tenant configure políticas do tenant (feature toggles para monitoramento de foco, câmera obrigatória, etc.) | 1b |
| FR17 | O sistema deve exibir prompt de upgrade quando o tenant atingir limites do plano atual | 1b |
| FR18 | O sistema deve permitir que o Super Admin visualize e gerencie todos os tenants da plataforma | 1a |
| FR19 | O sistema deve registrar metadata do tenant (data de criação, plano, status, configurações ativas) | 1a |

---

### 3. Grupos & Membros

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR20 | O sistema deve permitir que Admin/Líder crie, edite e exclua grupos dentro do tenant | 1a |
| FR21 | O sistema deve permitir que Admin/Líder vincule e desvincule participantes a um grupo | 1a |
| FR22 | O sistema deve permitir que Admin/Líder vincule e desvincule líderes a um grupo | 1a |
| FR23 | O sistema deve permitir que Admin/Líder convide participantes via e-mail ou link de convite | 1a |
| FR24 | O sistema deve permitir que Admin/Líder associe trilhas de conteúdo a um grupo | 1a |
| FR25 | O sistema deve exibir para o Líder a lista de membros do grupo com status de participação | 1a |
| FR26 | O sistema deve permitir que um participante visualize os grupos dos quais faz parte | 1a |
| FR27 | O sistema deve suportar importação em massa de participantes via arquivo CSV | 1b |
| FR28 | O sistema deve validar dados importados e reportar erros de importação ao usuário | 1b |

---

### 4. Trilhas & Conteúdo

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR29 | O sistema deve permitir que Admin/Líder crie trilhas de ensino com nome, descrição e configurações | 1a |
| FR30 | O sistema deve permitir que Admin/Líder crie módulos dentro de uma trilha e os ordene | 1a |
| FR31 | O sistema deve permitir que Admin/Líder crie aulas dentro de módulos e as ordene | 1a |
| FR32 | O sistema deve suportar os tipos de conteúdo: vídeo, texto rico, PDF/DOC, links externos | 1a |
| FR33 | O sistema deve permitir upload de arquivos de conteúdo para armazenamento próprio da plataforma | 1a |
| FR34 | O sistema deve permitir visualização de conteúdo inline (sem download obrigatório) | 1a |
| FR35 | O sistema deve permitir configuração de acesso sequencial ou livre entre módulos/aulas | 1b |
| FR36 | O sistema deve permitir configuração de pré-requisitos entre módulos/aulas | 1b |
| FR37 | O sistema deve registrar o progresso individual do participante por aula, módulo e trilha | 1a |
| FR38 | O sistema deve calcular e exibir percentual de conclusão da trilha por participante | 1a |
| FR39 | O sistema deve suportar regras de conclusão de aula: vídeo assistido (≥90% da duração), documento lido (scroll ≥80% + tempo ≥ tempo estimado de leitura), ou marcação manual pelo líder/participante. Cada tipo de conteúdo define sua regra padrão, configurável por tenant | 1b |
| FR40 | O sistema deve permitir publicação e versionamento de conteúdo (rascunho → publicado) | 1b |
| FR41 | O sistema deve permitir que o tenant defina trilhas no nível do tenant (catálogo) e as associe a múltiplos grupos | 1b |
| FR42 | O sistema deve suportar templates de conteúdo reutilizáveis: (a) biblioteca de templates pré-construídos (fornecidos pela plataforma), (b) templates criados pelo admin a partir de trilhas existentes ("salvar como template"). Templates incluem estrutura de módulos/aulas sem conteúdo específico | 2 |

---

### 5. Reuniões ao Vivo

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR43 | O sistema deve permitir que Admin/Líder crie reuniões vinculadas a um grupo com data, hora e duração | 2 |
| FR44 | O sistema deve integrar com provedor de videoconferência de forma agnóstica (abstração por interface) | 2 |
| FR45 | O sistema deve receber eventos do provedor de videoconferência (entrada, saída, estado de mídia) | 2 |
| FR46 | O sistema deve registrar presença automática classificada como integral ou parcial conforme regras configuráveis | 2 |
| FR47a | O sistema deve registrar o tempo com câmera ligada por participante durante a reunião | 2 |
| FR47b | O sistema deve registrar o tempo de permanência na sala por participante durante a reunião | 2 |
| FR47c | O sistema deve registrar indicador de foco (proxy técnico de atenção via visibilidade de aba) por participante, controlado por feature toggle do tenant | 2 |
| FR48 | O sistema deve tolerar desconexões técnicas sem penalizar a presença do participante (janela de reconexão configurável) | 2 |
| FR49 | O sistema deve gerar relatório pós-reunião automático com presença, engajamento e duração | 2 |
| FR50 | O sistema deve exibir banner de transparência durante a reunião informando que sinais de presença e engajamento estão sendo registrados | 2 |
| FR51 | O sistema deve manter estado da reunião ativa em cache e persistir ao encerrar | 2 |
| FR52 | O sistema deve permitir que o Líder visualize a lista de presença em tempo real durante a reunião | 2 |
| FR53 | O sistema deve notificar participantes sobre reuniões agendadas (via plataforma) | 2 |

---

### 6. Visibilidade Pastoral

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR54 | O sistema deve exibir dashboard semáforo (🟢🟡🔴) por participante para o Líder, baseado em sinais de presença, engajamento e progresso | 2 |
| FR55 | O sistema deve calcular a classificação semáforo com base em regras objetivas e configuráveis por tenant. Thresholds padrão: 🟢 presença ≥75% nas últimas 4 semanas + ativo nos últimos 14 dias; 🟡 presença 50-74% OU inativo 14-21 dias; 🔴 presença <50% OU inativo >21 dias. Admin Tenant pode ajustar thresholds por tenant | 2 |
| FR56 | O sistema deve permitir que o Líder visualize o perfil consolidado de um participante (histórico de presença, progresso em trilhas, sinais de engajamento) | 2 |
| FR57 | O sistema deve permitir que o Líder registre ações de cuidado pastoral vinculadas a um participante | 2 |
| FR58 | O sistema deve atualizar o dashboard semáforo em tempo real via SSE | 2 |
| FR59 | O sistema deve exibir indicadores de tendência por participante (melhorando, estável, declínio) | 2 |
| FR60 | O sistema deve permitir que o Admin Tenant visualize dashboard agregado de todos os grupos do tenant | 2 |
| FR61 | O sistema deve exibir alertas quando um participante mudar de status no semáforo (ex.: 🟢→🟡 ou 🟡→🔴) | 2 |
| FR62 | O sistema deve enquadrar toda a comunicação de monitoramento com vocabulário pastoral (cuidado, não vigilância). Governança: termos pastorais definidos em `vocabulary.ts` (packages/types), mensagens UI centralizadas em `pt-BR.json`. Termos proibidos: "monitorar", "rastrear", "controlar", "vigiar" — validado via lint CI. Design system team aprova alterações de vocabulário | 2 |

---

### 7. Relatórios & Analytics

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR63 | O sistema deve gerar relatório por reunião com métricas de presença e engajamento | 2 |
| FR64 | O sistema deve gerar relatório por trilha com métricas de progresso e conclusão por participante | 1b |
| FR65 | O sistema deve gerar relatório por tenant com métricas agregadas de todos os grupos | 2 |
| FR66 | O sistema deve identificar e sinalizar participantes em risco de evasão com base em padrões de ausência e inatividade. Critérios: alerta ao líder após 3+ ausências consecutivas em reuniões do grupo; flag de inatividade após 2+ semanas sem acesso à plataforma. Notificação via dashboard semáforo (transição automática 🟢→🟡 ou 🟡→🔴 conforme FR55) | 2 |
| FR67 | O sistema deve gerar métricas de plataforma para Super Admin (tenants ativos, usuários, utilização de recursos) | 2 |
| FR68 | O sistema deve permitir exportação de relatórios em formato adequado para análise (CSV ou equivalente) | 1b |

---

### 8. Onboarding & Adoção

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR69 | O sistema deve exibir tela de boas-vindas personalizada no primeiro acesso do usuário | 1b |
| FR70 | O sistema deve oferecer onboarding guiado para Admin Tenant na configuração inicial do tenant | 1b |
| FR71 | O sistema deve disponibilizar dados de demonstração para que o Admin explore funcionalidades antes de inserir dados reais | 1b |
| FR72 | O sistema deve coletar consentimento explícito do usuário para tratamento de dados conforme LGPD | 1a |
| FR73 | O sistema deve permitir que o usuário exporte seus dados pessoais (direito de portabilidade LGPD) | 1b |
| FR74 | O sistema deve permitir que o usuário solicite exclusão de seus dados pessoais (direito de eliminação LGPD) | 1b |
| FR75 | O sistema deve exibir política de privacidade e termos de uso no cadastro e mantê-los acessíveis | 1a |

---

### 9. Capabilities Transversais

> FRs adicionados após revisão para cobrir gaps identificados em busca, notificações, auditoria, resiliência e experiência de erro.

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR76 | O sistema deve permitir busca full-text por conteúdo dentro de trilhas, aulas e materiais do tenant. Implementação via PostgreSQL tsvector sobre título, descrição e tags. Resultados scoped por tenant (RLS). Suporte a busca por termo parcial e acentuação | 1b |
| FR77 | O sistema deve permitir envio de notificações in-app para usuários (reuniões, atualizações de conteúdo, alertas pastorais) | 2 |
| FR78 | O sistema deve permitir que o usuário configure preferências de notificação por tipo | Post-MVP |
| FR79 | O sistema deve gerar relatório consolidado por líder com visão agregada de todos os seus grupos | 2 |
| FR80 | O sistema deve registrar log de auditoria de ações administrativas (criação/edição/exclusão de recursos, alterações de permissão, configurações de tenant) | 1b |
| FR81 | O sistema deve exibir mensagens de erro claras e acionáveis, orientando o usuário sobre como resolver o problema | 1b |
| FR82 | O sistema deve manter funcionalidade básica de leitura (visualização de trilhas e conteúdo já carregado) em caso de instabilidade de conexão. Implementação via PWA com Service Worker: cache de conteúdo já visualizado (trilhas, aulas texto/PDF). Rascunho de registro de presença em reunião offline (sync automático ao reconectar). Não inclui funcionalidades de escrita/edição offline | Post-MVP |

---

### Distribuição por Release

| Release | Qtd | Áreas Principais |
|---------|-----|-------------------|
| **1a — Core Loop** | 24 | Identidade (11), Tenant parcial (3), Grupos (7), Trilhas parcial (7), LGPD (2) |
| **1b — Polish** | 23 | Tenant config (5), Grupos importação (2), Trilhas complementar (7), Relatório trilha (2), Onboarding (5), Busca (1), Auditoria (1), UX erro (1) |
| **2 — Radar Pastoral** | 27 | Reuniões (11+split), Visibilidade Pastoral (9), Relatórios reunião/tenant (4), Templates (1), Notificações (1), Relatório líder (1) |
| **Post-MVP** | 8 | Preferências notificação (1), Resiliência offline (1), demais em Phases 3-5 |
| **Total** | **82** | |

### Notas de Implementação (Informativas)

> Estas notas não são requisitos — são orientações para a fase de arquitetura e design técnico.

1. **FR47a/b/c (Engajamento):** Cada indicador é independente e controlável por feature toggle. O indicador de foco (FR47c) é o mais sensível e deve ser opt-in por tenant.
2. **FR37 (Progresso):** O percentual específico de conclusão é decisão de design, não requisito funcional. O FR especifica que o sistema deve registrar progresso.
3. **FR45 (Eventos de videoconferência):** O mecanismo de recepção de eventos (webhooks, SSE, polling) é decisão de arquitetura. O FR especifica que o sistema deve receber eventos.
4. **FR42 e FR67:** Movidos de Release 1b para Release 2 após análise de dependências — templates dependem de trilhas maduras, métricas de plataforma dependem de dados de reunião.
5. **Rastreabilidade:** Cada FR deve ser mapeável a pelo menos uma User Story na fase de épicos/stories.
6. **FR05 (Autorização):** Implementar via RBAC (papéis) + ABAC leve (contexto do tenant). Padrão recomendado: Keycloak roles + NestJS Guards + PostgreSQL RLS.
7. **FR09 (Defesa em profundidade):** As 3 camadas recomendadas são: identity provider (Keycloak), application guards (NestJS), database RLS (PostgreSQL).

## Requisitos Não-Funcionais

> NFRs definem QUÃO BEM o sistema deve funcionar, não O QUE ele faz. Cada NFR é mensurável e verificável. Padrões de implementação (Argon2id, circuit breaker, exponential backoff, etc.) estão nas Notas de Implementação — os NFRs especificam o resultado esperado, não a técnica.

### Performance

**Web Vitals (p75):**

| Métrica | Target |
|---------|--------|
| LCP (Largest Contentful Paint) | ≤ 2,5s |
| INP (Interaction to Next Paint) | ≤ 200ms |
| CLS (Cumulative Layout Shift) | ≤ 0,1 |

**Targets por Fluxo Crítico:**

| ID | Fluxo | Target | Condição |
|----|-------|--------|----------|
| NFR-P1 | Entrada na reunião | < 3s | 4G bom |
| NFR-P2 | Dashboard do líder (navegação recorrente) | ≤ 2s | Cache quente |
| NFR-P3 | Atualização do semáforo após evento | ≤ 2s | Ponta a ponta |
| NFR-P4 | Lista de presença (entrada/saída) | ≤ 1s | Tempo real |
| NFR-P5 | Página de trilha | ≤ 2,5s | Primeiro carregamento |
| NFR-P6 | Player de vídeo visível | ≤ 2s | Rede estável |
| NFR-P7 | Início de reprodução de vídeo | ≤ 3s | Rede estável |
| NFR-P8 | Documento/texto de aula | ≤ 2s | Legível e navegável |

---

### Segurança

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-S1 | Senhas devem ser armazenadas com hash Argon2id (memory cost 64MB, iterations 3, parallelism 1) — resistente a ataques de GPU e side-channel. Delegado ao Keycloak (suporte nativo) | 1a |
| NFR-S2 | Senha mínima: 12 caracteres; suportar até 64+ caracteres | 1a |
| NFR-S3 | Senhas vazadas/comuns devem ser bloqueadas no cadastro (lista OWASP/NIST) | 1a |
| NFR-S4 | MFA obrigatório para Super Admin e Admin Tenant | 1a |
| NFR-S5 | MFA opcional para Líder no MVP, com expansão planejada | Post-MVP |
| NFR-S6 | TLS obrigatório em trânsito, inclusive entre serviços internos sensíveis | 1a |
| NFR-S7 | Criptografia at-rest obrigatória para banco, storage de arquivos/gravações e backups | 1a |
| NFR-S8 | Segredos gerenciados fora do código via cofre/secret manager centralizado | 1a |
| NFR-S9 | Sessões com alta entropia para IDs de sessão | 1a |
| NFR-S10 | Nenhum dado de um tenant deve ser acessível por outro tenant, verificável por suíte de testes automatizada executada em cada deploy | 1a |

**Auditoria (eventos mínimos a registrar):**
- Login e autenticação (sucesso e falha)
- Alteração de permissão e papéis
- Criação/edição/exclusão de conteúdo
- Acesso a gravações
- Exportação de dados pessoais
- Alterações administrativas de tenant

---

### Escalabilidade

**Targets Progressivos por Release:**

| Métrica | Release 1 | Release 2 | 12 meses |
|---------|-----------|-----------|----------|
| Usuários simultâneos | 20 | 50 | 250 |
| Tenants ativos | 1–3 | 3–5 | 5–10 |
| Usuários cadastrados | 50–100 | 100–300 | 300–800 |
| UAM (ativos mensais) | 20–50 | 50–150 | 150–300 |
| Grupos recorrentes (tenant mais ativo) | 2–3 | 3–6 | 5–12 |
| Reuniões simultâneas | — | 1–3 | 3–8 |
| Participantes por reunião típica | — | 15–30 | 30–50 |

**Princípios de Escalabilidade:**
- NFR-E1: App/API/workers devem escalar horizontalmente. Trigger: CPU média >70% por 5min → auto-scale (max 4 réplicas dev, 8 prod). Stateless obrigatório — sessão e cache em Redis
- NFR-E2: Reunião ao vivo e processamento assíncrono devem escalar independentemente do app principal. BullMQ workers em containers separados; scale baseado em queue depth >100 jobs pending
- NFR-E3: Semáforo deve ser atualizado por eventos assíncronos, não por processamento síncrono pesado. Recálculo via BullMQ job disparado por evento de presença/progresso; resultado cacheado em Redis (TTL 5min)

---

### Confiabilidade

**Disponibilidade:**

| ID | Requisito | Target |
|----|-----------|--------|
| NFR-C1 | Uptime da plataforma principal | ≥ 99,5% (janela de 30 dias) |
| NFR-C2 | Alerta de uptime configurado com notificação imediata | Release 1a |
| NFR-C3 | Post-mortem documentado para cada incidente com downtime > 30 min | Release 1b |

**RPO/RTO Progressivos:**

| Tipo de Dado | RPO Release 1 | RPO Release 2 | RTO |
|--------------|---------------|---------------|-----|
| Dados transacionais críticos (usuários, grupos, presença, progresso) | ≤ 1h | ≤ 15 min | ≤ 4h |
| Gravações e documentos (com versionamento/snapshot) | ≤ 24h | ≤ 24h | ≤ 8h |

**Tolerância a Perda de Dados:**

| Tipo | Tolerância | Cenário de Verificação |
|------|-----------|------------------------|
| Presença consolidada/final | Zero perda | Simular crash do servidor durante reunião e verificar que dados de presença são recuperáveis |
| Telemetria bruta durante reunião | ≤ 60s de eventos não confirmados | Simular queda de conexão de 60s e verificar que ≤ 60s de telemetria são perdidos após reconexão |
| Eventos de progresso/trilha | ≤ 1 evento perdido por sessão | Simular falha de gravação e verificar reprocessamento automático |

**Backup & Restore:**

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-C4 | Banco: snapshots diários + backups incrementais | 1a |
| NFR-C5 | Storage: versionamento de objetos quando aplicável | 1b |
| NFR-C6 | Teste de restore executado e documentado | Gate Release 1b |
| NFR-C7 | Runbook de disaster recovery testado e documentado | Gate Release 1b |

---

### Acessibilidade

**Target:** WCAG 2.1 AA (com mentalidade WCAG 2.2 AA onde possível)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-A1 | Navegação por teclado em todos os fluxos principais | 1b |
| NFR-A2 | Contraste e foco visível conforme WCAG AA | 1b |
| NFR-A3 | Formulários acessíveis com labels e mensagens de erro claras | 1b |
| NFR-A4 | Compatibilidade com leitores de tela nas áreas críticas: login, dashboard, trilhas, progresso, semáforo | 2 |
| NFR-A5 | Semáforo não dependente apenas de cor para comunicar estado (ícones/texto complementar obrigatórios) | 2 |
| NFR-A6 | Legendas/transcrição quando houver vídeo essencial na trilha | Post-MVP |

---

### Integração & Resiliência

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-I1 | O sistema deve continuar operando funcionalidades core quando um provedor externo estiver indisponível por até 30 minutos | 2 |
| NFR-I2 | Falhas transitórias em integrações externas devem ser reprocessadas automaticamente antes de gerar erro para o usuário | 2 |
| NFR-I3 | Timeouts explícitos para todas as chamadas externas: connect ≤ 3s, read ≤ 10s | 2 |
| NFR-I4 | Jobs falhados devem ser retidos para reprocessamento e investigação | 1b |
| NFR-I5 | Health check por integração ativa com status acessível ao Super Admin | 2 |

**Fallbacks por Provedor:**

| Provedor | Fallback | Release |
|----------|----------|---------|
| Videoconferência | Sala reserva / reinício de sessão; modo áudio prioritário em degradação; remarcação rápida + notificação automática se provider falhar antes da reunião | 2 |
| WhatsApp | Reencaminhar por fila; fallback para notificação in-app ou e-mail quando existir; registrar status final (enviado, falhou, reprocessado) | Post-MVP |

---

### Observabilidade

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-O1 | Logs estruturados devem estar disponíveis para troubleshooting em ≤ 5 minutos após incidente | 1a |
| NFR-O2 | Erros de aplicação devem gerar alerta automático com contexto suficiente para diagnóstico | 1a |
| NFR-O3 | Métricas básicas de saúde (CPU, memória, disco, latência de resposta) disponíveis via dashboard | 1b |
| NFR-O4 | Métricas detalhadas por provedor de integração (sucesso, falha, latência, taxa de retry) | Phase 3 |
| NFR-O5 | Tracing distribuído entre serviços | Phase 3 |

---

### Privacidade & LGPD

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-L1 | Dados pessoais exportados devem estar disponíveis em ≤ 72h após solicitação do titular | 1b |
| NFR-L2 | Exclusão de dados pessoais deve ser executada em ≤ 30 dias após solicitação confirmada | 1b |
| NFR-L3 | Consentimento para tratamento de dados deve ser coletado antes de qualquer processamento de dados pessoais | 1a |
| NFR-L4 | Feature toggle para monitoramento de foco/aba deve estar desativado por padrão em novos tenants | 2 |
| NFR-L5 | Base legal por operação de tratamento de dados deve estar documentada e acessível | 1b |

---

### Experiência de Onboarding

| ID | Requisito | Target | Release |
|----|-----------|--------|---------|
| NFR-X1 | Admin Tenant deve conseguir criar o primeiro grupo com participantes | ≤ 10 min após primeiro login | 1b |
| NFR-X2 | Líder deve conseguir acessar o dashboard e visualizar seu grupo | ≤ 3 min após primeiro login | 1b |
| NFR-X3 | Participante deve conseguir acessar sua primeira trilha | ≤ 2 min após aceitar convite | 1b |

---

### Notas de Implementação (NFRs — Informativas)

> Estas notas não são requisitos — são orientações técnicas para a fase de arquitetura.

1. **Hash de senha:** Argon2id é a escolha recomendada para NFR-S1. Keycloak suporta nativamente.
2. **Isolamento multi-tenant (NFR-S10):** Implementar via 3 camadas: Keycloak (identity) → NestJS Guards (application) → PostgreSQL RLS (database).
3. **Resiliência de integrações (NFR-I1/I2):** Implementar com circuit breaker, exponential backoff + jitter, e idempotência.
4. **DLQ (NFR-I4):** No Release 1, BullMQ `failed` jobs com retry. DLQ real com NATS JetStream no Phase 3.
5. **Backup (NFR-C4):** WAL archiving contínuo para atingir RPO ≤ 15 min no Release 2. No Release 1, pg_dump cron é suficiente para RPO ≤ 1h.
6. **Observabilidade (NFR-O1/O2):** Sentry + logs estruturados (JSON) no Release 1. Grafana/Prometheus/Loki no Phase 3.
7. **Error budget:** Não formalizar no MVP. Usar alerta de uptime (UptimeRobot/Healthchecks.io) + post-mortem para incidentes.
8. **Acessibilidade (NFR-A1-A3):** shadcn/ui + Radix são AA-compliant por padrão. Esforço adicional concentrado nos componentes custom do Release 2 (semáforo, player, dashboard).

---

## Apêndice: Matriz de Rastreabilidade FR → Jornada

> Mapeamento de cada requisito funcional para a(s) jornada(s) de usuário que o exercita(m).
> J1 = Participante | J2 = Líder | J3 = Admin Tenant | J4 = Super Admin

| ID | Requisito (resumo) | J1 | J2 | J3 | J4 |
|----|---------------------|:--:|:--:|:--:|:--:|
| **1. Identidade & Acesso** |||||
| FR01 | Cadastro e-mail/senha | ✓ | ✓ | ✓ | |
| FR02 | Login OAuth (Google) | ✓ | ✓ | ✓ | |
| FR03 | Associação multi-tenant | ✓ | ✓ | ✓ | |
| FR04 | Autenticação centralizada (Keycloak) | ✓ | ✓ | ✓ | ✓ |
| FR05 | Autorização por papéis + contexto tenant | ✓ | ✓ | ✓ | ✓ |
| FR06 | Papéis: Super Admin, Admin, Líder, Participante | ✓ | ✓ | ✓ | ✓ |
| FR07 | Isolamento de dados por tenant (RLS) | ✓ | ✓ | ✓ | ✓ |
| FR08 | Admin gerencia usuários/papéis do tenant | | | ✓ | |
| FR09 | Defesa em profundidade (3 camadas) | ✓ | ✓ | ✓ | ✓ |
| FR10 | Seleção de tenant ativo | ✓ | ✓ | ✓ | |
| FR11 | Revogação de sessão ao remover usuário | | | ✓ | ✓ |
| FR83 | Recuperação de senha via email (Keycloak) | ✓ | ✓ | ✓ | ✓ |
| **2. Tenant & Configuração** |||||
| FR12 | Provisionamento de tenant | | | ✓ | ✓ |
| FR13 | Planos de assinatura (Free/Pro/Enterprise) | | | ✓ | ✓ |
| FR14 | Configuração de tenant (nome, logo, preferências) | | | ✓ | |
| FR15 | Feature gating por plano | | | ✓ | ✓ |
| FR16 | Limites por plano (grupos, membros, storage) | | | ✓ | ✓ |
| FR17 | Métricas de uso do tenant | | | ✓ | ✓ |
| FR18 | Super Admin gerencia tenants | | | | ✓ |
| FR19 | Upgrade/downgrade de plano | | | ✓ | ✓ |
| **3. Grupos & Membros** |||||
| FR20 | Criar grupo dentro do tenant | | ✓ | ✓ | |
| FR21 | Associar líder(es) a grupo | | | ✓ | |
| FR22 | Convidar participantes (e-mail/link) | | ✓ | ✓ | |
| FR23 | Aceitar convite e ingressar no grupo | ✓ | | | |
| FR24 | Visualizar membros do grupo | ✓ | ✓ | ✓ | |
| FR25 | Remover participante do grupo | | ✓ | ✓ | |
| FR26 | Transferir participante entre grupos | | | ✓ | |
| FR27 | Importação em lote via CSV (grupos) | | | ✓ | |
| FR28 | Importação em lote via CSV (membros) | | ✓ | ✓ | |
| **4. Trilhas de Conteúdo** |||||
| FR29 | Criar trilha de conteúdo | | ✓ | ✓ | |
| FR30 | Criar/ordenar módulos dentro de trilha | | ✓ | ✓ | |
| FR31 | Criar/ordenar aulas dentro de módulos | | ✓ | ✓ | |
| FR32 | Tipos de conteúdo (vídeo, texto, PDF, links) | | ✓ | ✓ | |
| FR33 | Upload de arquivos de conteúdo | | ✓ | ✓ | |
| FR34 | Visualização inline de conteúdo | ✓ | ✓ | | |
| FR35 | Acesso sequencial ou livre | | ✓ | ✓ | |
| FR36 | Pré-requisitos entre módulos/aulas | | ✓ | ✓ | |
| FR37 | Registro de progresso individual | ✓ | | | |
| FR38 | Percentual de conclusão por participante | ✓ | ✓ | | |
| FR39 | Regras de conclusão de aula | ✓ | ✓ | ✓ | |
| FR40 | Publicação e versionamento de conteúdo | | ✓ | ✓ | |
| FR41 | Trilhas no nível do tenant (catálogo) | | | ✓ | |
| FR42 | Templates reutilizáveis | | ✓ | ✓ | |
| **5. Reuniões ao Vivo** |||||
| FR43 | Agendar reunião recorrente | | ✓ | ✓ | |
| FR44 | Integração com videoconferência | | ✓ | | |
| FR45 | Receber eventos de videoconferência | | | | |
| FR46 | Registro de presença (manual/auto) | ✓ | ✓ | | |
| FR47a | Indicador: participação ativa | ✓ | | | |
| FR47b | Indicador: duração na reunião | ✓ | | | |
| FR47c | Indicador: foco (opt-in por tenant) | ✓ | | | |
| FR48 | Lembrete automático pré-reunião | ✓ | ✓ | | |
| FR49 | Histórico de reuniões do grupo | | ✓ | ✓ | |
| FR50 | Anotações do líder pós-reunião | | ✓ | | |
| FR51 | Cancelar/reagendar reunião | | ✓ | ✓ | |
| FR52 | Reunião avulsa (não recorrente) | | ✓ | ✓ | |
| FR53 | Gravação opcional de reunião | | ✓ | ✓ | |
| **6. Visibilidade Pastoral** |||||
| FR54 | Dashboard semáforo por participante | | ✓ | | |
| FR55 | Cálculo semáforo com regras configuráveis | | ✓ | ✓ | |
| FR56 | Perfil consolidado do participante | | ✓ | | |
| FR57 | Registro de ações de cuidado pastoral | | ✓ | | |
| FR58 | Dashboard semáforo em tempo real (SSE) | | ✓ | | |
| FR59 | Indicadores de tendência por participante | | ✓ | ✓ | |
| FR60 | Dashboard agregado do tenant | | | ✓ | |
| FR61 | Alertas de mudança de status semáforo | | ✓ | ✓ | |
| FR62 | Vocabulário pastoral na comunicação | ✓ | ✓ | ✓ | |
| **7. Relatórios & Analytics** |||||
| FR63 | Relatório por reunião (presença/engajamento) | | ✓ | ✓ | |
| FR64 | Relatório por trilha (progresso/conclusão) | | ✓ | ✓ | |
| FR65 | Relatório por tenant (métricas agregadas) | | | ✓ | |
| FR66 | Sinalização de risco de evasão | | ✓ | ✓ | |
| FR67 | Métricas de plataforma (Super Admin) | | | | ✓ |
| FR68 | Exportação de relatórios (CSV) | | ✓ | ✓ | ✓ |
| **8. Onboarding & Adoção** |||||
| FR69 | Tela de boas-vindas personalizada | ✓ | ✓ | ✓ | |
| FR70 | Tour guiado por papel | ✓ | ✓ | ✓ | |
| FR71 | Checklist de setup do tenant | | | ✓ | |
| FR72 | Indicador de progresso de setup | | | ✓ | |
| FR73 | Exportação de dados pessoais (LGPD) | ✓ | | | |
| FR74 | Exclusão de conta e dados (LGPD) | ✓ | | | |
| FR75 | Aceite de termos de uso | ✓ | ✓ | ✓ | |
| **9. Capabilities Transversais** |||||
| FR76 | Busca full-text por conteúdo | ✓ | ✓ | ✓ | |
| FR77 | Notificações in-app | ✓ | ✓ | ✓ | |
| FR78 | Preferências de notificação | ✓ | ✓ | ✓ | |
| FR79 | Relatório consolidado por líder | | ✓ | | |
| FR80 | Audit log de ações administrativas | | | ✓ | ✓ |
| FR81 | Mensagens de erro claras e acionáveis | ✓ | ✓ | ✓ | ✓ |
| FR82 | Funcionalidade offline (leitura) | ✓ | | | |

**Cobertura por Jornada:**
- J1 (Participante): 38 FRs — foco em consumo, progresso, presença
- J2 (Líder): 46 FRs — foco em gestão de grupo, trilhas, visibilidade pastoral
- J3 (Admin Tenant): 48 FRs — foco em configuração, relatórios, governança
- J4 (Super Admin): 14 FRs — foco em provisionamento, métricas de plataforma, auditoria
