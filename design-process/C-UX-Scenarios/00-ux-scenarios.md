# UX Scenarios: metanoia-hub

> Scenario outlines connecting Trigger Map personas to concrete user journeys

**Created:** 2026-04-12
**Author:** squad1promoacao with Claude Code
**Method:** Whiteport Design Studio (WDS) — Phase 3: UX Scenarios

---

## Scenario Summary

| ID | Scenario | Persona | Pages | Priority | Status |
|----|----------|---------|-------|----------|--------|
| 01 | Lider vence a quarta de manha | Lider de Grupo | 5 | ⭐ P1 | ✅ Outlined |
| 02 | Lider roda reuniao e fecha loop | Lider de Grupo | 3 | ⭐ P1 | ✅ Outlined |
| 03 | Pastor abre vista agregada | Pastor Titular (Admin Tenant) | 4 | ⭐ P1 | ✅ Outlined |
| 04 | Champion descobre, apresenta e ativa | Champion | 7 (+3 paralelas) | P2 | ✅ Outlined |
| 05 | Admin faz onboarding minimo | Admin Tenant | 9 | P2 | ✅ Outlined |
| 06 | Participante recebe cuidado com dignidade | Participante | 5 (semantico) | P2 | ✅ Outlined |
| 07 | Lider recupera acesso | Lider de Grupo | 5 (semantico) | P2 | ✅ Outlined |
| 08 | Usuario troca de igreja | Lider de Grupo (universal) | 4 (semantico) | P2 | ✅ Outlined |
| 09 | Super Admin opera plataforma | Super Admin | 4 (semantico) | P2 | ✅ Outlined |

**Nota:** outlines 01-05 usam numeracao provisoria `#N` para telas. Outlines 06-09 usam **rotulos semanticos** (padrao 11) por ausencia de inventario canonico em disco. A consolidacao de numeracao unificada deve ocorrer neste hub ou no Phase 4.

---

## Scenarios

### [01: Lider vence a quarta de manha](01-lider-vence-a-quarta-de-manha.md)
**Persona:** Lider de Grupo (Marcos) — *"Descobrir em 30s quem precisa de atencao esta semana"*
**Pages:** #10 Radar Pastoral, #16 Dashboard Lider, #17 Detalhe Participante, #18 Acao de Cuidado, #22 Sinal Prioritario
**User Value:** Em menos de 3 min, lider sai com acao concreta de cuidado
**Business Value:** Pastoral Radar entrega visibilidade acionavel sem visar fiscalizacao

---

### [02: Lider roda reuniao e fecha loop](02-lider-roda-reuniao-e-fecha-loop.md)
**Persona:** Lider de Grupo (Marcos) — *"Rodar o encontro presente na sala, nao na tela"*
**Pages:** #19 Agenda/Sala LiveKit, #20 Presenca Automatica, #21 Reflexao Pos-Reuniao
**User Value:** Ao sair da reuniao, lider tem observacoes salvas enquanto memoria esta viva
**Business Value:** Pastoral Radar se alimenta do encontro real, nao de formulario pos-fato

---

### [03: Pastor abre vista agregada](03-pastor-abre-vista-agregada.md)
**Persona:** Pastor Titular / Admin Tenant — *"Sair em 10 min com clareza de qual lider procurar"*
**Pages:** #23 Vista Agregada Tenant, #24 Drill-down Grupo, #25 Drill-down Lider, #26 Outreach Intent
**User Value:** Em 10-15 min, pastor sai com 1-2 nomes e pergunta de abertura para conversa pastoral
**Business Value:** Pastor enxerga o cuidado acontecendo sem virar auditor

---

### [04: Champion descobre, apresenta e ativa](04-champion-descobre-apresenta-e-ativa.md)
**Persona:** Champion (Julia, lider apaixonada) — *"Achar manifesto que bate com lingua materna pastoral"*
**Pages:** #1 Landing, #5 Manifesto Pastoral, #3 Features, #8 Estudo de Caso, #2 Pricing, #27 Apresentacao Curada (Deck Light), #9 Trial/Demo — Paralelas: #4 Sobre, #6 Blog, #7 Contato
**User Value:** Domingo: curiosidade validada. Segunda: email ao pastor com apresentacao curada sem precisar escrever nada
**Business Value:** Champion entra com ambicao de apresentar ao Pastor e sai com municao curada

---

