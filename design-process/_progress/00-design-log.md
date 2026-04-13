# Design Log — metanoia-hub

## Phase 0: Project Setup

| Item | Valor |
|------|-------|
| Data | 2026-04-09 |
| Status | Completo |
| Tipo | Greenfield |
| Complexidade | Complex (Web Application) |
| Tech Stack | React/Next (Next.js 16.2) |
| Component Library | shadcn/ui |
| Brief Level | Complete |
| Strategic Analysis | Full Trigger Map |
| Stakes | Enterprise |
| Materiais Existentes | PRD, Architecture, Project Context, UX Spec |

### Decisões
- Pasta raiz: `design-process/`
- Phase 5 (Agentic Development) adiada — wireframes antes de implementação
- Stakeholders: pendente definição

### Próximo Passo
- Phase 1: Product Brief (agente Saga) — EM ANDAMENTO

---

## Phase 1: Product Brief (Sessão 1)

| Item | Valor |
|------|-------|
| Data | 2026-04-09 |
| Status | Completo (2026-04-11) |
| Agente | Saga |

### Steps Completos
- Step 01 (Init): Completo
- Step 02 (Vision): Completo — visão sintetizada e confirmada
- Step 03 (Positioning): Completo — posicionamento sintetizado e confirmado
- Step 05 (Business Model): Completo — B2B SaaS freemium confirmado
- Step 06 (Business Customers): Completo — ICP primário igreja local evangélica 40–100p; flat fee por igreja (não por participante); **líder de grupo como usuário crítico** (regra de ouro do produto)
- Step 07 (Target Users): Completo — 4 perfis comportamentais definidos; líder de grupo com profundidade máxima; **mobile-first + hybrid-first + "vencer a quarta-feira de manhã no celular"** como diretrizes de MVP; 10 decisões permanentes derivadas (radar não é veredito, desarmar vigilância, neutra com calor pastoral, etc.)
- Step 07a (Product Concept): Completo — **Core Structural Idea: "radar pastoral, radar-first mas não radar-only"**; 2 filtros de decisão (valor + atrito); 2 princípios estruturais (confiabilidade humilde + loop fechado por cuidado); unidade mínima de valor = "cuidado acionado com contexto e confirmado por alguma resposta real"
- Step 08 (Success Criteria): Completo (2026-04-11) — **North Star de Produto:** `% semanas-líder com ≥1 ação orientada pelo radar em ≤48h`; **North Star de Negócio:** `% igrejas Pro renovadas com uso saudável`; **contra-métrica:** `% igrejas zumbis`. 4 ângulos sintetizados (comportamento, negócio, experiência, timeline). 9 princípios invioláveis hierarquizados com **"presença digital ≠ saúde espiritual"** como princípio-raiz. Timeline em 4 fases (Discovery 0–3m / MVP 3–9m / Validação 9–18m / Tração 18m+) com exigibilidade diferenciada: valor e segurança exigíveis cedo, retenção e economia exigíveis tarde
- Step 09 (Competitive Landscape): Completo (2026-04-11) — 4 alternativas reais mapeadas (A1 stack fragmentado WhatsApp+Drive+cabeça / A2 improviso manual / A3 software de igreja parcial / A4 ferramentas primas descartadas). WhatsApp classificado como **aliado-infraestrutura**, não inimigo. Do-nothing puro descrito como estado **híbrido** (transitório→permanente). **Vantagens injustas hierarquizadas:** 🏴 C4 Loop fechado por cuidado (bandeira principal) → 🏳️ C3 Foco radical no líder de grupo (bandeira secundária) → 🧱 C1+C6 dicionário + **modelo conceitual próprio de cuidado pastoral** (prova estrutural) → 🛡️ C2 Confiabilidade humilde (guardrail) → 🏛️ C5 Sensibilidade pastoral (ativo a institucionalizar). Reality Check 3 ataques: Planning Center 🟡 parcial (maior risco real), inChurch 🟡 parcial, Disciple.Tools 🟢 forte por segmentação. **5 constraints emergentes** pré-alimentam Step 10: radar além de attendance, valor-principal com líder não com supervisão, categoria nomeada cedo, UX absurdamente simples, institucionalizar modelo conceitual antes da interface ser copiada. Postura declarada: *"não vem cobrar um líder omisso; vem sustentar um líder que já não consegue ver tudo sozinho"*. Auto-checagem: nenhuma decisão contradiz os 9 princípios do Step 08.

