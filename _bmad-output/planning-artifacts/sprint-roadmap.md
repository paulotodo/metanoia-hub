# Sprint Roadmap — metanoia-hub

> Gerado em: 2026-04-09
> Atualizado em: 2026-05-11 (+ Sprint 7 Estabilizacao + 2 stories deferred-work cleanup no Sprint 8)
> Total: 22 sprints | 96 stories | 16 epics | ~44 semanas
> Cadencia: sprints de 2 semanas

---

## Resumo por Release

| Release | Sprints | Stories | Epics | Foco |
|---------|---------|---------|-------|------|
| **1a MVP Core** | 0-7 | 27 | 1, 2, 3, 4, 7 | Infra, Auth, Multi-tenancy, Grupos, Onboarding, Estabilizacao |
| **1a-beta** | 8-11 | 14 | 5, 6 | Reunioes ao Vivo, Radar Pastoral, Hardening cleanup |
| **1b Extended** | 12-17 | 28 | 8, 9, 10, 11, 12 | Trilhas, LGPD, Planos, Acessibilidade |
| **Release 2** | 18-21 | 23 | 13, 14, 15, 16 | Analytics, Notificacoes, Resiliencia |

---

## RELEASE 1a — MVP Core

### Sprint 0 — Fundacao do Monorepo (DONE)

**Meta:** Scaffold de infraestrutura, Docker Compose, CI/CD e spike de autenticacao.

| Story | Titulo | Status |
|-------|--------|--------|
| 1-1 | Scaffold do Monorepo Turborepo com Next.js, NestJS, Prisma | done |
| 1-2 | Docker Compose Completo com Keycloak, MinIO e LiveKit | done |
| 1-3 | Pipeline CI/CD com GitHub Actions | done |
| 1-4 | Spike Tecnico — Keycloak Multi-tenant com 4 Roles e Google OAuth | done |

**Entregavel:** Monorepo funcional com infra completa e auth validada.

---

### Sprint 1 — Observabilidade, Design System & Layout

**Meta:** Completar Epic 1 — logging estruturado, spike real-time, design tokens e shell de navegacao.

| Story | Titulo | Deps |
|-------|--------|------|
| 1-5 | Observabilidade Base — Pino Structured Logging, Sentry | 1-1 |
| 1-6 | Spike Tecnico — Pipeline Real-time (LiveKit -> Redis -> BullMQ) | 1-2 (LiveKit) |
| 1-7 | Design Tokens, Tipografia, Espacamento e shadcn/ui Base | 1-1 |
| 1-8 | Layout Base — NavigationConfig, Sidebar e Bottom Tabs | 1-7 |

**Rationale:** Enablers que devem estar prontos antes do desenvolvimento de features. 1-6 valida o pipeline real-time necessario para reunioes (Epic 5).

---

### Sprint 2 — Identidade & Acesso (Core Auth)

**Meta:** Registro de usuario, login, MFA e guards de autorizacao.

| Story | Titulo | Deps |
|-------|--------|------|
| 2-1 | Cadastro de Usuario com Email e Senha | 1-4 (Keycloak) |
| 2-2 | Login via Email/Senha e Google OAuth | 2-1 |
| 2-3 | MFA Obrigatorio para Super Admin e Admin Tenant | 2-2 |
| 2-4 | Autorizacao por Papeis e Guards NestJS (3 Camadas) | 2-2 |

**Rationale:** Auth e caminho critico — tudo depende de usuarios autenticados e guards por role.

---

### Sprint 3 — Multi-tenancy & LGPD Consent

**Meta:** Selecao de tenant, isolamento RLS, gestao de usuarios e consentimento LGPD.

| Story | Titulo | Deps |
|-------|--------|------|
| 2-5 | Selecao de Tenant Ativo e Associacao Multi-tenant | 2-4 |
| 2-6 | Isolamento de Dados por Tenant (RLS) | 2-5 |
| 2-7 | Gestao de Usuarios e Papeis pelo Admin Tenant | 2-4, 2-6 |
| 2-8 | Consentimento LGPD e Termos de Uso (Middleware) | 2-1 |
| 2-9 | Recuperacao de Senha via Email (Keycloak Nativo) | 2-2 |

**Rationale:** Completa Epic 2. RLS e pre-requisito para todos os dados tenant-scoped. LGPD e obrigatorio no registro. Story 2-9 adicionada via WDS Phase 3 outline 07 (gap table-stakes: password recovery).

---

### Sprint 4 — Provisionamento de Tenant

**Meta:** Provisionamento transacional, gestao Super Admin e guard de limites por plano.

| Story | Titulo | Deps |
|-------|--------|------|
| 3-1 | Provisionamento Transacional de Tenant | 2-4, 2-6 |
| 3-2 | Gestao de Tenants pelo Super Admin | 3-1 |
| 3-3 | Guard de Limites por Plano (Hardcoded) | 3-1 |