### [05: Admin faz onboarding minimo](05-admin-faz-onboarding-minimo.md)
**Persona:** Admin Tenant (Ricardo/Claudia) — *"Em ≤10 min ver radar funcionando"*
**Pages:** #12 Welcome Screen, #13 Demo Data, #15 Configuracao Tenant, #28 Wizard Step Perfil, #29 Wizard Step Comunidade, #30 Criar Grupo, #31 Convidar Lider, #32 Cadencia de Encontros, #33 Radar Demo, #34 Checklist Onboarding
**User Value:** Em ≤10 min: conta criada, tenant ativo, 1 grupo, radar com dados demo visiveis
**Business Value:** Onboarding minimo e ponte que atravessa, nao labirinto que prende

---

### [06: Participante recebe cuidado com dignidade](06-participante-recebe-cuidado-com-dignidade.md)
**Persona:** Participante (Juliana) — *"Ser notada, ser lembrada, ser acolhida com dignidade"*
**Pages (semanticas):** Email Transacional de Convite, Tela de Aceite de Convite, OAuth Google, Lista dos Meus Grupos, Detalhe do Meu Grupo
**User Value:** Juliana sente que o grupo se importa com ela como pessoa inteira, nao como metrica
**Business Value:** Cuidado pastoral acontece em contexto de presenca digital, nao apesar dela

---

### [07: Lider recupera acesso](07-lider-recupera-acesso.md)
**Persona:** Lider de Grupo (Marcos) — *"Entrar rapido e ver radar antes do trabalho como sempre"*
**Pages (semanticas):** Tela de Login, Tela de Recuperacao de Senha, Email de Reset, Tela de Nova Senha, Tela Principal Lider
**User Value:** Em ≤3 min, lider volta a ver o radar sem perder ciclo pastoral da semana
**Business Value:** Perda de credenciais nunca quebra o ciclo pastoral semanal

---

### [08: Usuario troca de igreja](08-usuario-troca-de-igreja.md)
**Persona:** Lider de Grupo (Marcos, multi-tenant) — *"Entrar na igreja certa com 1 toque"*
**Pages (semanticas):** Tela de Login, Tela de Selecao de Igreja, Tenant Switcher (componente), Tela Principal por Role
**User Value:** Trocar de contexto em ≤5s sem logout, dados isolados e seguros
**Business Value:** Usuarios multi-tenant mantem uso ativo em todas as comunidades

---

### [09: Super Admin opera plataforma](09-super-admin-opera-plataforma.md)
**Persona:** Super Admin (Paulo, operador tecnico) — *"Provisionar em 5 min e sair"*
**Pages (semanticas):** Tela de Login com MFA, Dashboard de Tenants, Formulario de Provisionamento, Detalhe do Tenant
**User Value:** Em ≤5 min: tenant criado, admin convidado; nunca viu dados pastorais
**Business Value:** Operador gerencia tenants sem jamais acessar dados pastorais das comunidades

---

## Page Coverage Matrix

### Telas com numeracao provisoria (#N) — Outlines 01-05

| Page | Rotulo | Scenarios | Purpose in Flow |
|------|--------|-----------|----------------|
| #1 | Landing Page | 04 | Champion descobre o produto (entry point marketing) |
| #2 | Pricing | 04 | Champion valida modelo de precificacao |
| #3 | Features | 04 | Champion confirma capabilities do produto |
| #4 | Sobre | 04 (paralela) | Contexto institucional (trilha alternativa) |
| #5 | Manifesto Pastoral | 04 | Peca-ancora: champion valida alinhamento de valores |
| #6 | Blog | 04 (paralela) | Conteudo educacional (trilha alternativa) |
| #7 | Contato | 04 (paralela) | Canal de comunicacao (trilha alternativa) |
| #8 | Estudo de Caso | 04 | Prova social com igreja real (ou projetada) |
| #9 | Trial / Demo | 04 | Entry point de ativacao (sales-led R1a, self-serve R1b) |
| #10 | Radar Pastoral | 01 | Lider ve sinais prioritarios da semana |
| #12 | Welcome Screen | 05 | Primeiro contato pos-login do Admin Tenant |
| #13 | Demo Data | 05 | Dados de demonstracao para validar valor imediato |
| #15 | Configuracao Tenant | 05 | Setup basico do tenant (nome, branding minimo) |
| #16 | Dashboard Lider | 01 | Visao geral dos grupos que o lider gerencia |
| #17 | Detalhe Participante | 01 | Contexto relacional de 1 participante especifico |
| #18 | Acao de Cuidado | 01 | Registrar acao pastoral em 1 frase |
| #19 | Agenda / Sala LiveKit | 02 | Preparar e abrir reuniao (modo hibrido) |
| #20 | Presenca Automatica | 02 | Presenca registrada via LiveKit webhook (zero manual) |
| #21 | Reflexao Pos-Reuniao | 02 | Campo livre pos-encontro ("Joao abriu sobre o pai") |
| #22 | Sinal Prioritario | 01 | Destaque visual de participante que precisa de atencao |
| #23 | Vista Agregada Tenant | 03 | Pastor ve saude pastoral de todos os grupos |
| #24 | Drill-down Grupo | 03 | Pastor ve detalhes de 1 grupo especifico |
| #25 | Drill-down Lider | 03 | Pastor ve contexto de 1 lider especifico |
| #26 | Outreach Intent | 03 | Pastor registra intencao de contato pastoral |
| #27 | Apresentacao Curada (Deck Light) | 04 | Champion gera material para apresentar ao pastor |
| #28 | Wizard Step — Perfil Pastoral | 05 | Passo 1 do wizard de onboarding (R1b Story 10.1) |
| #29 | Wizard Step — Comunidade | 05 | Passo 2 do wizard (R1b Story 10.1) |
| #30 | Criar Grupo | 05 | Passo 3: primeiro grupo com participantes |
| #31 | Convidar Lider | 05 | Passo 4: convidar primeiro lider ao grupo |
| #32 | Cadencia de Encontros | 05 | DDR: configurar frequencia de reunioes do grupo |
| #33 | Radar Demo | 05 | Radar com dados demo (valor imediato em ≤10 min) |
| #34 | Checklist Onboarding | 05 | Progresso do setup e proximos passos |