- Step 10 (Constraints): Completo (2026-04-11) — **Override crítico pastoral × edtech travado**: a linha estratégica do brief (líder de grupo / loop de cuidado / radar pastoral) passa a governar a herança edtech do PRD (trilhas, conteúdo, gamificação). **MVP Opção A travada** = Release 1a + 1a-beta (auth + grupos + reunião + radar pastoral) com loop de cuidado provado no Sprint 11 (~5,5 meses). MVP estendido = Release 1b até jan/2027. Constraints documentadas em 4 categorias (Timeline 4 fases, Budget/Equipe founder-led bootstrap 1–2 devs + IA, Technical web-first PWA-ready + Keycloak + videoconferência obrigatória + VPS self-managed + LGPD estrutural, Brand dicionário pastoral anti-CRM) + 5 **Defensibilidade constraints** elevadas a parâmetros permanentes (radar além de attendance, valor-principal com líder, categoria nomeada cedo, UX absurdamente simples, institucionalizar modelo conceitual antes da interface). Notas: **lovableMVP do PRD não governa mais prioridade** (override explícito); **child_safety herdado como constraint funcional** do epic 13. Auto-checagem: 9 princípios do Step 08 preservados.

- Step 10a (Platform & Device Strategy): Completo (2026-04-11) — **Responsive Web App Next.js 16.2 híbrido SSR+CSR + PWA-ready desde o MVP, codebase único, sem loja de app.** Mobile-first não mobile-only: primária Android gama média-baixa (líder), secundária desktop (pastor/admin com densidade invertida), terciária tablet. **Três decisões travadas:** (1) **Offline** — cache de leitura no MVP (radar nunca em branco + indicador "dados de X min atrás"), offline de escrita pós-MVP; (2) **Push** — web push nativo como canal único no MVP, constraint iOS documentada, monitoramento obrigatório de taxa de entrega por plataforma, WhatsApp Business API só na Phase 3 com dados reais; (3) **WCAG AA** — piso estrutural no Release 1a (shadcn/ui + Radix + tokens + semáforo redundante cor+ícone+texto), piso auditado formal na Release 1b (Sprints 17 e 20 reservados). Features nativas cortadas no MVP: câmera, geolocalização (anti-princípio vigilância), biometria. Caminho para nativo preservado via monorepo + packages/types. Auto-checagem: 9 princípios preservados.

- Step 11 (Tone of Voice): Completo (2026-04-11) — **4 atributos de tom travados, cada um protegendo contra um modo de falha específico** (ordem canônica de identitário→operacional): (1) **Pastoral sem igrejês** — calor sem jargão de púlpito, protege contra alienar Camada 2; (2) **Humilde sobre o que o radar sabe** (shorthand "radar humilde") — observa não diagnostica, protege contra falso positivo destruir confiança; (3) **Dignidade antes de dado** — zero verbos de vigilância, protege contra linguagem fiscalizadora que mataria a tese; (4) **Prático, concreto, terreno** — frases curtas, verbos de ação pastoral real, protege contra fluff inspiracional. **Glossário banido permanente** em 5 categorias: CRM/vendas (lead, pipeline, engajamento como substantivo humano, KPI, dashboard, retention, follow-up…), igrejês (amado, abençoado, irmão vocativo, rebanho, ovelha, alma, unção…), vigilância (monitorar, rastrear, supervisionar…), fluff corporativo (jornada, transformação, impacto, ecossistema…), concorrente/escolar (**célula**, **relatório** como label visível ao líder, **frequência** como proxy de presença). **Precisão temporal do radar mantida** ("Faz 2 semanas que o Pedro não aparece. Vale uma mensagem?"): linha vermelha está no verbo que segue (pergunta ≠ instrução), não no fato temporal — lembrar por ele *é o produto*. **Calibração do primeiro registro:** frase de reforço "Pequenas coisas assim é que sustentam o grupo" restrita a one-shot no primeiríssimo registro; dia a dia só "Guardei." ou "Anotado.". **Implicações permanentes:** `apps/web/messages/pt-BR.json` é fonte única + glossário banido vira lint de code review + label `copy-review` em toda PR que toca copy visível + atributo 4 pode relaxar na admin area (atributos 1–3 nunca relaxam). **Regra de ouro única:** *"Toda microcopy passa se um líder cansado na quinta à noite achar que foi escrita por outro líder cansado — e não por um consultor, um pastor de palco, ou um CRM de vendas."* Auto-checagem: 9 princípios do Step 08 preservados.