**Rationale:** Completa Epic 3. Sprint mais leve (3 stories) pois 3-1 envolve saga pattern complexa (criacao de realm Keycloak). 3-3 e referenciado por stories do Epic 4.

---

### Sprint 5 — Grupos, Membros & Convites

**Meta:** CRUD de grupos, gestao de membros, convites e associacao de trilhas.

| Story | Titulo | Deps |
|-------|--------|------|
| 4-1 | CRUD de Grupos | 2-6, 3-3 |
| 4-2 | Vincular Membros & Lideres a Grupo | 4-1 |
| 4-3 | Convite via E-mail e Link | 4-1 |
| 4-4 | Associar Trilhas a Grupo | 4-1 |
| 4-5 | Participante Visualiza Seus Grupos | 4-1 |

**Rationale:** Completa Epic 4. Grupos sao a unidade organizacional central — reunioes, trilhas e radar pastoral dependem de grupos.

---

### Sprint 6 — Onboarding Minimo

**Meta:** Tela de boas-vindas, dados demo e mensagens de erro acionaveis.

| Story | Titulo | Deps |
|-------|--------|------|
| 7-1 | Tela de Boas-Vindas Personalizada | 1-8, 2-2 |
| 7-2 | Dados de Demonstracao Realistas | 4-1 |
| 7-3 | Mensagens de Erro Acionaveis | 1-5 |

**Rationale:** Completa Epic 7. Sprint mais leve, bom momento para retrospective dos Epics 1-4 e resolver itens deferidos.

---

### Sprint 7 — Estabilizacao Release 1a

**Meta:** Testes de integracao end-to-end, correcao de bugs, polish.

| Atividade |
|-----------|
| Teste E2E do fluxo completo: registrar -> login -> selecionar tenant -> criar grupo -> convidar membros -> ver boas-vindas |
| Corrigir bugs descobertos |
| Resolver itens de deferred-work.md do Sprint 0 |
| Retrospective dos Epics 1-4, 7 |

**Entregavel:** Tag **Release 1a MVP Core**

---

## RELEASE 1a-beta — Reunioes & Radar Pastoral

### Sprint 8 — Reunioes ao Vivo (Infraestrutura) + Deferred-Work Cleanup

**Meta:** CRUD de reunioes, integracao LiveKit, pipeline de presenca automatica + 2 stories de hardening absorvendo itens P0/P1 do deferred-work.md.

| Story | Titulo | Deps |
|-------|--------|------|
| 5-1 | CRUD de Reunioes Vinculadas a Grupo | 4-1 |
| 5-2 | Integracao Agnostica com LiveKit | 1-6, 5-1 |
| 5-3 | Pipeline de Presenca Automatica | 5-2 |
| 1-9 | Config Hardening — LoggerModule.forRootAsync, Sentry sample rate env, Pino redact expandido, X-Request-Id header | 1-5 |
| 2-10 | Auth Hardening — JWT audience validation + audience mapper Keycloak, secret rotation realm-export, Object.freeze guard store | 1-4, 2-4 |

**Rationale:** O pipeline real-time validado em 1-6 e implementado para producao. 5-3 (classificacao automatica de presenca) e a story mais complexa. 1-9 e 2-10 absorvem itens P0/P1 do deferred-work.md acumulados nos Sprints 0-1; 2-10 inclui audience JWT (decisao party mode 3-0 unanime em 2026-04-09). Stories de hardening sao independentes de 5-1/5-2/5-3 e podem rodar em paralelo.

---

### Sprint 9 — Reunioes ao Vivo (UX & Relatorios)

**Meta:** Telemetria de engajamento, banner de transparencia, lista de presenca real-time e relatorio pos-reuniao.

| Story | Titulo | Deps |
|-------|--------|------|
| 5-4 | Telemetria Basica de Engajamento | 5-3 |
| 5-5 | Banner de Transparencia & Lista de Presenca Real-Time | 5-2, 5-3 |
| 5-6 | Relatorio Pos-Reuniao & Notificacoes | 5-3, 5-4 |

**Rationale:** Completa Epic 5. O banner de transparencia (5-5) e critico para compliance LGPD. O relatorio pos-reuniao (5-6) fornece o primeiro insight pastoral tangivel.

---

### Sprint 10 — Radar Pastoral (Core Engine)

**Meta:** Vocabulario pastoral, calculo de semaforo e indicadores de tendencia.

| Story | Titulo | Deps |
|-------|--------|------|
| 6-1 | Vocabulario Pastoral & Governanca | — |
| 6-2 | Calculo Assincrono do Semaforo & Dashboard | 5-3 |
| 6-3 | Indicadores de Tendencia & Alertas | 6-2 |