**Nota:** #11 e #14 nao sao referenciados em nenhum outline. Verificar no Phase 4 se essas telas existem no inventario original ou se a numeracao tem gaps.

### Telas com rotulos semanticos — Outlines 06-09

| Rotulo Semantico | Rota | Scenarios | Purpose in Flow |
|------------------|------|-----------|----------------|
| Tela de Login | `(public)/login` | 07, 08, 09 | Auth entry point (email/senha + Google OAuth) |
| Tela de Login com MFA | `(public)/login` + TOTP | 09 | Auth com MFA obrigatorio (Super Admin / Admin Tenant) |
| Email Transacional de Convite | Email (FR23) | 06 | Participante recebe convite do lider |
| Tela de Aceite de Convite | `(public)/convite/[token]` | 06 | Participante aceita convite pre-auth |
| OAuth Google | Externo (Google) | 06, 07 | Autenticacao via Google account |
| Lista dos Meus Grupos | `/app/consumo/grupos` | 06 | Participante ve seus grupos |
| Detalhe do Meu Grupo | `/app/consumo/grupos/[id]` | 06 | Participante ve conteudo e membros do grupo |
| Tela de Recuperacao de Senha | `(public)/recuperar-senha` | 07 | Input de email para reset (FR83 Story 2.9) |
| Email de Reset | Email (Keycloak) | 07 | Email pastoral com link de nova senha |
| Tela de Nova Senha | `(public)/nova-senha/[token]` | 07 | 2 campos de senha + validacao OWASP |
| Tela Principal Lider | `/app/gestao/` | 07, 08 | Radar pastoral (destino pos-auth para Lider) |
| Tela de Selecao de Igreja | `(auth)/selecionar-igreja` | 08 | Escolher tenant ativo entre 2+ opcoes |
| Tenant Switcher | Componente overlay | 08 | Troca mid-session sem logout |
| Dashboard de Tenants | `/app/admin/super/tenants` | 09 | Lista paginada de todos os tenants |
| Formulario de Provisionamento | `/app/admin/super/tenants/novo` | 09 | Criar novo tenant (saga DB → Keycloak → admin) |
| Detalhe do Tenant | `/app/admin/super/tenants/[id]` | 09 | Metadata operacional do tenant |

### Consolidacao pendente

A numeracao `#N` (outlines 01-05) e provisoria — veio de analise de escopo da Phase 3 Step 02/03 que **nao foi persistida como artefato**. Os rotulos semanticos (outlines 06-09) foram adotados como alternativa rigorosa (padrao 11). A consolidacao em numeracao unificada deve ocorrer antes do Phase 4 (wireframes), onde cada tela recebera:
- ID canonico unico
- Rota real documentada em `docs/architecture.md`
- Mapeamento para FR/Story quando aplicavel