- **Step 12 (Create Product Brief): Completo (2026-04-11)** — **Brief canônico gravado em `design-process/A-Product-Brief/project-brief.md`** consolidando os Steps 02–11 em 16 seções narrativas (Strategic Summary, Vision, Positioning, Business Model, Business Customer Profile, User Profile, Success Criteria, Competitive Landscape, Unfair Advantage, Constraints, Platform & Device Strategy, Tone of Voice, Additional Context, Business Context, Next Steps, Auto-checagem). **4 correções factuais aplicadas após revisão do usuário contra PRD e architecture:** (1) **Pricing** — Pro R$ 99/mês declarado como âncora publicada vigente no PRD; revisão WDS Step 06 para R$ 149–299/mês registrada como proposta não canonizada; (2) **pgvector** — reformulado como "extensão preparada no MVP, zero modelagem até Phase 5" conforme `architecture.md` linhas 299/379/1531; (3) **MVP Opção A** — ancorada explicitamente ao sprint roadmap como "Release 1a + 1a-beta, entrega no Sprint 11 ~semana 22, ~5,5 meses"; (4) **Vantagens C1–C6** — legenda de 6 linhas adicionada antes da hierarquia de defensibilidade, expandindo cada código para leitores novos. Auto-checagem final: 9 princípios invioláveis do Step 08 + 4 atributos de tom do Step 11 preservados em todas as seções.

### Próximo Step
- **Step 13 — Content Init** (abre WDS Phase 2: Trigger Mapping — agente Saga)

### Artefatos
- `design-process/A-Product-Brief/project-brief.md` — **brief canônico** (gerado no Step 12, fundação estratégica para todas as fases seguintes)
- `design-process/A-Product-Brief/session-01-progress.md` — registro completo das sínteses dos Steps 02–11

---

## Phase 2: Trigger Mapping (Step 13 — Content Init)

| Item | Valor |
|------|-------|
| Data | 2026-04-11 |
| Status | Completo |
| Agente | Saga (modo autônomo) |
| Caminho de execução | `step-00a-documentation-synthesis` (síntese a partir de docs existentes, não workshop do zero) |

### Fontes sintetizadas
- `design-process/A-Product-Brief/project-brief.md` — brief canônico (Phase 1, 77KB, input principal)
- `docs/prd.md` — PRD herdado (cross-check, filtrado pelos 4 filtros de tom)
- `docs/architecture.md` — bounded contexts e decisões técnicas (cross-check)

### Decisões autônomas tomadas
1. **Champion promovido a persona secundária própria** (em vez de subagrupado com líder) — justificativa: papel distinto no ciclo de compra (descobre → apresenta → defende)
2. **Admin promovido a persona terciária com documento próprio** — justificativa: risco crítico de onboarding mesmo com escopo mínimo
3. **Feature impact analysis em granularidade de bounded context** — evitado inventar features fora do brief/PRD/architecture
4. **Preço revisado R$ 149–299 documentado como ambiguidade explícita** (R$ 99 permanece âncora pública vigente até PRD ser atualizado)
5. **Menu halts da skill tratados como auto-[C]** — Paulo preferiu autonomia a facilitação passo-a-passo

### Strategic alignment check
- Vision do brief preservada verbatim ✅
- 9 princípios invioláveis respeitados em todas as personas ✅
- Glossário banido respeitado (ocorrências apenas em meta-referências/rejeições) ✅
- 4 filtros do tom aplicados ao feature-impact-analysis ✅
- MVP Opção A (Release 1a + 1a-beta, Sprint 11) como âncora cruzável ✅
- Override crítico respeitado (linha pastoral governa herança edtech) ✅
- North Stars canônicas como business objectives ✅
- Contra-métrica (% igrejas Pro zumbis) preservada ✅
- Red flags com janelas temporais preservadas ✅
- Princípio-raiz ("Presença digital ≠ saúde espiritual") visível no hub e nos insights ✅

