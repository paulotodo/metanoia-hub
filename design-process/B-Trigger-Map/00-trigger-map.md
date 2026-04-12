# 00 — Trigger Map (Hub)

**Projeto:** metanoia-hub · **Fase WDS:** Phase 2 — Trigger Mapping · **Última atualização:** 2026-04-11

> Documento-hub da Phase 2. Ponto de entrada único para navegar business goals, personas, driving forces, e implicações estratégicas. Baseado em Effect Mapping (Mijo Balic & Ingrid Domingues) adaptado por WDS.

---

## Diagrama: Business Goals → Platform → Target Groups → Driving Forces

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#fef3c7','primaryBorderColor':'#b45309','lineColor':'#78716c','fontSize':'14px'}}}%%
flowchart LR

  %% ============ BUSINESS GOALS (LEFT) ============
  BG0["<br/>🌟 VISION<br/><br/>Nenhum participante se afasta sem<br/>que o líder tenha um jeito claro,<br/>digno e a tempo de perceber e agir<br/><br/>Improviso relacional →<br/>Prática sustentada por radar humilde<br/><br/>"]

  BG1["<br/>⭐ PRIMARY GOAL<br/>THE ENGINE<br/><br/>Instalar o loop de cuidado<br/>no líder de grupo<br/><br/>≥60% plausibilidade · ≤48h<br/>%semanas-líder com ação<br/>Sprint 11 (~5,5 meses)<br/><br/>"]

  BG2["<br/>🚀 SECONDARY<br/>Retenção & Receita<br/><br/>Tenants Pro saudáveis<br/>(não zumbis)<br/>Churn ≤3% · ARR ~R$66k/12m<br/>Ativação ≤7 dias<br/><br/>"]

  BG3["<br/>🌟 TERTIARY<br/>Cuidado Real<br/><br/>Afastamentos interrompidos<br/>Dignidade preservada<br/>Zero vigilância<br/><br/>Benefício aos participantes<br/><br/>"]

  %% ============ PLATFORM (CENTER) ============
  PLATFORM["<br/>🧭 METANOIA-HUB<br/><br/>Radar Pastoral<br/><br/>Traduz sinais de participação<br/>digital em cuidado<br/>acionável — com loop<br/>fechado por resposta real<br/><br/>"]

  %% ============ TARGET GROUPS (RIGHT) ============
  TG1["<br/>👤 LÍDER DE GRUPO<br/>PRIMARY TARGET<br/><br/>Voluntário · Mobile-first<br/>2–4 aberturas/semana<br/>1–3 min/sessão<br/>Cansaço + culpa silenciosa<br/><br/>"]

  TG2["<br/>✝️ PASTOR TITULAR<br/>SECONDARY (BUYER)<br/><br/>Desktop denso · Legitima<br/>compra frente ao conselho<br/>Medo central: fiscalização<br/>Quer agregado, não individual<br/><br/>"]

  TG3["<br/>🧭 CHAMPION<br/>SECONDARY<br/><br/>Líder de discipulado<br/>Descobre, apresenta, defende<br/>Ponte líder ↔ pastor<br/>Híbrido desktop + mobile<br/><br/>"]

  TG4["<br/>🌱 PARTICIPANTE<br/>TERTIARY<br/><br/>Beneficiário final<br/>Mobile simples · Opcional<br/>Direito ao silêncio<br/>Nunca score · Nunca ranking<br/><br/>"]

  TG5["<br/>🛠️ ADMIN DE TENANT<br/>TERTIARY<br/><br/>Apoio administrativo<br/>Desktop denso · Onboarding<br/>Não vê dados pastorais<br/>Responsável por LGPD prática<br/><br/>"]

  %% ============ DRIVING FORCES (FAR RIGHT) ============
  DF1_POS["<br/>✅ LÍDER +<br/><br/>Ver a tempo · Agir a tempo<br/>Clareza humilde · Dignidade<br/>Memória que protege<br/>'Não fui pego de surpresa'<br/><br/>"]

  DF1_NEG["<br/>⚠️ LÍDER –<br/><br/>Culpa silenciosa<br/>Medo de virar fiscal<br/>Fadiga de ferramenta<br/>Falso positivo constrangedor<br/><br/>"]

  DF2_POS["<br/>✅ PASTOR +<br/><br/>Visibilidade agregada digna<br/>Legitimidade no conselho<br/>Proteção LGPD estrutural<br/>Preço flat previsível<br/><br/>"]

  DF2_NEG["<br/>⚠️ PASTOR –<br/><br/>Medo: virar fiscalização<br/>Veto do conselho<br/>Jargão CRM<br/>Ferramenta abandonada<br/><br/>"]

  DF3_POS["<br/>✅ PARTICIPANTE +<br/><br/>Sentir-se visto sem vigiado<br/>Direito ao silêncio saudável<br/>Cuidado relacional humano<br/>Privacidade inviolável<br/><br/>"]

  DF3_NEG["<br/>⚠️ PARTICIPANTE –<br/><br/>Sensação de vigilância<br/>Ser tratado como métrica<br/>Rótulo de estado espiritual<br/>Abandono na 1ª semana<br/><br/>"]

  %% ============ CONNECTIONS ============
  BG0 --> PLATFORM
  BG1 --> PLATFORM
  BG2 --> PLATFORM
  BG3 --> PLATFORM

  PLATFORM --> TG1
  PLATFORM --> TG2
  PLATFORM --> TG3
  PLATFORM --> TG4
  PLATFORM --> TG5

  TG1 --> DF1_POS
  TG1 --> DF1_NEG
  TG2 --> DF2_POS
  TG2 --> DF2_NEG
  TG4 --> DF3_POS
  TG4 --> DF3_NEG

  %% ============ STYLING ============
  classDef vision fill:#fef3c7,stroke:#b45309,stroke-width:3px,color:#1c1917
  classDef primaryGoal fill:#fde68a,stroke:#b45309,stroke-width:3px,color:#1c1917
  classDef secondaryGoal fill:#e0e7ff,stroke:#4338ca,stroke-width:2px,color:#1c1917
  classDef tertiaryGoal fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#1c1917
  classDef platform fill:#ede9fe,stroke:#6d28d9,stroke-width:4px,color:#1c1917
  classDef primaryPersona fill:#fed7aa,stroke:#c2410c,stroke-width:3px,color:#1c1917
  classDef secondaryPersona fill:#fef9c3,stroke:#a16207,stroke-width:2px,color:#1c1917
  classDef tertiaryPersona fill:#f3f4f6,stroke:#6b7280,stroke-width:2px,color:#1c1917
  classDef positiveForce fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#14532d
  classDef negativeForce fill:#fecaca,stroke:#b91c1c,stroke-width:2px,color:#7f1d1d

  class BG0 vision
  class BG1 primaryGoal
  class BG2 secondaryGoal
  class BG3 tertiaryGoal
  class PLATFORM platform
  class TG1 primaryPersona
  class TG2,TG3 secondaryPersona
  class TG4,TG5 tertiaryPersona
  class DF1_POS,DF2_POS,DF3_POS positiveForce
  class DF1_NEG,DF2_NEG,DF3_NEG negativeForce