**Coverage:** 32 telas numeradas (#1-#34, excluindo #11 e #14) + 16 telas semanticas (com sobreposicoes — ex: "Tela de Login" provavelmente corresponde a uma #N nao referenciada). **Estimativa consolidada: ~38-42 telas unicas** cobrindo todos os 9 cenarios.

---

## Debitos e DDRs consolidados (cross-outline)

| # | Debito / DDR | Outline(s) | Status | Acao |
|---|-------------|-----------|--------|------|
| 1 | FR60 dashboard agregado tenant = Release 2 no PRD | 03 | Opcao A endossada (promover para 1a-beta) | Grooming: confirmar promocao |
| 2 | #27 Tela de apresentacao (Deck Light) = DDR | 04 | 2 variantes propostas | Grooming: decidir PDF-only vs URL publica |
| 3 | Trial motion sales-led vs. self-serve | 04 | Opcao A (sales-led R1a) recomendada | Grooming: validar divergencia do PRD |
| 4 | Marketing pages como gate de conteudo | 04 | Marcado | Grooming: criar stories ou confirmar como conteudo |
| 5 | Champion como persona-satelite | 04 | Marcado | Grooming: registrar formalmente |
| 6 | NFR-X3 dualidade (R1b vs R1a-beta) | 06 | Opcao A recomendada (escopo ajustado) | Grooming: confirmar promocao |
| 7 | Tela de aceite de convite pre-auth | 06 | Interpretacao ampla FR23 | Grooming: confirmar escopo |
| 8 | Divergencia PRD Jornada 1 Juliana (parcial) | 06 | Reconhecido | Epic 8 (R1b) + Epic 14 (R2) completam |
| 9 | ~~Password recovery gap~~ | 07 | ✅ RESOLVIDO | FR83 + Story 2.9 criados |
| 10 | Keycloak email template pastoral | 07 | Pendente | Grooming: configurar realm action PT-BR |
| 11 | Rota de selecao de igreja | 08 | DDR proposto: `(auth)/selecionar-igreja` | Grooming: documentar em architecture.md |
| 12 | Posicao do tenant switcher no layout | 08 | DDR proposto: header, 1 tap | Grooming: definir no layout base (Story 1.8) |
| 13 | Cache invalidation on tenant switch | 08 | DDR proposto: tenant_id como query key | Grooming: documentar TanStack Query pattern |
| 14 | ExperienceResolver role-change no switch | 08 | Nota de grooming | Phase 4: UX de transicao entre experiencias |
| 15 | URL paths dentro de `/app/admin/super/*` | 09 | DDR (UX-DR25 lista telas, faltam paths) | Grooming: documentar paths em architecture.md |
| 16 | Persona Super Admin nao formalizada | 09 | DDR | Grooming: criar persona 07 em B-Trigger-Map |
| 17 | UX da saga de provisionamento (loading) | 09 | DDR proposto: stepper 3 etapas | Phase 4: wireframe do loading state |

---

## Padroes de rigor consolidados (11 padroes)

Emergidos das 9 iteracoes de outline. Aplicar em Phase 4+:

1. **Validar roles RBAC** contra os 6 reais (Super Admin, Admin Tenant, Editor de Conteudo, Lider, Participante, Auditor)
2. **Validar rotas** contra as 3 experiencias consolidadas (`/app/consumo/*`, `/app/gestao/*`, `/app/admin/*`)
3. **Validar referencias de Epic** contra o mapa real (Epic→FR→Story→Release)
4. **Respeitar NFRs** como hard constraints (NFR-X1 ≤10 min, NFR-X3 ≤2 min)
5. **Nunca reivindicar "100% MVP"** sem verificar release gate
6. **Marcar DDRs** com modelo de dados proposto + bounded context + acao de grooming
7. **Documentar divergencias** do PRD explicitamente (nao esconder)
8. **Glossario banido** user-facing (monitorar, rastrear, frequencia, engajamento, rebanho, score, ranking, etc.)
9. **Distinguir gate de conteudo vs. gate de engenharia** (marketing pages vs. features com story)
10. **Cada outline audita so features da sua persona** (conexao entre outlines via narrativa, nao via FR)
11. **Rotulos semanticos** quando numeracao nao verificada em disco

---

## Next Phase

These scenario outlines feed into **Phase 4: UX Design** where each page gets:
- Detailed page specifications
- Wireframe sketches
- Component definitions
- Interaction details

**Pre-requisitos para Phase 4:**
1. Consolidar numeracao de telas (unificar #N + semanticos em inventario canonico)
2. Resolver debitos de grooming pendentes (tabela acima)
3. Confirmar promocao de FR60 e NFR-X3 para 1a-beta
4. Criar persona formal do Super Admin e Champion

---

_Generated with Whiteport Design Studio framework · Phase 3: UX Scenarios · 9 outlines, 5 personas, ~38-42 telas unicas · 17 debitos/DDRs catalogados (1 resolvido) · 11 padroes de rigor consolidados_
