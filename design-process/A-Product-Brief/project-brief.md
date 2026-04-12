# Project Brief: metanoia-hub

> Complete Strategic Foundation — Refined on top of existing PRD, Architecture, Project Context and UX Specification

**Created:** 2026-04-11
**Author:** squad1promoacao
**Brief Type:** Complete (WDS Phase 1 — Steps 01–11 consolidated)
**Source of Truth:** `design-process/A-Product-Brief/session-01-progress.md` (1243 linhas, diálogo completo da Sessão 1)

---

## Strategic Summary

O **metanoia-hub** é um **radar pastoral**: uma plataforma B2B SaaS que traduz sinais de participação digital em visibilidade pastoral acionável, para que líderes de grupo e pastores possam cuidar a tempo — sem transformar pastoreio em fiscalização. O produto nasce da observação de que líderes de grupo evangélicos brasileiros vivem hoje dentro de um stack fragmentado (WhatsApp + Drive + cabeça) e percebem afastamentos tarde demais, sentindo culpa por algo que não é falta de amor, mas falta de um jeito claro de enxergar.

O princípio-raiz que governa todas as decisões de produto é **"presença digital ≠ saúde espiritual"**. Derivam dele dois princípios estruturais que diferenciam o metanoia-hub de qualquer alternativa existente: **confiabilidade humilde** — *"o radar só pode sinalizar o que consegue explicar"* — e **loop fechado por cuidado** — o sistema fecha o loop mostrando quando cuidado pastoral gerou movimento, sem gamificação, sem scoreboard, sem ranking. A unidade mínima de valor do produto é *"cuidado acionado com contexto e confirmado por alguma resposta real"*.

O ICP primário é a **igreja local evangélica brasileira com 40–100 participantes, 3–5 grupos, já híbrida digital**. O buyer é o pastor titular, o champion é o líder de discipulado, mas o **usuário crítico — e a regra de ouro do produto — é o líder de grupo**. Todo o aparato de UX, microcopy, priorização de features e telemetria é calibrado para **vencer a quarta-feira de manhã no celular dele**: uma checagem de 1–3 minutos que termina com a frase *"dessa vez eu não fui pego de surpresa"*.

---

## Vision

Fazer com que nenhum participante de grupo pequeno se afaste de uma comunidade de fé **sem que o líder tenha tido um jeito claro, digno e a tempo de perceber e agir** — transformando o improviso relacional que hoje depende só da memória humana em uma prática sustentada por um radar pastoral humilde, que observa mas não diagnostica, que lembra mas não fiscaliza, e que fecha o loop do cuidado só quando há resposta real.

**Frase-âncora do líder** (captura toda a tensão emocional do problema):
> *"Não me falta amor pelo grupo. Me falta um jeito claro de enxergar quem está se afastando e agir a tempo."*

**Meta de 30 dias do líder** (a evidência de que o produto funcionou):
> *"Dessa vez eu não fui pego de surpresa."*

---

## Positioning Statement

Para **líderes de grupo pequeno em igrejas locais evangélicas brasileiras (40–100 participantes, já híbridas digitais)** que **lutam para enxergar a tempo quem está se afastando e agir sem transformar pastoreio em fiscalização**, o **metanoia-hub** é um **radar pastoral** que **traduz sinais de participação digital em cuidado acionável** — diferente de CRMs de igreja, ChMS administrativos, LMS educacionais e combos Meet+Drive porque é o único produto **desenhado a partir do líder de grupo (não da governança institucional) e construído em cima de um modelo conceitual próprio de cuidado pastoral que fecha o loop entre percepção, ação e resposta real**.

**Breakdown:**

| Componente | Valor |
|---|---|
| **Target Customer** | Igreja local evangélica brasileira, 40–100 participantes, 3–5 grupos pequenos, já híbrida digital. Usuário crítico: o líder de grupo. |
| **Need / Opportunity** | Enxergar afastamentos a tempo e agir com dignidade — sem vigilância, sem culpa, sem mais uma ferramenta pesada. |
| **Category** | **Radar pastoral** (categoria nomeada cedo, explicitamente não-CRM, não-ChMS, não-LMS, não-Meet+Drive). |
| **Key Benefit** | *"Cuidado acionado com contexto e confirmado por alguma resposta real"* — em ≤48h do sinal, em ≤3min de tela. |
| **Differentiator** | Loop fechado por cuidado + foco radical no líder de grupo + modelo conceitual pastoral próprio. Incumbentes não conseguem copiar sem canibalizar o próprio modelo de negócio. |

