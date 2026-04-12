# 06 — Feature Impact Analysis

**Projeto:** metanoia-hub · **Fase WDS:** Phase 2 — Trigger Mapping · **Última atualização:** 2026-04-11
**Propósito:** Filtrar features herdadas do PRD e da arquitetura contra os princípios invioláveis e os 4 filtros do tom, para decidir o que entra no MVP Opção A (Release 1a + 1a-beta, Sprint 11).

> **Regra canônica (Override crítico do brief):**
> A linha estratégica (líder de grupo / loop de cuidado / radar pastoral) **governa a herança edtech do PRD**. `lovableMVP` original não governa mais prioridade. Qualquer feature herdada passa pelos 4 filtros antes de entrar.

---

## Os 4 Filtros (aplicação obrigatória por feature)

1. **Pastoral sem igrejês** — A feature respeita calor pastoral sem alienar Camada 2 (líderes e membros menos conectados ao vocabulário eclesiástico)?
2. **Radar humilde** — A feature opera dentro do *"não sei honesto"*? Distingue o que sabe do que não sabe?
3. **Dignidade antes de dado** — A feature tem zero verbos de vigilância e nunca transforma pastoreio em fiscalização?
4. **Prático, concreto, terreno** — A feature cabe no cenário-âncora (*vencer a quarta de manhã em 1–3 min no Android gama média-baixa*)?

**Se a feature falha em qualquer filtro, ela é rejeitada ou redesenhada — não negociável.**

---

## Features In-Scope (Release 1a — 6–8 semanas)

| Feature | Filtro 1 | Filtro 2 | Filtro 3 | Filtro 4 | Driving Force servida | Bounded Context |
|---|---|---|---|---|---|---|
| **Auth (Keycloak 3-layer)** | ✅ | N/A | ✅ | ✅ | Pastor+ (proteção LGPD) · Admin+ (separação de escopo) | `auth` |
| **Multi-tenant com RLS estrutural** | ✅ | N/A | ✅ | ✅ | Pastor+ · Admin+ · Participante+ (privacidade) | `tenant` |
| **Cadastro de grupos e papéis** | ✅ | N/A | ✅ | ✅ | Admin+ (onboarding previsível) · Champion+ | `groups` |
| **Trilhas básicas (conteúdo pastoral)** | ⚠️ Reescrita | N/A | ✅ | ✅ | Participante+ (jornada pessoal) | `content` |
| **Reunião (videoconferência)** | ✅ | N/A | ✅ | ✅ | Líder+ (grupo-pastoral exige reunião) · Champion+ | `meetings` |
| **Audit log de acesso a dados** | ✅ | N/A | ✅ | N/A | Pastor+ · Admin+ (LGPD) | `audit` |
| **Onboarding de tenant** | ✅ | N/A | ✅ | ✅ | Admin+ · Champion+ (valor em 2 semanas) | `onboarding` |

**Nota sobre trilhas básicas:** A feature entra no Release 1a **apenas após reescrita pelos 4 filtros**. Termos como "evolua sua fé", "alcance o próximo nível", "progresso" são rejeitados. Trilhas viram **"passos concretos de próxima conversa"** em linguagem pastoral humilde.

---

## Features In-Scope (Release 1a-beta — até Sprint 11, ~5,5 meses)

**Este é o coração do MVP Opção A — o loop de cuidado provado.**

| Feature | Filtro 1 | Filtro 2 | Filtro 3 | Filtro 4 | Driving Force servida | Bounded Context |
|---|---|---|---|---|---|---|
| **Radar pastoral — detectors com auto-throttle ≥60%** | ✅ | ✅ CORE | ✅ | ✅ | Líder+ (*ver a tempo*) · Líder− (*sem falso positivo*) | `pastoral` |
| **Sinal com explicação textual** | ✅ | ✅ CORE | ✅ | ✅ | Líder+ (*clareza humilde*) · Líder− (*sem sinal-sem-explicação*) | `pastoral` |
| **Memória relacional sem gamificação** | ✅ | ✅ | ✅ | ✅ | Líder+ (*memória que protege*) | `pastoral` |
| **Loop fechado por resposta real** | ✅ | ✅ CORE | ✅ | ✅ | Primary goal direto — a "engine" | `pastoral` |
| **Tela principal do líder (1–3 min)** | ✅ | ✅ | ✅ | ✅ CORE | Líder+ (*cenário-âncora quarta-feira*) | `pastoral` / `groups` |
| **Vista agregada do pastor** | ✅ | ✅ | ✅ CORE | ✅ | Pastor+ (*visibilidade agregada digna*) · Pastor− (*desarmar medo central*) | `pastoral` / `tenant` |
| **Web push nativo (canal único)** | ✅ | ✅ (raro, contextual) | ✅ | ✅ | Líder+ (*cadência certa*) | `notifications` |
| **Cache de leitura offline + indicador temporal** | ✅ | ✅ (indicador "dados de X min atrás") | ✅ | ✅ | Líder+ (*nunca em branco*) · Líder− (*Android gama baixa*) | `pastoral` |
| **Dicionário pastoral como lint** | ✅ CORE | ✅ | ✅ | ✅ | Todos — guardrail de marca | `web` (lint) |
| **LGPD estrutural (consent + RLS + rights)** | ✅ | N/A | ✅ CORE | ✅ | Pastor+ · Admin+ · Participante+ | `tenant` / `audit` |