**Rationale:** 6-1 estabelece a linguagem pastoral que governa todo UI copy. 6-2 e o motor de calculo assincrono do semaforo. Inicialmente usa apenas sinais de presenca; sinais de trilhas adicionados apos Epic 8.

---

### Sprint 11 — Radar Pastoral (UX & Dashboard)

**Meta:** Perfil consolidado, acoes de cuidado pastoral, componentes UX e dashboard admin.

| Story | Titulo | Deps |
|-------|--------|------|
| 6-4 | Perfil Consolidado & Acoes de Cuidado Pastoral | 6-2 |
| 6-5 | Componentes UX do Radar Pastoral | 6-2, 6-3 |
| 6-6 | Dashboard Agregado para Admin Tenant | 6-2 |

**Rationale:** Completa Epic 6. Este e o diferencial chave do metanoia-hub — o dashboard do radar pastoral. Entrega o "momento aha" para lideres.

**Entregavel:** Tag **Release 1a-beta**

---

## RELEASE 1b — Plataforma Estendida

### Sprint 12 — Trilhas & Conteudo (Core)

**Meta:** CRUD de trilhas/modulos/aulas com repository pattern, upload de conteudo e progresso individual.

| Story | Titulo | Deps |
|-------|--------|------|
| 8-1 | CRUD de Trilhas, Modulos & Aulas com Repository Pattern | 2-6, 3-3 |
| 8-2 | Tipos de Conteudo, Upload & Visualizacao Inline | 8-1, 1-2 (MinIO) |
| 8-3 | Progresso Individual & Percentual de Conclusao | 8-1 |

**Rationale:** Conteudo e Core Domain com repository pattern. 8-1 e a maior story (3 tipos de entidade com reordenacao). 8-3 adiciona tracking de progresso que alimenta o semaforo pastoral.

---

### Sprint 13 — Trilhas (Regras & Publicacao)

**Meta:** Regras de conclusao, acesso sequencial e publicacao/versionamento.

| Story | Titulo | Deps |
|-------|--------|------|
| 8-4 | Regras de Conclusao por Tipo de Conteudo | 8-3 |
| 8-5 | Acesso Sequencial & Pre-requisitos entre Modulos e Aulas | 8-1 |
| 8-6 | Publicacao, Versionamento & Catalogo Tenant | 8-1 |

**Rationale:** Camada de regras de negocio sobre o CRUD de conteudo. Workflow de publicacao e importante para governanca.

---

### Sprint 14 — Trilhas (Reports, Busca & UX)

**Meta:** Relatorios de trilha, busca full-text, UX polish e tela "Minhas Trilhas".

| Story | Titulo | Deps |
|-------|--------|------|
| 8-7 | Relatorio por Trilha & Exportacao CSV | 8-3 |
| 8-8 | Busca Full-Text por Conteudo | 8-1 |
| 8-9 | TrailPlaylist, Skeletons & Performance UX | 8-1 |
| 8-10 | Tela "Minhas Trilhas" — Listagem de Trilhas do Participante | 8-3 |

**Rationale:** Completa Epic 8. Apos este sprint, o calculo do semaforo (6-2) pode ser enriquecido com sinais de progresso de trilhas via domain events.

---

### Sprint 15 — LGPD & Onboarding Avancado

**Meta:** Exportacao/exclusao de dados, audit log, consentimento, wizard de onboarding e demo seed.

| Story | Titulo | Deps |
|-------|--------|------|
| 9-1 | Exportacao de Dados Pessoais (Portabilidade LGPD) | 2-1 |
| 9-2 | Exclusao de Dados Pessoais (Eliminacao LGPD) | 9-1 |
| 9-3 | Log de Auditoria Imutavel | — (cross-cutting) |
| 9-4 | Base Legal & Historico de Consentimento | 2-8 |
| 10-1 | Wizard de Onboarding para Admin Tenant | 3-1 |
| 10-2 | Dados de Demonstracao (Seed) | Todos os epics de conteudo |

**Rationale:** Agrupa compliance LGPD. Wizard de onboarding (10-1) e demo seed (10-2) podem rodar em paralelo pois targetam fluxos diferentes.

---

### Sprint 16 — CSV Import & Feature Gating

**Meta:** Importacao CSV, planos dinamicos, branding, feature toggles e prompts de upgrade.

| Story | Titulo | Deps |
|-------|--------|------|
| 10-3 | Importacao CSV — Upload, Preview & Validacao | 4-2 |
| 10-4 | Importacao CSV — Confirmacao & Processamento | 10-3 |
| 11-1 | Planos de Assinatura & Limites Dinamicos | 3-3 |
| 11-2 | Branding Customizado do Tenant | 3-1 |
| 11-3 | Politicas & Feature Toggles por Tenant | 11-1 |
| 11-4 | Prompt de Upgrade & Gestao de Limites | 11-1, 11-3 |

