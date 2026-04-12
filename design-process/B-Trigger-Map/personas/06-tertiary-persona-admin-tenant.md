# Persona Terciária — Admin de Tenant

**Prioridade:** 🛠️ TERTIARY TARGET · **Tipo:** Apoio administrativo · escopo mínimo mas crítico no MVP
**Projeto:** metanoia-hub · **Fase WDS:** Phase 2 — Trigger Mapping
**Origem:** Síntese do brief (Step 13 Content Init) · 2026-04-11

---

## Snapshot

| Campo | Valor |
|---|---|
| **Quem é** | Pessoa responsável por configurar e manter a conta da igreja no metanoia-hub (muitas vezes secretária/assistente do pastor) |
| **Papel no produto** | Cadastro, RLS, configurações, convites, governança técnica |
| **O que NÃO vê** | **Dados pastorais** de grupos ou participantes (salvo quando explicitamente autorizado caso a caso) |
| **Device** | Desktop denso |
| **Cadência** | Alta na 1ª semana (onboarding) · baixa depois (ocasional — quando há líder novo, quando muda o plano, quando há questão LGPD) |

---

## Contexto Real

- Não é pastor. Pode ser a secretária, o tesoureiro, um voluntário técnico, o próprio pastor titular fazendo dupla função.
- **Crítico no onboarding:** se ele trava, a igreja inteira trava. Se ele desiste, o tenant zumbifica.
- Precisa entender a hierarquia de papéis (pastor titular, champion, líder, participante) e configurar corretamente — sem virar especialista em RBAC/RLS.
- Recebe perguntas do pastor sobre LGPD, privacidade, export/delete — precisa conseguir responder com confiança.

---

## Mental Model

- **"Eu cuido da infraestrutura, não do pastoreio."** Quer instalar e sair do caminho.
- **"Se alguém me perguntar sobre dados, eu preciso saber responder."** LGPD é obrigação dele na prática.
- **"Eu não quero saber o que os líderes estão vendo."** Separação de escopo é confortável para ele também.
- **"Se eu errar configuração, a culpa é minha."** Ansiedade com decisões irreversíveis.

---

## Positive Driving Forces

| Força | Descrição | Product Promise |
|---|---|---|
| **Onboarding previsível** | Quer um caminho claro, passo a passo, com estimativas reais de tempo | Ativação ≤7 dias · onboarding self-service com checkpoints |
| **Separação de escopo confortável** | Quer fazer seu trabalho técnico sem acessar dados pastorais sensíveis | RLS estrutural · admin **não vê** dados pastorais salvo autorização explícita |
| **Respostas prontas sobre LGPD** | Quer conseguir responder "quem vê o quê", "como exportar", "como deletar" sem virar advogado | Documentação técnica em linguagem humana · política de dados visível · logs auditáveis |
| **Reversibilidade de configuração** | Não quer ter medo de errar · quer poder desfazer | Configurações com undo · avisos claros antes de ações destrutivas |
| **Não virar bode expiatório** | Se algo der errado, quer ter histórico claro do que foi feito | Audit log de ações administrativas |

---

## Negative Driving Forces

| Força Negativa | Descrição | Mitigação |
|---|---|---|
| **Complexidade de RBAC/RLS** | Se tiver que entender multi-tenant hierárquico no nível técnico, desiste | **Abstração amigável:** "quem pode ver quem" em linguagem humana, não em ACLs |
| **Medo de vazar dados** | Ansiedade com LGPD · medo de configurar mal e expor participantes | Defaults seguros · RLS absoluto desde o primeiro commit · onboarding não permite estados inválidos |
| **Dependência técnica externa** | Se precisar chamar TI da igreja, o deal para | Zero dependência externa crítica no Release 1a (PRD linha 932) · autosserve total |
| **Interface sobrecarregada** | Desktop denso é bem-vindo, mas sobrecarregado não é | Denso **e** organizado · filtros claros · pesquisa global |
| **Falta de suporte humano** | Igreja local desconfia de chat de IA; quer gente real | Suporte humano real · canal pastoral de dúvidas (não ticket frio) |

---

## Transformação

**De:** Assistente/tesoureiro que instalou ferramentas de igreja anteriormente, queimou-se com alguma configuração ruim, desconfia de qualquer nova plataforma, tem medo de errar LGPD.

**Para:** Admin que instalou o metanoia-hub em 4 dias, configurou os 5 líderes, confirmou o RLS, respondeu à pergunta do pastor sobre exportação de dados em 30 segundos lendo a página de LGPD, e pode voltar a focar nas outras 20 coisas que fazem parte do trabalho dele.

---

## UX Implications

- **Desktop denso explicitamente projetado** — alta densidade de informação é um valor, não um defeito, nessa área
- **Admin area pode relaxar o atributo 4 do tom (prático, concreto, terreno)** — mais técnico, mais funcional — **mas nunca relaxa 1, 2, 3** (pastoral, humilde, dignidade)
- **Zero jargão CRM** (não porque o admin se importa, mas porque se ele vir isso, a desconfiança contamina a percepção do pastor)
- **Página de LGPD em linguagem humana** — consulta-pronta pelo admin quando o pastor perguntar
- **Audit log visível e buscável** · reversibilidade · defaults seguros
- **Onboarding com estimativas reais de tempo** (ex: *"Configurar grupos — 10 min · Convidar líderes — 5 min por líder"*)

---

## Related Documents

- [`../00-trigger-map.md`](../00-trigger-map.md)
- [`../01-business-goals.md`](../01-business-goals.md)
- [`03-secondary-persona-pastor-titular.md`](./03-secondary-persona-pastor-titular.md)
