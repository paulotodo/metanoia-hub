# Persona Primária — Líder de Grupo Pequeno

**Prioridade:** ⭐ PRIMARY TARGET · **Tipo:** User crítico (decide, no dia a dia, se o produto vive ou morre)
**Projeto:** metanoia-hub · **Fase WDS:** Phase 2 — Trigger Mapping
**Origem:** Síntese do brief (Step 13 Content Init) · 2026-04-11

---

## Snapshot

> **Frase que captura toda a tensão emocional:**
> *"Não me falta amor pelo grupo. Me falta um jeito claro de enxergar quem está se afastando e agir a tempo."*

| Campo | Valor |
|---|---|
| **Quem é** | Voluntário, não profissional. Tem emprego/vida fora da igreja. |
| **O que lidera** | 8–15 participantes num grupo pequeno (célula, grupo familiar, grupo de estudo — nome varia por igreja) |
| **Contexto de uso** | Mobile-first real · Android gama média-baixa · 2–4 aberturas/semana · 1–3 minutos por sessão |
| **Cenário-âncora MVP** | *"Vencer a quarta-feira de manhã no celular, antes do trabalho"* |
| **Estado emocional dominante** | **Cansaço + culpa silenciosa** — não por falta de amor, mas por falta de mecânica |
| **Device primário** | Android gama média-baixa (PWA web push) |
| **Device secundário** | Desktop, ocasional |

---

## Contexto Real (vida fora da igreja)

- Usa WhatsApp o dia inteiro, mas para **outras coisas**. O grupo dele é uma conversa entre muitas.
- **Percebe afastamentos tarde demais** e sente **culpa** por isso — não por falta de amor, mas porque a memória humana não escala para 15 pessoas em ciclos de semanas.
- **Não quer "mais uma ferramenta" para aprender.** Quer vencer uma manhã específica, no celular, em 1–3 minutos, antes do trabalho.
- Está cansado na quinta à noite. Está distraído na quarta de manhã. Pode ter sido interrompido a qualquer momento. Qualquer UX que assuma o contrário falha.

---

## Mental Model (como ele enxerga o problema)

- **"Pastoreio é relacional, não mecânico."** Ele não quer automação substituindo discernimento.
- **"Sou eu que decido quando ligar."** O radar sugere; ele decide. Qualquer coisa que inverta isso é fiscalização disfarçada.
- **"Silêncio nem sempre é problema."** Algumas ausências são descanso, trabalho, luto. Ele sabe disso, o produto tem que saber também.
- **"Eu não quero vigiar ninguém."** Medo compartilhado com o pastor titular: *"Isso vai transformar pastoreio em fiscalização."*

---

## Positive Driving Forces (o que ele **quer sentir / alcançar**)

| Força | Descrição | Product Promise (como o radar pastoral responde) |
|---|---|---|
| **Ver a tempo, agir a tempo** | Quer identificar quem está se afastando **antes** que o afastamento vire perda de participante | **Radar pastoral com plausibilidade ≥60%** — sinaliza o que consegue explicar; silencia quando não consegue |
| **Clareza pastoral humilde** | Quer uma leitura honesta do grupo que **não finja saber o que não sabe** | **Confiabilidade humilde (C2):** radar mostra o que sabe (presença física) e o que não sabe (estado interno) |
| **Dignidade no cuidado** | Quer agir com carinho, não com checklist frio. Quer mandar uma mensagem que soe a ele, não a CRM | **Loop fechado por cuidado (C4):** percepção → ação pastoral → confirmação de resposta real (não de "visualizado") |
| **Mecânica sem complexidade** | Quer chegar de manhã, ver o que importa, fazer 1 ação, fechar o app | **UX absurdamente simples** — resume a semana em uma tela, 1–3 minutos, ação óbvia |
| **Memória que o protege** | Quer que o sistema lembre o que ele esqueceu — sem gamificar isso | **Memória relacional sem gamificação** — C6 (modelo conceitual próprio) |
| **Não ser pego de surpresa** | Meta de 30 dias: *"Dessa vez eu não fui pego de surpresa"* | **North Star de Produto:** % semanas-líder com ≥1 ação em ≤48h |

---

## Negative Driving Forces (o que o **bloqueia**, frustra, ou o afasta do produto)