---

## Business Model

**Tipo:** B2B SaaS freemium com cobrança **flat por igreja** (nunca por participante — princípio de produto, não só de pricing).

### Plano de Preços (estado atual)

| Plano | Preço (âncora publicada no PRD) | Escopo |
|---|---|---|
| **Free** | R$ 0 | Acesso básico, validação inicial |
| **Pro** | **R$ 99/mês** (flat por igreja) | Ferramenta ministerial completa |
| **Enterprise** | Sob consulta | Redes de igrejas, multi-tenant hierárquico |

**ARR alvo 12 meses:** ~R$ 66.000 (referência de seed: 3 Pro + 2 Enterprise) · **Churn mensal alvo:** ≤ 3% · **Tempo de ativação do tenant:** ≤ 7 dias.

### Revisão proposta no WDS Step 06 (não canonizada no PRD)

O diálogo estratégico do **Step 06** identificou que a **zona de conforto de preço** do buyer pastor é **R$ 80–250/mês** e a **zona aceitável com valor claro** é R$ 250–500/mês. A partir dessa leitura, o WDS recomenda **testar uma âncora revisada de R$ 149–299/mês** durante o MVP, para posicionar o produto como *"ferramenta ministerial séria"* (acima de ChMS brasileiros como Amosh R$ 49,90, Enuves R$ 84, IgrejasNet R$ 99–175, ePastor a partir de R$ 127).

> **⚠️ Consistência documental:** a revisão do Step 06 requer atualização explícita do PRD (`docs/prd.md`) antes de ser canonizada. Até que isso aconteça, **R$ 99/mês (Pro) é a âncora pública vigente**. O brief canônico registra ambas as referências para evitar ambiguidade.

### Ciclo de Cobrança

- **Entrada/aquisição:** cobrança mensal para reduzir atrito de decisão
- **Retenção/consolidação:** cobrança anual com desconto
- **Regra absoluta:** nunca cobrar por participante (princípio de produto — evita criar incentivo perverso contra cadastrar membros vulneráveis)

---

## Business Customer Profile (B2B)

**ICP primário:** Igreja local evangélica brasileira, **40–100 participantes**, 3–5 grupos pequenos, já operando em modelo híbrido digital (reuniões presenciais + WhatsApp + alguma videoconferência ocasional).

### Buying Roles

| Papel | Quem é | Poder no ciclo de compra |
|---|---|---|
| **Buyer** | **Pastor titular** | Aprova e paga. Precisa legitimar a decisão frente ao conselho da igreja. |
| **Champion** | **Líder de discipulado** (ou pastor de grupos pequenos) | Descobre, avalia, apresenta, defende internamente. |
| **User crítico** | **Líder de grupo** (regra de ouro do produto) | Decide, no dia a dia, se o produto vive ou morre. |

### Frase-âncora do ciclo de compra

> *"O buyer aprova, o pastor titular legitima, mas quem faz o produto vencer ou morrer é o líder que usa o radar no dia a dia."*

### Aceleradores de compra

- Valor visível em poucos dias (não semanas)
- Onboarding leve
- Dor clara do champion (já sente que perde gente por falta de visibilidade)
- Confiança pré-existente entre pastor titular e champion
- Preço simples e de baixo atrito

### Vetos típicos

- *"É mais uma ferramenta para aprender"*
- *"Ninguém vai usar direito"*
- Esforço de migração do WhatsApp
- Dúvidas sobre privacidade de dados de membros
- Falta de integração com o stack atual
- Preço sem prova de valor percebida

### Comparação mental real

> A referência do buyer **não** é *"metanoia-hub vs software enterprise"*. É *"metanoia-hub vs meu combo atual de WhatsApp + Meet + planilha + esforço humano"*. O preço precisa parecer razoável **frente ao tempo poupado, à clareza pastoral e à substituição da fragmentação** — não frente a benchmarks enterprise.

---

## User Profile (within Business)

### Usuário crítico: o líder de grupo (profundidade máxima)

**Contexto real:**
- Voluntário, não profissional. Tem emprego/vida fora da igreja.
- Lidera 8–15 participantes em um grupo pequeno (célula, grupo familiar, grupo de estudo — vocabulário varia por igreja).
- Usa WhatsApp o dia inteiro, mas para outras coisas. O grupo é uma conversa entre muitas.
- Percebe afastamentos **tarde demais** e sente **culpa** por isso — não por falta de amor, mas por falta de mecânica.
- Não quer *"mais uma ferramenta"*. Quer **vencer uma manhã específica**: quarta-feira, no celular, em 1–3 minutos, antes do trabalho.