**Rationale:** Completa Epics 10 e 11. CSV import combina naturalmente com plan limits (ambos workflows admin).

---

### Sprint 17 — Acessibilidade Hardening

**Meta:** Compliance WCAG AA completo em todos os fluxos existentes.

| Story | Titulo | Deps |
|-------|--------|------|
| 12-1 | Navegacao por Teclado — Fluxos Publicos & Infraestrutura | 1-8, 2-1/2-2 |
| 12-2 | Navegacao por Teclado — Fluxos Autenticados | Todos fluxos auth |
| 12-3 | Contraste WCAG AA & Focus Visible | — |
| 12-4 | Touch Targets, Reduced Motion & Mobile Feedback | — |
| 12-5 | Formularios Acessiveis | — |
| 12-6 | Teste Automatizado de Contraste & axe-core | 12-3 |

**Rationale:** Completa Epic 12. Hardening de acessibilidade e melhor feito apos todos os fluxos de UI existirem. Quality gate axe-core (12-6) previne regressoes.

**Entregavel:** Tag **Release 1b Extended**

---

## RELEASE 2 — Post-MVP

### Sprint 18 — Relatorios Avancados & Analytics

**Meta:** Relatorios por reuniao, consolidados, deteccao de evasao, metricas de plataforma e templates de conteudo.

| Story | Titulo | Deps |
|-------|--------|------|
| 13-1 | Relatorio por Reuniao | 5-6 |
| 13-2a | Relatorio Consolidado por Lider | 6-2 |
| 13-2b | Relatorio por Tenant com Materialized Views | 13-2a |
| 13-3 | Deteccao de Risco de Evasao | 6-3 |
| 13-4 | Metricas de Plataforma — Super Admin | 3-2 |
| 13-5 | Templates de Conteudo Reutilizaveis | 8-1 |

**Rationale:** Completa Epic 13. Relatorios alavancam todas as camadas de dados construidas anteriormente.

---

### Sprint 19 — Notificacoes & Comunicacao

**Meta:** Infraestrutura de notificacoes, SSE real-time, notification center, email via Resend e health checks.

| Story | Titulo | Deps |
|-------|--------|------|
| 14-1 | Infraestrutura de Notificacoes & Channel Router | — |
| 14-2a | SSE Endpoint, Redis PubSub Backend | 14-1 |
| 14-2b | Notification Center UI | 14-2a |
| 14-2c | SSE Reconnection Gap Fill | 14-2a |
| 14-3 | Notificacoes por Email via Resend | 14-1 |
| 14-4 | Health Check de Integracoes & Dashboard | 14-3 |

**Rationale:** Completa Epic 14. Infraestrutura de notificacoes e uma unidade coesa, melhor construida em conjunto.

---

### Sprint 20 — Acessibilidade Avancada (Screen Reader)

**Meta:** Suporte completo a screen reader em todos os fluxos.

| Story | Titulo | Deps |
|-------|--------|------|
| 15-1 | Screen Reader — Autenticacao, Navegacao Global & Landmarks | 2-1/2-2 |
| 15-2 | Screen Reader — Dashboard Lider, Radar Pastoral & Listas | 6-5 |
| 15-3 | Semaforo Multimodal — Icones, Texto Complementar & ARIA | 6-2 |
| 15-4 | Screen Reader — Trilhas, Progresso & Conteudo | 8-1 |

**Rationale:** Completa Epic 15. Suporte a screen reader requer que todo UI esteja finalizado.

---

### Sprint 21 — Resiliencia, Offline & Expansoes Futuras

**Meta:** Preferencias de notificacao, PWA offline, MFA lider, observabilidade, tracing, legendas e disaster recovery.

| Story | Titulo | Deps |
|-------|--------|------|
| 16-1 | Preferencias Granulares de Notificacao por Tipo | 14-1 |
| 16-2 | PWA & Service Worker — Leitura Offline | 8-2 |
| 16-3 | MFA para Papel Lider via Keycloak | 2-3 |
| 16-4 | Metricas por Integracao & Dashboard de Observabilidade | 1-5 |
| 16-5 | Tracing Distribuido entre Servicos | 1-5 |
| 16-6 | Legendas & Transcricao de Video | 8-2 |
| 16-7 | Resiliencia Operacional — Backup, Restore & Disaster Recovery | — |

**Rationale:** Completa Epic 16 e o projeto inteiro. Stories post-MVP de hardening. Sprint mais pesado (7 stories) pois muitas sao tarefas de infraestrutura menores/independentes.

**Entregavel:** Tag **Release 2 & Post-MVP**

---

## Progresso Atual

- **Stories concluidas:** 4/90 (4.4%)
- **Sprint atual:** Sprint 0 (DONE) — proximo: Sprint 1
- **Release atual:** 1a MVP Core
- **Epics iniciados:** 1/16