```

---

## Summary: O que o trigger map diz

O metanoia-hub vence ou morre pela **primary persona** (líder de grupo). Se o líder age a tempo usando o radar, a engine gira: tenants renovam, pastores legitimam, participantes são cuidados, defensibilidade se institucionaliza. Se o líder não usa, nada mais acontece — mesmo com receita, o produto é zumbi.

A **tese de defensibilidade** é estrutural: **fechar o loop do cuidado pastoral a partir do líder de grupo usando um modelo conceitual próprio (C6)** que incumbentes (Planning Center, inChurch, ChMS brasileiros) não conseguem copiar sem canibalizar o próprio modelo de negócio.

O **risco existencial** não é concorrência — é a própria UX. Se qualquer tela fizer um participante se sentir vigiado, ou um líder se sentir fiscalizado, ou um pastor se sentir substituído, o princípio-raiz foi violado e o produto falhou mesmo com receita.

---

## Detailed Documentation Menu

### 📊 Business Strategy
- **[01-business-goals.md](./01-business-goals.md)** — Vision, positioning, 3 tiers de objectives, flywheel, success metrics, red flags
  - 🌟 **Primary:** Instalar loop de cuidado no líder (Sprint 11 · ≥60% plausibilidade)
  - 🚀 **Secondary:** Tenants Pro saudáveis · ativação ≤7d · defensibilidade
  - 🌱 **Tertiary:** Cuidado real a participantes · dignidade · zero vigilância
  - **Contra-métrica:** % igrejas Pro zumbis (crescente = fracasso)

### 👥 Target Users
- **[personas/02-primary-persona-lider-de-grupo.md](./personas/02-primary-persona-lider-de-grupo.md)** ⭐ — Líder voluntário, mobile-first, cenário-âncora "vencer a quarta de manhã"
- **[personas/03-secondary-persona-pastor-titular.md](./personas/03-secondary-persona-pastor-titular.md)** — Buyer, medo central de fiscalização, visão agregada
- **[personas/04-secondary-persona-champion.md](./personas/04-secondary-persona-champion.md)** — Líder de discipulado, ponte entre pastor e líderes
- **[personas/05-tertiary-persona-participante.md](./personas/05-tertiary-persona-participante.md)** — Beneficiário final, direito ao silêncio
- **[personas/06-tertiary-persona-admin-tenant.md](./personas/06-tertiary-persona-admin-tenant.md)** — Apoio administrativo, LGPD prática

### 🧠 Strategic Implications
- **[05-key-insights.md](./05-key-insights.md)** — Primary Development Focus, critical success factors, design implications por seção, emotional transformation goals
- **[06-feature-impact-analysis.md](./06-feature-impact-analysis.md)** — Features herdadas do PRD filtradas pelos princípios invioláveis

### 📋 Synthesis & Governance
- **[_synthesis-from-docs.md](./_synthesis-from-docs.md)** — Log do Step 13 (Content Init): origem, gaps, alignment check
- **Fonte canônica:** [../A-Product-Brief/project-brief.md](../A-Product-Brief/project-brief.md)
- **Design log:** [../_progress/00-design-log.md](../_progress/00-design-log.md)

---

## How to Read This Trigger Map

1. **Começa pela primary persona** (líder de grupo) — ela é o user crítico; decisões pastorais governam decisões comerciais.
2. **Cruza as driving forces negativas** contra cada proposta de feature — se uma feature aciona uma driving force negativa, ela viola um princípio inviolável e deve ser rejeitada ou redesenhada.
3. **Business goals estão hierarquizados** — Primary é engine; Secondary é driven-by-primary; Tertiary é real-world benefit.
4. **Pastor é buyer, champion é apresentador, líder é user crítico.** Os 3 papéis precisam estar alinhados para o produto vender e sobreviver.
5. **Princípios invioláveis (9)** não são preferências — são critérios de rejeição. Qualquer proposta que contradiga o princípio-raiz (*"Presença digital ≠ saúde espiritual"*) é rejeitada.

---

## Cross-Validation Check

| Check | Status |
|---|---|
| Primary persona explícita | ✅ Líder de grupo |
| Driving forces +/− para todas as personas | ✅ (líder, pastor, participante com + e −; champion com + e −; admin com + e −) |
| Business goals em 3 tiers | ✅ |
| Flywheel explica causalidade | ✅ |
| Mermaid diagram válido | ✅ |
| North stars canônicas | ✅ (produto + negócio + contra-métrica) |
| Red flags documentadas | ✅ |
| Princípios invioláveis como critério de rejeição | ✅ |
| Consistência com project-brief.md | ✅ |
| Linguagem pastoral (glossário banido respeitado) | ✅ |

---

**Próximo passo:** Phase 3 — UX Scenarios (C-UX-Scenarios/) — usando este trigger map como referência estratégica.