### Artefatos
```
design-process/B-Trigger-Map/
├── 00-trigger-map.md                             (hub com diagrama Mermaid)
├── 01-business-goals.md                          (vision, positioning, 3 tiers, flywheel, métricas)
├── 05-key-insights.md                            (development focus, CSFs, design implications)
├── 06-feature-impact-analysis.md                 (features filtradas pelos 4 filtros + princípios)
├── _synthesis-from-docs.md                       (log Step 13: origem, gaps, alignment)
└── personas/
    ├── 02-primary-persona-lider-de-grupo.md      ⭐ primary user crítico
    ├── 03-secondary-persona-pastor-titular.md    (buyer)
    ├── 04-secondary-persona-champion.md          (líder de discipulado)
    ├── 05-tertiary-persona-participante.md       (beneficiário final)
    └── 06-tertiary-persona-admin-tenant.md       (apoio administrativo)
```

### Próximo Step
- **Phase 3 — UX Scenarios** (`design-process/C-UX-Scenarios/`) — cenário-âncora canônico: *"vencer a quarta-feira de manhã no celular"*. O trigger map desta phase é input direto para cenários de uso concretos.

---

## Phase 3: UX Scenarios

| Item | Valor |
|------|-------|
| Data | 2026-04-12 |
| Status | Completo |
| Agente | Saga (Scenario Outline) |
| Cenários | 9 cenários cobrindo 38 páginas |
| Qualidade | Bom (todos acima dos thresholds mínimos; cenário 01 Excelente) |

### Steps Completos
- Step 01 (Load Context): brief canônico + trigger map + 5 personas + design log
- Step 02 (Analyze Scope): 38 páginas, Medium scale, Suggest mode, Mixed format
- Step 03 (Build Strategic Context): 9 chains, coverage 38/38
- Step 04 (Suggest Scenarios): 9 cenários aprovados, modo checkpoint por cenário
- Step 05 (Outline Scenarios): 9/9 outlines completos (formato adaptado Q1-Q8 + release gate + DDRs + tone audit)
- Step 06 (Generate Overview): hub `00-ux-scenarios.md` com summary table, coverage matrix, 17 débitos, 11 padrões
- Step 07 (Quality Review): 5 validadores aplicados, Opção A (appendix fora do escopo de brevidade), todos passam
- Step 08 (Design Log): esta entrada
- Step 09 (Handover): prep Phase 4

### Artefatos
- `C-UX-Scenarios/00-ux-scenarios.md` — Hub (summary table + coverage matrix + 17 débitos consolidados)
- `C-UX-Scenarios/01-lider-vence-a-quarta-de-manha.md` — Cenário âncora ⭐
- `C-UX-Scenarios/02-lider-roda-reuniao-e-fecha-loop.md` — Meeting + reflection loop
- `C-UX-Scenarios/03-pastor-abre-vista-agregada.md` — Supervisão pastoral agregada
- `C-UX-Scenarios/04-champion-descobre-apresenta-e-ativa.md` — Funnel discovery + apresentação
- `C-UX-Scenarios/05-admin-faz-onboarding-minimo.md` — Onboarding ≤10min (2 variantes)
- `C-UX-Scenarios/06-participante-recebe-cuidado-com-dignidade.md` — Primeiro contato digno
- `C-UX-Scenarios/07-lider-recupera-acesso.md` — Password recovery (FR83/Story 2.9)
- `C-UX-Scenarios/08-usuario-troca-de-igreja.md` — Tenant switching multi-igreja
- `C-UX-Scenarios/09-super-admin-opera-plataforma.md` — Operação + provisionamento

### Decisões-chave

| Data | Decisão | Fase | Participantes |
|------|---------|------|---------------|
| 2026-04-11 | FR60 (dashboard agregado) promovido para Release 1a-beta (Opção A endossada) | Phase 3: Scenarios | Saga + Paulo |
| 2026-04-11 | Champion promovida como persona-satélite (não existia no PRD) | Phase 3: Scenarios | Saga + Paulo |
| 2026-04-11 | Sales-led (Opção A) para R1a, self-serve retorna R1b (divergência informada do PRD) | Phase 3: Scenarios | Saga + Paulo |
| 2026-04-12 | FR83 + Story 2.9 criados (password recovery — gap descoberto pelo processo) | Phase 3: Scenarios | Saga + Paulo |
| 2026-04-12 | Rótulos semânticos como padrão quando numeração #N não verificada em disco | Phase 3: Scenarios | Saga + Paulo |
| 2026-04-12 | Quality Review Opção A: seções suplementares como appendix fora da rubric de brevidade | Phase 3: Scenarios | Saga + Paulo |

