# 05 — Key Insights

**Projeto:** metanoia-hub · **Fase WDS:** Phase 2 — Trigger Mapping · **Última atualização:** 2026-04-11
**Fonte:** Síntese do brief canônico + trigger map (Step 13 Content Init)

---

## The Flywheel: How Priorities Reinforce Each Other

**THE ENGINE (Priority #1):**
O líder de grupo usando o radar pastoral para agir a tempo sobre afastamentos é o **único** ponto que destrava o resto. Sem líder agindo, não há renovação, não há pastor confiando, não há participante cuidado, não há defensibilidade.

**Reinforcement loop:**
- Líder age → participante é cuidado a tempo → afastamento interrompido → líder vê o valor → conta ao champion → champion fortalece a compra interna → pastor legitima → tenant renova → receita alimenta institucionalização de defensibilidade → produto mantém vantagem → líder continua confiando.

Se qualquer link desta corrente quebra (ex: líder acha que o radar falhou; pastor sente que virou fiscalização; participante se sente vigiado), o flywheel gira para trás.

---

## Primary Development Focus (5 áreas críticas para o MVP)

1. **Tela principal do líder — vista semanal acionável**
   Uma vista que cabe em 1–3 minutos no Android gama média-baixa: sinais do radar, leitura do que aconteceu desde a última abertura, 1 ação óbvia por sinal, estado "dados de X min atrás" sempre visível.

2. **Mecânica de sinalização com plausibilidade honesta**
   Detectors com auto-throttle abaixo de 60% de plausibilidade (perdem voz). Princípio 3: sem sinal-sem-explicação. Cada sinal tem um "porquê" textual que o líder reconhece.

3. **Loop fechado por resposta real**
   O produto distingue "visualizado" de "respondeu". Só fecha o loop quando há evidência relacional de movimento real — não quando alguém abriu uma mensagem.

4. **Onboarding de igreja + treinamento de líder**
   Admin instala em ≤7 dias. Champion treina 1 líder em ≤45 min. Líder consegue usar sozinho na 1ª semana. Expectativa explícita de que silêncio saudável é ok.

5. **Vista de pastor — saúde agregada sem vigilância individual**
   Visão agregada por grupo, por tipo de sinal, por saúde do líder (apoio, não produtividade). Zero perfil individual de participante salvo autorização explícita.

---

## Critical Success Factors

1. **Plausibilidade ≥60% no radar** — piso estrutural. Abaixo disso, detectors perdem voz.
2. **Linguagem pastoral enforçada como lint** — glossário banido + label `copy-review` em toda PR de UI. Fonte única: `apps/web/messages/pt-BR.json`.
3. **UX que parece explicitamente não-fiscalização** — desarmar o medo central do pastor em cada tela, não só evitá-lo.
4. **Primeira semana sem abandono** — onboarding que cabe no tempo real do voluntário cansado.
5. **Cuidado relacional humano no loop** — zero automação substituindo discernimento pastoral.

---

## Design Implications (por seção de experiência)

### A. Tela do líder (mobile, 1–3 min)
- **Must do:** Uma vista, máximo 5 sinais destacados, cada sinal com explicação textual ("o que sabemos, o que não sabemos"), 1 ação primária por sinal, indicador "dados de X min atrás"
- **Tied to:** Líder positive *"ver a tempo, agir a tempo"*; líder negative *"falso positivo constrangedor"*
- **Don't:** Score único, ranking, imperativo automatizado, jargão CRM

### B. Onboarding de líder voluntário
- **Must do:** ≤45 min total · expectativa explícita de silêncio saudável · primeira sessão útil = 2 min · exemplo real de radar acertando
- **Tied to:** Líder negative *"fadiga de ferramenta"*; champion positive *"ganhar credibilidade interna"*
- **Don't:** Tour longo, termos técnicos, pressão para configurar tudo antes de começar

### C. Vista do pastor (desktop denso)
- **Must do:** Agregado por grupo · sinais de líder sobrecarregado · política de LGPD visível · zero perfil individual de participante salvo autorização explícita
- **Tied to:** Pastor positive *"visibilidade agregada digna"*; pastor negative *"medo central de fiscalização"*
- **Don't:** Leaderboard entre líderes, perfil individual de participante no padrão, linguagem de CRM

### D. Onboarding de tenant (admin area)
- **Must do:** Checklist com estimativas reais · defaults seguros · undo em configurações · audit log · página LGPD consulta-pronta
- **Tied to:** Admin positive *"onboarding previsível"*; admin negative *"medo de vazar dados"*
- **Don't:** Dependência técnica externa, ACLs expostas cruas, ausência de suporte humano

### E. Jornada do participante (quando ele usa)
- **Must do:** Mobile simples, conteúdo útil, zero métrica visível, consentimento explícito, transparência sobre dados
- **Tied to:** Participante positive *"sentir-se visto sem vigiado"*; participante negative *"ser tratado como métrica"*
- **Don't:** Score, ranking, gamificação, rótulo espiritual, tracking de terceiros

### F. Microcopy (UI textual em toda parte)
- **Must do:** Tom 4-atributos (pastoral humilde, radar humilde, dignidade antes de dado, prático terreno) · pergunta em vez de imperativo · glossário banido enforçado
- **Tied to:** Todos os personas — tom é guardrail de marca e acessibilidade pastoral
- **Don't:** Termos banidos (lead, pipeline, engajamento, funil, KPI, rebanho, ovelha, monitorar, rastrear, supervisionar)

---

## Emotional Transformation Goals (primeira pessoa)

**Líder de grupo:**
> *"Antes eu me sentia culpado por não conseguir ver tudo. Hoje eu chego na quarta de manhã, vejo o que importa em 2 minutos, mando uma mensagem real para quem precisa, e a culpa saiu de cima de mim sem virar frieza."*

**Pastor titular:**
> *"Antes eu tinha medo de qualquer ferramenta transformar pastoreio em vigilância. Hoje eu vejo a saúde dos grupos, confio nos meus líderes, e o produto some no fundo — é o cuidado relacional que aparece."*

**Champion (líder de discipulado):**
> *"Antes eu sentia sozinho que a gente estava perdendo gente por falta de mecânica. Hoje eu trouxe um radar que os líderes realmente usam, e a cultura de cuidado da igreja cresceu sem virar burocracia."*

**Participante:**
> *"Eu nem sei que existe um radar pastoral. Só sei que quando eu sumi por 2 semanas, alguém que me conhece mandou uma mensagem de verdade — e isso foi carinho, não checklist."*

**Admin de tenant:**
> *"Eu configurei a igreja em 4 dias, respondi a pergunta do pastor sobre LGPD em 30 segundos, e consegui voltar pro resto do meu trabalho. A ferramenta saiu do meu caminho."*

---

## Design Focus Statement

> **O metanoia-hub é desenhado para o líder cansado na quarta-feira de manhã, no Android gama média-baixa, antes do trabalho — e toda decisão de produto começa respondendo à pergunta: "isso ajuda o líder a agir a tempo, com dignidade, em 1–3 minutos, sem virar fiscalização?".**
>
> Se a resposta for não, a decisão é rejeitada, mesmo que seja tecnicamente viável, comercialmente atraente, ou esteticamente bonita.

---

## Development Phases

### **First Deliverable: metanoia-hub Release 1a-beta (MVP com loop de cuidado provado)**

Focus on empowering **líder de grupo** from **"não consegue ver tudo sozinho, culpa silenciosa"** to **"age a tempo com radar humilde, dignidade preservada"** who naturally becomes **multiplicador de cultura de cuidado**:

- **Tela principal do líder** — Vista semanal acionável · 1–3 min · Android gama baixa
- **Sinais com plausibilidade honesta** — Auto-throttle · explicação textual · sem score
- **Loop fechado por resposta real** — Distingue visualizado de respondido
- **Onboarding de líder voluntário** — ≤45 min · expectativa de silêncio saudável
- **Vista de pastor agregada** — Desktop denso · zero perfil individual salvo autorização
- **Onboarding de tenant (admin)** — ≤7 dias · defaults seguros · LGPD consulta-pronta
- **Microcopy enforçada** — Glossário banido como lint · pt-BR.json como fonte única

### **Future Phases**

- **Phase 2 (Release 1b — até jan/2027):** Expansão de trilhas herdadas do PRD (filtradas pelos princípios pastorais); cobertura expandida de offline de leitura; auditoria WCAG AA formal
- **Phase 3 (pós-MVP):** WhatsApp Business API (canal auxiliar, nunca principal); conselho pastoral consultivo institucionalizado
- **Phase 4:** API pública versionada; integração com outros stacks de igreja
- **Phase 5:** Busca semântica com pgvector (só com 6+ meses de dados acumulados); inteligência relacional avançada
- **Avaliação futura:** Apps nativos (só se PWA não atender); offline de escrita

---

## Related Documents

- **Hub:** [`00-trigger-map.md`](./00-trigger-map.md)
- **Business Goals:** [`01-business-goals.md`](./01-business-goals.md)
- **Primary Persona:** [`personas/02-primary-persona-lider-de-grupo.md`](./personas/02-primary-persona-lider-de-grupo.md)
- **Feature Impact:** [`06-feature-impact-analysis.md`](./06-feature-impact-analysis.md)
- **Fonte canônica:** [`../A-Product-Brief/project-brief.md`](../A-Product-Brief/project-brief.md)
