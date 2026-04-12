# 01 — Business Goals

**Projeto:** metanoia-hub
**Fase:** WDS Phase 2 — Trigger Mapping
**Origem:** Síntese de `design-process/A-Product-Brief/project-brief.md` + `docs/prd.md` + `docs/architecture.md` (Step 13 — Content Init, modo autônomo)
**Última atualização:** 2026-04-11

---

## Vision

**Fazer com que nenhum participante de grupo pequeno se afaste de uma comunidade de fé sem que o líder tenha tido um jeito claro, digno e a tempo de perceber e agir** — transformando o improviso relacional (que hoje depende só da memória humana) em uma prática sustentada por um radar pastoral humilde, que observa mas não diagnostica, lembra mas não fiscaliza, e fecha o loop do cuidado só quando há resposta real.

**Frase-âncora do líder (tensão emocional do problema):**
> *"Não me falta amor pelo grupo. Me falta um jeito claro de enxergar quem está se afastando e agir a tempo."*

**Meta de 30 dias do líder (evidência de que o produto funcionou):**
> *"Dessa vez eu não fui pego de surpresa."*

---

## Positioning Statement

Para **líderes de grupo pequeno em igrejas locais evangélicas brasileiras (40–100 participantes, já híbridas digitais)** que **lutam para enxergar a tempo quem está se afastando e agir sem transformar pastoreio em fiscalização**, o **metanoia-hub** é um **radar pastoral** que **traduz sinais de participação digital em cuidado acionável** — diferente de CRMs de igreja, ChMS administrativos, LMS educacionais e combos Meet+Drive porque é o único produto **desenhado a partir do líder de grupo (não da governança institucional)** e construído sobre um **modelo conceitual próprio de cuidado pastoral** que **fecha o loop entre percepção, ação e resposta real**.

---

## Business Objectives (3 Priority Tiers)

### ⭐ PRIMARY GOAL: Instalar o loop de cuidado no líder de grupo (THE ENGINE)

- **Statement:** Provar que o líder de grupo consegue, usando o radar pastoral, agir a tempo sobre afastamentos — medindo uso saudável, não engajamento bruto.
- **Metric:** `% semanas-líder com ≥1 ação orientada pelo radar em ≤48h` (North Star de Produto)
- **Target piso:** ≥60% de plausibilidade (radar bate percepção do líder) · **Alvo:** ≥75% até Validação (9–18m)
- **Timeline:** Sprint 11 (~5,5 meses) — Release 1a-beta com loop de cuidado provado
- **Impact:** Este goal é a **engine** que alimenta todos os outros. Sem líder agindo com radar, não há retenção, não há Free→Pro, não há expansão.

---

### 🚀 SECONDARY GOALS (Driven by Primary)

**Objective 1: Tenant Pro saudável (retenção real, não zumbi)**
- **Statement:** Converter igrejas Free em Pro pagantes com uso saudável (radar batendo percepção pastoral + líder agindo sem culpa).
- **Metric:** `% igrejas Pro renovadas com uso saudável` (North Star de Negócio)
- **Target:** 3 Pro + 2 Enterprise no seed (ARR ~R$ 66k em 12 meses); churn mensal ≤3%
- **Timeline:** MVP → Validação (3–18m)
- **Counter-metric obrigatória:** `% igrejas Pro zumbis` — se crescer, o produto fracassou mesmo com receita.

**Objective 2: Ativação rápida do tenant**
- **Statement:** Pastor titular e champion (líder de discipulado) conseguem subir uma igreja em ≤7 dias e ver valor nas primeiras 2 semanas.
- **Metric:** Tempo de ativação do tenant + % igrejas com ≥1 líder "saudável" em 30 dias
- **Target:** Ativação ≤7 dias · ≥1 igreja saudável até 90 dias
- **Timeline:** Release 1a (MVP — 6–8 semanas)

**Objective 3: Defensibilidade institucionalizada**
- **Statement:** Transformar a sensibilidade pastoral do fundador (C5) e o modelo conceitual próprio (C6) em framework replicável — antes que incumbentes (Planning Center, inChurch) tentem copiar superficialmente.
- **Metric:** Existência de dicionário pastoral (C1), princípios invioláveis documentados, conselho pastoral consultivo, e implementação técnica do modelo conceitual C6 (sinal pastoral, silêncio saudável vs silêncio de risco, memória relacional sem gamificação).
- **Target:** Framework documentado e enforceado como lint de code review (`copy-review` label + `apps/web/messages/pt-BR.json` como fonte única)
- **Timeline:** Contínuo — MVP a Tração

---

### 🌟 TERTIARY GOALS (Real-World Benefits for Church Members)

**Nota:** Estes goals são os benefícios que o metanoia-hub cria **para os participantes das igrejas** — e só acontecem se o goal primário (líder agindo com radar) funcionar. Eles **não** são KPIs do produto, são consequências da tese.

**Objective 4: Participante não pego de surpresa pelo afastamento**
- **Statement:** Participantes em risco recebem contato relacional (não automatizado) de um líder real que se importou — dentro de ≤48h do sinal.
- **Metric:** % afastamentos interrompidos por ação pastoral relacional (confirmada por resposta real, não por "visualizado")
- **Timeline:** MVP → Validação
- **Benefício ao participante:** Sentir-se visto sem sentir-se vigiado.