**Padrão de uso do MVP:**
- **Mobile-first real:** 75–85% mobile (Android gama média-baixa primário) + 15–25% desktop (pastor/admin com densidade invertida)
- **Hybrid-first:** push contextual **raro** + hábito leve (nem puramente push, nem puramente hábito)
- **2–4 aberturas/semana** (não diária — diariedade seria cansaço, não cuidado)
- **Cenário-âncora MVP:** *"vencer a quarta-feira de manhã no celular"*

**Medo central do pastor titular** (que o líder compartilha):
> *"Isso vai transformar pastoreio em fiscalização."*
>
> **A UX precisa desarmar isso em cada tela.** Não basta "não ser fiscalização" — tem que **parecer explicitamente** não-fiscalização para quem abre pela primeira vez.

**Improviso sagrado** (NÃO automatizar):
- Discernimento relacional do líder sobre contexto específico de cada participante
- Escolha de palavras em uma mensagem privada
- Decisão de quando ligar, quando visitar, quando esperar
- **O radar não é veredito.** O radar sugere, o líder decide.

### Secondary Users

| Usuário | Densidade UI | Papel funcional |
|---|---|---|
| **Pastor titular** | Desktop densa + mobile leve | Visão agregada dos grupos, acompanhamento do champion, sem vigilância de participante individual |
| **Líder de discipulado (champion)** | Desktop médio + mobile médio | Vê grupos sob sua responsabilidade, treina líderes, institui cultura de cuidado |
| **Participante** | Mobile simples | Jornada pessoal, próximos passos, conteúdo — **nunca** ranking, nunca score |
| **Admin de tenant** | Desktop densa | Cadastro, RLS, configurações; **não vê dados pastorais** salvo quando explicitamente autorizado |
| **Super Admin de plataforma** | Desktop densa | Métricas de plataforma, suporte, nunca dados de participantes |

---

## Success Criteria

### North Stars

| Métrica | Definição |
|---|---|
| **North Star de Produto** | `% semanas-líder com ≥1 ação orientada pelo radar em ≤48h` |
| **North Star de Negócio** | `% igrejas Pro renovadas com uso saudável` (uso saudável = radar batendo percepção pastoral + líder agindo sem sentir culpa) |
| **Contra-métrica (anti-gamificação)** | `% igrejas Pro zumbis` — igrejas que pagam mas não usam; se crescer, o produto fracassou mesmo com receita |

### Princípio-raiz inviolável

> **"Presença digital ≠ saúde espiritual."**
>
> Este é o fundamento dos outros 8 princípios. Qualquer decisão de produto, métrica, tela, alerta, notificação ou copy que **contradiga esse princípio é rejeitada** — mesmo que tecnicamente viável, mesmo que comercialmente atraente.

### 9 Princípios Invioláveis (hierarquizados)

1. **Presença digital ≠ saúde espiritual** (princípio-raiz)
2. **Sem score-oráculo** — nenhum número único resume "como vai" um participante
3. **Sem sinal-sem-explicação** — o radar recusa sinalizar o que não consegue explicar
4. **Sem ranking** — nem entre participantes, nem entre grupos, nem entre líderes
5. **Sem automação substituindo discernimento** — decisão pastoral é sempre humana
6. **Dignidade do silêncio** — nem todo silêncio é problema; alguns são descanso
7. **Loop fechado só por resposta real** — não fechar loop por "visualizado" ou "abriu o app"
8. **Memória relacional sem gamificação** — lembrar é cuidado, não pontuação
9. **Radar não é veredito** — o produto observa, o líder decide

### Timeline de Exigibilidade (4 fases)

| Fase | Período | Exigibilidade |
|---|---|---|
| **Discovery** | 0–3 meses | Valor e segurança **exigíveis cedo**; retenção e economia **ainda não** |
| **MVP / Ativação** | 3–9 meses | Produto funcionando + primeiros tenants pagantes; radar batendo percepção pastoral em ≥60% dos casos (piso de plausibilidade) |
| **Validação** | 9–18 meses | North Star de produto estabilizando; churn ≤ 3% mensal; hábito leve instalado |
| **Tração** | 18m+ | Retenção alta, Free→Pro plausível, expansão para redes de igrejas |

### Plausibilidade do sinal

- **Piso mínimo:** 60% (radar sinaliza, líder concorda que faz sentido, em 60%+ dos casos)
- **Alvo:** ≥75%
- **Auto-throttle:** detectors que caem abaixo do piso **perdem voz** no radar até serem recalibrados