---

## Features EXPLICITAMENTE VETADAS (anti-princípio)

| Feature | Motivo da rejeição | Princípio violado |
|---|---|---|
| **Score único de participante** | Reduz humano a número | Princípio 2: sem score-oráculo |
| **Ranking de participantes** | Comparação entre pessoas → vigilância | Princípio 4: sem ranking |
| **Ranking de grupos** | Competição pastoral → fiscalização | Princípio 4: sem ranking |
| **Ranking de líderes** | Produtividade de voluntário → cobrança | Princípio 4: sem ranking |
| **Geolocalização** | Vigilância física · princípio-raiz | Anti-vigilância (provavelmente nunca) |
| **Câmera (presença por foto)** | Vigilância visual · princípio-raiz | Anti-vigilância |
| **Biometria** | Vigilância física · princípio-raiz | Anti-vigilância |
| **% aberturas que viram ação** | Métrica de engajamento CRM | Anti-engajamento · anti-KPI |
| **Session length como métrica** | Incentiva retenção via fadiga | Anti-hábito-leve |
| **Imperativo automatizado** (*"Envie mensagem agora"*) | Substitui discernimento pastoral | Princípio 5: sem automação substituindo discernimento |
| **Rótulo de estado espiritual** (*"frio"*, *"morno"*) | Humilhante · adjetiva humano | Tom · glossário banido |
| **Cobrança por participante** | Incentivo perverso contra cadastrar vulneráveis | Princípio de produto (flat por igreja) |
| **Tracking de terceiros** | Vigilância aplicada ao participante | Anti-vigilância estrutural |
| **Leaderboard de qualquer tipo** | Gamificação de cuidado | Princípio 8: memória relacional sem gamificação |

---

## Features CORTADAS DO MVP (adiadas, não vetadas)

| Feature | Decisão | Quando re-avaliar |
|---|---|---|
| **Offline de escrita (Service Worker completo)** | ❌ MVP | Phase 2+ (Release 1b) |
| **WhatsApp Business API** | ❌ MVP | Phase 3 (só com dados reais de uso) |
| **Busca semântica com pgvector** | ❌ MVP | Phase 5 (só com 6+ meses de dados acumulados) |
| **API pública versionada** | ❌ MVP | Phase 4 |
| **Auditoria WCAG AA formal** | ⚠️ MVP tem piso estrutural | Release 1b (Sprints 17 e 20) |
| **Apps nativos** | ❌ MVP | Só se PWA não atender — caminho preservado, não comprometido |
| **Agentic development** | ❌ MVP | Adiada — wireframes antes de código autônomo |

---

## Risk Assessment por Feature-Grupo

### 🔴 Alto risco (deve falhar o filtro se não for cuidado)

- **Trilhas pastorais herdadas do PRD** — herança edtech conflita com tom pastoral. **Mitigação:** reescrita obrigatória pelo Content Creation Workshop em Phase posterior. Até lá, trilhas entram como placeholder consciente.
- **Onboarding de participante** — risco de abandono na 1ª semana é o red flag crítico. **Mitigação:** expectativa explícita de silêncio saudável no fluxo de onboarding.

### 🟡 Risco médio (filtro passa, mas vigilância contínua necessária)

- **Radar pastoral** — tese central do produto; se plausibilidade cair abaixo de 60%, auto-throttle. **Mitigação:** monitoramento obrigatório da métrica de plausibilidade como KPI interno.
- **Vista agregada do pastor** — tentação natural de adicionar "drill-down" em participante individual. **Mitigação:** drill-down requer autorização explícita auditada.

### 🟢 Baixo risco (infraestrutura, sem dilema pastoral direto)

- Auth, multi-tenant/RLS, audit log, cache de leitura, push nativo — são infraestruturais e respeitam os princípios por design.

---

## Alinhamento com o Sprint Roadmap (PRD linha 1116)

| Sprint | Release | Foco | Features principais |
|---|---|---|---|
| **Sprint 1–8** | Release 1a | Auth, grupos, trilhas, reunião, admin | Infraestrutura + herança edtech filtrada |
| **Sprint 9–11** | Release 1a-beta | **Radar pastoral com loop de cuidado provado** | Detectors, sinais, memória relacional, loop fechado, vista do líder, vista do pastor |
| **Sprint 12+** | Release 1b | Expansão até jan/2027 | Expansão de trilhas, auditoria WCAG AA formal, offline de escrita |

---

## Related Documents

- [`00-trigger-map.md`](./00-trigger-map.md) — Hub
- [`01-business-goals.md`](./01-business-goals.md) — Goals hierarquizados
- [`05-key-insights.md`](./05-key-insights.md) — Design implications por seção
- [`../A-Product-Brief/project-brief.md`](../A-Product-Brief/project-brief.md) — Fonte canônica
- `docs/prd.md` — PRD herdado (filtrado pelos 4 filtros)
- `docs/architecture.md` — Arquitetura e bounded contexts