### Summary
9 cenários sunshine-path cobrindo 5 personas (Líder ⭐, Admin Tenant [Pastor + Onboarding], Champion†, Participante, Super Admin) e 38 páginas. †Champion = persona-satélite. Formato adaptado com release gate audit + DDRs + tone audit integrados para fact-checking rigoroso contra PRD/Epics reais. 17 débitos/DDRs consolidados cross-outline. 11 padrões de rigor emergidos como regras permanentes. Padrão emergente: outlines funcionam como **ferramenta de fact-checking** — FR83/Story 2.9 (password recovery) criados como gap descoberto naturalmente ao narrar a experiência.

### Próximo Step
- ~~Phase 4 — UX Design~~ ✅ Iniciado

---

## Phase 4: UX Design

| Item | Valor |
|------|-------|
| Data | 2026-04-12 |
| Status | Em andamento |
| Agente | Freya (WDS-4 Suggest mode) |
| Cenário ativo | 01 — Líder vence a quarta de manhã |

### Backlog

- [x] Cenário 01: Líder vence a quarta de manhã (5 páginas) ✅ 2026-04-13
- [x] Cenário 05: Admin faz onboarding mínimo — variante 1a-beta (5/9 páginas) ✅ 2026-04-13 · 1b adiada
- [ ] Cenário 02: Líder roda reunião e fecha loop (3 páginas)
- [ ] Cenário 03: Pastor abre vista agregada (4 páginas)
- [ ] Cenário 06: Participante recebe cuidado com dignidade (5 páginas)
- [ ] Cenário 07: Líder recupera acesso (5 páginas)
- [ ] Cenário 08: Usuário troca de igreja (4 páginas)
- [ ] Cenário 09: Super Admin opera plataforma (4 páginas)
- [ ] Cenário 04: Champion descobre, apresenta e ativa (10 páginas)

### Current

| Task | Cenário | Página | Iniciado |
|------|---------|--------|----------|
| Page context + design | 01 | 01.2-tela-principal-lider | 2026-04-12 |

### Design Loop Status

| Cenário | Página | Nome | Status | Data |
|---------|--------|------|--------|------|
| 01 | 01.1 | Login Líder | specified-light | 2026-04-12 |
| 01 | 01.2 | Tela Principal Líder | specified | 2026-04-12 |
| 01 | 01.3 | Detalhe do Sinal | specified | 2026-04-12 |
| 01 | 01.4 | Perfil Participante | specified | 2026-04-13 |
| 01 | 01.5 | Loop Fechado | specified | 2026-04-13 |
| 05 | 05.1 | Aceite do Convite | specified | 2026-04-13 |
| 05 | 05.2 | Termos e LGPD | specified | 2026-04-13 |
| 05 | 05.3 | Criar Conta Admin | specified | 2026-04-13 |
| 05 | 05.4 | Boas-vindas e Demonstração | specified | 2026-04-13 |
| 05 | 05.5 | Criar Primeiro Grupo | specified | 2026-04-13 |

### Log