### Métricas vetadas como KPI principal

- `% aberturas que viram ação` (métrica de engajamento; seria anti-princípio)
- Session length (seria anti-hábito-leve)
- MAU / DAU bruto
- Participantes cadastrados (cresce por migração, não por valor)
- Pageviews do pastor

### Red flags — sinais de que o produto está fracassando

| Janela | Sinal | Ação |
|---|---|---|
| 30–45 dias | Radar não bate percepção do líder | Revisar detectors, suspender sinal |
| 60 dias | Sem hábito leve instalado | Repensar cadência de notificação |
| 90 dias | Sem **uma** igreja saudável | Repensar ICP ou onboarding |
| 9–12 meses | Free→Pro conversão não plausível | Repensar pricing ou proposta de valor |
| **Qualquer momento** | **Participante se sentindo vigiado** | **Parada imediata, revisão de princípio-raiz** |

---

## Competitive Landscape

### 4 Alternativas Reais

| ID | Alternativa | Natureza | Risco competitivo |
|---|---|---|---|
| **A1** | **Stack fragmentado** (WhatsApp + Drive + cabeça do líder) | Do-nothing híbrido — transitório que virou permanente | Alto — é o status quo. **WhatsApp é aliado-infraestrutura, não inimigo**. |
| **A2** | **Improviso manual** (memória do líder + planilha eventual) | Do-nothing puro | Médio — funciona em grupos pequenos, quebra em 40+ participantes |
| **A3** | **Software de igreja parcial** (Planning Center, inChurch, Amosh, Enuves, IgrejasNet, ePastor) | CRM/ChMS administrativo | 🟡 **Maior risco real** — Planning Center e inChurch podem adicionar features de "saúde de grupo" superficialmente |
| **A4** | **Ferramentas primas descartadas** (Disciple.Tools, Church Community Builder) | LMS/ChMS internacional | 🟢 Forte por segmentação — Disciple.Tools é o concorrente mais filosoficamente alinhado |

### Postura declarada do metanoia-hub

> *"Não vem cobrar um líder omisso; vem sustentar um líder que já não consegue ver tudo sozinho."*

### WhatsApp não é inimigo

A estratégia de integração **reconhece o WhatsApp como camada de infraestrutura de comunicação** que nenhuma igreja brasileira vai abandonar. O metanoia-hub **não compete** com WhatsApp — complementa. WhatsApp Business API entra na **Phase 3** (pós-MVP), só com dados reais de uso que justifiquem o investimento.

---

## Our Unfair Advantage

### Legenda das Vantagens Competitivas (C1–C6)

Durante o Step 09 do WDS, as vantagens foram codificadas para debate e priorização. A legenda abaixo é a referência cruzável do brief:

| ID | Vantagem | Natureza |
|---|---|---|
| **C1** | **Dicionário pastoral anti-CRM** | Camada visível — vocabulário que recusa "lead, pipeline, engajamento, funil, KPI" |
| **C2** | **Confiabilidade humilde** (*"não sei" honesto*) | Princípio — o radar recusa sinalizar o que não consegue explicar |
| **C3** | **Foco radical no líder de grupo como unidade de cuidado** | Define o usuário real — cria tensão com incumbentes institucionais |
| **C4** | **Loop fechado por cuidado, não por métrica** | Tese do produto — percepção → ação pastoral → confirmação de movimento |
| **C5** | **Sensibilidade pastoral do fundador** | Ativo a institucionalizar (não pode ficar como *"o fundador é especial"*) |
| **C6** | **Modelo conceitual próprio de cuidado pastoral** | Fosso profundo — sinal pastoral, silêncio saudável vs silêncio de risco, tentativa de cuidado, resposta ao cuidado, movimento observado, memória relacional sem gamificação |

### Hierarquia de defensibilidade

| Posição | Vantagem | Papel |
|---|---|---|
| 🏴 **Bandeira principal** | **C4 — Loop fechado por cuidado** | Tese do produto. Combina ontologia, linguagem, UX e mecânica. Difícil de copiar superficialmente. |
| 🏳️ **Bandeira secundária** | **C3 — Foco radical no líder de grupo** | Copiar com integridade exige canibalizar o modelo de negócio dos incumbentes (que depende da igreja como conta pagante). |
| 🧱 **Prova estrutural** | **C1 + C6 — Dicionário + modelo conceitual pastoral próprio** | C1 é visível; C6 é o fosso profundo. Base de UX, dados, notificações e inteligência futura. |
| 🛡️ **Guardrail de marca** | **C2 — Confiabilidade humilde** | Diferencial + guardrail estratégico. Não sustenta sozinho a defensibilidade. |
| 🏛️ **Ativo a institucionalizar** | **C5 — Sensibilidade pastoral do fundador** | Precisa virar framework, princípios, playbook, conselho consultivo pastoral, comunidade de líderes cocriando. |