**Objective 5: Pastor titular com visibilidade sem fiscalização**
- **Statement:** Pastor titular enxerga a saúde agregada dos grupos sem transformar pastoreio em vigilância individual.
- **Metric:** Pastor usa a visão agregada e **não** pede relatórios individuais de participante
- **Timeline:** MVP
- **Benefício ao pastor:** Liderança informada que protege o princípio-raiz "Presença digital ≠ saúde espiritual".

**Objective 6: Dignidade do silêncio preservada**
- **Statement:** Participantes têm direito ao silêncio saudável — nem todo não-comparecimento é problema; alguns são descanso, luto, trabalho.
- **Metric:** 0 ocorrências de `% aberturas que viram ação` (métrica vetada) · 0 alarmes falsos escalados
- **Timeline:** Contínuo — é princípio, não feature
- **Benefício ao participante:** Não ser transformado em lead, funil ou número.

---

## The Flywheel: How Goals Connect

**THE ENGINE (Priority #1):**
- Líder de grupo usa radar pastoral para agir a tempo sobre afastamentos (≤48h, ≤3min de tela)
- Timeline: 5,5 meses (Sprint 11)
- Quando isso funciona, todo o resto destrava: a igreja renova, o pastor confia, o participante é cuidado, o fundador institucionaliza defensibilidade.

**Retenção & Receita (Priority #2):**
- Driven BY líderes agindo com radar
- Igrejas Pro renovando · Churn ≤3% · ARR ~R$ 66k em 12 meses
- Timeline: 3–18 meses
- Foco: Tenants saudáveis, **não** tenants zumbis.

**Cuidado Real a Participantes (Priority #3):**
- Real-world benefits FOR os participantes das igrejas
- Afastamentos interrompidos a tempo · Dignidade preservada · Zero vigilância
- Timeline: Contínuo
- **Key benefit:** Participantes são cuidados por humanos, mecanicamente lembrados por máquinas — nunca o contrário.

---

## Success Metrics Alignment

### North Stars (canônicas)

| Métrica | Definição | Piso MVP | Alvo Validação |
|---|---|---|---|
| **North Star de Produto** | `% semanas-líder com ≥1 ação orientada pelo radar em ≤48h` | ≥60% plausibilidade | ≥75% |
| **North Star de Negócio** | `% igrejas Pro renovadas com uso saudável` | 3 Pro + 2 Enterprise | Churn ≤3%/mês |
| **Contra-métrica anti-gamificação** | `% igrejas Pro zumbis` | 0 como sinal; crescente = fracasso | Idealmente nula |

### Timeline de Exigibilidade (4 fases canônicas)

| Fase | Período | Exigibilidade |
|---|---|---|
| **Discovery** | 0–3 meses | Valor e segurança exigíveis cedo · retenção/economia ainda não |
| **MVP / Ativação** | 3–9 meses | Primeiros tenants pagantes · radar batendo percepção pastoral em ≥60% dos casos |
| **Validação** | 9–18 meses | North Star estabilizando · churn ≤3%/mês · hábito leve instalado |
| **Tração** | 18m+ | Retenção alta · Free→Pro plausível · expansão a redes de igrejas |

### Red flags — quando o produto está fracassando

| Janela | Sinal | Ação |
|---|---|---|
| 30–45 dias | Radar não bate percepção do líder | Revisar detectors, suspender sinal |
| 60 dias | Sem hábito leve instalado | Repensar cadência de notificação |
| 90 dias | Sem **uma** igreja saudável | Repensar ICP ou onboarding |
| 9–12 meses | Free→Pro conversão não plausível | Repensar pricing ou proposta de valor |
| **Qualquer momento** | **Participante se sentindo vigiado** | **Parada imediata, revisão de princípio-raiz** |

### Métricas explicitamente VETADAS como KPI principal

- `% aberturas que viram ação` (engajamento; anti-princípio)
- Session length (anti-hábito-leve)
- MAU / DAU bruto
- Participantes cadastrados (cresce por migração, não por valor)
- Pageviews do pastor
- Qualquer número único que resuma um humano

---

## Related Documents

- **Hub:** [`00-trigger-map.md`](./00-trigger-map.md)
- **Personas:**
  - Primary: [`personas/02-primary-persona-lider-de-grupo.md`](./personas/02-primary-persona-lider-de-grupo.md)
  - Secondary: [`personas/03-secondary-persona-pastor-titular.md`](./personas/03-secondary-persona-pastor-titular.md)
  - Secondary: [`personas/04-secondary-persona-champion.md`](./personas/04-secondary-persona-champion.md)
  - Tertiary: [`personas/05-tertiary-persona-participante.md`](./personas/05-tertiary-persona-participante.md)
  - Tertiary: [`personas/06-tertiary-persona-admin-tenant.md`](./personas/06-tertiary-persona-admin-tenant.md)
- **Key Insights:** [`05-key-insights.md`](./05-key-insights.md)
- **Feature Impact:** [`06-feature-impact-analysis.md`](./06-feature-impact-analysis.md)
- **Documentation Synthesis Log:** [`_synthesis-from-docs.md`](./_synthesis-from-docs.md)
- **Fonte canônica:** [`../A-Product-Brief/project-brief.md`](../A-Product-Brief/project-brief.md)