- 2026-04-12: Phase 4 iniciada. Cenário 01 (Líder vence a quarta de manhã) selecionado como âncora. Modo Suggest.
- 2026-04-12: 01.1 Login Líder — spec leve (passthrough). Login é infraestrutura implementada (Stories 2.1/2.2). Documentados 2 estados (sessão ativa/expirada) + redirect via ExperienceResolver para `/app/gestao/radar`.
- 2026-04-12: 01.2 Tela Principal Líder — **specified** (Steps 01–09 completos). 14 componentes, 35 translation keys, 10 page states, 12 spacing objects, 21 typography tokens. Decisões-chave: SemaforoPills como elemento estrutural (Direção A do UX Spec), densidade adaptativa de cards (expanded/medium/compact), Improviso Sagrado respeitado (sugestões pastorais removidas do R1a-beta), compressão tipográfica mobile (H1 20px/600 em ≤360px, restaura 30px/700 em ≥lg), ReturnBanner para ausência >5d, filtro excludente triple-state nas pills. 6 componentes candidatos a design system (SemaforoPill, ParticipantCard, GrupoPill, InboxZeroState, SectionStableResume, ReturnBanner).
- 2026-04-12: 01.3 Detalhe do Sinal — **specified** (Steps 01–09 completos). 13 componentes, 30 translation keys, 7 page states, 10 spacing objects, 16 typography tokens. Decisões-chave: divisão "o que viu / o que não sabe" (materialização do radar humilde), ObservedFact 16px como conteúdo primário vs SystemLimitation 14px+muted, LastCareRecord condicional (contexto relacional mínimo), PresenceDots (timeline visual sem números), estado "Signal resolved" (race condition → celebração pastoral), atalho 01.3→01.5 (mesmo padrão da 01.2), hierarquia de rotas `/radar/{id}/perfil` e `/radar/{id}/cuidado`. 2 componentes novos candidatos a design system (PresenceDots, SignalExplanation).
- 2026-04-13: 01.4 Perfil Participante — **specified** (Steps 01–09 completos). 14 componentes, 22 translation keys (14 novas + 8 reutilizadas), 6 page states, 10 spacing objects, 17 typography tokens. Decisões-chave: memória relacional mínima (última conversa, última oração, próximo marco) como conteúdo core, condicionais sem placeholder (padrão 01.3 consolidado), empty state empático ("Ainda não há registros — esta pode ser a primeira conversa"), memory note a 16px (destaque para frase do próprio líder), PresenceDots reutilizado da 01.3 (sempre visível, dados do sistema), CTA único "Registrar cuidado" (sem "Ver essa pessoa" — já estamos no perfil), Improviso Sagrado mantido (zero imperativo). 2 componentes novos candidatos a design system (RelationalMemoryCard, EmptyMemoryState).
- 2026-04-13: 01.5 Loop Fechado — **specified** (Steps 01–09 completos). 15 componentes, 24 translation keys (20 novas + 4 reutilizadas), 7 page states, 9 spacing objects, 14 typography tokens. Decisões-chave: campo frase livre 280 chars (sem tags, sem categorias no MVP), textarea 16px (evita iOS auto-zoom), auto-focus (teclado abre na entrada), confirmação seca "Obrigado. Vemos você quinta." (variante dinâmica com dia da reunião), abandon dialog para proteger texto não-salvo, botão save com feedback visual (disabled→spinner→confirmation), full-page takeover no estado de confirmação, domain event `radar.action.recorded` documentado, API contract POST `/api/v1/care-actions` → 201. 3 componentes novos candidatos a design system (CareFormField, ConfirmationPage, AbandonDialog). **Cenário 01 completo — 5/5 páginas specified.**
- 2026-04-13: Cenário 05 (Admin faz onboarding mínimo) — **variante 1a-beta completa** (5/5 páginas specified). Desktop-first wizard linear. Resumo por página:
  - 05.1 Aceite do Convite: 6 componentes, 16 keys, 6 states. Token de uso único (7 dias), rota pública, zero campos. Design system: OnboardingPageLayout, TokenErrorState.
  - 05.2 Termos e LGPD: 8 componentes, 17 keys, 4 states. Resumo pastoral em 4 bullets ("Seus dados pertencem à sua igreja"), texto legal scrollável, checkbox LGPD-compliant (nunca pré-marcado). Design system: LegalAcceptanceBlock, PastoralSummaryCard.
  - 05.3 Criar Conta Admin: 10 componentes, 28 keys, 7 states. 4 campos mínimos (nome, email, senha, igreja) + Google OAuth. Keycloak cria user + role Admin Tenant + tenant com RLS. Design system: FormField, OAuthButton, OAuthDivider.
  - 05.4 Boas-vindas + Demo: 8 componentes, 18 keys, 4 states. Momento "wow" — radar de demonstração com 3 cards (Story 7.2). AdminSidebar introduzida. Route guard single-use. Design system: AdminSidebar, DemoRadarCard, WelcomeHero.
  - 05.5 Criar Primeiro Grupo: 9 componentes, 24 keys, 6 states. 3 campos (nome obrigatório, descrição opt, horário opt) + selfAdd checkbox (pré-marcado). Evento `tenant.activation.primary` disparado. NFR-X1 ≤10 min cumprido. Design system: GroupForm, ScheduleInlineField.
  **Variante 1b (wizard guiado, páginas 05.6–05.10) adiada para Release 1b sprint planning.**

---