### Tese de defensibilidade (Step 09, citação canônica)

> *"O metanoia-hub não vence porque 'entende igreja'. Ele vence se conseguir transformar cuidado pastoral em uma lógica de produto que incumbentes não conseguem copiar sem trair seu modelo de negócio ou reescrever o próprio sistema. Sua vantagem injusta não está em dashboards, alertas ou linguagem religiosa. Está em **fechar o loop do cuidado pastoral a partir da unidade real de acompanhamento — o líder de grupo — usando um modelo conceitual próprio de cuidado que produtos administrativos não possuem e não conseguem absorver sem deformar a si mesmos**."*

---

## Constraints

### Override crítico: linha pastoral governa herança edtech do PRD

> **A linha estratégica deste brief (líder de grupo / loop de cuidado / radar pastoral) passa a governar a herança edtech do PRD** (trilhas, conteúdo, gamificação). A `lovableMVP` original do PRD **não governa mais prioridade**. Qualquer feature herdada do PRD passa pelos 4 filtros do tom (ver seção Tone of Voice) antes de entrar.

### Timeline

**4 fases (detalhadas na seção Success Criteria):** Discovery (0–3m) → MVP (3–9m) → Validação (9–18m) → Tração (18m+).

### MVP Opção A — travada no Step 10

> **MVP Opção A = Release 1a (Core Loop) + Release 1a-beta do sprint roadmap, com entrega no Sprint 11 (~semana 22, ~5,5 meses).**
>
> - **Release 1a isolado** = 6–8 semanas conforme PRD (`docs/prd.md` linha 1116) — auth + grupos + trilhas básicas + reunião
> - **Release 1a-beta** = extensão adicionando o **radar pastoral com loop de cuidado provado**
> - **MVP estendido** = Release 1b até **jan/2027**

Essa é a **âncora cruzável** para qualquer sprint, story, PR ou decisão de escopo: *"isso entra no 1a, no 1a-beta, no 1b, ou é Phase 2+?"*

### Budget & Equipe

- **Founder-led bootstrap:** 1–2 devs + IA como co-piloto
- **Sem dependência externa crítica no Release 1a** (PRD linha 932)
- Orçamento dimensionado para chegar à validação com runway mínimo

### Technical

- **Web-first, PWA-ready desde o MVP** (sem loja de app)
- **Codebase único** (Turborepo + pnpm)
- **Keycloak obrigatório** para auth desde o dia 1 (3-layer: roles → guards → RLS)
- **Videoconferência obrigatória** no Release 1a (grupo-pastoral não funciona sem reunião)
- **VPS self-managed** (não serverless) — trade-off consciente por custo e controle
- **LGPD estrutural** (não bolt-on) — consentimento, RLS multi-tenant absoluto, data subject rights
- **PostgreSQL 16** como banco primário. **Extensão pgvector preparada** no MVP para reduzir dívida de migração, mas com **zero modelagem de embeddings até Phase 5** — busca semântica só entra quando houver 6+ meses de dados acumulados (`docs/architecture.md` linhas 299, 379, 1531)

### Brand

- **Dicionário pastoral anti-CRM** (ver seção Tone of Voice)
- **Identidade visual:** neutra com calor pastoral — nem corporativa fria, nem gospel kitsch
- **Frase-âncora do tom:** *"Se um líder cansado na quinta à noite achar que foi escrito por um consultor, um pastor de palco ou um CRM, a copy falhou."*

### Constraints de Defensibilidade (5, elevadas a parâmetros permanentes)

1. **Radar vai além de attendance** — não pode ser "quem veio / quem faltou"; precisa do modelo conceitual C6
2. **Valor-principal com o líder de grupo, não com a supervisão**
3. **Categoria nomeada cedo** — *"radar pastoral"* é a categoria, não tagline
4. **UX absurdamente simples** — complexidade da visão não pode virar complexidade de tela
5. **Institucionalizar o modelo conceitual antes que a interface seja copiada**

### Herança funcional não-negociável