| Força Negativa | Descrição | Mitigação no produto |
|---|---|---|
| **Culpa silenciosa** | Sente que deveria ter visto antes, não viu, carrega o peso sozinho | O radar **não acusa** o líder por não ter detectado antes. Tom pastoral humilde. Zero linguagem de culpa. |
| **Medo de virar fiscal** | Medo explícito: *"Isso vai transformar pastoreio em fiscalização"* | **UX precisa desarmar isso em cada tela.** Não basta "não ser fiscalização" — tem que **parecer explicitamente** não-fiscalização no primeiro uso |
| **Fadiga de ferramenta** | *"É mais uma coisa pra aprender / lembrar de abrir"* | Push contextual raro + hábito leve · ativação em 1 sessão · onboarding que cabe entre um engarrafamento e o trabalho |
| **Jargão que aliena** | Palavras de CRM ("lead", "pipeline", "engajamento") ou igrejês pesado ("rebanho", "unção") o desligam | **Dicionário pastoral anti-CRM (C1)** · glossário banido enforçado como lint |
| **Score que reduz humano a número** | Rejeita a ideia de um número único representando "como vai" um participante | **Princípio 2: sem score-oráculo** · Princípio 4: sem ranking |
| **Falso positivo que gera mensagem constrangedora** | Se o radar diz "Pedro precisa de cuidado" e Pedro só estava de férias, o líder perde credibilidade pessoal com o grupo | **Princípio 3: sem sinal-sem-explicação** · Auto-throttle: detectors abaixo de 60% de plausibilidade **perdem voz** |
| **Cadência errada** | Notificação diária vira ruído; notificação rara demais deixa passar | **2–4 aberturas/semana** — híbrido push contextual + hábito leve |
| **Tela lenta em Android gama baixa** | App pesado no celular dele = produto morto | **Bundle budget agressivo** · Server Components default · cache-first de leitura |

---

## Transformação (jornada de mudança)

**De:** Líder cansado que carrega culpa por não enxergar tudo sozinho, improvisando pastoreio no intervalo do almoço, sem mecânica, dependente de memória.

**Para:** Líder que chega na quarta de manhã, vê em 2 minutos os sinais que merecem olhar, age com 1 mensagem ou 1 ligação dentro de 48h, e fecha o loop quando tem resposta real — **sem sentir que está vigiando ninguém**.

**Champion creation (como ele vira defensor do produto):**
> Quando, 30 dias depois de instalar o produto na igreja, ele olha para trás e diz: *"Dessa vez eu não fui pego de surpresa"* — e conta isso para o pastor titular e para o líder de discipulado. Essa é a conversão de usuário em champion pastoral interno.

---

## Improviso Sagrado (o que o produto **NÃO** automatiza — regra absoluta)

- Discernimento relacional sobre o contexto específico de cada participante
- Escolha de palavras em uma mensagem privada
- Decisão de quando ligar, quando visitar, quando esperar
- **O radar não é veredito. O radar sugere, o líder decide.**

---

## UX Implications (o que isso exige do design)

- **Tela principal do líder = 1 vista, 1 decisão por sinal, 1 ação em ≤3 min**
- **Radar com estado "dados de X min atrás"** — nunca em branco, nunca fingindo tempo real
- **Redundância cor+ícone+texto** em qualquer semáforo (WCAG AA · lê com lente embaçada e Android gama baixa)
- **Copy que um líder cansado na quinta à noite reconhece como vinda de outro líder cansado** — não de consultor, pastor de palco ou CRM
- **Empty state saudável:** *"Nenhum sinal por aqui hoje. Silêncio saudável — nem tudo que é quieto é problema."*
- **Success state um-shot (primeiro registro):** *"Guardei. Pequenas coisas assim é que sustentam o grupo."*
- **Success state dia a dia:** *"Guardei."* / *"Anotado."*
- **Nenhum imperativo automatizado.** *"Vale uma mensagem?"* passa. *"Envie uma mensagem agora"* é vetado.

---

## Related Documents

- [`../00-trigger-map.md`](../00-trigger-map.md) — Hub
- [`../01-business-goals.md`](../01-business-goals.md) — Business goals
- [`../05-key-insights.md`](../05-key-insights.md) — Key insights estratégicos
- [`../06-feature-impact-analysis.md`](../06-feature-impact-analysis.md) — Feature impact
