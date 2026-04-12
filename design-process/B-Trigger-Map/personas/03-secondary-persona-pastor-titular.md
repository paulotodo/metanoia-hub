# Persona Secundária — Pastor Titular

**Prioridade:** 🏳️ SECONDARY TARGET · **Tipo:** Buyer (aprova e paga) + Legitimador
**Projeto:** metanoia-hub · **Fase WDS:** Phase 2 — Trigger Mapping
**Origem:** Síntese do brief (Step 13 Content Init) · 2026-04-11

---

## Snapshot

> **Frase-âncora:** *"O buyer aprova, o pastor titular legitima, mas quem faz o produto vencer ou morrer é o líder que usa o radar no dia a dia."*

| Campo | Valor |
|---|---|
| **Papel no ciclo de compra** | **Buyer** — aprova e paga; precisa legitimar a decisão frente ao conselho da igreja |
| **Medo central** | *"Isso vai transformar pastoreio em fiscalização"* |
| **O que quer** | Visão agregada da saúde dos grupos, sem vigilância individual de participantes |
| **Device primário** | **Desktop denso** (densidade invertida — muita informação por tela) |
| **Device secundário** | Mobile leve, ocasional |
| **Cadência de uso** | Semanal a quinzenal, em blocos curtos |

---

## Contexto Real

- Lidera 3–5 grupos pequenos via líderes voluntários. Conhece os líderes; não conhece todos os participantes.
- Já usa um stack fragmentado: WhatsApp + Drive + planilha + esforço humano. Sente que perde gente, mas o custo de mudar é alto.
- A referência mental dele **não é** *"metanoia-hub vs software enterprise"*. É *"metanoia-hub vs meu combo atual"*.
- Precisa legitimar qualquer decisão de R$/mês frente ao conselho da igreja — não decide sozinho.

---

## Mental Model

- **"Pastoreio é da minha responsabilidade pastoral, não de uma ferramenta."** Qualquer produto que pareça substituir o papel pastoral dele é rejeitado.
- **"Privacidade dos membros é inegociável."** Dúvidas sobre LGPD, compartilhamento de dados, acesso por terceiros = veto direto.
- **"Não vou pagar por participante."** Isso criaria incentivo perverso para não cadastrar membros vulneráveis.
- **"Eu quero ver a saúde, não vigiar pessoas."** Quer agregado, não individual.

---

## Positive Driving Forces

| Força | Descrição | Product Promise |
|---|---|---|
| **Visibilidade agregada com dignidade** | Quer saber se os grupos estão saudáveis, sem invadir participante individual | Vista de pastor: saúde de grupo, tendências, sinais de alerta no nível do grupo (não do indivíduo) |
| **Apoio a líderes sem fiscalizá-los** | Quer treinar e apoiar os líderes voluntários — ver quem precisa de mentoria, não quem está atrasado num relatório | Métricas de **saúde do líder** (está agindo com o radar? precisa de apoio?) — nunca de "produtividade" |
| **Legitimidade frente ao conselho** | Precisa justificar a assinatura Pro frente ao conselho — o produto precisa ser explicável em 30 segundos | Positioning claro: "radar pastoral" · caso de uso tangível · ROI de tempo poupado e retenção de membros |
| **Proteção legal/LGPD** | Quer estar compliant sem virar especialista | **LGPD estrutural, não bolt-on** · consentimento explícito · RLS multi-tenant absoluto · data subject rights |
| **Preço flat, sem pegadinha** | Quer preço previsível que não cresça com cadastro de membros | **Flat por igreja, nunca por participante** (princípio de produto) |

---

## Negative Driving Forces

| Força Negativa | Descrição | Mitigação |
|---|---|---|
| **Medo central: virar fiscalização** | *"Isso vai transformar pastoreio em fiscalização"* — medo explícito | Princípio-raiz inviolável: *"Presença digital ≠ saúde espiritual"* · UX precisa desarmar isso visivelmente em cada tela |
| **Veto do conselho** | Conselho pode bloquear a assinatura por custo, privacidade ou "mais uma ferramenta" | Positioning que o champion pode defender · preço ancorado ao combo atual (não a enterprise) · landing com linguagem pastoral |
| **Falso positivo pastoral** | Se o radar acusa injustamente um participante, o líder perde credibilidade e o pastor perde confiança no produto | Confiabilidade humilde (C2) · auto-throttle de detectors abaixo de 60% · princípio 3: sem sinal-sem-explicação |
| **Mais uma ferramenta abandonada** | Sabe que igreja local vive com cemitério de ferramentas abandonadas | Onboarding ≤7 dias · valor visível em 2 semanas · métrica de "igreja saudável" explícita |
| **Linguagem corporativa** | *"lead"*, *"pipeline"*, *"engajamento"*, *"KPI"*, *"dashboard"* — qualquer termo de CRM o afasta | **Glossário banido enforcado como lint de code review** · label `copy-review` em toda PR que toca microcopy |
| **Dúvida sobre dados e vazamento** | *"Quem vê os dados dos meus membros?"* · *"O que acontece se eu cancelar?"* | Transparência total: quem vê o quê, política de export/delete clara, sem dark patterns |
| **Comparação mental com ChMS brasileiros baratos** | Vê Amosh R$49,90 · Enuves R$84 · IgrejasNet R$99–175 e pergunta "por que pagar mais?" | **Diferenciação por categoria (radar pastoral, não ChMS administrativo)** · zona de conforto de preço validada em R$80–250 |

---

## Transformação

**De:** Pastor ansioso que sabe que está perdendo gente mas não tem tempo nem mecânica para investigar, sobrecarregado pela responsabilidade pastoral agregada, usando WhatsApp + planilha + memória.

**Para:** Pastor que confia nos líderes porque o radar ajuda os líderes a agirem a tempo, com visibilidade agregada da saúde dos grupos — sem nunca precisar abrir o perfil individual de um participante.

**Como ele legitima a compra:**
> *"Não é mais uma ferramenta. É um radar pastoral que ajuda nossos líderes a não deixar ninguém cair pelo vão — e custa menos que o tempo que a gente já gasta improvisando."*

---

## UX Implications

- **Visão agregada no desktop denso** — muita informação por tela, filtrável por grupo, por tempo, por tipo de sinal
- **Zero perfil individual de participante** (exceto quando explicitamente solicitado pelo líder do grupo dele, com justificativa)
- **Página de "saúde do líder"** — não é vigilância do líder, é apoio: *"esse líder precisa de uma conversa?"*
- **Transparência absoluta sobre dados:** quem vê o quê, logs de acesso, política de retenção/export/delete em linguagem humana
- **Admin area relaxa o atributo 4 do tom (prático, concreto, terreno)** — pode ser mais denso e técnico, **mas nunca relaxa 1, 2 ou 3** (pastoral, humilde, dignidade)
- **Landing / onboarding com positioning defendível** — o pastor precisa conseguir explicar o produto para o conselho em 30 segundos

---

## Related Documents

- [`../00-trigger-map.md`](../00-trigger-map.md)
- [`../01-business-goals.md`](../01-business-goals.md)
- [`02-primary-persona-lider-de-grupo.md`](./02-primary-persona-lider-de-grupo.md)
- [`04-secondary-persona-champion.md`](./04-secondary-persona-champion.md)