- **`child_safety`** — herdado do PRD (epic 13) como constraint funcional permanente
- **`tenant_hierarchy`** — multi-tenancy absoluto via RLS desde o primeiro commit

### WhatsApp

Desce de *"lovable MVP"* para *"forte desejável pós-MVP-core"*. WhatsApp Business API entra na **Phase 3**, não antes.

---

## Platform & Device Strategy

**Primary Platform:** **Responsive Web App** — Next.js 16.2 híbrido SSR+CSR + **PWA-ready desde o MVP**.

### Supported Devices (prioridade)

1. **Mobile Android gama média-baixa** (primário — o líder real)
2. **Desktop** (secundário — pastor/admin com densidade invertida)
3. **Tablet** (terciário — fallback)
4. **iOS** (constraint documentada — web push limitado)

### Device Priority

- **Mobile-first não mobile-only:** 75–85% do uso esperado em mobile, 15–25% desktop
- **Densidade invertida pastor/admin:** desktop denso (muita informação por tela) + mobile leve (checagem rápida)

### Interaction Models

- Líder de grupo: checagem de 1–3 min no mobile, 2–4x/semana
- Pastor titular: visão agregada no desktop, ocasional no mobile
- Champion (líder de discipulado): híbrido real, ambos os devices
- Participante: mobile simples, jornada pessoal
- Admin/Super Admin: desktop denso

### Technical Requirements

| Categoria | Decisão MVP | Decisão pós-MVP |
|---|---|---|
| **Offline — leitura** | ✅ Cache de leitura (radar nunca em branco + indicador *"dados de X min atrás"*) | Expandir cobertura |
| **Offline — escrita** | ❌ Cortado do MVP | Phase 2+ |
| **Push notifications** | **Web push nativo como canal único** (constraint iOS documentada; monitoramento obrigatório de taxa de entrega por plataforma) | WhatsApp Business API na Phase 3, só com dados reais |
| **WCAG AA** | Piso estrutural no Release 1a (shadcn/ui + Radix + tokens + semáforo redundante cor+ícone+texto) | Piso auditado formal na Release 1b (Sprints 17 e 20 reservados) |
| **Câmera** | ❌ Cortada do MVP (anti-princípio vigilância) | Avaliação pós-validação |
| **Geolocalização** | ❌ Cortada do MVP (anti-princípio vigilância) | **Provavelmente nunca** |
| **Biometria** | ❌ Cortada do MVP | Avaliação pós-validação |

### Platform Rationale

Responsive Web App + PWA é a única escolha que **(a)** elimina loja de app como gatekeeper pastoral, **(b)** permite deploy contínuo sem review delays, **(c)** cobre Android gama média-baixa sem instalação pesada, **(d)** reutiliza codebase único para desktop pastoral, e **(e)** preserva o caminho para nativo (via monorepo + `packages/types`) sem comprometimento técnico no MVP.

### Future Platform Plans

- **Phase 3:** WhatsApp Business API (canal de notificação auxiliar, não principal)
- **Phase 4:** API pública versionada
- **Phase 5:** Busca semântica com pgvector (requer 6+ meses de dados acumulados)
- **Post-MVP:** Service Worker completo (offline de escrita)
- **Avaliação futura:** apps nativos (só se PWA não atender) — o caminho está preservado mas não comprometido

### Design Implications

- Todo componente de UI precisa funcionar em **Android gama média-baixa** sem jank
- Semáforos e sinais visuais precisam de **redundância cor+ícone+texto** (WCAG AA)
- Density shifting entre mobile e desktop é uma decisão de design explícita, não emergente
- Indicador *"dados de X min atrás"* é componente obrigatório no radar

### Development Implications

- **Bundle budget agressivo** para mobile-first real
- **Server Components por default** (App Router) — CSR só na área autenticada
- **Service Worker no MVP:** cache-first de leitura, network-first quando conectado
- **Zero tracking de terceiros** no MVP (anti-vigilância aplicada também ao usuário final do tenant)

---

## Tone of Voice

**Escopo:** UI microcopy, system messages, labels, botões, estados vazios, erros. *(Conteúdo estratégico — headlines de landing, descrições de feature, propostas de valor — usa o Content Creation Workshop em fase posterior do WDS.)*

### 4 Atributos Canônicos (ordem identitário → operacional)

Cada atributo protege contra um modo de falha específico. **A ordem importa** — o 1 governa o 4, nunca o contrário.

