# Persona Terciária — Participante

**Prioridade:** 🌱 TERTIARY TARGET · **Tipo:** Membro do grupo pequeno · beneficiário final do cuidado pastoral
**Projeto:** metanoia-hub · **Fase WDS:** Phase 2 — Trigger Mapping
**Origem:** Síntese do brief (Step 13 Content Init) · 2026-04-11

---

## Snapshot

> **Regra absoluta:** O participante é cuidado por humanos, mecanicamente lembrado por máquinas — nunca o contrário. Ele **nunca** vê ranking, nunca vê score, nunca é transformado em lead.

| Campo | Valor |
|---|---|
| **Quem é** | Membro de grupo pequeno (célula, grupo familiar, grupo de estudo) — 8–15 pessoas por grupo |
| **Papel no produto** | Beneficiário final — NÃO é comprador, NÃO é user power, é o **humano que a tese protege** |
| **Device** | Mobile simples |
| **Uso esperado** | Baixo — jornada pessoal, próximos passos, conteúdo; **não precisa** acessar o produto ativamente para ser cuidado |
| **Risco central** | Abandono na 1ª semana (onboarding frio) + sensação de vigilância (qualquer tela que pareça fiscalização) |

---

## Contexto Real

- Está em vários estados possíveis: entrando no grupo agora, participando regularmente, em crise pessoal, de férias, em luto, desligando-se silenciosamente.
- **Não quer ser monitorado.** Mesmo sem saber articular, percebe quando um sistema o trata como dado.
- Frequentemente não sabe que o radar pastoral existe — e tudo bem. A tese funciona sem que o participante precise ter awareness do produto.
- Pode ou não acessar a ferramenta. Se acessar, vai ser para conteúdo/trilhas herdadas do PRD (ajustadas pelos 4 filtros pastorais).

---

## Mental Model

- **"A igreja é pessoas, não software."** Qualquer experiência digital na igreja que não reforce isso falha.
- **"Eu tenho direito de ficar em silêncio por um tempo."** Dignidade do silêncio é direito dele.
- **"Se alguém me procurar, é porque se importou — não porque o sistema mandou."** O valor emocional está no gesto humano; o sistema tem que sumir.

---

## Positive Driving Forces

| Força | Descrição | Product Promise |
|---|---|---|
| **Sentir-se visto sem sentir-se vigiado** | Quer que um líder real note quando ele sumiu — mas com dignidade | **Loop fechado por cuidado relacional** — nunca por automação; nunca imperativo do sistema |
| **Jornada pessoal útil** | Se usar o produto, quer próximos passos concretos, conteúdo que serve | Trilhas herdadas do PRD passam pelos 4 filtros do tom antes de entrar |
| **Privacidade sobre estado interno** | Ninguém deveria saber *como ele vai* por dedução mecânica | **Princípio 1: Presença digital ≠ saúde espiritual** — radar não tenta inferir estado espiritual |
| **Direito ao silêncio saudável** | Algumas ausências são descanso, luto, trabalho — não precisam de ação | **Princípio 6: Dignidade do silêncio** |

---

## Negative Driving Forces

| Força Negativa | Descrição | Mitigação (como o produto protege o participante) |
|---|---|---|
| **Sensação de vigilância** | Qualquer tela que pareça monitorar / rastrear / supervisionar gera rejeição imediata | **Red flag absoluto:** "Participante se sentindo vigiado" = parada imediata, revisão de princípio-raiz |
| **Ser tratado como métrica** | Score, ranking, % de presença, pipeline → alienação | **Princípios 2, 4:** sem score-oráculo · sem ranking · nunca número único resume humano |
| **Ser adjetivado por estado espiritual** | Labels tipo "frio", "afastado", "morno" são humilhantes | Vetado em UI visível · lint de code review com glossário banido |
| **Fadiga de app e notificação** | Não quer mais um app chato puxando atenção | Push contextual raro · hábito leve · jornada pessoal opcional |
| **Abandono na 1ª semana** | Red flag crítico: onboarding frio = perda permanente | Onboarding com calor pastoral humilde · expectativa explícita de que silêncio é ok · primeira sessão = 2 minutos |
| **Dúvida sobre LGPD** | *"Quem vê meus dados?"* · *"O que a igreja sabe de mim?"* | Transparência total · consentimento explícito · data subject rights estrutural · RLS absoluto |

---

## Transformação (indireta — o produto transforma o cuidado que ele recebe, não ele)

**De:** Participante que sumiu em silêncio 3 semanas atrás e ninguém notou até que virasse oficial o afastamento — recebendo depois, se receber, um contato tardio que soa a "check-list de retenção".

**Para:** Participante que, na segunda semana de silêncio, recebeu uma mensagem curta e real de um líder que se importou genuinamente — sem saber se foi o radar ou a memória que puxou o gatilho, e sem que isso importe, porque quem falou foi uma pessoa, não um sistema.

---

## UX Implications

- **Minimizar a presença ativa do participante na ferramenta.** Se ele usar, ótimo; se não, o produto funciona pelo cuidado relacional dos líderes.
- **Se houver UI para participante:** mobile simples, zero métrica visível, zero comparação com outros, zero gamificação.
- **Jornada de conteúdo** (trilhas herdadas do PRD) reescrita para passar nos 4 filtros de tom (pastoral, humilde, dignidade, prático) — nada de "evolua sua fé" ou "alcance o próximo nível".
- **Consentimento explícito** para qualquer dado coletado · política de export/delete em linguagem humana · logs de acesso auditáveis.
- **Child safety** herdado do PRD (epic 13) como constraint permanente.
- **Zero tracking de terceiros** (anti-vigilância aplicada também ao usuário final do tenant).

---

## Related Documents

- [`../00-trigger-map.md`](../00-trigger-map.md)
- [`../01-business-goals.md`](../01-business-goals.md)
- [`02-primary-persona-lider-de-grupo.md`](./02-primary-persona-lider-de-grupo.md)
