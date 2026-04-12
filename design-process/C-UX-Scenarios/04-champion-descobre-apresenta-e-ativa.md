---
design_intent: S
design_status: not-started
---

# 04: Champion descobre o Hub, apresenta ao pastor e ativa

**Project:** metanoia-hub
**Created:** 2026-04-11
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios
**Scenario type:** Screen Flow (SSR marketing · hybrid device · mobile-discovery → desktop-present)
**Priority:** ⭐ Priority 2 — Supporting (funil comercial inicial)
**Release gate:**
- **Core do site marketing (Landing, Pricing, Features, Sobre, Manifesto) — Release 1a.**
- **Estudo de caso, Blog, Contato — Release 1a ou 1a-beta conforme disponibilidade editorial.**
- **Tela de apresentação curada (#27) — ⚠️ Design-driven requirement, ver seção Release Gate Audit.**
- **Trial self-serve (#9) — ⚠️ Pode ser Release 1b+ dependendo do go-to-market motion; sales direta é a fallback do MVP.**

---

## Nota de persona — quem é o Champion e por que ele importa

**⚠️ Extensão do modelo de personas:** o Champion **não existe** como persona documentada no PRD. As 5 jornadas do PRD cobrem Marcos (Líder), Juliana (Participante), Cláudia (Admin), Paulo (Super Admin) e Ricardo (Adoção/Buyer). O Champion aqui é uma **extensão explícita** desse modelo — conceito comum em SaaS para descrever o vetor interno de evangelização antes do buyer decidir. Este outline é o primeiro artefato do projeto a nomear a persona formalmente; a rastreabilidade deve partir deste documento até que o PRD seja atualizado para incluí-la (ação sugerida: pedir ao time de produto no próximo grooming para registrar Champion como persona-satélite da jornada de adoção do Ricardo).

O **Champion** neste produto é o **líder apaixonado sem poder orçamentário** — tipicamente um líder de grupo pequeno, líder de discipulado, coordenador de ministério ou pastor auxiliar que **ama a causa do discipulado**, consome conteúdo pastoral (podcasts, livros, conferências), e tem frustração acumulada com os softwares "de igreja" que parecem corporativos demais. Ele é **digitalmente confortável**, mais que o Pastor Titular em média, mas **não é o comprador** — é quem **descobre, se apaixona, e precisa convencer quem decide**.

O Champion é o vetor mais provável de entrada do produto em uma igreja. Ele não é o cenário de valor sustentado (esse é o cenário 01 com o líder na quarta de manhã), mas é **a porta pela qual o cenário 01 nunca acontece se o Champion não tiver munição**. Sem o Champion convencido, o produto nem chega ao Pastor Titular.

**Mapeamento RBAC:** o Champion não tem role RBAC no produto ainda — ele é um *visitor* anônimo no site de marketing. Após ativar o trial, ele vira `Admin Tenant` (se autossuficiente) ou aguarda o Pastor Titular assumir o papel.

---

## Transaction (Q1)

**What this scenario covers:**
Do momento *"recebi um link num grupo de WhatsApp de líderes"* até *"mandei uma apresentação curada para o pastor titular no Monday e ativei um trial para mostrar ao vivo"*, passando pela descoberta emocional (Manifesto Pastoral), validação prática (Features + Estudo de caso), validação financeira (Pricing) e geração da munição de persuasão (#27 Tela de apresentação). O caminho é **hybrid device**: começa mobile (descoberta casual à noite ou no ônibus) e termina desktop (preparação da apresentação para o pastor).

---

## Business Goal (Q2)

**Goal:** `O Champion entra no produto com ambição de apresentar ao Pastor Titular, e sai com munição curada para fazê-lo sem se sentir vendedor` (Trigger Map · Business Goal B4 — aquisição early-stage)

**Objective:** `% visitantes do site que chegam à tela #27 (Apresentação) e/ou ativam trial` — funil de topo de pipeline, mensurada a partir do go-live do site (Release 1a).

Este cenário também mede a **saúde do manifesto pastoral como peça-âncora**: se o Manifesto Pastoral (#5) não entrega o "clique emocional", o Champion nunca chega à tela #27. O manifesto é o coração do funil inicial, não um item de rodapé institucional.

---

## User & Situation (Q3)

**Persona:** Champion — líder apaixonado sem poder orçamentário. Nome fictício do cenário: **Júlia**, 34 anos, líder de grupo pequeno na Igreja Presbiteriana de [cidade], fisioterapeuta de profissão, ouve dois podcasts semanais sobre discipulado, leu *The Trellis and the Vine*, está há 3 anos liderando o mesmo grupo e há 6 meses começou a pedir à liderança da igreja *"algum jeito de a gente cuidar melhor das pessoas que estão nos grupos"*. Ela não tem filhos pequenos; está num momento de capacidade. Tem um notebook razoável e um celular Android gama média (acima do floor Moto G4/G5). Lê tudo em PT-BR, entende alguns conceitos em EN de software mas prefere evitar.

**Situation:**
Domingo, 21h40. Júlia acabou de jantar, terminou de colocar a louça na máquina, sentou no sofá, pegou o celular. Abriu um grupo de WhatsApp de "Líderes de pequenos grupos" que participa (regional, ~40 pessoas). Uma amiga compartilhou há 2 horas um link com o texto *"gente, achei uma coisa diferente, deem uma olhada — parece que alguém tá tentando fazer software pastoral de verdade"*. Júlia toca no link. Cai no #1 Landing do metanoia-hub no celular. Ela tem **15 a 25 minutos** de atenção nessa sessão de domingo à noite — depois vai dormir. Se gostar do que vê, vai **voltar amanhã de manhã no notebook** com mais atenção e tempo, e aí sim avalia se vale levar ao pastor dela.

---

## Driving Forces (Q4)

**Hope:** Achar um produto onde o manifesto bate com a língua materna do discipulado que ela já pratica. Sair da sessão de domingo com a sensação *"isso aqui é diferente, vou estudar direito amanhã e talvez apresentar ao pastor Marcelo na terça"*. Na sessão de segunda, sair com **uma apresentação curada na mão** (ou no email) que ela pode mandar pro pastor sem ter que escrever nada — só *"dá uma olhada nisso"* e anexar.

**Worry:** Ser mais uma decepção — abrir, ver "recursos corporativos" travestidos de pastoral, sentir que perdeu 10 minutos, fechar a aba frustrada. Ou: gostar do produto, apresentar ao pastor, e o pastor dizer *"Júlia, isso é legal mas parece complicado demais pra nossa realidade"* — e ela ficar com a sensação de ter sugerido algo que não se encaixa. Ou pior: o preço ser tão alto que ela nem sente coragem de levar ao pastor. Ou se sentir vendedora por apresentar algo que não é dela.

---

## Device & Starting Point (Q5 + Q6)

**Device:** **Hybrid** — descoberta mobile (Android gama média, Sunday night scroll) → aprofundamento desktop (notebook Monday morning/evening). O site precisa funcionar **impecavelmente em ambos**. A decisão de se voltar mobile ou desktop é da Júlia, não do produto.

**Entry:** Link compartilhado num grupo de WhatsApp (bounce de terceiro), direto para `/` (#1 Landing). Não há UTM segmentado nem landing alternativa; o Champion sempre entra pelo home principal. Sem login obrigatório em nenhuma etapa deste cenário até o step de trial (#9).

**Nota de release gate:** O link compartilhado por WhatsApp é cópia de URL pura. Nada exige integração de social sharing, deep linking ou Open Graph rico para o MVP — **OG tags básicos para preview de link no WhatsApp são suficientes** (imagem + título + descrição). Isso é Release 1a.

---

## Best Outcome (Q7)

**User Success — Sunday night (sessão 1, mobile, 15–25 min):**
Júlia fecha a aba do celular às 22h05 com a sensação *"isso aqui é diferente de verdade, o manifesto me tocou, vou olhar amanhã com calma."* Ela salva o link nos favoritos do navegador e/ou encaminha a mensagem original do WhatsApp para ela mesma em "Mensagens Salvas". **Não ativa trial ainda.** Não preenche contato. Sai em estado de *curiosidade validada*.

**User Success — Monday morning (sessão 2, desktop, 25–40 min):**
Júlia volta ao site no notebook, relê o manifesto com calma, navega Features + Estudo de caso, confere Pricing (respira aliviada — é acessível para o porte da igreja dela), chega à tela **#27 Apresentação** — uma peça curada, visualmente coerente com o manifesto, que ela pode **compartilhar por link** ou **baixar como PDF** para mandar ao pastor. Opcionalmente, ativa um **trial self-serve** (se disponível no release atual) para poder mostrar o produto *ao vivo* ao pastor Marcelo na terça. Sai com email mandado para o pastor: *"Pastor, dá uma olhada nisso — acho que é o que a gente tava procurando. [link] / [PDF anexado]"*.

**Business Success:**
- +1 evento `marketing.champion.deck.shared` (ou equivalente) no momento em que Júlia compartilha ou baixa a #27.
- +1 evento `trial.self_serve.activated` se Júlia ativar trial (opcional, depende de release).
- Pipeline qualificado: uma igreja entra no topo do funil com um Champion engajado e uma apresentação entregue ao decisor — muito mais qualificada que um lead frio.

---

## Shortest Path (Q8)

Duas sessões, um único champion, zero obrigação entre sessões. O site é um corredor claro — não um labirinto de capturas de email. Cada página tem seu trabalho específico e encaminha para a próxima sem empurrar.

### Sessão 1 — Sunday night, mobile (15–25 min)

1. **Landing (#1)** — Primeiro contato. Hero com manifesto em 1 frase curta (não headline de marketing corporativo), imagem honesta de líder real, CTA primário *"Ler o manifesto"* (não *"Começar grátis"*). CTA secundário *"Ver como funciona"*. Júlia toca no primeiro — ela quer saber *"por que"* antes de *"como"*.
2. **Manifesto Pastoral (#5)** — **Peça-âncora do funil.** Não é um blog post nem um "sobre nós" — é o documento que articula por que o metanoia-hub existe, em linguagem pastoral. Temas: presença digital ≠ saúde espiritual, dignidade antes de dado, Improviso Sagrado, radar humilde. Texto longo-médio (3–5 min de leitura), tipografia generosa, zero tracking de scroll, zero popups. Ao final: 2 CTAs equivalentes — *"Ver as funcionalidades"* (#3) e *"Conhecer a equipe por trás"* (#4). Júlia toca no primeiro.
3. **Features (#3)** — Lista curada de funcionalidades em **linguagem pastoral, não bullet list corporativo**. Não há *"dashboards interativos"*, há *"vista pastoral humilde"*. Não há *"real-time analytics"*, há *"radar que ajuda a lembrar, não a vigiar"*. Seção por seção, cada feature é apresentada como resposta a uma tensão pastoral real. Screenshot/mockup por feature, zero vídeo auto-play. Ao final, CTA *"Ver igreja real usando"* (#8). Júlia toca.
4. **Estudo de caso (#8)** — 1 ou 2 estudos de caso curtos de igrejas reais. Formato: a tensão pastoral que existia, como o produto foi usado, que diferença fez — contado em voz pastoral, não em *"X% increase in engagement"*. Frases dos líderes em aspas, fotos honestas. Ao final: *"Ver como é a apresentação"* (#27). Júlia olha no relógio (22h01), decide parar aqui e voltar amanhã. Sai sem ativar nada.

### Sessão 2 — Monday morning, desktop (25–40 min)

5. **Pricing (#2)** — Acessando direto pelo bookmark, Júlia entra pela Pricing desta vez. Quer ver se vale a pena antes de investir mais tempo. Planos expostos de forma transparente: preço por tamanho de igreja, features incluídas, o que não está incluído, FAQ. Zero *"Contact sales"* como preço do plano principal no MVP (isso é anti-pastoral). Júlia vê o preço, confirma que cabe no orçamento da igreja dela, respira. Toca em *"Ver apresentação curada"* (#27).
6. **Tela de apresentação curada (#27) — Deck Light** — Esta tela **existe especificamente para o Champion**. É um deck visual curado, **pronto para ser compartilhado por link** (URL pública) ou **baixado como PDF**, que contém: (a) o manifesto em 2 slides, (b) 4 screenshots-chave do produto com legendas pastorais, (c) 1 slide de preço, (d) 1 slide de call-to-action *"Quer testar?"*. A Júlia **não precisa fazer nada além de copiar o link e mandar pro pastor**. Zero edição, zero templating, zero branding personalizado no MVP — é um deck único, bem desenhado, compartilhável. Júlia copia o link, abre o Gmail, compõe o email para o pastor Marcelo.
7. **Cadastro / Trial (#9) — opcional, depende de release** — Para poder mostrar o produto *ao vivo* ao pastor na terça, Júlia decide ativar um trial self-serve de 14 dias. Formulário mínimo: nome, email, nome da igreja. Zero campos de "número de funcionários" ou "cargo". Email de ativação cai na caixa dela. No trial, ela vira `Admin Tenant` temporário do tenant-trial, e pode convidar o pastor Marcelo como co-admin durante o trial. **Se trial self-serve é Release 1b+, este step vira *"Solicitar demonstração"* — formulário mínimo que dispara contato do time comercial em 1 dia útil.**

**Sessão 2 termina** com o email mandado para o pastor e (opcionalmente) um trial ativo. Júlia fecha o notebook. Daqui, a responsabilidade passa para o pastor Marcelo — que, se convertido, entra no cenário 05 (admin-faz-onboarding-minimo).

---

## Trigger Map Connections

**Persona:** Champion (líder apaixonado sem poder orçamentário · Hybrid device · Não tem role RBAC no produto)

**Driving Forces Addressed:**
- ✅ **Want:** *"Achar um manifesto que bate com a minha língua materna pastoral"* — #5 Manifesto é peça-âncora, não item de rodapé
- ✅ **Want:** *"Ter munição curada para apresentar ao pastor sem precisar escrever nada"* — #27 Tela de apresentação é curadoria pronta
- ✅ **Want:** *"Validar preço antes de investir mais tempo"* — Pricing (#2) é transparente, sem "Contact sales" disfarçado
- ❌ **Fear:** *"Ser mais uma decepção corporativa disfarçada de pastoral"* — linguagem, tom, imagens e case study são filtrados por 4 filtros de tom
- ❌ **Fear:** *"Apresentar ao pastor e ele achar caro/complicado demais"* — #27 é otimizada para o pastor não-técnico ler em 2 minutos
- ❌ **Fear:** *"Se sentir vendedora"* — o Champion nunca é empurrado a vender; é convidado a compartilhar algo que ele mesmo achou bonito

**Business Goal:** Funil comercial pastoral sem agressividade (Trigger Map §01-business-goals.md — topo de pipeline qualificado)

**Design Implications aplicadas (§05-key-insights.md):**
- **A — Radar humilde (invertido ao marketing):** o site **oferece** o conteúdo, nunca **exige** email para liberar — zero gated content no MVP
- **Linguagem-primeiro:** manifesto, features e case study passam por auditoria de glossário antes de publicar
- **F — Improviso Sagrado (aplicado ao marketing):** nenhum chat bot presumindo que o visitante tem um problema que só o produto resolve
- **Performance-first:** landing deve ser TTI <2s no Moto G4/G5 via SSR — o Champion não tem paciência para SPA pesada

**Anti-patterns bloqueados:**
- ❌ Nenhum popup de captura de email nos primeiros 90s
- ❌ Nenhum gated content (manifesto, features e case study **sempre livres**)
- ❌ Nenhum chatbot com "Oi! Posso te ajudar a encontrar o plano certo?" nos primeiros 30s
- ❌ Nenhuma tela de *"Contact sales"* disfarçada de preço do plano principal
- ❌ Nenhum uso de jargão comercial: *engagement, KPIs, ROI, pipeline, churn, funnel, conversão* user-facing
- ❌ Nenhuma comparação pública com concorrentes (*"vs. Church Software X"*) — indignidade competitiva
- ❌ Nenhum testemunhal fake ou genérico ("Amazing product! — John D., Pastor")
- ❌ Nenhuma urgência sintética (*"Trial de 14 dias começa agora!"*, *"Só restam 3 vagas!"*)

---

## Scenario Steps

| Step | Page | Purpose | Exit Action |
|------|------|---------|-------------|
| 04.1 | `04.1-landing/` (#1) | Primeiro contato via link WhatsApp, hero + manifesto em 1 frase | Toque em *"Ler o manifesto"* |
| 04.2 | `04.2-manifesto-pastoral/` (#5) | Peça-âncora do funil — DNA pastoral em 3–5 min de leitura | Toque em *"Ver as funcionalidades"* |
| 04.3 | `04.3-features/` (#3) | Features em linguagem pastoral, uma por tensão pastoral real | Toque em *"Ver igreja real usando"* |
| 04.4 | `04.4-estudo-de-caso/` (#8) | 1–2 estudos de caso em voz pastoral, zero métricas corporativas | Sessão 1 termina ou continua para Pricing |
| 04.5 | `04.5-pricing/` (#2) | Preços transparentes por tamanho de igreja, sem contact-sales disfarçado | Toque em *"Ver apresentação curada"* |
| 04.6 | `04.6-apresentacao-curada/` (#27) | **Deck Light** — peça pronta para compartilhar com o pastor titular | Copiar link / Baixar PDF |
| 04.7 (opt) | `04.7-cadastro-trial/` (#9) | Ativar trial self-serve (ou solicitar demo se trial é R1b+) | Email de ativação enviado |

**First step (04.1)** inclui o contexto de entrada completo: situation (Q3) + mental state (Q4) + discovery method (Q6). Per-page detalhes ficam para Phase 4 (UX Design / wireframes).

**Páginas do inventário não visitadas no sunshine path, mas parte do Chain 04:**
- **#4 Sobre** — acessível a partir do #5 Manifesto (CTA alternativo *"Conhecer a equipe"*). Trilho paralelo para quem quer validar credencial da equipe antes de seguir. Não está no sunshine path porque o Champion típico (Júlia) valida equipe *depois* de validar manifesto.
- **#6 Blog** — descoberta alternativa para champions que chegam via SEO orgânico ou share de artigo. Alimenta o Manifesto com profundidade contínua, mas não é obrigatório ao Champion do sunshine path.
- **#7 Contato** — trilho paralelo para champions que preferem falar com um humano antes de ativar trial. Redireciona para email + formulário simples. Não está no sunshine path porque a Júlia prefere autonomia.

**On-step interactions** (que não saem do step): scroll smooth no manifesto com âncoras internas, expand/collapse nas features longas, lightbox nos screenshots do #27, preview do PDF antes do download, OG tags para preview de link no WhatsApp no step 04.1. Todos documentados como storyboard items dentro de cada page spec na Phase 4.

---

## Release Gate Audit

### Nota sobre o release gate das marketing pages

**⚠️ Bandeira de rastreabilidade:** a arquitetura prevê o route group `(public)/` no Next.js App Router com SSR/SSG (e existem referências a `page.tsx` Landing e `pricing/page.tsx`), **mas nenhum Epic do Sprint Roadmap (sprints 0–21) cria stories de engenharia para as 8 páginas públicas** listadas neste outline. Isso não significa que as páginas não vão existir no go-live — significa que elas são **deliverables de conteúdo + design + templating estático**, fora da cadência de sprints de engenharia de produto.

**Interpretação adotada neste outline:**
- As marketing pages são **conteúdo estático no route group `(public)/`**, produzidas como deliverable do trilho de **design + conteúdo editorial + copy**, não como stories de engenharia no Sprint Roadmap.
- O "gate" associado a elas é um **gate de conteúdo** (precisa do manifesto escrito, das features descritas, do case study aprovado), não um **gate de release de engenharia**.
- A **infraestrutura** que as hospeda (route group `(public)/`, SSR, deploy, OG tags) é parte do scaffolding do frontend em Epic 1 (ou equivalente de bootstrap), **não uma story por página**.
- Se no grooming for decidido que essas páginas **precisam de stories de engenharia** (por complexidade de CMS, animações custom, integração com blog, etc.), este outline deve ser revisitado e o release gate recalculado.

**Ação requerida no grooming:** confirmar que as marketing pages são conteúdo estático gerido pelo trilho de design/copy (gate de conteúdo) OU criar stories explícitas nos Epics de MVP e recalcular o sprint allocation.

### Core do site marketing — gate de conteúdo

| Elemento | Gate de conteúdo | Epic / Story | Nota |
|---|---|---|---|
| #1 Landing (SSR, Next.js App Router) | ✅ Conteúdo pronto p/ go-live | ⚠️ Sem story explícita — scaffolding no Epic 1 | Conteúdo + copy + design, não engenharia |
| #2 Pricing (SSR, transparente) | ✅ Conteúdo pronto p/ go-live | ⚠️ Sem story explícita — scaffolding no Epic 1 | Depende de decisão de precificação |
| #3 Features (SSR, linguagem pastoral) | ✅ Conteúdo pronto p/ go-live | ⚠️ Sem story explícita — scaffolding no Epic 1 | Auditoria de tom pré-publicação |
| #4 Sobre (SSR, equipe + missão) | ✅ Conteúdo pronto p/ go-live | ⚠️ Sem story explícita — scaffolding no Epic 1 | Trilho paralelo |
| #5 Manifesto Pastoral (SSR, peça-âncora) | ✅ Conteúdo pronto p/ go-live | ⚠️ Sem story explícita — **peça crítica do funil** | Auditoria de tom obrigatória |
| OG tags para preview WhatsApp | ✅ Parte do scaffolding SSR | Epic 1 (bootstrap) | Básico, não rich preview |
| Performance SSR <2s TTI Moto G4/G5 | ✅ NFR do frontend | NFR de performance Epic 1 | Next.js SSR + cache CDN |

### Conteúdo editorial (depende de disponibilidade)

| Elemento | Release gate | Nota |
|---|---|---|
| #6 Blog (CMS básico ou MDX estático) | ⚠️ Release 1a ou 1a-beta | Depende de estratégia editorial — sem Blog, o Manifesto precisa ser forte sozinho |
| #8 Estudo de caso (1–2 igrejas reais) | ⚠️ Release 1a-beta ou 1b | **Depende de ter igreja piloto real** — no go-live 1a, pode ser substituído por estudo de caso hipotético/projetado |
| #7 Contato (formulário simples → email) | ✅ Release 1a | Epic de Marketing Site |

### Tela de apresentação curada (#27) — design-driven requirement

| Elemento | Release gate | Nota |
|---|---|---|
| **#27 Deck Light compartilhável** | ⚠️ **Design-driven requirement** | **Ver nota de mapeamento abaixo** |
| URL pública do deck (rota SSR) | ⚠️ DDR | Parte de #27 |
| Download PDF do deck | ⚠️ DDR | Parte de #27 |
| OG tags rich para preview do deck ao ser compartilhado | ⚠️ DDR | Parte de #27 |

### Trial self-serve (#9) — depende de go-to-market motion

| Elemento | Release gate | Nota |
|---|---|---|
| Trial self-serve 14 dias sem cartão | ⚠️ **A verificar** | **Se o MVP go-to-market é sales-led, trial self-serve vai para Release 1b+** |
| Formulário mínimo (nome, email, igreja) | ✅ Release 1a (se trial self-serve) ou ❌ (se sales-led) | Condicional |
| Tenant-trial provisionamento automático | ⚠️ Release 1b+ provável | Requer infra de self-service |
| Upgrade de trial para pago | ⚠️ Release 1b+ provável | Requer integração de pagamento |
| Fallback: *"Solicitar demonstração"* como formulário | ✅ Release 1a | Alternativa sales-led, mais seguro para MVP |

### Vetos permanentes

| Elemento | Status |
|---|---|
| Popups de captura nos primeiros 90s | ❌ Veto permanente |
| Gated content (manifesto, features, case study) | ❌ Veto permanente |
| Chatbot agressivo nos primeiros 30s | ❌ Veto permanente |
| Urgência sintética (*"Só 3 vagas!"*) | ❌ Veto permanente |
| Comparação pública com concorrentes | ❌ Veto permanente (indignidade competitiva) |
| Testemunhal fake ou genérico | ❌ Veto permanente |

### Débito de release gate #1: Tela de apresentação curada (#27)

**Problema:** A #27 é uma peça única, desenhada especificamente para o Champion compartilhar com o Pastor Titular. Não aparece em nenhum Epic do site marketing padrão. Mas é **estratégica para o funil pastoral** — sem ela, o Champion precisa "vender" o produto com palavras próprias, e a persona do Champion rejeita o papel de vendedor.

**Proposta de mapeamento:** Story nova no Epic de Marketing Site, ou em Epic de Growth/Funil. Modelo conceitual:
- Rota SSR pública `/apresentacao` (ou `/apresentacao/[slug]` se houver versões futuras)
- Conteúdo renderizado a partir de MDX estático ou CMS simples (sem banco)
- PDF gerado via export estático ou serviço (ex: Puppeteer server-side em função edge)
- OG tags rich específicos da #27 para preview bonito no WhatsApp/Gmail

**Opção MVP minimalista:** começar como **PDF estático baixável** sem a URL pública rica. O Champion baixa e anexa no email. Preview WhatsApp fica com OG da landing. Menos elegante, mas 100% realizável em Release 1a com zero débito técnico.

**Ação requerida no grooming:** Decidir se a #27 entra como Release 1a (versão minimalista PDF-only) ou Release 1a-beta (versão completa com URL pública + OG rich + PDF).

### Débito de release gate #2: Go-to-market motion — divergência explícita do PRD

**⚠️ Divergência documentada do PRD — Jornada 5:** A Jornada 5 do PRD ("Adoção pelo Ricardo") assume **self-service completo**: *"Trial → pago sem intervenção humana"*. Este outline **recomenda sales-led para Release 1a** — uma divergência deliberada que precisa ser reconhecida, não escondida.

**Problema:** O step 04.7 (ativar trial) só funciona como o PRD descreve se o MVP oferece **trial self-serve** desde o Release 1a. Se o motion de MVP é **sales-led** (pastor conversa com um humano do time comercial, contrato é fechado manualmente, tenant é criado manualmente), então o step 04.7 vira *"Solicitar demonstração"* e o Champion não ativa trial — ele agenda conversa.

**Justificativa da divergência (por que divergir do PRD no 1a):**
- MVP tem equipe mínima (1–2 devs) que precisa validar hipóteses de valor **manualmente**, cliente a cliente, antes de industrializar o fluxo de self-service.
- Os primeiros clientes 1a são oportunidade de **aprendizado pastoral** que só acontece com contato humano — essa qualidade se perde num fluxo 100% automatizado.
- Infra de self-service (provisionamento automático de tenant-trial, RLS para trial, email transactional operacional, upgrade path com pagamento) é **escopo significativo** que concorre com as features pastorais core do 1a — prioridade baixa comparada ao Epic 5 (grupos) e Epic 6 (radar).
- Sales-led **não é o target permanente** — é um escalão para aprender antes de industrializar.

**Proposta de mapeamento:**
- **Opção A — Sales-led MVP (recomendado para Release 1a, divergente do PRD):** step 04.7 é formulário curto *"Quer ver ao vivo? Nosso time liga em 1 dia útil"* → CRM interno (pode ser planilha + inbox no 1a) → contato humano. Simples, seguro, realista. Trial self-serve fica para Release 1b.
- **Opção B — Trial self-serve desde 1a (fiel ao PRD Jornada 5):** step 04.7 é o fluxo descrito no sunshine path. Requer infra de self-service completa. Escopo significativo, concorre com pastoral core.

**Recomendação do design:** **Opção A** para Release 1a, com reversão explícita para Opção B (fiel ao PRD) no Release 1b, após os primeiros clientes terem validado o manifesto pastoral na prática.

**Ação requerida no grooming:**
1. **Validar a divergência com o PRD** — essa decisão precisa ser aceita formalmente pelo time de produto como "divergência informada", não como "esquecemos do PRD".
2. **Atualizar o PRD Jornada 5** para refletir o caminho em dois estágios: sales-led 1a → self-serve 1b, ou manter a versão atual e anotar este outline como fonte da divergência temporária.
3. **Validar Opção A como default do 1a.**

### Resumo dos débitos

Este cenário gera **3 débitos explícitos** + 2 pontos de rastreabilidade:

1. **#27 Tela de apresentação curada** — design-driven requirement, 2 variantes (PDF-only minimalista em 1a ou completa em 1a-beta). Decisão no grooming.
2. **Trial self-serve vs. sales-led motion (divergência do PRD Jornada 5)** — recomendação Opção A (sales-led) para MVP como divergência informada, com 04.7 como formulário de demo request. PRD deve ser atualizado ou este outline deve ser reconhecido como fonte da divergência temporária. Reversão ao self-serve no Release 1b.
3. **Marketing pages sem stories de engenharia** — interpretação adotada: páginas são conteúdo estático sob trilho de design/copy, gate de conteúdo (não de release de engenharia). Grooming deve confirmar ou criar stories explícitas.
4. **Disponibilidade editorial do estudo de caso** — não é débito de código, mas de produto: precisa de ao menos 1 igreja piloto disposta a emprestar nome e contexto antes do go-live, ou substituto claramente rotulado como "estudo projetado".
5. **Champion como persona-satélite** — extensão do modelo de personas do PRD, este outline é o primeiro artefato a nomeá-la formalmente; pedir ao produto para registrá-la no PRD como satélite da jornada do Ricardo.

---

## Tone audit (glossário banido)

Verificação interna antes de salvar — nenhuma ocorrência user-facing de: *engagement (como métrica), KPI, ROI, pipeline (comercial), funnel, conversão, churn, leads qualificados, analytics, real-time, AI-powered, enterprise-grade, best-in-class, game-changing, Contact sales disfarçado, rebanho, célula, dashboard (corporativo), score, ranking*. ✅

**Substituições deliberadas:**
- "engage with your community" → "cuidar do seu grupo"
- "real-time analytics" → "radar humilde que ajuda a lembrar"
- "KPIs pastorais" → "sinais pastorais"
- "conversion funnel" → nunca aparece user-facing
- "trial" (UI) → "testar por 14 dias" ou "experimentar antes de comprar"
- "leads" → nunca aparece user-facing
- "Request a demo" → "Quer ver ao vivo? Nosso time liga em 1 dia útil"

Vocabulário substitutivo adotado: *manifesto, cuidado, presença, radar, apresentação, experimentar, conhecer, conversar.*

---

_Outlined sob Phase 3 — UX Scenarios · Mode: Suggest com checkpoint por cenário · Override pastoral × edtech: linha pastoral governa em qualquer conflito · Este cenário é a **porta de entrada comercial** do produto — o Champion é quem traz o produto para dentro da igreja, e o cenário 05 (admin onboarding) é o que acontece depois que o Pastor Titular foi convencido · 2 débitos de release gate + 1 recomendação estratégica documentados para grooming · Tela #27 é a peça mais única e estratégica deste cenário e merece atenção especial no Phase 4._