1. **Pastoral sem igrejês** — calor sem jargão de púlpito. *Protege contra alienar a Camada 2 (líderes e membros menos conectados ao vocabulário eclesiástico tradicional).*
2. **Humilde sobre o que o radar sabe** (shorthand: *"radar humilde"*) — observa, não diagnostica. *Protege contra falso positivo gerar culpa pastoral indevida.*
3. **Dignidade antes de dado** — zero verbos de vigilância. *Protege contra linguagem fiscalizadora que transforma pastoreio em controle.*
4. **Prático, concreto, terreno** — frases curtas, verbos pastorais reais. *Protege contra fluff inspiracional que soa a marketing e não a ministério.*

> **Admin area** pode relaxar o atributo 4 (mais denso, mais técnico) **mas nunca relaxa 1, 2 ou 3**.

### Glossário Banido (5 categorias)

| Categoria | Termos banidos |
|---|---|
| **CRM/vendas** | `lead`, `pipeline`, `engajamento` (como substantivo humano), `funil`, `KPI` (em UI visível), `dashboard` (em UI visível), `follow-up`, `retention` |
| **Igrejês** | `amado`, `abençoado`, `irmão` (como vocativo), `rebanho`, `ovelha`, `alma`, `unção` |
| **Vigilância** | `monitorar`, `rastrear`, `supervisionar` |
| **Fluff corporativo** | `jornada`, `transformação`, `impacto`, `ecossistema` |
| **Concorrente-escolar** (calibração do founder) | `célula`, `relatório` (como label visível ao líder), `frequência` (como proxy de presença) |

> **Regra de engenharia:** glossário banido vira **lint de code review**. Toda PR que toca copy visível recebe label `copy-review`. Fonte única de microcopy: `apps/web/messages/pt-BR.json`.

### Examples

**Error Messages:**
- ✅ *"Ops, a gente não conseguiu carregar seu grupo agora. Tenta de novo em um minuto?"*
- ❌ *"Erro 500: Internal Server Error. Por favor contate o suporte."*

**Button Text:**
- ✅ *"Mandar uma mensagem"* / *"Registrar cuidado"* / *"Ver o grupo"*
- ❌ *"Engajar participante"* / *"Iniciar follow-up"* / *"Track member"*

**Empty States:**
- ✅ *"Nenhum sinal por aqui hoje. Silêncio saudável — nem tudo que é quieto é problema."*
- ❌ *"Nenhum dado disponível."* / *"0 alertas ativos."*

**Success Messages (primeiro registro — one-shot):**
- ✅ *"Guardei. Pequenas coisas assim é que sustentam o grupo."*
- ❌ *"Member engagement recorded successfully."*

**Success Messages (dia a dia):**
- ✅ *"Guardei."* / *"Anotado."*
- ❌ *"Ação registrada com sucesso no sistema."*

### Precisão temporal é VALOR, não risco

> *"Faz 2 semanas que o Pedro não aparece. Vale uma mensagem?"*

Essa frase **passa no tom** porque o produto **lembra pelo líder** — isso é o produto. A **linha vermelha está no verbo que segue o fato temporal**: **pergunta** (*"Vale uma mensagem?"*) é cuidado; **instrução** (*"Envie uma mensagem agora"*) é fiscalização. Dados temporais crus são permitidos; imperativos automatizados não são.

### Guidelines

**Do:**
- Frases curtas. Verbos concretos. Pergunta em vez de imperativo quando há sugestão.
- Usar o vocabulário real do líder cansado da quinta à noite.
- Assumir que o leitor está cansado, distraído, e pode ter sido interrompido.
- Celebrar silêncio saudável explicitamente quando ele for a leitura correta.

**Don't:**
- Nunca transformar sinal temporal em instrução automática.
- Nunca rotular participante com adjetivo de estado espiritual.
- Nunca usar número único para resumir um humano.
- Nunca pedir desculpas por não ter detectado algo — o radar é humilde, não culpado.
- Nunca, jamais, usar um termo do glossário banido em UI visível ao líder ou ao participante.

### Regra de Ouro única

> *"Toda microcopy passa se um líder cansado na quinta à noite achar que foi escrita por outro líder cansado — e não por um consultor, um pastor de palco, ou um CRM de vendas."*

---

*Nota: o Tone of Voice desta seção governa UI microcopy. Conteúdo estratégico (headlines, descrições de feature, propostas de valor) será desenvolvido no Content Creation Workshop em Steps posteriores do WDS com base no propósito específico de cada página.*

---

## Additional Context

### Materiais existentes sobre os quais este brief foi construído

- `docs/prd.md` — PRD completo com 82 FRs, personas, métricas (106KB)
- `docs/architecture.md` — Arquitetura técnica, bounded contexts, decisões (84KB)
- `docs/project-context.md` — 47 regras de implementação, stack, convenções
- `_bmad-output/planning-artifacts/ux-design-specification.md` — UX spec anterior (2584 linhas, processo BMAD)
- `design-process/A-Product-Brief/session-01-progress.md` — diálogo completo dos Steps 02–11 (1243 linhas)

### Princípio-raiz (reforço final)

> **"Presença digital ≠ saúde espiritual."**
>
> Se qualquer decisão de produto, métrica, tela, alerta ou copy contradiz esse princípio, ela é rejeitada. Sem exceção. Sem *"mas tecnicamente..."*. Sem *"só nessa feature..."*.

### Regra de Ouro do usuário crítico

> *"O líder de grupo é o usuário crítico do produto."*
>
> Buyer aprova, champion defende, participante se beneficia — **mas o líder de grupo é quem decide se o produto vive ou morre**. Nenhuma feature, nenhuma tela, nenhuma mudança de escopo pode contradizer essa regra sem revisão explícita do brief.

---

## Business Context

- **Primary Goal:** Transformar cuidado pastoral informal em prática sustentada por um radar pastoral humilde, preservando o improviso sagrado do discernimento humano.
- **Solution:** Plataforma B2B SaaS web-first, PWA-ready, construída em cima de um modelo conceitual próprio de cuidado pastoral (C6) que nenhum CRM, ChMS ou LMS consegue replicar sem trair o próprio modelo de negócio.
- **Target Users:** Igrejas locais evangélicas brasileiras (40–100 participantes) servindo ao líder de grupo como usuário crítico, pastor titular como buyer, líder de discipulado como champion.

*Análise estratégica completa (goals de negócio aprofundados, driving forces por persona, Trigger Maps de cada cenário) será desenvolvida em [Phase 2: Trigger Mapping](../B-Trigger-Map/).*

---

## Next Steps

Este brief é a **fundação estratégica canônica** sobre a qual todo o trabalho de design subsequente se apoia. Cada uma das fases abaixo **deve validar suas decisões contra os 9 princípios invioláveis** e contra os **4 atributos de tom** antes de ser considerada pronta.

- [ ] **Phase 2: Trigger Mapping** — Mapear psicologia do usuário para goals de negócio (próxima fase imediata do WDS)
- [ ] **Phase 3: UX Scenarios** — Cenários canônicos derivados dos triggers
- [ ] **Phase 4: UX Design** — Wireframes e specs telados
- [ ] **Phase 6: Asset Generation** — Assets finais
- [ ] **Phase 7: Design System** — Já bootstrapped (shadcn/ui + Tailwind v4 + tokens pastoral)
- [ ] Atualização subsequente do PRD para refletir overrides deste brief (pricing, lovableMVP, herança edtech)

---

## Auto-checagem final

**Todas as seções deste brief foram verificadas contra os 9 princípios invioláveis do Step 08.** Nenhuma seção contradiz:

- ✅ *"Presença digital ≠ saúde espiritual"* — preservado em toda métrica, todo KPI, toda tela mencionada
- ✅ *"Sem score-oráculo"* — nenhuma seção propõe número único de saúde
- ✅ *"Sem sinal-sem-explicação"* — confiabilidade humilde (C2) é guardrail de marca
- ✅ *"Sem ranking"* — nunca entre participantes, grupos ou líderes
- ✅ *"Sem automação substituindo discernimento"* — improviso sagrado preservado
- ✅ *"Dignidade do silêncio"* — estado vazio celebra silêncio saudável
- ✅ *"Loop fechado só por resposta real"* — C4 é bandeira principal
- ✅ *"Memória relacional sem gamificação"* — microcopy reforça, glossário banido protege
- ✅ *"Radar não é veredito"* — tom humilde + regra do verbo-pergunta

**E contra os 4 atributos de tom:** toda copy de exemplo e toda regra de UI neste brief respeita pastoral-sem-igrejês, radar humilde, dignidade antes de dado, prático-concreto-terreno.

---

**Status:** Product Brief Complete
**Fase completada:** WDS Phase 1 (Product Brief)
**Próxima fase:** WDS Phase 2 (Trigger Mapping) — iniciada pelo Step 13 (Content Init)
**Last Updated:** 2026-04-11

---

*Generated by Whiteport Design Studio (WDS Phase 1, Step 12) — built on top of existing PRD, Architecture, Project Context and UX Specification through 11 steps of collaborative strategic dialogue.*
