---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/prd-requirements-extraction.md
  - _bmad-output/planning-artifacts/metanoia-hub-prd-validation-report.md
---

# metanoia-hub - Epic Breakdown

## Overview

Este documento fornece o breakdown completo de épicos e stories do metanoia-hub, decompondo os requisitos do PRD, UX Design Specification e Architecture em stories implementáveis.

## Requirements Inventory

### Functional Requirements

**Total: 82 FRs (80 MVP + 2 Post-MVP)**

#### 1.1 Identidade & Acesso (11 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR01 | O sistema deve permitir cadastro de usuário com e-mail e senha | 1a |
| FR02 | O sistema deve permitir login via provedor OAuth (Google) | 1a |
| FR03 | O sistema deve permitir que um mesmo usuário esteja associado a múltiplos tenants | 1a |
| FR04 | O sistema deve autenticar usuários de forma centralizada via provedor de identidade | 1a |
| FR05 | O sistema deve autorizar ações com base em papéis do usuário e contexto do tenant, garantindo que cada papel acesse apenas os recursos permitidos | 1a |
| FR06 | O sistema deve suportar os papéis: Super Admin, Admin Tenant, Líder, Participante | 1a |
| FR07 | O sistema deve isolar dados e operações por tenant, impedindo acesso cruzado | 1a |
| FR08 | O sistema deve permitir que um Admin Tenant gerencie usuários e papéis dentro do seu tenant | 1a |
| FR09 | O sistema deve implementar defesa em profundidade com 3 camadas de autorização independentes: (1) Keycloak identity provider, (2) NestJS Guards por rota, (3) PostgreSQL RLS por tenant | 1a |
| FR10 | O sistema deve permitir que o usuário selecione o tenant ativo ao acessar a plataforma | 1a |
| FR11 | O sistema deve revogar sessões e tokens quando um usuário for removido de um tenant | 1a |

#### 1.2 Tenant & Configuração (8 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR12 | O sistema deve permitir o provisionamento de novos tenants com dados mínimos (nome, admin, plano) | 1a |
| FR13 | O sistema deve associar cada tenant a um plano de assinatura (Free, Pro, Enterprise) com limites definidos | 1b |
| FR14 | O sistema deve aplicar limites numéricos por plano (grupos, participantes, storage, reuniões simultâneas) | 1b |
| FR15 | O sistema deve permitir que o Admin Tenant configure branding básico (logo, cores, nome de exibição) | 1b |
| FR16 | O sistema deve permitir que o Admin Tenant configure políticas do tenant (feature toggles para monitoramento de foco, câmera obrigatória, etc.) | 1b |
| FR17 | O sistema deve exibir prompt de upgrade quando o tenant atingir limites do plano atual | 1b |
| FR18 | O sistema deve permitir que o Super Admin visualize e gerencie todos os tenants da plataforma | 1a |
| FR19 | O sistema deve registrar metadata do tenant (data de criação, plano, status, configurações ativas) | 1a |

#### 1.3 Grupos & Membros (9 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR20 | O sistema deve permitir que Admin/Líder crie, edite e exclua grupos dentro do tenant | 1a |
| FR21 | O sistema deve permitir que Admin/Líder vincule e desvincule participantes a um grupo | 1a |
| FR22 | O sistema deve permitir que Admin/Líder vincule e desvincule líderes a um grupo | 1a |
| FR23 | O sistema deve permitir que Admin/Líder convide participantes via e-mail ou link de convite | 1a |
| FR24 | O sistema deve permitir que Admin/Líder associe trilhas de conteúdo a um grupo | 1a |
| FR25 | O sistema deve exibir para o Líder a lista de membros do grupo com status de participação | 1a |
| FR26 | O sistema deve permitir que um participante visualize os grupos dos quais faz parte | 1a |
| FR27 | O sistema deve suportar importação em massa de participantes via arquivo CSV | 1b |
| FR28 | O sistema deve validar dados importados e reportar erros de importação ao usuário | 1b |

#### 1.4 Trilhas & Conteúdo (14 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR29 | O sistema deve permitir que Admin/Líder crie trilhas de ensino com nome, descrição e configurações | 1a |
| FR30 | O sistema deve permitir que Admin/Líder crie módulos dentro de uma trilha e os ordene | 1a |
| FR31 | O sistema deve permitir que Admin/Líder crie aulas dentro de módulos e as ordene | 1a |
| FR32 | O sistema deve suportar os tipos de conteúdo: vídeo, texto rico, PDF/DOC, links externos | 1a |
| FR33 | O sistema deve permitir upload de arquivos de conteúdo para armazenamento próprio da plataforma | 1a |
| FR34 | O sistema deve permitir visualização de conteúdo inline (sem download obrigatório) | 1a |
| FR35 | O sistema deve permitir configuração de acesso sequencial ou livre entre módulos/aulas | 1b |
| FR36 | O sistema deve permitir configuração de pré-requisitos entre módulos/aulas | 1b |
| FR37 | O sistema deve registrar o progresso individual do participante por aula, módulo e trilha | 1a |
| FR38 | O sistema deve calcular e exibir percentual de conclusão da trilha por participante | 1a |
| FR39 | O sistema deve suportar regras de conclusão de aula: vídeo assistido (>=90%), documento lido (scroll >=80% + tempo >= estimado), ou marcação manual pelo líder/participante. Configurável por tenant | 1b |
| FR40 | O sistema deve permitir publicação e versionamento de conteúdo (rascunho -> publicado) | 1b |
| FR41 | O sistema deve permitir que o tenant defina trilhas no nível do tenant (catálogo) e as associe a múltiplos grupos | 1b |
| FR42 | O sistema deve permitir templates de conteúdo reutilizáveis (biblioteca da plataforma + salvar como template) | 2 |

#### 1.5 Reuniões ao Vivo (13 FRs — FR47 dividido em 3)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR43 | O sistema deve permitir que Admin/Líder crie reuniões vinculadas a um grupo com data, hora e duração | 2 |
| FR44 | O sistema deve integrar com provedor de videoconferência de forma agnóstica (abstração por interface) | 2 |
| FR45 | O sistema deve receber eventos do provedor de videoconferência (entrada, saída, estado de mídia) | 2 |
| FR46 | O sistema deve registrar presença automática classificada como integral ou parcial conforme regras configuráveis | 2 |
| FR47a | O sistema deve registrar o tempo com câmera ligada por participante durante a reunião | 2 |
| FR47b | O sistema deve registrar o tempo de permanência na sala por participante durante a reunião | 2 |
| FR47c | O sistema deve registrar indicador de foco (proxy técnico de atenção via visibilidade de aba) por participante, controlado por feature toggle do tenant | 2 |
| FR48 | O sistema deve tolerar desconexões técnicas sem penalizar a presença do participante (janela de reconexão configurável) | 2 |
| FR49 | O sistema deve gerar relatório pós-reunião automático com presença, engajamento e duração | 2 |
| FR50 | O sistema deve exibir banner de transparência durante a reunião informando que sinais de presença e engajamento estão sendo registrados | 2 |
| FR51 | O sistema deve manter estado da reunião ativa em cache e persistir ao encerrar | 2 |
| FR52 | O sistema deve permitir que o Líder visualize a lista de presença em tempo real durante a reunião | 2 |
| FR53 | O sistema deve notificar participantes sobre reuniões agendadas | 2 |

#### 1.6 Visibilidade Pastoral (9 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR54 | O sistema deve exibir dashboard semáforo (verde/amarelo/vermelho) por participante para o Líder | 2 |
| FR55 | O sistema deve calcular a classificação semáforo com base em regras objetivas e configuráveis por tenant (thresholds padrão: verde >=75% presença + ativo 14d; amarelo 50-74% ou inativo 14-21d; vermelho <50% ou inativo >21d) | 2 |
| FR56 | O sistema deve permitir que o Líder visualize o perfil consolidado de um participante (histórico de presença, progresso em trilhas, sinais de engajamento) | 2 |
| FR57 | O sistema deve permitir que o Líder registre ações de cuidado pastoral vinculadas a um participante | 2 |
| FR58 | O sistema deve atualizar o dashboard semáforo em tempo real via SSE | 2 |
| FR59 | O sistema deve exibir indicadores de tendência por participante (melhorando, estável, declínio) | 2 |
| FR60 | O sistema deve permitir que o Admin Tenant visualize dashboard agregado de todos os grupos do tenant | 2 |
| FR61 | O sistema deve exibir alertas quando um participante mudar de status no semáforo (ex.: verde->amarelo ou amarelo->vermelho) | 2 |
| FR62 | O sistema deve enquadrar toda a comunicação de monitoramento com vocabulário pastoral (cuidado, não vigilância). Governança: vocabulary.ts como fonte única, lint rules bloqueiam termos corporativos | 2 |

#### 1.7 Relatórios & Analytics (6 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR63 | O sistema deve gerar relatório por reunião com métricas de presença e engajamento | 2 |
| FR64 | O sistema deve gerar relatório por trilha com métricas de progresso e conclusão por participante | 1b |
| FR65 | O sistema deve gerar relatório por tenant com métricas agregadas de todos os grupos | 2 |
| FR66 | O sistema deve identificar e sinalizar participantes em risco de evasão (3+ ausências consecutivas ou 2+ semanas inativo) | 2 |
| FR67 | O sistema deve gerar métricas de plataforma para Super Admin (tenants ativos, usuários, utilização de recursos) | 2 |
| FR68 | O sistema deve permitir exportação de relatórios em formato CSV | 1b |

#### 1.8 Onboarding & Adoção (7 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR69 | O sistema deve exibir tela de boas-vindas personalizada no primeiro acesso do usuário | 1b |
| FR70 | O sistema deve oferecer onboarding guiado para Admin Tenant na configuração inicial do tenant | 1b |
| FR71 | O sistema deve disponibilizar dados de demonstração para que o Admin explore funcionalidades antes de inserir dados reais | 1b |
| FR72 | O sistema deve coletar consentimento explícito do usuário para tratamento de dados conforme LGPD | 1a |
| FR73 | O sistema deve permitir que o usuário exporte seus dados pessoais (direito de portabilidade LGPD) | 1b |
| FR74 | O sistema deve permitir que o usuário solicite exclusão de seus dados pessoais (direito de eliminação LGPD) | 1b |
| FR75 | O sistema deve exibir política de privacidade e termos de uso no cadastro e mantê-los acessíveis | 1a |

#### 1.9 Capabilities Transversais (7 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR76 | O sistema deve permitir busca full-text por conteúdo dentro de trilhas, aulas e materiais do tenant (PostgreSQL tsvector, scoped por RLS) | 1b |
| FR77 | O sistema deve permitir envio de notificações in-app para usuários (reuniões, atualizações de conteúdo, alertas pastorais) | 2 |
| FR78 | O sistema deve permitir que o usuário configure preferências de notificação por tipo | Post-MVP |
| FR79 | O sistema deve gerar relatório consolidado por líder com visão agregada de todos os seus grupos | 2 |
| FR80 | O sistema deve registrar log de auditoria de ações administrativas (CRUD, alterações de permissão, configurações de tenant) | 1b |
| FR81 | O sistema deve exibir mensagens de erro claras e acionáveis, orientando o usuário sobre como resolver o problema | 1b |
| FR82 | O sistema deve manter funcionalidade básica de leitura offline (PWA/Service Worker para conteúdo já visualizado) | Post-MVP |

### NonFunctional Requirements

**Total: 52 NFRs**

#### 2.1 Performance (8 NFRs)

**Web Vitals (p75):** LCP <= 2,5s | INP <= 200ms | CLS <= 0,1

| ID | Fluxo | Target | Condição |
|----|-------|--------|----------|
| NFR-P1 | Entrada na reunião | < 3s | 4G bom |
| NFR-P2 | Dashboard do líder (navegação recorrente) | <= 2s | Cache quente |
| NFR-P3 | Atualização do semáforo após evento | <= 2s | Ponta a ponta |
| NFR-P4 | Lista de presença (entrada/saída) | <= 1s | Tempo real |
| NFR-P5 | Página de trilha | <= 2,5s | Primeiro carregamento |
| NFR-P6 | Player de vídeo visível | <= 2s | Rede estável |
| NFR-P7 | Início de reprodução de vídeo | <= 3s | Rede estável |
| NFR-P8 | Documento/texto de aula | <= 2s | Legível e navegável |

#### 2.2 Segurança (10 NFRs)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-S1 | Senhas armazenadas com hash resistente a ataques de GPU e side-channel (Argon2id) | 1a |
| NFR-S2 | Senha mínima: 12 caracteres; suportar até 64+ caracteres | 1a |
| NFR-S3 | Senhas vazadas/comuns bloqueadas no cadastro (lista OWASP/NIST) | 1a |
| NFR-S4 | MFA obrigatório para Super Admin e Admin Tenant | 1a |
| NFR-S5 | MFA opcional para Líder no MVP, com expansão planejada | Post-MVP |
| NFR-S6 | TLS obrigatório em trânsito, inclusive entre serviços internos sensíveis | 1a |
| NFR-S7 | Criptografia at-rest obrigatória para banco, storage e backups | 1a |
| NFR-S8 | Segredos gerenciados fora do código via cofre/secret manager | 1a |
| NFR-S9 | Sessões com alta entropia para IDs de sessão | 1a |
| NFR-S10 | Nenhum dado de um tenant acessível por outro, verificável por suite de testes automatizada | 1a |

**Eventos de auditoria obrigatórios:** Login (sucesso/falha), alteração de permissão, CRUD conteúdo, acesso a gravações, exportação dados pessoais, alterações admin tenant.

#### 2.3 Escalabilidade (3 NFRs)

| ID | Requisito | Trigger |
|----|-----------|---------|
| NFR-E1 | App/API/workers devem escalar horizontalmente. Stateless obrigatório — sessão e cache em Redis | CPU >70% por 5min → auto-scale (max 4 dev, 8 prod) |
| NFR-E2 | Reunião ao vivo e processamento assíncrono devem escalar independentemente do app principal | Queue depth >100 jobs pending |
| NFR-E3 | Semáforo atualizado por eventos assíncronos via BullMQ; resultado cacheado em Redis (TTL 5min) | Evento de presença/progresso |

**Targets progressivos:** R1: 20 simultâneos, 1-3 tenants | R2: 50 simultâneos, 3-5 tenants | 12m: 250 simultâneos, 5-10 tenants

#### 2.4 Confiabilidade (7 NFRs)

| ID | Requisito | Target |
|----|-----------|--------|
| NFR-C1 | Uptime da plataforma principal | >= 99,5% (30 dias) |
| NFR-C2 | Alerta de uptime com notificação imediata | Release 1a |
| NFR-C3 | Post-mortem documentado para incidentes com downtime > 30 min | Release 1b |
| NFR-C4 | Banco: snapshots diários + backups incrementais | 1a |
| NFR-C5 | Storage: versionamento de objetos quando aplicável | 1b |
| NFR-C6 | Teste de restore executado e documentado | Gate Release 1b |
| NFR-C7 | Runbook de disaster recovery testado e documentado | Gate Release 1b |

**RPO/RTO:** Dados transacionais: RPO <=1h (R1) / <=15min (R2), RTO <=4h. Gravações/docs: RPO <=24h, RTO <=8h.

#### 2.5 Privacidade & LGPD (5 NFRs)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-L1 | Dados pessoais exportados disponíveis em <= 72h | 1b |
| NFR-L2 | Exclusão de dados pessoais executada em <= 30 dias | 1b |
| NFR-L3 | Consentimento coletado antes de qualquer processamento de dados pessoais | 1a |
| NFR-L4 | Feature toggle para monitoramento de foco/aba desativado por padrão em novos tenants | 2 |
| NFR-L5 | Base legal por operação de tratamento documentada e acessível | 1b |

#### 2.6 Acessibilidade (6 NFRs)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-A1 | Navegação por teclado em todos os fluxos principais | 1b |
| NFR-A2 | Contraste e foco visível conforme WCAG AA | 1b |
| NFR-A3 | Formulários acessíveis com labels e mensagens de erro claras | 1b |
| NFR-A4 | Compatibilidade com leitores de tela nas áreas críticas: login, dashboard, trilhas, progresso, semáforo | 2 |
| NFR-A5 | Semáforo não dependente apenas de cor para comunicar estado (ícones/texto complementar obrigatórios) | 2 |
| NFR-A6 | Legendas/transcrição quando houver vídeo essencial na trilha | Post-MVP |

#### 2.7 Observabilidade (5 NFRs)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-O1 | Logs estruturados disponíveis para troubleshooting em <= 5 minutos após incidente | 1a |
| NFR-O2 | Erros de aplicação geram alerta automático com contexto suficiente para diagnóstico | 1a |
| NFR-O3 | Métricas básicas de saúde (CPU, memória, disco, latência) disponíveis via dashboard | 1b |
| NFR-O4 | Métricas detalhadas por provedor de integração (sucesso, falha, latência, taxa de retry) | Post-MVP |
| NFR-O5 | Tracing distribuído entre serviços | Post-MVP |

#### 2.8 Onboarding (3 NFRs)

| ID | Requisito | Target | Release |
|----|-----------|--------|---------|
| NFR-X1 | Admin Tenant deve conseguir criar o primeiro grupo com participantes | <= 10 min após primeiro login | 1b |
| NFR-X2 | Líder deve conseguir acessar o dashboard e visualizar seu grupo | <= 3 min após primeiro login | 1b |
| NFR-X3 | Participante deve conseguir acessar sua primeira trilha | <= 2 min após aceitar convite | 1b |

#### 2.9 Integrações (5 NFRs)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-I1 | Sistema deve continuar operando funcionalidades core quando provedor externo estiver indisponível por até 30 minutos | 2 |
| NFR-I2 | Falhas transitórias em integrações externas reprocessadas automaticamente | 2 |
| NFR-I3 | Timeouts explícitos para todas as chamadas externas: connect <= 3s, read <= 10s | 2 |
| NFR-I4 | Jobs falhados retidos para reprocessamento e investigação | 1b |
| NFR-I5 | Health check por integração ativa com status acessível ao Super Admin | 2 |

### Additional Requirements

**Requisitos técnicos da Arquitetura que impactam a implementação:**

- **Infraestrutura:** Hetzner VPS + Docker Swarm + Portainer + Traefik 3.6.x (reverse proxy com auto-discovery e Let's Encrypt)
- **Monorepo:** Turborepo 2.5+ com pnpm 10.33.0 — estrutura: apps/web, apps/api, packages/ui, packages/types, packages/config
- **Multi-tenancy obrigatória:** AsyncLocalStorage (RequestContext) → Prisma extension auto-inject tenant_id → PostgreSQL RLS. NUNCA passar tenant_id como parâmetro
- **Autenticação 3 camadas:** Keycloak (roles) → NestJS Guards (endpoint + tenant + group) → RLS PostgreSQL
- **6 Roles RBAC:** Super Admin, Admin Tenant, Editor de Conteúdo, Líder, Participante, Auditor (Phase 4)
- **UUID v7:** Gerado na aplicação com lib `uuidv7()` — NUNCA `@default(uuid())` do Prisma
- **API versionada:** `/api/v1/` prefix desde MVP
- **Contratos API:** Success `{ data, meta? }` | Error `{ statusCode, error, message, details? }` | Create 201 | Delete 204 | Async 202
- **Domain Events:** `{ eventId, eventType, version, tenantId, timestamp, data, metadata }`
- **Observabilidade:** Pino (structured JSON logs) com middleware auto-inject tenant_id/user_id, Sentry para error tracking
- **CI/CD:** GitHub Actions — PR: lint + test + build | Merge main: Docker build + deploy | E2E: Playwright contra Docker Compose
- **Real-time pipeline (Reunião):** Webhook provedor → NestJS → Redis (rt:meeting:{id}) → BullMQ flush → PostgreSQL. Dashboard via SSE
- **Notificações:** Evento de domínio → BullMQ queue:notifications → Channel Router (SSE in-app, Email via Resend, WhatsApp Phase 3)
- **Storage:** MinIO (S3-compatible) com URLs assinadas e expiração
- **Validação:** Zod 4.3.6 em `packages/types` como contrato compartilhado FE+BE. Custom `ZodValidationPipe` (~20 linhas). Snapshot tests obrigatórios para schemas
- **Config fail-fast:** `@nestjs/config` + validação Zod no boot — falha imediatamente se variáveis obrigatórias ausentes
- **Core domains (Repository pattern):** pastoral/, meetings/, content/ — service + repository
- **Supporting subdomains (Direct):** auth/, tenant/, groups/, notifications/, audit/, analytics/, onboarding/ — service + Prisma
- **Redis namespaces:** `cache:*`, `rt:*`, `queue:*`, `rate:*`, `session:*`
- **Feature gating duplo:** Subscription Tiers (disponível) + Feature Toggles por tenant (ativo)

### UX Design Requirements

**Requisitos extraídos da UX Design Specification (ux-design-specification.md):**

#### Design System & Tokens

| ID | Requisito | Escopo |
|----|-----------|--------|
| UX-DR01 | Implementar paleta de cores semântica com tokens CSS custom properties: brand-teal (#2B7A78), brand-teal-light (#3AAFA9), brand-teal-dark (#17252A), brand-terracotta (#C1666B), brand-terracotta-light (#D4918A), care-urgent (#C1666B), care-attention (#D4A24C), care-ok (#7BA38A), care-neutral (#8E8D8A), surface-base (#FAFAF8), surface-elevated (#FFFFFF), surface-sunken (#F2F0ED) | Design System |
| UX-DR02 | Implementar escala tipográfica com Inter como fonte primária via next/font (subsets latin + latin-ext). Scale: Display 36px/700, H1 30px/700, H2 24px/600, Body 16px/400, Body Small 14px/400, Caption 12px/500, Overline 11px/600 | Design System |
| UX-DR03 | Implementar sistema de espaçamento com densidade por experiência: Consumo (padding 20-24px, radius 12px), Gestão (16-20px, 8px), Admin (12-16px, 6-8px) | Design System |

#### Componentes Pastorais (Core)

| ID | Requisito | Release |
|----|-----------|---------|
| UX-DR04 | Implementar `SemaforoPill` — componente de status visual (verde/amarelo/vermelho) com aria-live para mudanças de estado | R2 |
| UX-DR05 | Implementar `ParticipantCard` — card expansível com nome, foto, semáforo, contexto pastoral e CTA "Cuidar" | R2 |
| UX-DR06 | Implementar `TimelineCuidado` — timeline sinal → ação → resultado por participante (modo cronológico R2, modo correlacionado R3) | R2 |
| UX-DR07 | Implementar `NudgePastoral` — notificação contextual que guia o líder para ação de cuidado | R2 |
| UX-DR08 | Implementar `useUndoableAction` hook + `UndoToast` — padrão undo para ações pastorais com timeout configurável | R2 |
| UX-DR09 | Implementar `CelebrationBanner` — feedback positivo para marcos de progresso do participante | R2 |
| UX-DR10 | Implementar `InboxZeroState` — estado vazio otimista quando todas as pendências pastorais estão resolvidas | R2 |
| UX-DR11 | Implementar `SaudacaoCard` — saudação contextual com resumo pastoral ("Bom dia, Pastor Marcos. Seu grupo tem 12 pessoas...") | R2 |

#### Componentes de Suporte

| ID | Requisito | Release |
|----|-----------|---------|
| UX-DR12 | Implementar `TrailPlaylist` — visualização tipo playlist com módulos, aulas, barra de progresso e status de conclusão | R2 |
| UX-DR13 | Implementar `MeetingCard` — card de reunião com data, hora, status e botão de entrada 1-tap | R2 |
| UX-DR14 | Implementar `OnboardingWizard` — wizard de onboarding multi-step para participante (R2) e admin/adoção (R3) | R2/R3 |
| UX-DR15 | Implementar `GroupCard` — card de grupo com nome, líder e semáforo agregado | R3 |

#### Vocabulário Pastoral

| ID | Requisito | Escopo |
|----|-----------|--------|
| UX-DR16 | Criar `vocabulary.ts` como fonte única de termos pastorais em packages/types. Lint rule bloqueia strings de monitoramento hardcoded fora do vocabulary | Cross-cutting |

#### Navegação & Layout

| ID | Requisito | Escopo |
|----|-----------|--------|
| UX-DR17 | Implementar navegação unificada com `navigationConfig` única: bottom tabs (mobile) e sidebar fixa 240px (desktop). 5 tabs: Radar, Reuniões, Trilhas, Perfil, Mais. <=360px: ícones-only | Layout |
| UX-DR18 | Implementar layout responsivo mobile-first com breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px. Max-content: 1280px (max-w-7xl) | Layout |

#### Acessibilidade

| ID | Requisito | Escopo |
|----|-----------|--------|
| UX-DR19 | Garantir WCAG 2.1 AA em todas as interfaces. Contraste mínimo: textos 4.5:1, gráficos/ícones 3:1. Touch targets >= 44px | Acessibilidade |
| UX-DR20 | Implementar `aria-live="polite"` em mudanças de estado do semáforo. Suporte a reduced motion para todas as animações | Acessibilidade |
| UX-DR21 | Implementar teste automatizado de contraste: script que lê tokens do tailwind.preset.ts, gera matriz texto × superfície, verifica ratio com wcag-contrast. Roda no CI | Acessibilidade |

#### Experiências por Persona

| ID | Requisito | Escopo |
|----|-----------|--------|
| UX-DR22 | Implementar experiência Consumo (Participante): rota /app/consumo/* — home com 3 cards (Trilha/Reunião/Progresso), trilha playlist, content viewer, reunião 1-tap, meu progresso | Telas |
| UX-DR23 | Implementar experiência Gestão (Líder): rota /app/gestao/* — dashboard semáforo, radar pastoral com filtros, inbox cuidado, timeline cuidado, reunião host view, relatórios líder | Telas |
| UX-DR24 | Implementar experiência Administração (Admin): rota /app/admin/* — visão geral KPI, grupos, líderes, catálogo trilhas, configurações tenant, relatórios admin | Telas |
| UX-DR25 | Implementar experiência Super Admin: rota /app/admin/super/* — control plane dashboard, provisionamento tenant (wizard 3 steps), audit log, métricas cross-tenant | Telas |
| UX-DR26 | Implementar fluxo de onboarding/adoção: landing page, demo interativa com dados ficcionais, cadastro Google/email, wizard 5 steps (perfil, igreja, grupo, líder, radar) | Telas |

#### Performance UX

| ID | Requisito | Escopo |
|----|-----------|--------|
| UX-DR27 | Implementar skeleton placeholders para evitar CLS. Lazy loading para componentes below the fold. Dynamic imports para componentes pesados (TimelineCuidado, TelaReentry) | Performance |

### FR Coverage Map

| FR | Epic | Descrição |
|----|------|-----------|
| FR01 | Epic 2 | Cadastro com e-mail e senha |
| FR02 | Epic 2 | Login via OAuth (Google) |
| FR03 | Epic 2 | Usuário associado a múltiplos tenants |
| FR04 | Epic 2 | Autenticação centralizada via Keycloak |
| FR05 | Epic 2 | Autorização baseada em papéis e contexto tenant |
| FR06 | Epic 2 | Papéis: Super Admin, Admin Tenant, Líder, Participante |
| FR07 | Epic 2 | Isolamento de dados por tenant (RLS) |
| FR08 | Epic 2 | Admin Tenant gerencia usuários e papéis |
| FR09 | Epic 2 | Defesa em profundidade (3 camadas) |
| FR10 | Epic 2 | Seleção de tenant ativo |
| FR11 | Epic 2 | Revogação de sessão ao remover usuário |
| FR83 | Epic 2 | Recuperação de senha via email (Keycloak nativo) |
| FR12 | Epic 3 | Provisionamento de novos tenants |
| FR13 | Epic 11 | Planos de assinatura (Free/Pro/Enterprise) |
| FR14 | Epic 11 | Limites numéricos por plano |
| FR15 | Epic 11 | Branding básico do tenant |
| FR16 | Epic 11 | Políticas e feature toggles do tenant |
| FR17 | Epic 11 | Prompt de upgrade ao atingir limites |
| FR18 | Epic 3 | Super Admin gerencia tenants |
| FR19 | Epic 3 | Metadata do tenant |
| FR20 | Epic 4 | CRUD de grupos dentro do tenant |
| FR21 | Epic 4 | Vincular/desvincular participantes a grupo |
| FR22 | Epic 4 | Vincular/desvincular líderes a grupo |
| FR23 | Epic 4 | Convite via e-mail ou link |
| FR24 | Epic 4 | Associar trilhas a grupo |
| FR25 | Epic 4 | Lista de membros com status para Líder |
| FR26 | Epic 4 | Participante visualiza seus grupos |
| FR27 | Epic 10 | Importação em massa via CSV |
| FR28 | Epic 10 | Validação de dados importados |
| FR29 | Epic 8 | Criar trilhas de ensino |
| FR30 | Epic 8 | Criar módulos dentro de trilha |
| FR31 | Epic 8 | Criar aulas dentro de módulos |
| FR32 | Epic 8 | Tipos de conteúdo: vídeo, texto, PDF, links |
| FR33 | Epic 8 | Upload de arquivos de conteúdo |
| FR34 | Epic 8 | Visualização inline de conteúdo |
| FR35 | Epic 8 | Acesso sequencial ou livre |
| FR36 | Epic 8 | Pré-requisitos entre módulos/aulas |
| FR37 | Epic 8 | Progresso individual por aula/módulo/trilha |
| FR38 | Epic 8 | Percentual de conclusão por participante |
| FR39 | Epic 8 | Regras de conclusão de aula |
| FR40 | Epic 8 | Publicação e versionamento de conteúdo |
| FR41 | Epic 8 | Trilhas no nível tenant (catálogo) |
| FR42 | Epic 13 | Templates de conteúdo reutilizáveis (Release 2) |
| FR43 | Epic 5 | Criar reuniões vinculadas a grupo |
| FR44 | Epic 5 | Integração agnóstica com provedor de vídeo (LiveKit MVP) |
| FR45 | Epic 5 | Eventos do provedor de vídeo |
| FR46 | Epic 5 | Presença automática (integral/parcial) |
| FR47a | Epic 5 | Tempo com câmera ligada |
| FR47b | Epic 5 | Tempo de permanência na sala |
| FR47c | Epic 5 | Indicador de foco (feature toggle) |
| FR48 | Epic 5 | Tolerância a desconexões (janela reconexão) |
| FR49 | Epic 5 | Relatório pós-reunião automático |
| FR50 | Epic 5 | Banner de transparência |
| FR51 | Epic 5 | Estado da reunião em cache |
| FR52 | Epic 5 | Líder inicia/encerra reuniões |
| FR53 | Epic 5 | Notificação de reuniões agendadas |
| FR54 | Epic 6 | Dashboard semáforo por participante |
| FR55 | Epic 6 | Classificação semáforo configurável |
| FR56 | Epic 6 | Perfil consolidado do participante |
| FR57 | Epic 6 | Ações de cuidado pastoral |
| FR58 | Epic 6 | Atualização em tempo real via SSE |
| FR59 | Epic 6 | Indicadores de tendência |
| FR60 | Epic 6 | Dashboard agregado para Admin Tenant |
| FR61 | Epic 6 | Alertas de mudança de status |
| FR62 | Epic 6 | Vocabulário pastoral obrigatório |
| FR63 | Epic 13 | Relatório por reunião |
| FR64 | Epic 8 | Relatório por trilha |
| FR65 | Epic 13 | Relatório por tenant (agregado) |
| FR66 | Epic 13 | Detecção de risco de evasão |
| FR67 | Epic 13 | Métricas de plataforma (Super Admin) |
| FR68 | Epic 8 | Exportação de relatórios em CSV |
| FR69 | Epic 7 | Tela de boas-vindas personalizada |
| FR70 | Epic 10 | Onboarding guiado para Admin Tenant |
| FR71 | Epic 10 | Dados de demonstração |
| FR72 | Epic 2 | Consentimento LGPD |
| FR73 | Epic 9 | Exportação de dados pessoais (portabilidade) |
| FR74 | Epic 9 | Exclusão de dados pessoais (eliminação) |
| FR75 | Epic 2 | Política de privacidade e termos de uso |
| FR76 | Epic 8 | Busca full-text por conteúdo |
| FR77 | Epic 14 | Notificações in-app |
| FR78 | Epic 16 | Preferências de notificação (Post-MVP) |
| FR79 | Epic 13 | Relatório consolidado por líder |
| FR80 | Epic 9 | Log de auditoria |
| FR81 | Epic 7 | Mensagens de erro claras e acionáveis |
| FR82 | Epic 16 | Funcionalidade offline (Post-MVP) |

### NFR Coverage Map

| NFR | Categoria | Descrição | Epic(s) | Stories |
|-----|-----------|-----------|---------|---------|
| NFR-P1 | Performance | Entrada na reunião < 3s | Epic 5 | 5.3, 5.4 |
| NFR-P2 | Performance | Dashboard do líder <= 2s | Epic 6 | 6.1, 6.2 |
| NFR-P3 | Performance | Atualização do semáforo <= 2s | Epic 6 | 6.1, 6.3 |
| NFR-P4 | Performance | Lista de presença <= 1s | Epic 5 | 5.4, 5.5 |
| NFR-P5 | Performance | Página de trilha <= 2,5s | Epic 8 | 8.1, 8.4 |
| NFR-P6 | Performance | Player de vídeo <= 2s | Epic 8 | 8.3 |
| NFR-P7 | Performance | Início de reprodução <= 3s | Epic 8 | 8.3 |
| NFR-P8 | Performance | Documento/texto de aula <= 2s | Epic 8 | 8.3 |
| NFR-S1 | Segurança | Hash Argon2id para senhas | Epic 2 | 2.1 |
| NFR-S2 | Segurança | Senha mínima 12 caracteres | Epic 2 | 2.1 |
| NFR-S3 | Segurança | Senhas vazadas bloqueadas | Epic 2 | 2.1 |
| NFR-S4 | Segurança | MFA obrigatório Super Admin/Admin | Epic 2 | 2.3 |
| NFR-S5 | Segurança | MFA opcional para Líder | Epic 16 | 16.3 |
| NFR-S6 | Segurança | TLS obrigatório em trânsito | Epic 1 | 1.1, 1.2 |
| NFR-S7 | Segurança | Criptografia at-rest | Epic 1 | 1.1, 1.2 |
| NFR-S8 | Segurança | Segredos via secret manager | Epic 1 | 1.1, 1.2 |
| NFR-S9 | Segurança | Sessões com alta entropia | Epic 2 | 2.2, 2.4 |
| NFR-S10 | Segurança | Isolamento tenant verificável | Epic 2 | 2.6 |
| NFR-E1 | Escalabilidade | Escala horizontal stateless | Epic 3 | 3.1 |
| NFR-E2 | Escalabilidade | Reunião escala independente | Epic 5 | 5.3, 5.6 |
| NFR-E3 | Escalabilidade | Semáforo via BullMQ assíncrono | Epic 6 | 6.1, 6.3 |
| NFR-C1 | Confiabilidade | Uptime >= 99,5% | Transversal | 1.3, 1.5 |
| NFR-C2 | Confiabilidade | Alerta de uptime | Epic 1 | 1.5 |
| NFR-C3 | Confiabilidade | Post-mortem documentado | Epic 16 | 16.7 |
| NFR-C4 | Confiabilidade | Snapshots diários + backups | Transversal | 1.2, 16.7 |
| NFR-C5 | Confiabilidade | Storage versionamento | Epic 16 | 16.7 |
| NFR-C6 | Confiabilidade | Teste de restore documentado | Epic 16 | 16.7 |
| NFR-C7 | Confiabilidade | Runbook DR testado | Epic 16 | 16.7 |
| NFR-L1 | LGPD | Exportação dados <= 72h | Epic 9 | 9.1 |
| NFR-L2 | LGPD | Exclusão dados <= 30 dias | Epic 9 | 9.2 |
| NFR-L3 | LGPD | Consentimento antes de processamento | Epic 2 | 2.8 |
| NFR-L4 | LGPD | Feature toggle foco desativado por padrão | Epic 5 | 5.5 |
| NFR-L5 | LGPD | Base legal documentada | Epic 9 | 9.3 |
| NFR-A1 | Acessibilidade | Navegação por teclado | Epic 12 | 12.1, 12.2 |
| NFR-A2 | Acessibilidade | Contraste e foco WCAG AA | Epic 12 | 12.3, 12.4 |
| NFR-A3 | Acessibilidade | Formulários acessíveis | Epic 12 | 12.5 |
| NFR-A4 | Acessibilidade | Leitores de tela áreas críticas | Epic 15 | 15.1, 15.2, 15.4 |
| NFR-A5 | Acessibilidade | Semáforo não dependente de cor | Epic 15 | 15.3 |
| NFR-A6 | Acessibilidade | Legendas/transcrição vídeo | Epic 16 | 16.6 |
| NFR-O1 | Observabilidade | Logs troubleshooting <= 5min | Epic 1 | 1.5 |
| NFR-O2 | Observabilidade | Alerta automático com contexto | Epic 1 | 1.5 |
| NFR-O3 | Observabilidade | Métricas básicas de saúde | Epic 1 | 1.3, 1.5 |
| NFR-O4 | Observabilidade | Métricas por integração | Epic 16 | 16.4 |
| NFR-O5 | Observabilidade | Tracing distribuído | Epic 16 | 16.5 |
| NFR-X1 | Onboarding | Admin cria grupo <= 10 min | Epic 7 | 7.1 |
| NFR-X2 | Onboarding | Líder acessa dashboard <= 3 min | Epic 7 | 7.1 |
| NFR-X3 | Onboarding | Participante acessa trilha <= 2 min | Epic 7 | 7.1 |
| NFR-I1 | Integrações | Operação sem provedor por 30 min | Epic 14 | 14.1, 14.3 |
| NFR-I2 | Integrações | Retry automático falhas transitórias | Epic 14 | 14.1, 14.3 |
| NFR-I3 | Integrações | Timeouts: connect <= 3s, read <= 10s | Epic 14 | 14.3 |
| NFR-I4 | Integrações | Jobs falhados retidos | Epic 14 | 14.1, 14.2 |
| NFR-I5 | Integrações | Health check por integração | Epic 14 | 14.4 |

## Epic List

### Epic 1: Fundação Habilitadora do Produto (Release 1a-alpha)
Épico habilitador (não entrega valor direto ao usuário). Desenvolvedor pode clonar, rodar `pnpm dev` e ter monorepo Turborepo + Next.js + NestJS + PostgreSQL + Keycloak + Redis + LiveKit via Docker Compose, com CI/CD, design tokens e layout base configurados.
**FRs cobertos:** Nenhum (habilita todos)
**NFRs cobertos:** NFR-O1, NFR-O2, NFR-C2, NFR-S6, NFR-S7, NFR-S8
**UX-DRs cobertos:** UX-DR01, UX-DR02, UX-DR03, UX-DR17, UX-DR18
**Pre-mortem gates:**
- Spike técnico de real-time: webhook LiveKit simulado → Redis → BullMQ → SSE → frontend consome (PoC validada antes de qualquer FR de reunião)
- Spike Keycloak: 3 dias time-boxed para configurar multi-tenant, 4 roles iniciais, Google OAuth. Se falhar, reavaliar stack de auth antes do Epic 2. Realm exportado como JSON para reprodutibilidade
- jest-axe configurado no CI desde a primeira PR — acessibilidade automatizada como gate
- Testes RLS base configurados no pipeline com helper que provisiona 2 tenants e valida isolamento
- Observabilidade: Pino structured logging + Sentry + RequestContext (AsyncLocalStorage) com auto-inject tenant_id/user_id
- Prisma v7 com extensão multi-tenant + UUID v7 + Zod em packages/types desde o dia 1

### Epic 2: Identidade, Acesso & Multi-tenancy (Release 1a-alpha)
Usuário pode se cadastrar (email/Google), fazer login, selecionar tenant, ter dados isolados por RLS. Admin gerencia usuários e papéis. Consentimento LGPD e termos de uso no cadastro.
**FRs cobertos:** FR01–FR11, FR72, FR75, FR83
**NFRs cobertos:** NFR-S1–S4, NFR-S9, NFR-S10, NFR-L3
**Pre-mortem gates:**
- Começar com 4 roles (Super Admin, Admin Tenant, Líder, Participante). Editor de Conteúdo e Auditor adicionados em épicos posteriores
- Suite de testes RLS inclui cenários com JOINs, subqueries e aggregações desde o início

### Epic 3: Provisionamento de Tenant & Configuração Básica (Release 1a-alpha)
Super Admin provisiona tenants com dados mínimos. Metadata registrada. Gestão de tenants pela plataforma.
**FRs cobertos:** FR12, FR18, FR19
**NFRs cobertos:** NFR-E1
**Pre-mortem gate:**
- Limites básicos hardcoded por plano (Free = max 3 grupos, 15 membros/grupo) já implementados como guard simples

### Epic 4: Grupos, Membros & Convites (Release 1a-alpha)
Admin/Líder cria grupos, vincula participantes e líderes, envia convites (email/link), associa trilhas a grupos. Participante vê seus grupos. Líder vê lista de membros com status.
**FRs cobertos:** FR20–FR26
**Pre-mortem gate:**
- Limites hardcoded do Epic 3 aplicados (guard bloqueia criação além do limite do plano)
- Testes RLS para queries de membros cross-group

### Epic 5: Reuniões ao Vivo & Presença MVP (Release 1a-beta)
Líder cria e gerencia reuniões vinculadas a grupos. Integração com LiveKit (adapter pattern para troca futura). Presença automática, telemetria básica (câmera, permanência, foco via feature toggle), banner de transparência, lista de presença em tempo real, estado em cache.
**FRs cobertos:** FR43–FR53
**NFRs cobertos:** NFR-P1, NFR-P4, NFR-E2, NFR-L4
**UX-DRs cobertos:** UX-DR13
**Pre-mortem gates:**
- Spike de real-time do Epic 1 já validou o pipeline. Épico não inicia sem spike aprovado
- Teste de integração com 2 salas LiveKit simultâneas em tenants diferentes, validando isolamento de webhooks e namespace Redis
- Testes RLS para queries de presença com JOINs reunião↔grupo↔participante

### Epic 6: Radar Pastoral & Visibilidade MVP (Release 1a-beta)
Dashboard semáforo por participante baseado em sinais de presença de reunião (semáforo "completo" com progresso de trilhas só após Epic 8). Inclui tendência temporal (3 últimas reuniões) e tempo médio de permanência. Perfil consolidado, ações de cuidado pastoral, SSE, indicadores de tendência, alertas de mudança de status, vocabulário pastoral.
**FRs cobertos:** FR54–FR62
**NFRs cobertos:** NFR-P2, NFR-P3, NFR-E3
**UX-DRs cobertos:** UX-DR04–DR11, UX-DR16, UX-DR20
**Pre-mortem gates:**
- Escopo reduzido explícito: semáforo funciona com sinais de presença + tendência temporal + permanência
- Documentado que semáforo "completo" (+ progresso trilhas) requer Epic 8
- Dados demo disponíveis via Epic 7

### Epic 7: Onboarding Mínimo (Release 1a-beta)
Tela de boas-vindas, mensagens de erro acionáveis, dados de demonstração realistas que populam o Radar com cenários ficcionais.
**FRs cobertos:** FR69, FR81
**NFRs cobertos:** NFR-X1, NFR-X2, NFR-X3
**Pre-mortem gate:**
- Dados demo incluem: 1 grupo fictício com ~10 participantes, 3 reuniões históricas com presenças variadas, semáforos em estados diferentes (verde/amarelo/vermelho). Líder abre o Radar e vê valor imediato

### Epic 8: Trilhas, Conteúdo, Progresso, Relatórios & Busca (Release 1b)
Trilhas com módulos e aulas (vídeo, texto, PDF, links). Upload, visualização inline, progresso, conclusão, acesso sequencial/livre, pré-requisitos, publicação/versionamento, catálogo tenant. Relatório por trilha, exportação CSV. Busca full-text (PostgreSQL tsvector, scoped por RLS). Tela "Minhas Trilhas" para participante.
**FRs cobertos:** FR29–FR41, FR64, FR68, FR76
**NFRs cobertos:** NFR-P5–P8
**UX-DRs cobertos:** UX-DR12, UX-DR22 (parcial — listagem trilhas), UX-DR27
**Nota:** Quando este épico ficar pronto, o semáforo do Epic 6 evolui automaticamente para incluir sinais de progresso de trilhas

### Epic 9: Privacidade, LGPD & Compliance (Release 1b)
Exportação de dados pessoais (portabilidade), solicitação de exclusão (eliminação), base legal documentada. Log de auditoria de ações administrativas.
**FRs cobertos:** FR73, FR74, FR80
**NFRs cobertos:** NFR-L1, NFR-L2, NFR-L5

### Epic 10: Onboarding Avançado & Adoção (Release 1b)
Wizard guiado para Admin Tenant. Dados de demonstração expandidos. Importação em massa via CSV com validação.
**FRs cobertos:** FR27, FR28, FR70, FR71
**UX-DRs cobertos:** UX-DR14, UX-DR26

### Epic 11: Planos, Limites & Feature Gating (Release 1b)
Configuração dinâmica de planos (Free/Pro/Enterprise), limites configuráveis, branding, políticas/feature toggles, prompt de upgrade. Evolui os limites hardcoded do Epic 3.
**FRs cobertos:** FR13–FR17
**Pre-mortem gate:**
- Evolui hardcoded → dinâmico. Guard simples do Epic 3 é substituído por configuração em banco

### Epic 12: Hardening de Acessibilidade & Qualidade UX (Release 1b)
Auditoria de acessibilidade, navegação por teclado completa em todos os fluxos, contraste WCAG AA, formulários acessíveis, teste automatizado de contraste no CI. (Itens automáticos já são gate desde Epic 1; este épico cobre validação manual e gaps.) UX-DR07 (NudgePastoral) e UX-DR09 (CelebrationBanner) removidos deste épico — são componentes pastorais R2 já cobertos no Epic 13.
**NFRs cobertos:** NFR-A1–A3
**UX-DRs cobertos:** UX-DR19, UX-DR21

### Epic 13: Relatórios Avançados & Analytics (Release 2)
Relatório por reunião, por tenant (agregado), métricas de plataforma (Super Admin), detecção de risco de evasão, relatório consolidado por líder. Templates de conteúdo reutilizáveis.
**FRs cobertos:** FR42, FR63, FR65–FR67, FR79

### Epic 14: Notificações & Comunicação (Release 2)
Notificações in-app via SSE (reuniões, conteúdo, alertas pastorais). Integração resiliente com provedores externos (timeouts, retries, health checks).
**FRs cobertos:** FR77
**NFRs cobertos:** NFR-I1–I5

### Epic 15: Acessibilidade Avançada (Release 2)
Compatibilidade com leitores de tela nas áreas críticas, semáforo com ícones/texto complementar obrigatórios.
**NFRs cobertos:** NFR-A4, NFR-A5

### Epic 16: Resiliência, Offline & Expansões Futuras (Post-MVP)
PWA/Service Worker para conteúdo já visualizado. Preferências de notificação. MFA para Líder. Métricas por integração. Tracing distribuído. Legendas/transcrição.
**FRs cobertos:** FR78, FR82
**NFRs cobertos:** NFR-S5, NFR-O4, NFR-O5, NFR-A6, NFR-C3, NFR-C5–C7

---

## Epic 1: Fundação Habilitadora do Produto

Épico habilitador (não entrega valor direto ao usuário). Desenvolvedor pode clonar, rodar `pnpm dev` e ter monorepo Turborepo + Next.js + NestJS + PostgreSQL + Keycloak + Redis + LiveKit via Docker Compose, com CI/CD, observabilidade, design tokens e layout base configurados.

### Story 1.1: Scaffold do Monorepo Turborepo com Next.js, NestJS, Prisma e Docker Compose Mínimo

As a developer,
I want a monorepo scaffold with Turborepo, Next.js (App Router), NestJS, Prisma v7, and shared packages, plus a minimal Docker Compose with PostgreSQL and Redis,
So that I can run `pnpm dev` and have a fully functional local development environment with database, validation contracts and multi-tenant test infrastructure from day one.

**Acceptance Criteria:**

**Given** the repository is cloned and `pnpm install` is run
**When** I execute `docker compose up` followed by `pnpm dev`
**Then** PostgreSQL is running on port 5432 with a `metanoia_dev` database
**And** Redis is running on port 6379
**And** Next.js starts on port 3000 and renders a stub page at `/`
**And** NestJS starts on port 3001 and exposes `GET /api/health` returning `{ "status": "ok" }`
**And** NestJS connects successfully to PostgreSQL and Redis on boot
**And** the monorepo structure follows: `apps/web`, `apps/api`, `packages/ui`, `packages/types`, `packages/config`
**And** TypeScript `strict: true` is enabled in all packages
**And** ESLint and Prettier are configured with shared config in `packages/config`
**And** Turborepo pipelines are configured for `dev`, `build`, `lint`, `test`, `db:migrate`, `db:rls`, `db:setup`, `db:seed`
**And** a `.env.example` file documents all required environment variables
**And** `@nestjs/config` validates all required env vars on boot with Zod — missing vars cause immediate fail with clear message
**And** Prisma v7 is configured in `apps/api` with a base migration creating a `_health` table
**And** Prisma client extension auto-injects `tenant_id` on all queries (multi-tenant extension pattern)
**And** `uuidv7()` lib is installed and a `generateId()` helper is exported from `packages/types`
**And** `packages/types` is initialized with Zod 4.3.6, an example shared schema (e.g., `PaginationSchema`), and a snapshot test for that schema
**And** `pnpm turbo db:setup` executes migration + RLS policy application successfully
**And** a RLS test helper is created in `apps/api/test/rls/` that provisions 2 test tenants and validates data isolation across CRUD operations
**And** `@@map` and `@map` decorators are used for snake_case DB naming convention

### Story 1.2: Docker Compose Completo com Keycloak, MinIO e LiveKit

As a developer,
I want the Docker Compose extended with Keycloak, MinIO and LiveKit services,
So that all infrastructure dependencies are available locally for auth, storage and video features.

**Acceptance Criteria:**

**Given** Docker is installed and the base Docker Compose from Story 1.1 is running
**When** I run `docker compose up` with the complete configuration
**Then** Keycloak is running on port 8080 with a `metanoia` realm loaded from `infra/keycloak/realm-export.json` on startup
**And** MinIO is running on port 9000 with a `metanoia-storage` bucket created
**And** LiveKit is running on port 7880 with test API keys configured in `.env`
**And** NestJS boot completes without errors and connects to all services (PostgreSQL, Redis, Keycloak, MinIO)
**And** `.env.example` is updated with all new environment variables documented
**And** a `docker-compose.test.yml` is created for CI environment with ephemeral databases and minimal resource allocation
**And** a new developer cloning the repo can run `docker compose up && pnpm dev` without any manual Keycloak configuration

### Story 1.3: Pipeline CI/CD com GitHub Actions

As a developer,
I want CI/CD pipelines configured with GitHub Actions,
So that every PR is validated automatically and merges to main build Docker images.

**Acceptance Criteria:**

**Given** a PR is opened against `main` or `dev`
**When** the CI pipeline runs
**Then** it starts services using `docker-compose.test.yml` for ephemeral test databases
**And** it executes `lint`, `test`, and `build` using Turborepo remote cache
**And** Zod schema snapshot tests are included in the test pipeline
**And** RLS isolation tests are executed as a dedicated pipeline step
**And** jest-axe is configured with a smoke test on the Next.js stub page (pipeline ready for real components)
**And** the pipeline completes in under 10 minutes for a clean cache

**Given** a PR is merged to `main`
**When** the build pipeline runs
**Then** Docker images are built and tagged with the commit SHA
**And** images are pushed to the container registry

### Story 1.4: Spike Técnico — Keycloak Multi-tenant com 4 Roles e Google OAuth

As a developer,
I want a validated Keycloak configuration with multi-tenant support, 4 initial roles, and Google OAuth,
So that I have confidence the auth architecture works before building identity features.

**Acceptance Criteria:**

**Given** Keycloak is running via Docker Compose with the `metanoia` realm loaded from JSON
**When** the realm configuration is validated
**Then** 4 realm roles are defined: `super_admin`, `admin_tenant`, `lider`, `participante`
**And** Google OAuth is configured as an identity provider in the realm
**And** a test user can register with email/password and receive a valid JWT
**And** a test user can login via Google OAuth and receive a valid JWT
**And** the JWT token includes `realm_roles`, `tenant_id`, and `user_id` claims via custom mappers
**And** a NestJS `KeycloakAuthGuard` can extract and validate the JWT token
**And** the guard rejects expired, malformed, or missing tokens with appropriate error responses
**And** the final realm configuration is exported as JSON and committed to `infra/keycloak/realm-export.json`
**And** Docker Compose loads this JSON automatically on boot (no manual configuration required for new devs)
**And** **time-box:** this spike must be completed in 3 days maximum
**And** if spike fails within time-box, a decision document is created in `docs/decisions/` evaluating auth alternatives (e.g., JWT self-issued, Auth.js)

### Story 1.5: Observabilidade Base — Pino Structured Logging, Sentry e RequestContext

As a developer,
I want structured logging with Pino, error tracking with Sentry, and a RequestContext middleware using AsyncLocalStorage,
So that every request is traceable with tenant_id and user_id, and application errors generate automatic alerts with sufficient context.

**Acceptance Criteria:**

**Given** NestJS is running with the Pino logger configured
**When** an HTTP request is received
**Then** the `RequestContext` middleware extracts `tenant_id` and `user_id` from the Keycloak JWT and stores them in AsyncLocalStorage
**And** Pino automatically includes `tenant_id`, `user_id`, `request_id`, and `correlation_id` in every log line for that request
**And** logs are output as structured JSON (not plain text)
**And** unauthenticated requests (e.g., health check) log without tenant_id/user_id but still include request_id
**And** Sentry is configured for error tracking with `@sentry/nestjs`
**And** unhandled exceptions and rejected promises are captured by Sentry with tenant_id and user_id context
**And** a test utility in `apps/api/test/utils/log-capture.ts` captures Pino logs during tests and allows assertions on structured fields (tenant_id, action, etc.)
**And** NFR-O1 is met: logs are available for troubleshooting within 5 minutes (structured JSON queryable by tenant_id)
**And** NFR-O2 is met: application errors generate Sentry alerts with sufficient diagnostic context

### Story 1.6: Spike Técnico — Pipeline Real-time (LiveKit → Redis → BullMQ → SSE)

As a developer,
I want a validated proof-of-concept of the real-time pipeline using authenticated requests and structured logging,
So that I have confidence the architecture works before building meeting features.

**Acceptance Criteria:**

**Given** Keycloak spike (Story 1.4) is validated and a valid JWT token is available
**And** RequestContext middleware (Story 1.5) is injecting tenant_id/user_id into AsyncLocalStorage
**When** a simulated LiveKit webhook event `room.participant_joined` is sent to the NestJS endpoint
**Then** the RequestContext middleware extracts `tenant_id` and `user_id` from the JWT
**And** the event is stored in Redis under namespace `rt:meeting:{tenantId}:{meetingId}:presence`
**And** a BullMQ job is enqueued in `queue:meetings`
**And** the BullMQ worker processes the job and flushes the event from Redis to PostgreSQL
**And** an SSE endpoint `GET /api/v1/sse/meetings/:id` pushes the event to connected clients (authenticated via JWT)
**And** a minimal React component receives and displays the SSE event in real-time
**And** all pipeline steps produce structured Pino logs with tenant_id and meeting_id
**And** the full pipeline completes in under 2 seconds end-to-end
**And** events from Tenant A are NOT visible to SSE subscribers of Tenant B (namespace isolation validated with 2 concurrent tenants)
**And** **time-box:** this spike must be completed in 3 days maximum

### Story 1.7: Design Tokens, Tipografia, Espaçamento e shadcn/ui Base

As a developer,
I want design tokens (colors, typography, spacing) configured as CSS custom properties with Tailwind integration, and shadcn/ui initialized with base components,
So that all future UI work follows a consistent visual foundation with reusable accessible components.

**Acceptance Criteria:**

**Given** the `packages/config/tailwind.preset.ts` is loaded by Next.js
**When** I use semantic classes like `bg-surface-base`, `text-brand-teal`, `text-care-urgent`
**Then** the correct CSS custom properties are applied
**And** CSS custom properties are defined in `:root` for:
  - Brand: `brand-teal` (#2B7A78), `brand-teal-light` (#3AAFA9), `brand-teal-dark` (#17252A), `brand-terracotta` (#C1666B), `brand-terracotta-light` (#D4918A)
  - Pastoral: `care-urgent` (#C1666B), `care-attention` (#D4A24C), `care-ok` (#7BA38A), `care-neutral` (#8E8D8A)
  - Surfaces: `surface-base` (#FAFAF8), `surface-elevated` (#FFFFFF), `surface-sunken` (#F2F0ED)
  - Interactive states: `hover`, `active`, `focus`, `disabled` tokens
**And** Inter font is loaded via `next/font` with latin + latin-ext subsets
**And** typography scale is configured: Display 36px/700, H1 30px/700, H2 24px/600, Body 16px/400, Body Small 14px/400, Caption 12px/500, Overline 11px/600
**And** spacing follows base-4px scale with density tokens per experience (Consumo 20-24px, Gestão 16-20px, Admin 12-16px)
**And** structure is prepared for dark mode (CSS custom properties redefinable via `.dark` class)
**And** shadcn/ui (CLI v4) is initialized in `packages/ui/components/` with base components: Button, Card, Input, Dialog
**And** base components use the design tokens (not default shadcn colors)
**And** all base components pass jest-axe accessibility tests

### Story 1.8: Layout Base — NavigationConfig, Sidebar e Bottom Tabs

As a developer,
I want the base application layout with unified navigation that renders as bottom tabs on mobile and sidebar on desktop,
So that all future pages share a consistent navigation structure across devices.

**Acceptance Criteria:**

**Given** the design tokens and shadcn/ui components from Story 1.7 are available
**When** I navigate to the authenticated app area
**Then** a `NavigationConfig` object defines 5 tabs: Radar, Reuniões, Trilhas, Perfil, Mais
**And** on mobile (< lg breakpoint), navigation renders as bottom tabs with icons and labels
**And** on screens ≤360px, bottom tabs show icon-only with labels only on the active tab
**And** on desktop (≥ lg breakpoint), navigation renders as a fixed sidebar (240px width) with icons and full labels
**And** the active tab/item is visually highlighted with `brand-teal`
**And** responsive breakpoints work correctly: base, sm, md, lg, xl, 2xl
**And** container uses `mx-auto` and `max-w-7xl` (1280px) for main content
**And** touch targets are ≥ 44px on mobile
**And** keyboard navigation works: Tab/Shift+Tab between nav items, Enter to activate
**And** `motion-safe:transition-all` is used for any navigation transitions (with reduced-motion alternative)
**And** navigation component passes jest-axe accessibility tests

---

## Epic 2: Identidade, Acesso & Multi-tenancy

Usuário pode se cadastrar (email/Google), fazer login, selecionar tenant, ter dados isolados por RLS. Admin gerencia usuários e papéis. Consentimento LGPD e termos de uso no cadastro. Autorização em 3 camadas independentes.

### Story 2.1: Cadastro de Usuário com Email e Senha

As a new user,
I want to register with my email and password,
So that I can create an account and access the platform.

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I submit a valid email and password (minimum 12 characters, max 64+)
**Then** a migration creates tables `users`, `user_tenants`, and `consents` (if not yet created) with `tenant_id`, UUID v7 PKs, and RLS policies
**And** my account is created in Keycloak and a user record is persisted in PostgreSQL with UUID v7
**And** my password is validated against the OWASP/NIST leaked password list — common/leaked passwords are rejected with a clear message (NFR-S3)
**And** my password is stored with Argon2id hash in Keycloak (NFR-S1)
**And** I receive a confirmation email to verify my account
**And** the registration page passes jest-axe accessibility tests

**Given** I submit an email that already exists
**When** the server processes the request
**Then** I see a clear error message without revealing whether the email is registered (security best practice)

**Given** I submit a password shorter than 12 characters or longer than 64 characters
**When** the server processes the request
**Then** I see a clear validation error explaining the password requirements (NFR-S2)

### Story 2.2: Login via Email/Senha e Google OAuth

As a registered user,
I want to login with my email/password or Google account,
So that I can access my account securely.

**Acceptance Criteria:**

**Given** I am on the login page
**When** I submit valid email and password credentials
**Then** I receive a JWT token from Keycloak with `realm_roles`, `tenant_id`, and `user_id` claims
**And** the session is established with high-entropy session ID (NFR-S9)
**And** I am redirected to tenant selection (if multiple tenants) or the app dashboard

**Given** I am on the login page
**When** I click "Login with Google"
**Then** I am redirected to Google OAuth flow via Keycloak
**And** upon successful Google authentication, I receive a valid JWT with the same claims
**And** if this is my first Google login, a user record is created in PostgreSQL
**And** if this is my first login (no consent recorded), I am redirected to the LGPD consent flow (Story 2.8) before accessing the app

**Given** I submit invalid credentials
**When** the server processes the request
**Then** I see a generic error message "Email ou senha incorretos" (no credential enumeration)
**And** failed login attempts are logged in the audit trail (Pino structured log with `action: "auth.login.failed"`)

**Given** the CI pipeline runs Google OAuth tests
**When** the test suite executes
**Then** a mock identity provider is configured in Keycloak for CI (simulating Google OAuth flow without real Google credentials)
**And** the mock IdP test validates the full flow: redirect → callback → JWT issued → user created

### Story 2.3: MFA Obrigatório para Super Admin e Admin Tenant

As a Super Admin or Admin Tenant,
I want MFA enforced on my account,
So that my elevated-privilege account is protected against unauthorized access.

**Acceptance Criteria:**

**Given** I am a user with role `super_admin` or `admin_tenant`
**When** I login for the first time after MFA enforcement
**Then** I am required to configure a TOTP authenticator (e.g., Google Authenticator, Authy)
**And** subsequent logins require TOTP code after email/password

**Given** I am a user with role `lider` or `participante`
**When** I login
**Then** MFA is NOT required (NFR-S5 deferred to Post-MVP for Líder)

**Given** I am a Super Admin and I enter an incorrect TOTP code
**When** the server processes the request
**Then** login is rejected with a clear message
**And** the failed MFA attempt is logged in the audit trail (Pino: `action: "auth.mfa.failed"`)

### Story 2.4: Autorização por Papéis e Guards NestJS (3 Camadas)

As a platform operator,
I want role-based access control enforced at 3 independent layers,
So that users can only access resources permitted by their role and tenant context (FR05, FR09).

**Acceptance Criteria:**

**Given** the 3-layer authorization is configured
**When** a request reaches the API
**Then** Layer 1 (Keycloak): JWT token is validated and roles are extracted via `KeycloakAuthGuard` (from Epic 1 spike, now production-ready)
**And** Layer 2 (NestJS Guards): `RolesGuard` with `@Roles('admin_tenant', 'lider')` decorator checks the user's role. `TenantGuard` verifies the user belongs to the requested tenant
**And** Layer 3 (PostgreSQL RLS): queries are automatically scoped to `tenant_id` via Prisma extension — even if Guards are bypassed, data leakage is impossible

**Given** this story creates 3 Guards
**When** each Guard is implemented
**Then** `KeycloakAuthGuard` validates JWT signature, expiration, and extracts claims (production-hardened from spike)
**And** `RolesGuard` checks `realm_roles` claim against `@Roles()` decorator on the endpoint
**And** `TenantGuard` verifies the user's `tenant_id` matches the requested resource's tenant
**And** `GroupGuard` is NOT created in this story — deferred to Epic 4 (Grupos)

**Given** the 4 roles are defined: `super_admin`, `admin_tenant`, `lider`, `participante`
**When** each role accesses the API
**Then** `super_admin` can access all tenants and platform management endpoints
**And** `admin_tenant` can access only their tenant's management endpoints
**And** `lider` can access only their assigned groups within the tenant
**And** `participante` can access only their own data and group content

**Given** a user with role `participante` attempts to access an admin endpoint
**When** the NestJS Guard evaluates the request
**Then** the request is rejected with HTTP 403 and error `{ statusCode: 403, error: "Forbidden", message: "Insufficient permissions" }`
**And** no stack trace is exposed to the frontend
**And** the rejection is logged (Pino: `action: "auth.access.denied"`, `user_id`, `endpoint`, `required_role`)

### Story 2.5: Seleção de Tenant Ativo e Associação Multi-tenant

As a user associated with multiple tenants,
I want to select which tenant I'm working in,
So that I see only data relevant to my current context.

**Acceptance Criteria:**

**Given** I am logged in and associated with 2+ tenants (FR03)
**When** I access the platform
**Then** I see a tenant selection screen listing all my tenants with their name, my role in each, and plan status
**And** I can select one tenant to set as active

**Given** I select a tenant
**When** the selection is confirmed
**Then** the `tenant_id` is set in my JWT/session context
**And** all subsequent API requests include `tenant_id` via RequestContext (AsyncLocalStorage)
**And** the Prisma tenant extension auto-filters all queries to the active tenant
**And** the `TenantGuard` from Story 2.4 validates my access to this tenant
**And** I am redirected to the app dashboard for that tenant

**Given** I am associated with only 1 tenant
**When** I login
**Then** that tenant is automatically selected and I skip the selection screen

**Given** I want to switch tenants during a session
**When** I access the tenant switcher
**Then** I can select a different tenant and the context switches immediately
**And** the previous tenant's data is no longer accessible in the UI

**Given** one of my tenants has an expired plan
**When** I see the tenant selection screen
**Then** the expired tenant is shown with a visual indicator (e.g., "Plano expirado") and is still selectable
**And** upon selecting an expired tenant, I see a limited view with an upgrade prompt (detailed behavior in Epic 11)

### Story 2.6: Isolamento de Dados por Tenant (RLS)

As a platform operator,
I want complete data isolation between tenants enforced at the database level,
So that no data from one tenant is ever accessible by another tenant (FR07, NFR-S10).

**Acceptance Criteria:**

**Given** RLS policies are applied to all existing tables with `tenant_id` (`users`, `user_tenants`, `consents`)
**When** a query is executed via Prisma
**Then** the Prisma tenant extension automatically injects `WHERE tenant_id = :current_tenant` on all operations (SELECT, INSERT, UPDATE, DELETE)
**And** `tenant_id` is NEVER passed as a function parameter — always from AsyncLocalStorage via RequestContext

**Given** the RLS test suite runs
**When** tests execute with 2 provisioned test tenants
**Then** Tenant A cannot SELECT, UPDATE, or DELETE records belonging to Tenant B
**And** INSERT operations for Tenant A automatically set `tenant_id` to Tenant A's ID
**And** JOINs between tables (e.g., users ↔ user_tenants) respect RLS boundaries
**And** Subqueries and aggregations (e.g., COUNT of users per tenant) respect RLS
**And** the test suite runs on every PR in the CI pipeline

**Given** a new migration is created in a future epic that adds a table
**When** the migration is applied
**Then** the table MUST include `tenant_id` column
**And** an RLS policy MUST be created for the table
**And** the CI fails if RLS test coverage doesn't include the new table
**And** the RLS test framework is extensible to cover views and materialized views when created in future epics

### Story 2.7: Gestão de Usuários e Papéis pelo Admin Tenant

As an Admin Tenant,
I want to manage users and their roles within my tenant,
So that I can control who has access and what they can do (FR08).

**Acceptance Criteria:**

**Given** I am logged in as Admin Tenant
**When** I access the user management page
**Then** I see a list of all users in my tenant with their name, email, role, and status
**And** the list is scoped to my tenant only (RLS enforced)

**Given** I want to change a user's role
**When** I select a user and assign a new role (e.g., `participante` → `lider`)
**Then** the role is updated in both Keycloak and PostgreSQL
**And** the change is logged in the audit trail (Pino: `action: "auth.role.changed"`, `target_user_id`, `old_role`, `new_role`)
**And** the user's JWT is invalidated and they must re-authenticate to get updated claims

**Given** I want to remove a user from my tenant
**When** I remove the user
**Then** the user's association with this tenant is removed
**And** all active sessions and tokens for this user in this tenant are revoked (FR11)
**And** the removal is logged in the audit trail
**And** the user can still access other tenants they belong to (FR03)

**Given** I remove a user and the user attempts to use their old token
**When** the old token is sent in an API request
**Then** the request is rejected with HTTP 401 Unauthorized
**And** the rejection is logged (Pino: `action: "auth.token.revoked"`, `user_id`, `tenant_id`)

**Given** I attempt to manage users from another tenant
**When** the request reaches the API
**Then** it is rejected by RLS — no data from other tenants is visible

### Story 2.8: Consentimento LGPD e Termos de Uso (Middleware)

As a new user,
I want to review and accept the privacy policy and terms of use on my first access,
So that the platform collects my data with my explicit consent as required by LGPD (FR72, FR75, NFR-L3).

**Acceptance Criteria:**

**Given** I am completing registration via email (Story 2.1) OR logging in via Google OAuth for the first time (Story 2.2)
**When** the system detects I have no consent recorded
**Then** I am redirected to the consent screen before I can access any app functionality
**And** this redirect is implemented as a frontend middleware that checks consent status on every authenticated route

**Given** I am on the consent screen
**When** I view the documents
**Then** I see the privacy policy and terms of use as readable, scrollable documents (not just checkboxes)
**And** I must explicitly accept each document (separate checkboxes for privacy policy and terms of use)
**And** I cannot proceed to the app without accepting both

**Given** I accept the consent
**When** the system processes my acceptance
**Then** the consent timestamp, version of the documents, IP address, and user agent are recorded in the `consents` table
**And** the consent record is associated with my user ID and is immutable (append-only, no updates or deletes)
**And** I am redirected to tenant selection (Story 2.5) or the app dashboard

**Given** the privacy policy or terms are updated to a new version
**When** I next login
**Then** I am shown the updated documents and must re-accept before continuing
**And** my previous consent record is preserved (for audit trail) and a new record is created

**Given** I want to access the privacy policy or terms of use at any time
**When** I navigate to the footer or settings area
**Then** the current versions are accessible and readable without requiring re-acceptance

### Story 2.9: Recuperação de Senha via Email (Keycloak Nativo)

As a user who forgot my password,
I want to reset it via an email link without needing to contact an administrator,
So that I can regain access to my account quickly and continue my pastoral workflow (FR83).

**Release:** 1a-beta
**Origin:** WDS Phase 3 — Outline 07 (lider-recupera-acesso) expôs que password recovery não existia como FR, Story ou UI. Gap de documentação table-stakes corrigido.

**Acceptance Criteria:**

**Given** I am on the login page (`(public)/login`)
**When** I cannot remember my password
**Then** I see a discrete link "Esqueci minha senha" below the password field
**And** tapping it navigates me to `(public)/recuperar-senha`

**Given** I am on the password recovery page
**When** I enter my email address and tap "Enviar link de recuperação"
**Then** the system triggers Keycloak's native `FORGOT_PASSWORD` realm action for that email
**And** I see a generic confirmation message: "Se esse email existir na nossa base, você vai receber um link nos próximos segundos." (anti-credential-enumeration — same message regardless of whether the email exists)
**And** no information is leaked about whether the account exists

**Given** I receive the password reset email
**When** I open it
**Then** the email uses pastoral tone (not corporate security language): subject "Marcos, aqui tá o link pra sua senha nova", body with 1 short paragraph + 1 large CTA button "Criar nova senha"
**And** the email contains NO corporate footer, NO "if you did not request this email" disclaimer, NO tracking pixels
**And** the reset token expires in 15 minutes

**Given** I tap the reset link in the email
**When** the browser opens `(public)/nova-senha/[token]`
**Then** I see 2 fields: new password + confirmation
**And** OWASP password validation runs inline (same rules as Story 2.1: minimum 8 characters, no absurd special character requirements)
**And** after successful submission, the system updates my password via Keycloak Admin API
**And** a new session is created automatically (no need to go back to login)
**And** I am redirected to my default experience route (`/app/gestao/` for Líder, `/app/admin/` for Admin Tenant, `/app/consumo/` for Participante)

**Given** I try to use an expired or already-used reset token
**When** the page loads
**Then** I see a pastoral message: "Esse link já venceu — pede outro na tela de login."
**And** a button redirects me to `(public)/login`

**Given** I am rate-limited (too many reset requests)
**When** I try to request another reset
**Then** the system returns the same generic confirmation (no error revealing rate limit) but does not send a new email
**And** rate limiting follows Story 2.2 patterns (existing implementation)

**Technical Notes:**
- Backend: POST `/api/v1/auth/forgot-password` → triggers Keycloak realm action; POST `/api/v1/auth/reset-password` → validates token + updates password via Keycloak Admin API
- Frontend: 2 new routes under `(public)/` route group (SSR, no auth required)
- Email: Keycloak email template customized with pastoral tone (PT-BR)
- No new PostgreSQL tables needed — password reset is managed 100% by Keycloak (tokens, expiration, validation)
- No tenant_id involved — recovery is per-user, not per-tenant

## Epic 3: Provisionamento de Tenant & Configuração Básica

Super Admin provisiona tenants com dados mínimos de forma transacional. Metadata registrada. Gestão de tenants pela plataforma. Limites básicos hardcoded por plano implementados como guard.

### Story 3.1: Provisionamento Transacional de Tenant

As a Super Admin,
I want to provision a new tenant with minimal required data in a transactional flow,
So that tenant creation is atomic and no orphan records exist if any step fails.

**Acceptance Criteria:**

**Given** I am authenticated as Super Admin
**When** I submit the tenant provisioning form with name, slug, admin email and selected plan (Free/Pro/Enterprise)
**Then** the system creates the tenant record, Keycloak realm, and admin user in a single transaction
**And** the flow uses saga pattern (não 2PC): criar tenant no banco → criar realm Keycloak → se Keycloak falhar, marcar tenant com `status: provisioning_failed` para retry manual pelo Super Admin (botão na UI)
**And** the `tenants` table includes: `id` (UUID v7), `name`, `slug` (unique, URL-safe: `^[a-z0-9-]+$`), `status` (enum `TenantStatus`: `active`, `provisioning_failed`, `suspended`), `plan` (enum `TenantPlan`: `free`, `pro`, `enterprise`), `plan_limits_override` (JSONB, nullable), `metadata` (JSONB), `created_at`, `updated_at`
**And** slug validation rejects values that não match `^[a-z0-9-]+$` with 422 and descriptive error
**And** RLS policies are applied to the tenants table from creation
**And** the API returns 201 with the created tenant data

**Given** a tenant with `status: provisioning_failed` exists
**When** I trigger a retry for that tenant
**Then** the system retries the failed Keycloak step and updates status to `active` on success

**Given** I try to create a tenant with a slug that already exists
**When** I submit the provisioning form
**Then** the API returns 409 Conflict with a clear error message

### Story 3.2: Gestão de Tenants pelo Super Admin

As a Super Admin,
I want to list, view details, and update tenant information,
So that I can manage all tenants on the platform effectively.

**Acceptance Criteria:**

**Given** I am authenticated as Super Admin
**When** I access the tenant management area
**Then** I see a paginated list of all tenants with name, slug, plan, status and creation date
**And** I can filter by status (active/suspended/provisioning_failed), by plan (free/pro/enterprise), and search by name or slug
**And** the Super Admin bypasses RLS via `PrismaAdminService` (connection pool separado sem RLS, isolado do `PrismaService` padrão) — decisão documentada em ADR

**Given** I am viewing the tenant list
**When** I click on a specific tenant
**Then** I see the tenant detail page with all metadata (FR19): name, slug, plan, status, admin contact, member count, creation date
**And** I can edit tenant name, metadata, and status (activate/suspend)

**Given** I update a tenant's status to `suspended`
**When** users of that tenant try to access the system
**Then** they receive a clear message that their organization's access is suspended
**And** sessões ativas do tenant no Keycloak são invalidadas (logout forçado) no momento da suspensão
**And** an audit log entry is created for the status change

**Given** I am on the tenant detail page
**When** I update metadata fields
**Then** the changes are persisted and the `updated_at` timestamp is refreshed
**And** the API returns 200 with the updated tenant data

### Story 3.3: Guard de Limites por Plano (Hardcoded)

As a platform operator,
I want hardcoded plan limits enforced via a NestJS Guard,
So that tenants cannot exceed their plan's resource allocation before dynamic configuration exists.

**Acceptance Criteria:**

**Given** the system has hardcoded plan limits defined as constants:
- Free: max 3 groups, 15 members/group
- Pro: max 10 groups, 50 members/group
- Enterprise: max 50 groups, 200 members/group
**When** any resource creation request is received
**Then** a NestJS Guard (not middleware) checks the tenant's current resource count against the plan limit
**And** if the `plan_limits_override` field (from Story 3.1) is set, those values take precedence over hardcoded defaults

**Given** a tenant on the Free plan already has 3 groups
**When** a request to create a 4th group is made
**Then** the Guard returns 403 with message indicating the plan limit was reached
**And** the response includes current count, limit, and a hint about upgrading

**Given** concurrent requests attempt to create resources that would exceed the limit
**When** both requests are processed simultaneously
**Then** atomic limit enforcement via Redis `INCR` atômico ensures only one succeeds (race condition test required)
**And** the resource count is cached in Redis (`cache:tenant:{id}:resource_count`) with TTL de 5 minutos e invalidação eager on create/delete
**And** if Redis is unavailable, fallback para `SELECT COUNT` com lock pessimista no PostgreSQL (garantindo consistência mesmo sem cache)

**Given** the Guard is implemented
**When** integration tests run
**Then** tests include a simulated group creation scenario (preparation for Epic 4)
**And** tests verify Guard blocks creation at exact boundary (e.g., 3rd group OK, 4th blocked for Free plan)
**And** tests verify `plan_limits_override` correctly overrides hardcoded defaults

## Epic 4: Grupos, Membros & Convites

Admin/Líder cria grupos, vincula participantes e líderes, envia convites (email/link), associa trilhas a grupos. Participante vê seus grupos. Líder vê lista de membros com status.

### Story 4.1: CRUD de Grupos

As a Admin/Líder,
I want to create, edit and delete groups within my tenant,
So that I can organize participants into discipleship groups.

**Acceptance Criteria:**

**Given** I am authenticated as Admin or Líder
**When** I create a new group with name and description
**Then** the group is created with the schema: `id` (UUID v7), `tenant_id`, `name` (required), `description` (optional), `status` (enum: `active`, `archived`; default `active`), `created_by` (UUID), `created_at`, `updated_at`
**And** RLS policies ensure the group is only visible within the tenant
**And** the Guard do Epic 3 bloqueia criação se o limite de grupos do plano for atingido (grupos com status `archived` não contam no limite)
**And** the API returns 201 with the created group data

**Given** I am viewing a group I have access to
**When** I edit the group name or description
**Then** the changes are persisted and `updated_at` is refreshed
**And** the API returns 200 with the updated group data

**Given** I want to remove a group
**When** I delete the group
**Then** the group is soft-deleted (status changed to `archived`), not physically removed
**And** archived groups retain their members for historical/pastoral reference
**And** the API returns 200 with confirmation

**Given** groups exist in my tenant
**When** I list groups
**Then** I see a paginated list of active groups (archived excluded by default, filterable)
**And** RLS tests include JOINs and subqueries cross-tenant to verify isolation

### Story 4.2: Vincular Membros & Líderes a Grupo

As a Admin/Líder,
I want to add and remove participants and leaders from a group,
So that each group has the correct members with appropriate roles.

**Acceptance Criteria:**

**Given** I am Admin or Líder of a group
**When** I add a participant or leader to the group
**Then** a record is created in `group_members` with: `id` (UUID v7), `group_id`, `user_id`, `tenant_id`, `role` (enum: `participant`, `leader`), `status` (enum: `active`, `invited`, `inactive`), `joined_at`, `created_at`
**And** `UNIQUE(group_id, user_id)` constraint prevents duplicates — duplicate attempt returns 409 Conflict with descriptive message
**And** the Guard do Epic 3 bloqueia adição se o limite de membros/grupo do plano for atingido

**Given** I am viewing the group member list as Líder
**When** I access the members area
**Then** I see the list of members with name, role (participant/leader), status (active/invited/inactive) and join date (FR25)

**Given** I try to remove the last leader of a group
**When** I submit the removal request
**Then** the API returns 422 with message "Cannot remove the last leader of a group"
**And** the leader remains linked to the group

**Given** I remove a non-last-leader member
**When** I submit the removal request
**Then** the member is unlinked from the group
**And** RLS tests verify cross-group isolation (members of group A cannot see members of group B)

### Story 4.3: Convite via E-mail e Link

As a Admin/Líder,
I want to invite participants via email or shareable link,
So that new members can join groups without manual provisioning.

**Acceptance Criteria:**

**Given** I am Admin or Líder of a group
**When** I generate an invite link for the group
**Then** a unique token is created using `crypto.randomBytes(32).toString('base64url')` (not UUID v7, to prevent enumeration)
**And** the invite is stored in `group_invites` with: `id` (UUID v7), `group_id`, `tenant_id`, `token` (unique), `email` (nullable), `status` (enum: `pending`, `accepted`, `expired`, `revoked`), `expires_at` (7 days from creation), `created_by`, `created_at`

**Given** I send an invite via email
**When** the invite is submitted with a target email address
**Then** the email is enqueued via BullMQ job (stub implementation: logs to console in dev, real provider integration deferred to Epic 12)
**And** rate limit of 50 invites/hour per tenant is enforced via Redis `INCR` with key `rate:invite:{tenantId}` and TTL 3600s

**Given** a person receives an invite link
**When** they access the link
**Then** they are directed to register/login and automatically linked to the group upon authentication
**And** the invite status changes to `accepted`

**Given** I want to cancel a pending invite
**When** I revoke the invite
**Then** the invite status changes to `revoked` and the link becomes invalid
**And** attempting to use a revoked or expired link returns a clear error message

### Story 4.4: Associar Trilhas a Grupo

As a Admin/Líder,
I want to associate content trails to a group,
So that the group's participants have access to the assigned learning content.

**Acceptance Criteria:**

**Given** I am Admin or Líder of a group
**When** I associate one or more trails to the group
**Then** records are created in `group_trails` with: `group_id`, `trail_id`, `tenant_id`, `assigned_by` (UUID), `assigned_at` (timestamp)
**And** the endpoint accepts an array of `trail_ids` for bulk association
**And** if any `trail_id` does not exist, the API returns 422 with the list of invalid IDs (not 404)
**And** RLS ensures associations are isolated per tenant

**Given** I want to remove a trail association
**When** I unlink a trail from the group
**Then** the `group_trails` record is deleted and the API returns 204

**Given** trails do not exist yet (Epic 8)
**When** integration tests run for this story
**Then** tests use seed data with fictional trail records to validate the association flow end-to-end

### Story 4.5: Participante Visualiza Seus Grupos

As a Participante,
I want to see a list of groups I belong to,
So that I can navigate to my discipleship groups easily.

**Acceptance Criteria:**

**Given** I am authenticated as Participante
**When** I access `GET /api/v1/groups/me`
**Then** I see a paginated list of my groups with: group name, leaders (names), member count, trails associated, and my own status in the group (`active`/`invited`)
**And** pagination follows the standard meta format (total, page, limit)
**And** I can sort by group name or join date

**Given** I do not belong to any group
**When** I access `GET /api/v1/groups/me`
**Then** the API returns 200 with an empty `data` array and meta with `total: 0` (not 404)

**Given** I belong to groups in my tenant
**When** I access the endpoint
**Then** RLS guarantees I only see groups where I am a member — no cross-tenant or cross-group leakage

## Epic 5: Reuniões ao Vivo & Presença MVP

Líder cria e gerencia reuniões vinculadas a grupos. Integração com LiveKit (adapter pattern para troca futura). Presença automática, telemetria básica, banner de transparência, lista de presença em tempo real, estado em cache.

### Story 5.1: CRUD de Reuniões Vinculadas a Grupo

As a Admin/Líder,
I want to create, edit, cancel and manage meetings linked to a group,
So that I can schedule and control discipleship meetings.

**Acceptance Criteria:**

**Given** I am authenticated as Admin or Líder
**When** I create a new meeting for a group
**Then** the meeting is created with the schema: `id` (UUID v7), `tenant_id`, `group_id` (FK), `title`, `scheduled_at` (ISO 8601), `duration_minutes`, `status` (enum: `scheduled`, `in_progress`, `completed`, `cancelled`), `provider_room_id` (string, nullable — preenchido ao iniciar reunião), `created_by`, `created_at`, `updated_at`
**And** RLS policies ensure the meeting is only visible within the tenant
**And** the API returns 201 with the created meeting data

**Given** I am Líder of the meeting's group
**When** I start the meeting
**Then** the status changes to `in_progress`, a LiveKit room is created via adapter, and `provider_room_id` is populated
**And** when I end the meeting, status changes to `completed` and the room is closed

**Given** the meeting is displayed in the UI
**When** a participant views the `MeetingCard` component (UX-DR13)
**Then** the card shows date, time, status and a 1-tap entry button
**And** the entry button calls an endpoint that generates a LiveKit access token on-demand and redirects to the room

**Given** meetings exist in my group
**When** I list meetings
**Then** I see a paginated list filterable by status and group

### Story 5.2: Integração Agnóstica com LiveKit

As a platform operator,
I want a provider-agnostic video integration via adapter pattern with LiveKit as MVP implementation,
So that the video provider can be swapped in the future without code changes.

**Acceptance Criteria:**

**Given** the system needs to integrate with a video provider
**When** the adapter is implemented
**Then** the interface `VideoProviderAdapter` exposes methods: `createRoom(options)`, `deleteRoom(roomId)`, `generateToken(roomId, identity, metadata)`, `getActiveParticipants(roomId)`, `handleWebhook(headers, body)` (parses and validates provider-specific webhooks, returns typed events)
**And** `LiveKitAdapter` implements this interface as the MVP provider

**Given** a participant enters a meeting
**When** a token is generated
**Then** the token includes `room` (provider_room_id), `identity` (userId), and `metadata` (tenantId) — ensuring multi-tenant isolation
**And** entry time is < 3s (NFR-P1)

**Given** LiveKit sends a webhook
**When** the endpoint receives it
**Then** the webhook signature is validated against the LiveKit API key before processing (reject unsigned/invalid webhooks with 401)
**And** the `handleWebhook` method on the adapter parses the raw payload into typed domain events

**Given** two simultaneous meetings in different tenants
**When** integration tests run
**Then** webhooks from tenant A do not feed cache of tenant B (Redis namespace isolation: `rt:meeting:{tenantId}:{meetingId}`)
**And** meeting processing scales independently via BullMQ (NFR-E2)

### Story 5.3: Pipeline de Presença Automática

As a platform operator,
I want automatic presence tracking with reconnection tolerance and cached meeting state,
So that attendance is recorded accurately without manual intervention.

**Acceptance Criteria:**

**Given** a meeting is in progress
**When** LiveKit webhooks are received (`participant_joined`, `participant_left`, `track_published`, `track_unpublished`)
**Then** events flow through the pipeline: webhook endpoint → adapter validates signature → Redis state update (`rt:meeting:{tenantId}:{meetingId}`) → BullMQ job → PostgreSQL persistence
**And** webhook processing is idempotent: dedup via Redis `SETNX` with key `webhook:{eventId}` and TTL 1h — duplicate events are silently skipped

**Given** a meeting is active
**When** presence state is maintained in Redis
**Then** a checkpoint job (BullMQ repeatable, every 5 minutes) flushes partial state to PostgreSQL `meeting_snapshots` for crash recovery
**And** on meeting end, final flush persists complete data to `meeting_attendance`

**Given** presence is tracked
**When** a participant's total duration is calculated
**Then** presence is classified as `integral` (≥ 80% of meeting duration) or `parcial` (< 80%) — threshold hardcoded as constant (configurável por tenant deferred to Epic 11)
**And** the `meeting_attendance` table includes: `id` (UUID v7), `tenant_id`, `meeting_id`, `user_id`, `join_time`, `leave_time`, `total_duration_seconds`, `presence_type` (enum: `integral`, `parcial`, `ausente`), `reconnections` (int), `created_at`

**Given** a participant disconnects during a meeting
**When** they reconnect within the tolerance window (default: 2 min, configurable)
**Then** the disconnection does not penalize their presence record (FR48)
**And** the `reconnections` counter is incremented

**Given** presence data exists
**When** RLS tests run
**Then** tests verify isolation with JOINs across meeting↔group↔participant relationships cross-tenant

### Story 5.4: Telemetria Básica de Engajamento

As a Líder,
I want basic engagement telemetry (camera time, room duration, focus indicator),
So that I have visibility into participation quality beyond just attendance.

**Acceptance Criteria:**

**Given** a meeting is in progress and telemetry is being collected
**When** track events are processed
**Then** `camera_on_seconds` is calculated from `track_published`/`track_unpublished` events (video track only)
**And** `room_duration_seconds` is total time in room (join→leave, excluding disconnections outside tolerance window)

**Given** the focus indicator feature toggle is enabled for the tenant
**When** a participant is in a meeting
**Then** the frontend sends a heartbeat every 30s with `{ visible: boolean }` (via Page Visibility API) through WebSocket
**And** `focus_score` is calculated as `visible_seconds / total_seconds` (range 0.0–1.0)
**And** focus data is only collected AFTER the transparency banner has been displayed (privacy guarantee)

**Given** the focus indicator feature toggle is disabled (default for new tenants, NFR-L4)
**When** telemetry is processed
**Then** `focus_score` is stored as `null` and no focus heartbeats are sent from the frontend

**Given** telemetry data is collected
**When** it is persisted
**Then** it is stored in `meeting_telemetry`: `id` (UUID v7), `tenant_id`, `meeting_id`, `user_id`, `camera_on_seconds`, `room_duration_seconds`, `focus_score` (nullable, 0.0–1.0), `created_at`
**And** processing is asynchronous via BullMQ (does not block meeting flow)

### Story 5.5: Banner de Transparência & Lista de Presença Real-Time

As a Participante/Líder,
I want to see a transparency banner during meetings and the leader to see live attendance,
So that participants know what is being tracked and leaders have real-time visibility.

**Acceptance Criteria:**

**Given** a participant joins a meeting
**When** the meeting view loads
**Then** a persistent banner is displayed: "Sinais de presença e engajamento estão sendo registrados para acompanhamento pastoral" (PT-BR, pastoral vocabulary)
**And** if focus indicator toggle is ON for the tenant, the banner additionally states: "O indicador de foco de aba também está ativo"

**Given** I am Líder or Admin of the meeting's group
**When** I view the live attendance panel during a meeting
**Then** I see real-time list via SSE with: participant name, status (na sala/saiu), current duration, camera on/off
**And** updates arrive within ≤ 1s (NFR-P4)
**And** data is served from Redis cache (`rt:meeting:{tenantId}:{meetingId}`)

**Given** the SSE connection drops
**When** the client detects disconnection
**Then** automatic reconnection is triggered and the server sends full current state (not just deltas) upon reconnect

**Given** I am a Participante (not Líder/Admin)
**When** I try to access the live attendance panel
**Then** I do not have access — only Líder and Admin of the group can view the real-time presence list

### Story 5.6: Relatório Pós-Reunião & Notificações

As a Líder,
I want an automatic post-meeting report and participants to receive meeting notifications,
So that I have a summary of each meeting and participants are reminded of upcoming meetings.

**Acceptance Criteria:**

**Given** a meeting is ended (status → `completed`)
**When** the post-meeting BullMQ job processes
**Then** an automatic report is generated and stored in `meeting_reports`: `id` (UUID v7), `tenant_id`, `meeting_id`, `summary` (JSONB), `generated_at`
**And** the JSONB `summary` follows the schema: `{ attendees: [{ userId, name, presenceType, durationSeconds, cameraSeconds, focusScore }], totalDurationMinutes, avgEngagementScore, totalPresent, totalPartial, totalAbsent }`

**Given** I am Líder or Admin
**When** I access the meeting detail after completion
**Then** I see the full post-meeting report with all attendee details and aggregated metrics

**Given** I am a Participante
**When** I access a completed meeting
**Then** I see only my own presence status and duration (not the full report) — full report is restricted to Líder/Admin in MVP

**Given** a meeting is scheduled
**When** the notification time approaches (default: 30 min before, configurable)
**Then** a notification is enqueued via BullMQ (stub implementation — log + queue, real provider integration in Epic 12, same approach as Story 4.3)

## Epic 6: Radar Pastoral & Visibilidade MVP

Dashboard semáforo por participante baseado em sinais de presença de reunião (semáforo "completo" com progresso de trilhas só após Epic 8). Inclui tendência temporal, perfil consolidado, ações de cuidado pastoral, alertas de mudança de status, vocabulário pastoral.

### Story 6.1: Vocabulário Pastoral & Governança

As a platform operator,
I want a centralized pastoral vocabulary with lint enforcement across frontend and backend,
So that all communication uses care-oriented language, never surveillance terms.

**Acceptance Criteria:**

**Given** the platform needs consistent pastoral language
**When** `vocabulary.ts` is created in `packages/types`
**Then** it exports typed constants for all pastoral terms: "cuidado", "acompanhamento", "presença", "atenção pastoral", etc.
**And** lint rules are configured in both `apps/web` and `apps/api` to block surveillance/corporate terms hardcoded outside vocabulary (ex: "vigilância", "tracking", "monitoramento")
**And** any change to `vocabulary.ts` requires PR review (enforced via CODEOWNERS)

**Given** a developer adds a new UI string related to monitoring
**When** they use a hardcoded term not from vocabulary.ts
**Then** the lint rule fails CI with a descriptive error pointing to vocabulary.ts as the source of truth

### Story 6.2: Cálculo Assíncrono do Semáforo & Dashboard

As a Líder,
I want a traffic-light dashboard showing each participant's pastoral status calculated asynchronously,
So that I can quickly identify who needs attention with fast load times.

**Acceptance Criteria:**

**Given** presence events are processed (Epic 5)
**When** a BullMQ job recalculates participant status
**Then** the result is persisted in `participant_radar_status`: `id` (UUID v7), `tenant_id`, `group_id`, `participant_id`, `status` (enum: `verde`, `amarelo`, `vermelho`), `trend` (enum: `melhorando`, `estavel`, `declinio`), `presence_percentage` (decimal), `last_active_at`, `calculated_at`
**And** the result is cached in Redis (`cache:radar:{tenantId}:{groupId}`) with TTL 5min (NFR-E3)
**And** thresholds are defined as named constants in `packages/types` (not magic numbers):
- `RADAR_GREEN_THRESHOLD = 0.75` (≥75% presença últimas 3 reuniões E ativo últimos 14 dias)
- `RADAR_YELLOW_MIN = 0.50` (50–74% presença OU inativo 14–21 dias)
- `RADAR_RED_THRESHOLD = 0.50` (<50% presença OU inativo >21 dias)
- `RADAR_ACTIVE_DAYS = 14`, `RADAR_INACTIVE_DAYS = 21`

**Given** I am Líder and access the Radar dashboard
**When** the dashboard loads
**Then** I see my group's participants with `SemaforoPill` (verde/amarelo/vermelho) reading from cache — dashboard loads ≤ 2s (NFR-P2)
**And** each `SemaforoPill` has an accessible tooltip explaining the meaning (ex: "Presença consistente — participou de 3/3 últimas reuniões")
**And** `aria-live="polite"` announces status changes for screen readers (UX-DR20)
**And** all animations respect `prefers-reduced-motion`

**Given** the semáforo MVP is documented
**When** stakeholders review
**Then** it is clear that semáforo calculates only from presence signals + trend + permanence (progress de trilhas requires Epic 8)

### Story 6.3: Indicadores de Tendência & Alertas

As a Líder,
I want to see trend indicators and receive alerts when a participant's status worsens,
So that I can proactively care for participants showing declining engagement.

**Acceptance Criteria:**

**Given** a participant's status is recalculated
**When** the trend is determined from the last 3 meetings + average permanence time
**Then** the indicator shows: `melhorando` (↑), `estável` (→), or `declínio` (↓)
**And** the trend is persisted in `participant_radar_status.trend`

**Given** a participant's status changes negatively (verde→amarelo or amarelo→vermelho)
**When** the BullMQ job detects the transition
**Then** an alert is created in `pastoral_alerts`: `id` (UUID v7), `tenant_id`, `group_id`, `participant_id`, `previous_status`, `new_status`, `trend`, `created_at`, `read_at` (nullable), `dismissed_at` (nullable)
**And** dedup: only 1 alert per transition — no new alert while status remains the same (ex: stays vermelho for 3 meetings = 1 alert, not 3)
**And** semáforo updates within ≤ 2s end-to-end after event (NFR-P3)

**Given** a participant's status changes positively (vermelho→amarelo or amarelo→verde)
**When** the transition is detected
**Then** no alert is generated — positive transitions feed `CelebrationBanner` (Story 6.5)

### Story 6.4: Perfil Consolidado & Ações de Cuidado Pastoral

As a Líder,
I want to view a participant's consolidated profile and register pastoral care actions,
So that I have full context before reaching out and can track my pastoral efforts.

**Acceptance Criteria:**

**Given** I am Líder viewing the Radar
**When** I expand a participant's `ParticipantCard` (UX-DR05)
**Then** I see: name, photo, semáforo, trend, last meeting attended, average permanence time (read from `meeting_telemetry` — Epic 5), and pastoral context
**And** the card expands to show `TimelineCuidado` in reverse chronological order (most recent first): signals (presence/absence) → care actions registered → results (UX-DR06, chronological mode MVP)

**Given** no care actions have been registered for a participant
**When** the TimelineCuidado is displayed
**Then** an encouraging empty state message appears: "Nenhuma ação de cuidado registrada. Que tal começar com uma mensagem?" (pastoral tone, from vocabulary.ts)

**Given** I want to register a pastoral care action
**When** I submit the action form
**Then** the action is stored in `pastoral_actions`: `id` (UUID v7), `tenant_id`, `group_id`, `participant_id`, `leader_id`, `action_type` (enum: `ligacao`, `visita`, `mensagem`, `oracao`, `outro`), `description`, `action_date`, `created_at`
**And** the timeline updates immediately with the new action
**And** RLS ensures pastoral actions are isolated per tenant

**Given** the profile shows trail progress
**When** Epic 8 is not yet implemented
**Then** trail progress section shows "Em breve" placeholder

### Story 6.5: Componentes UX do Radar Pastoral

As a Líder,
I want contextual nudges, celebration banners, undo support and a pastoral greeting,
So that the Radar feels like a pastoral care companion.

**Acceptance Criteria:**

**Given** a participant has 2+ consecutive meeting absences
**When** the Líder views the Radar
**Then** a `NudgePastoral` notification appears guiding toward care action (ex: "Maria não participou das últimas 2 reuniões. Que tal uma ligação?") (UX-DR07)
**And** nudge trigger rules are: 2+ consecutive absences → suggest call; status changed to vermelho → suggest visit; 7+ days inactive → suggest message

**Given** a participant transitions positively (ex: vermelho→amarelo, amarelo→verde)
**When** the Líder views the Radar
**Then** a `CelebrationBanner` appears with positive feedback (ex: "Maria voltou a participar! Seu cuidado fez diferença.") (UX-DR09)

**Given** I register or undo a pastoral care action
**When** the action is submitted
**Then** `useUndoableAction` hook + `UndoToast` provides undo capability with 5s timeout and a visible progress indicator showing remaining time (UX-DR08)

**Given** all pastoral alerts are resolved for my group
**When** I view the Radar
**Then** `InboxZeroState` shows an optimistic empty state with pastoral message (ex: "Todos os seus participantes estão bem acompanhados!") (UX-DR10)

**Given** I open the Radar for the first time in a session
**When** the dashboard loads
**Then** `SaudacaoCard` shows a contextual greeting with pastoral summary (ex: "Bom dia, Pastor Marcos. Seu grupo tem 12 pessoas, 2 precisam de atenção.") (UX-DR11)

**And** all text strings come from `vocabulary.ts` (Story 6.1)
**And** MVP priority: `SaudacaoCard` and `NudgePastoral` are required; `InboxZeroState`, `CelebrationBanner`, and `UndoToast` are nice-to-have (can be deferred under schedule pressure)

### Story 6.6: Dashboard Agregado para Admin Tenant

As a Admin Tenant,
I want an aggregated dashboard across all groups with near-real-time updates,
So that I have organizational-level visibility of pastoral health.

**Acceptance Criteria:**

**Given** I am authenticated as Admin Tenant
**When** I access the aggregated Radar dashboard
**Then** I see: total participants by status (verde/amarelo/vermelho), distribution per group, overall trend
**And** I can filter by group, time period, and status

**Given** I am Líder (not Admin)
**When** I access the aggregated view
**Then** I see only groups where I am leader — filtering is enforced server-side (not just UI)

**Given** the aggregated dashboard needs updates
**When** data changes
**Then** updates are delivered via polling every 30s (not SSE — aggregated view is analytical, not real-time critical)
**And** data is served from aggregated Redis cache

## Epic 7: Onboarding Mínimo

Tela de boas-vindas, mensagens de erro acionáveis, dados de demonstração realistas que populam o Radar com cenários ficcionais para validação imediata de valor.

### Story 7.1: Tela de Boas-Vindas Personalizada

As a usuário (Admin/Líder/Participante),
I want a personalized welcome screen on my first access,
So that I understand the platform and know exactly what to do next.

**Acceptance Criteria:**

**Given** I am logging in for the first time
**When** the system detects `onboarding_completed_at` is `null` on my user record (column: `onboarding_completed_at` timestamp nullable in `users` table)
**Then** I see a welcome screen personalized for my role with a placeholder pastoral illustration (shepherd icon or similar) and exactly 1 primary CTA button:
- Admin Tenant: "Bem-vindo! Crie seu primeiro grupo e convide participantes" — CTA: "Criar Grupo"
- Líder: "Bem-vindo! Seu grupo está pronto. Explore o Radar Pastoral" — CTA: "Abrir Radar"
- Participante: "Bem-vindo! Veja seus grupos e comece a participar" — CTA: "Ver Meus Grupos" (not trilhas — Epic 8 not yet available)

**Given** I complete the onboarding flow (click CTA and reach destination)
**When** the onboarding is marked complete
**Then** `onboarding_completed_at` is set to current timestamp (not boolean — enables analytics on when users onboard)
**And** the welcome screen is not shown again on subsequent logins

**Given** the onboarding flow is timed
**When** benchmarked
**Then** Admin completes first group creation ≤ 10 min (NFR-X1), Líder reaches dashboard ≤ 3 min (NFR-X2)
**And** all text uses vocabulary from `vocabulary.ts` (Epic 6, Story 6.1)

### Story 7.2: Dados de Demonstração Realistas

As a novo tenant/líder,
I want realistic demo data pre-populated in my workspace,
So that I can see the Radar Pastoral in action and understand the platform value immediately.

**Acceptance Criteria:**

**Given** a new tenant is provisioned or the admin selects "Quero ver dados de exemplo" during onboarding
**When** the demo seed runs (`pnpm seed:demo`)
**Then** a dedicated demo tenant is created with `is_demo: true` flag on the `tenants` table (not per-record flags — cleanup = delete tenant with cascade)
**And** the seed is idempotent — running 2x does not duplicate data (checks if demo tenant exists before creating)

**Given** demo data is seeded
**When** the data is created
**Then** it includes:
- 1 grupo fictício ("Grupo Esperança") with ~10 participants with realistic Brazilian names (ex: "Maria Santos", "João Oliveira", "Ana Costa") and avatar placeholders with initials
- 3 historical meetings with varied attendance (integral, parcial, ausente) and realistic timestamps (last 3 weeks, not generic dates)
- Radar status distributed: ~4 verde, ~3 amarelo, ~2 vermelho, ~1 novo
- Varied trends: melhorando, estável, declínio
- 2 pastoral care actions registered
- 1 active alert (participant turned vermelho)
**And** all data uses UUID v7 and realistic timestamps
**And** demo data is RLS-isolated (does not contaminate other tenants)

**Given** the demo is seeded and a Líder logs in
**When** they complete onboarding
**Then** a guided demo walkthrough starts: Radar overview → Click a participant → View timeline → Register a care action (tour with 4 steps, skippable)
**And** the líder sees value immediately (pre-mortem gate validated)

### Story 7.3: Mensagens de Erro Acionáveis

As a usuário,
I want clear and actionable error messages,
So that I understand what went wrong and how to fix it.

**Acceptance Criteria:**

**Given** the platform needs consistent error messages
**When** errors are displayed
**Then** all user-facing error messages are centralized in `apps/web/messages/pt-BR.json` with standardized keys: `error.{context}.{action}` (ex: `error.group.create.limit_reached`, `error.auth.permission_denied`)
**And** the backend returns error keys that the frontend maps to localized messages

**Given** an error occurs
**When** the message is displayed
**Then** each error includes: what happened + what to do:
- Permission: "Você não tem permissão para esta ação. Fale com o administrador do seu grupo."
- Plan limit: "Limite do plano atingido (3/3 grupos). Fale com o administrador para upgrade."
- Not found: "Recurso não encontrado. Verifique o endereço ou volte ao início."
**And** no error displays stack traces or technical codes to the user (API format: `{ statusCode, error, message, details? }`)
**And** vocabulary pastoral is used where applicable (via `vocabulary.ts`)

**Given** a network error occurs
**When** the request fails
**Then** a skeleton loading state is shown while retrying with exponential backoff (1s, 2s, 4s — 3 attempts)
**And** after 3 failed attempts, a friendly error message replaces the skeleton: "Não foi possível carregar. Verifique sua conexão e tente novamente." with a retry button

**Given** an unhandled error occurs anywhere in the app
**When** the error propagates
**Then** a global error boundary (`error.tsx` per route segment + root fallback) catches it and displays a friendly message instead of a white screen
**And** the error is reported to Sentry (Epic 1 observability)

---

## Epic 8: Trilhas, Conteúdo, Progresso, Relatórios & Busca

Trilhas com módulos e aulas multiformato (vídeo, texto rico, PDF/DOC, links externos). Upload via MinIO, visualização inline, progresso individual, regras de conclusão por tipo de conteúdo, acesso sequencial/livre, pré-requisitos, publicação/versionamento, catálogo tenant, relatório por trilha, exportação CSV e busca full-text. Content é Core Domain — usa repository pattern obrigatório. Quando este épico estiver completo, o semáforo do Epic 6 evolui automaticamente para incluir sinais de progresso de trilhas via domain events.

### Story 8.1: CRUD de Trilhas, Módulos & Aulas com Repository Pattern

As a Admin/Líder,
I want to create, edit, delete and reorder trails, modules within trails, and lessons within modules,
So that I can structure discipleship content in a clear hierarchy that participants can follow.

**Acceptance Criteria:**

**Given** the content module is set up at `apps/api/src/modules/content/`
**When** the module is initialized
**Then** it follows the Core Domain repository pattern with: `content.module.ts`, `content.controller.ts`, `content.service.ts`, `content.repository.ts`
**And** DTOs are created: `CreateTrailDto`, `UpdateTrailDto`, `CreateModuleDto`, `UpdateModuleDto`, `CreateLessonDto`, `UpdateLessonDto` in `dto/` folder, validated with Zod schemas from `packages/types`
**And** Zod schemas have snapshot tests in `packages/types/__tests__/schemas.snapshot.test.ts` — minimum 6 snapshots: CreateTrailDto, UpdateTrailDto, CreateModuleDto, UpdateModuleDto, CreateLessonDto, UpdateLessonDto

**Given** I am authenticated as Admin or Líder within my tenant
**When** I create a trail via `POST /api/v1/trails`
**Then** a new `Trail` record is created with: `id` (UUID v7), `tenantId` (auto-injected via Prisma extension), `name`, `description`, `status` (default: `draft`), `createdBy`, `createdAt`, `updatedAt`
**And** the Prisma model uses `@@map("trails")` with fields using `@map("snake_case")`
**And** RLS policy `rls_trails_tenant_isolation` ensures queries are scoped to my tenant_id
**And** the response follows the API contract: `{ "data": { ...trail }, "meta": null }` with status 201

**Given** a trail exists in my tenant
**When** I create a module via `POST /api/v1/trails/:trailId/modules`
**Then** a new `Module` record is created with: `id` (UUID v7), `trailId`, `tenantId`, `name`, `order` (auto-increment within trail), `createdAt`, `updatedAt`
**And** the `order` field supports reordering via `PATCH /api/v1/trails/:trailId/modules/reorder` accepting an array of module IDs
**And** the reorder endpoint returns 422 if the array contains duplicate IDs, IDs not belonging to this trail, or a count mismatch with existing modules

**Given** a module exists in my tenant
**When** I create a lesson via `POST /api/v1/trails/:trailId/modules/:moduleId/lessons`
**Then** a new `Lesson` record is created with: `id` (UUID v7), `moduleId`, `tenantId`, `name`, `contentType` (enum: `video`, `rich_text`, `pdf_doc`, `external_link`), `contentUrl` (nullable — set in Story 8.2), `order`, `estimatedDurationMinutes`, `createdAt`, `updatedAt`
**And** the `order` field supports reordering via `PATCH /api/v1/trails/:trailId/modules/:moduleId/lessons/reorder`
**And** the same 422 validation rules from module reorder apply to lesson reorder (duplicate IDs, wrong parent, count mismatch)

**Given** I try to access a trail from another tenant
**When** the query executes
**Then** RLS blocks the access and returns 404 (not 403, to prevent tenant enumeration)
**And** RLS isolation tests in `apps/api/test/rls/` validate cross-tenant isolation for trails, modules, and lessons

**Given** I delete a trail via `DELETE /api/v1/trails/:trailId`
**When** the trail has modules and lessons
**Then** soft-delete is applied (field `deletedAt`) — cascade soft-deletes modules and lessons
**And** the response is 204 (no body)

### Story 8.2: Tipos de Conteúdo, Upload & Visualização Inline

As a Admin/Líder,
I want to upload content files (video, PDF/DOC) and reference external links and rich text for lessons,
So that participants can consume discipleship content directly in the platform without downloading files.

**Acceptance Criteria:**

**Given** a lesson exists with `contentType: video`
**When** I upload a video file via `POST /api/v1/content/upload`
**Then** the file is stored in MinIO under bucket `metanoia-storage` with key `content/{tenantId}/{trailId}/{lessonId}/{filename}`
**And** the storage policy is `permanent` (content is retained indefinitely, not subject to 90-day expiration)
**And** the `Lesson.contentUrl` is updated with the MinIO object key (not a signed URL — URLs are signed on read)
**And** file metadata is stored: `originalName`, `mimeType`, `sizeBytes`, `uploadedBy`, `uploadedAt`
**And** all content records store indexable metadata: `title`, `description`, `tags` (text array — used for full-text search in Story 8.8)

**Given** a lesson has `contentType: video` and a valid `contentUrl`
**When** a participant navigates to the lesson page
**Then** a video player is rendered inline using native `<video>` element with signed MinIO URL generated via `storage.service.getSignedUrl(objectKey, expiration)` from Epic 1 storage module (expiration: 4 hours)
**And** the video player is visible within 2 seconds of page load (NFR-P6) — verified via Playwright `page.waitForSelector('video', { state: 'visible' })` with 2000ms timeout in E2E tests
**And** video playback begins within 3 seconds on stable network (NFR-P7) — verified via Playwright `video.evaluate(v => v.readyState >= 3)` assertion with 3000ms timeout

**Given** a lesson has `contentType: pdf_doc` and a valid `contentUrl`
**When** a participant navigates to the lesson page
**Then** the document is rendered inline using a PDF viewer component (no forced download)
**And** the document is legible and navigable within 2 seconds (NFR-P8)

**Given** a lesson has `contentType: rich_text`
**When** the Admin/Líder edits the lesson
**Then** a rich text editor is available for content authoring (bold, italic, headings, lists, links, images)
**And** the rendered content is stored as HTML in the `contentBody` field (no external file — stored in DB)

**Given** a lesson has `contentType: external_link`
**When** a participant navigates to the lesson
**Then** the external URL is displayed with a preview card and an "Abrir em nova aba" button
**And** the link opens in a new tab with `rel="noopener noreferrer"`

**Given** the trail page loads with all content types
**When** the page renders
**Then** the full page loads within 2.5 seconds (NFR-P5)
**And** `content.repository.ts` handles all queries with N+1 prevention (eager loading modules + lessons in a single query)

### Story 8.3: Progresso Individual & Percentual de Conclusão

As a Participante,
I want my progress to be tracked automatically as I consume trail content,
So that I can see how far I've advanced and resume where I left off.

**Acceptance Criteria:**

**Given** I am a participant assigned to a group that has a trail associated
**When** I open a lesson for the first time
**Then** a `LessonProgress` record is created with: `id` (UUID v7), `userId`, `lessonId`, `tenantId`, `status` (enum: `not_started`, `in_progress`, `completed`), `progressPercent` (0-100), `startedAt`, `completedAt` (nullable), `lastAccessedAt`
**And** the record is persisted via `content.repository.ts` (repository pattern)

**Given** I am consuming a lesson
**When** a progress event occurs (video time update, scroll position, manual mark)
**Then** a BullMQ job is enqueued in `queue:lesson-progress` with payload: `{ userId, lessonId, tenantId, progressPercent, eventType }`
**And** the BullMQ worker processes the job asynchronously and updates `LessonProgress` in PostgreSQL
**And** progress is NOT updated synchronously in the request path (async via queue for resilience)
**And** failed jobs retry 3x with exponential backoff (1s, 2s, 4s). After 3 failures, job moves to `queue:lesson-progress:failed` for manual inspection (NFR-I4: jobs falhados retidos para reprocessamento)

**Given** a lesson is marked as `completed`
**When** the progress is persisted
**Then** `ModuleProgress` is recalculated: `completedLessons / totalLessons * 100`
**And** `TrailProgress` is recalculated: `completedModules / totalModules * 100` (a module is complete when all its lessons are complete)
**And** a domain event `content.trail.progress_updated` is emitted with: `{ eventId, eventType: "content.trail.progress_updated", version: 1, tenantId, timestamp, data: { userId, trailId, progressPercent, previousPercent }, metadata: { correlationId } }`
**And** this domain event will be consumed by the Pastoral module (Epic 6) to update the semáforo with trail progress signals — pastoral subscription to be added as Story 6.9 or documented as planned tech debt in Epic 6
**And** the domain event schema is validated via Zod snapshot test (contract test) in `packages/types/__tests__/schemas.snapshot.test.ts` to prevent silent breaking changes between content and pastoral modules
**And** an integration test validates the full pipeline: lesson consumed → BullMQ job enqueued → progress persisted → module/trail recalculated → domain event emitted with correct payload

**Given** I navigate to "Meu Progresso" or the trail listing
**When** the page loads
**Then** each trail shows a progress bar with the overall completion percentage
**And** each module within a trail shows its completion percentage
**And** lessons show status icons: not started (circle), in progress (half-circle), completed (checkmark)
**And** "Continuar de onde parei" link takes me to the last accessed incomplete lesson

**Given** LessonProgress records exist
**When** a query is made across tenants
**Then** RLS ensures I can only see my own progress within my tenant
**And** RLS isolation tests validate cross-tenant and cross-user isolation

### Story 8.4: Regras de Conclusão por Tipo de Conteúdo

As a Admin Tenant,
I want to configure how each content type determines lesson completion,
So that completion metrics reflect actual engagement rather than just page visits.

**Acceptance Criteria:**

**Given** a lesson has `contentType: video`
**When** the participant watches the video
**Then** the frontend tracks video playback progress via `timeupdate` events fired every 5 seconds
**And** the frontend maintains an array of watched intervals (e.g., `[{start: 0, end: 30}, {start: 45, end: 90}]`) — seeking resets the current interval start, only continuous playback extends intervals
**And** unique watched time is calculated by merging overlapping intervals and summing total unique seconds
**And** the lesson is marked as `completed` when `floor(uniqueWatchedSeconds / totalDurationSeconds * 100) >= 90` (integer percentage, floor rounding)
**And** the watched percentage is persisted incrementally via BullMQ jobs in `queue:lesson-progress`
**And** boundary tests validate: 89% → NOT completed, 90% → completed, 89.5% floors to 89 → NOT completed

**Given** a lesson has `contentType: pdf_doc` or `rich_text`
**When** the participant reads the document
**Then** the frontend tracks scroll position (percentage of document scrolled) and time spent
**And** the lesson is marked as `completed` when: scroll ≥ 80% of document AND time spent ≥ estimated reading time (field `estimatedDurationMinutes` on Lesson)
**And** if `estimatedDurationMinutes` is not set, only scroll ≥ 80% is required

**Given** a lesson has `contentType: external_link`
**When** the participant clicks the link
**Then** the lesson can only be completed via manual marking (participant clicks "Marcar como concluída" or leader marks it)
**And** a manual completion records `completedBy: 'participant' | 'leader'` in the progress record

**Given** I am an Admin Tenant
**When** I access tenant configuration settings
**Then** I can override default completion rules per content type for my tenant:
  - Video threshold: default 90%, configurable 50%-100%
  - Document scroll threshold: default 80%, configurable 50%-100%
  - Allow/disallow manual completion for video and document types
**And** the configuration is stored in `TenantContentConfig` table with `tenantId` (unique)
**And** the default rules apply when no tenant-specific config exists (convention over configuration)

**Given** completion rules change for a tenant
**When** existing progress records exist
**Then** existing completed lessons are NOT retroactively changed (completion is immutable once recorded)
**And** only future lesson interactions use the new rules

### Story 8.5: Acesso Sequencial & Pré-requisitos entre Módulos e Aulas

As a Admin/Líder,
I want to configure whether modules and lessons must be completed in sequence or can be accessed freely,
So that I can enforce learning paths or allow flexible exploration depending on the content.

**Acceptance Criteria:**

**Given** I am editing a trail
**When** I configure the trail's access mode
**Then** I can choose between: `sequential` (modules must be completed in order) or `free` (any module accessible)
**And** the setting is stored as `accessMode` field on the `Trail` model (enum: `sequential`, `free`, default: `free`)

**Given** a trail has `accessMode: sequential`
**When** a participant tries to access Module 3
**Then** access is granted only if Module 2 has `status: completed` in the participant's `ModuleProgress`
**And** if Module 2 is not complete, the API returns 403 with message: "Complete o módulo anterior para desbloquear este conteúdo"
**And** the UI shows locked modules with a lock icon and a tooltip explaining the prerequisite

**Given** a module has lessons
**When** the module has `lessonAccessMode: sequential` (configurable per module, independent of trail-level setting)
**Then** lessons within the module must be completed in order
**And** the same locking logic applies at lesson level

**Given** I configure prerequisites between modules
**When** I set Module C to require Module A and Module B as prerequisites via `PATCH /api/v1/trails/:trailId/modules/:moduleId/prerequisites`
**Then** a `ModulePrerequisite` join table stores the relationships
**And** the API validates that prerequisites don't create circular dependencies (returns 422 with explanation if detected)
**And** a participant can only access Module C when both A and B are completed

**Given** a trail has `accessMode: free`
**When** a participant navigates the trail
**Then** all modules are accessible regardless of completion status
**And** lesson-level `lessonAccessMode` within each module is still respected independently

### Story 8.6: Publicação, Versionamento & Catálogo Tenant

As a Admin/Líder,
I want to manage trail content through a draft-to-published workflow and make trails available as a tenant-wide catalog,
So that content quality is controlled before participant access and trails can be shared across multiple groups.

**Acceptance Criteria:**

**Given** I create a trail (Story 8.1)
**When** the trail is created
**Then** it starts with `status: draft` — invisible to participants
**And** only users with role Admin or Líder (or future Editor de Conteúdo) can view draft trails

**Given** a trail is in `draft` status
**When** I publish it via `POST /api/v1/trails/:trailId/publish`
**Then** the `status` changes to `published` and a `version` number is set (starts at 1)
**And** `publishedAt` and `publishedBy` fields are recorded
**And** the trail becomes visible and accessible to participants in associated groups
**And** a domain event `content.trail.published` is emitted with: `{ eventId, eventType, version: 1, tenantId, timestamp, data: { trailId, trailVersion, publishedBy } }`

**Given** a published trail needs updates
**When** I edit the trail content (add/modify modules, lessons)
**Then** edits are made on a new draft version (participants continue seeing the current published version)
**And** when I re-publish, the `version` is incremented and the new content becomes live
**And** previous versions are retained in a `TrailVersion` table for audit/rollback
**And** publishing a new version does NOT invalidate existing participant progress — `LessonProgress` records reference `lessonId` (stable UUID v7), not the trail version number. If lessons are removed in a new version, orphaned progress records are soft-archived (not deleted)
**And** a regression test validates: publish v2 with modified lesson structure → participant progress from v1 is NOT lost, NOT corrupted, and correctly displayed

**Given** I want to make a trail available across my tenant
**When** I add the trail to the tenant catalog via `POST /api/v1/trails/:trailId/catalog`
**Then** the trail is flagged as `catalogVisible: true`
**And** it appears in the tenant-wide trail catalog endpoint: `GET /api/v1/trails/catalog`
**And** any Admin/Líder in the tenant can associate it with their groups (N:N relationship via `GroupTrail` join table)

**Given** a trail is associated with multiple groups (Epic 4, Story 4.4 integration)
**When** I query trail associations
**Then** the `GroupTrail` table stores: `groupId`, `trailId`, `assignedAt`, `assignedBy`
**And** participants see the trail in each group context they belong to
**And** progress is tracked per-participant (not per-group) — a participant in multiple groups sees the same progress

**Given** trail catalog operations
**When** any query is executed
**Then** all operations are scoped by tenant via RLS — no cross-tenant catalog leakage

### Story 8.7: Relatório por Trilha & Exportação CSV

As a Líder/Admin,
I want to view trail completion reports with per-participant metrics and export them as CSV,
So that I can monitor group progress and share reports with church leadership.

**Acceptance Criteria:**

**Given** I am a Líder with a group that has trails assigned
**When** I access `GET /api/v1/reports/trails/:trailId`
**Then** I see a report with:
  - Trail name, total modules, total lessons
  - Per-participant row: name, overall progress %, modules completed, lessons completed, last activity date, status (not started / in progress / completed)
  - Aggregated metrics: average completion %, participants who completed, participants who haven't started
**And** the report is paginated using `{ "data": [...], "meta": { "page", "perPage", "total", "totalPages" } }`
**And** results are filterable by: status (not_started, in_progress, completed), date range (lastActivityAfter, lastActivityBefore)
**And** all data is scoped to my tenant and my groups (Líder sees only their groups; Admin sees all groups in tenant)

**Given** I want to export the report
**When** I request `GET /api/v1/reports/trails/:trailId/export?format=csv`
**Then** the API returns a CSV file with Content-Type `text/csv` and Content-Disposition `attachment; filename="trilha-{trailName}-{date}.csv"`
**And** the CSV includes headers in Portuguese: "Participante", "Progresso (%)", "Módulos Concluídos", "Aulas Concluídas", "Última Atividade", "Status"
**And** the CSV uses UTF-8 with BOM for correct character display in Excel
**And** for large datasets (> 1000 participants), the export is processed asynchronously via BullMQ job in `queue:reports` and the API returns 202 with a `jobId`
**And** the client polls `GET /api/v1/reports/jobs/:jobId` for status (`processing`, `completed`, `failed`) — when completed, the response includes a signed download URL (valid for 1 hour). This polling approach works without Epic 14 notifications; when Epic 14 is implemented, an in-app notification is added as enhancement

**Given** I am an Admin
**When** I access `GET /api/v1/reports/trails` (without trailId)
**Then** I see a summary of all trails in my tenant: trail name, total participants, average progress, completion rate
**And** I can drill down into any trail for the detailed per-participant report

### Story 8.8: Busca Full-Text por Conteúdo

As a Participante/Líder/Admin,
I want to search for content across trails, modules and lessons using free-text search,
So that I can quickly find relevant discipleship material without browsing through the entire trail hierarchy.

**Acceptance Criteria:**

**Given** the content database has trails, modules, and lessons with populated `title`, `description`, and `tags` fields
**When** a Prisma migration is applied
**Then** a `tsvector` column `search_vector` is added to the `lessons` table (and optionally `trails` and `modules`)
**And** a PostgreSQL trigger automatically updates `search_vector` on INSERT and UPDATE using `to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))`
**And** a GIN index `idx_lessons_search_vector` is created on the `search_vector` column
**And** the migration includes `CREATE EXTENSION IF NOT EXISTS unaccent;` before creating the tsvector infrastructure
**And** the migration is a raw SQL migration (not Prisma schema-only, since tsvector + trigger + extension require raw SQL)
**And** the migration is wrapped in a transaction. The rollback migration drops the GIN index, trigger, tsvector column, and extension cleanly (in reverse order)
**And** soft-deleted records (`deletedAt IS NOT NULL`) are excluded from the tsvector trigger — the trigger includes a `WHERE deletedAt IS NULL` condition, preventing "ghost" results in search

**Given** I am authenticated and search via `GET /api/v1/search?q={term}`
**When** I enter a search term
**Then** results are returned from lessons matching the `ts_query` against `search_vector`
**And** results include: lesson title, trail name, module name, content type, and a text snippet with highlighted match
**And** results are ranked by `ts_rank` relevance score
**And** results are scoped to my tenant via RLS (no cross-tenant results)
**And** the search endpoint responds within 500ms for up to 10,000 lessons per tenant

**Given** I search with Portuguese diacritics (e.g., "oração" vs "oracao")
**When** the search executes
**Then** both forms return the same results (the `portuguese` text search configuration handles diacritics via `unaccent` extension installed in the migration)
**And** partial terms are supported via prefix matching (e.g., "disc" matches "discipulado")
**And** when no matches are found, the API returns an empty array `{ "data": [], "meta": { "total": 0 } }` (not an error)

**Given** I search for content
**When** a trail is in `draft` status
**Then** draft content does NOT appear in search results for Participantes
**And** Admin/Líder can see draft content in results (with a "Rascunho" badge)

### Story 8.9: TrailPlaylist, Skeletons & Performance UX

As a Participante,
I want a playlist-style view of trail content with smooth loading states,
So that I can navigate lessons intuitively and never see blank screens while content loads.

**Acceptance Criteria:**

**Given** I navigate to a trail page
**When** the page renders
**Then** a `TrailPlaylist` component displays the trail structure as a playlist sidebar:
  - Modules as collapsible sections with title and completion percentage
  - Lessons within each module as list items with: title, content type icon (video/doc/link), duration estimate, completion status (checkmark / in-progress / locked)
  - Overall trail progress bar at the top
**And** the currently active lesson is highlighted with `brand-teal` background
**And** clicking a lesson loads it in the main content area (right panel on desktop, full-screen on mobile)
**And** the component uses the `Consumo` experience density (padding 20-24px, radius 12px) per UX-DR03

**Given** the trail page is loading
**When** the API response is pending
**Then** skeleton placeholders are shown for: playlist sidebar (3 module blocks with 3 lesson lines each), main content area (video/document placeholder), and progress bar
**And** skeletons animate with a subtle pulse (using `motion-safe:animate-pulse`)
**And** no Cumulative Layout Shift (CLS) occurs when real content replaces skeletons

**Given** the trail page has modules below the fold
**When** the page loads
**Then** only above-the-fold modules load their lesson details immediately
**And** below-the-fold modules use lazy loading (Intersection Observer) to defer lesson data fetching
**And** heavy components (`TimelineCuidado`, `TelaReentry` from other epics) use `next/dynamic` for dynamic imports

**Given** I am on a mobile device (< lg breakpoint)
**When** I view the trail
**Then** the playlist shows as a collapsible bottom sheet or top accordion (not sidebar)
**And** tapping a lesson opens the content full-screen with a "back to playlist" button
**And** touch targets are ≥ 44px for all interactive elements

**Given** all performance optimizations are in place
**When** the trail page loads
**Then** total page load is ≤ 2.5 seconds (NFR-P5)
**And** TanStack Query is used for data fetching in Client Components with stale-while-revalidate (staleTime: 5 minutes for trail structure, 30 seconds for progress data)
**And** the `TrailPlaylist` component passes jest-axe accessibility tests
**And** keyboard navigation works: arrow keys to navigate lessons, Enter to select, Escape to collapse module

**Prerequisite:** Stories 8.1-8.8 must be complete. This story integrates CRUD (8.1), content viewing (8.2), progress (8.3), completion status (8.4), sequential locking (8.5), and draft/published filtering (8.6).

### Story 8.10: Tela "Minhas Trilhas" — Listagem de Trilhas do Participante

As a Participante,
I want to see a listing of all trails available to me with my progress on each,
So that I can discover content assigned to my groups and choose what to study next.

**Acceptance Criteria:**

**Given** I am a participant with group memberships that have trails associated
**When** I navigate to the "Trilhas" tab (from NavigationConfig — Epic 1, Story 1.8)
**Then** I see a listing page with trail cards, each showing:
  - Trail name and description (truncated to 2 lines)
  - Number of modules and total lessons
  - My progress bar with completion percentage
  - Status badge: "Não Iniciada", "Em Andamento", or "Concluída"
  - Last activity date (if started)
**And** trails are sorted by: in-progress first (by last activity, descending), then not-started, then completed
**And** only `published` trails are shown (draft trails are hidden from participants)
**And** the listing is paginated with infinite scroll (10 trails per page, TanStack Query with `useInfiniteQuery`)

**Given** I click on a trail card
**When** the trail page loads
**Then** I am taken to the TrailPlaylist view (Story 8.9) for that trail
**And** if I have progress, the playlist opens on my last accessed lesson ("Continuar de onde parei" from Story 8.3)

**Given** I have no trails assigned (empty state)
**When** the listing page loads
**Then** an empty state is displayed with pastoral vocabulary: "Nenhuma trilha disponível ainda. Fale com o líder do seu grupo para começar sua jornada de discipulado."
**And** the empty state uses the `EmptyState` component pattern (consistent with Epic 7 onboarding patterns)

**Given** the listing page is loading
**When** the API response is pending
**Then** skeleton placeholders show 3 trail card outlines with pulse animation (UX-DR27)
**And** no CLS when real cards replace skeletons

**Given** the listing page renders
**When** all content is loaded
**Then** the page load is ≤ 2.5 seconds (NFR-P5)
**And** the page uses `Consumo` experience density (padding 20-24px, radius 12px) per UX-DR03
**And** all trail cards have touch targets ≥ 44px on mobile
**And** the listing page passes jest-axe accessibility tests

---

## Epic 9: Privacidade, LGPD & Compliance

Exportação de dados pessoais (portabilidade LGPD), solicitação de exclusão (eliminação LGPD), base legal documentada por operação de tratamento, e log de auditoria imutável de ações administrativas. Audit é cross-cutting concern via NestJS interceptor — append-only, nem Super Admin pode deletar registros.

### Story 9.1: Exportação de Dados Pessoais (Portabilidade LGPD)

As a Participante,
I want to request an export of all my personal data held by the platform,
So that I can exercise my LGPD right to data portability and review what information is stored about me.

**Acceptance Criteria:**

**Given** I am authenticated as any user (Participante, Líder, Admin)
**When** I navigate to my profile settings and click "Exportar meus dados"
**Then** I can choose the export format: JSON (machine-readable) or PDF (human-readable)
**And** the request is submitted via `POST /api/v1/privacy/export` with payload `{ format: "json" | "pdf" }`
**And** the API returns 202 with `{ "data": { "jobId": "<uuid>", "status": "accepted", "estimatedCompletionHours": 24 } }`
**And** a BullMQ job is enqueued in `queue:privacy-export` with payload: `{ userId, allTenantIds, format, requestedAt }` — note: `allTenantIds` includes ALL tenants the user belongs to (FR03 multi-tenant), not just the active tenant. LGPD portability requires ALL personal data regardless of tenant context

**Given** the export job is processing
**When** the BullMQ worker executes
**Then** it iterates over ALL tenants the user belongs to (`allTenantIds`) and collects personal data per tenant: profile info, group memberships, trail progress, meeting attendance, lesson progress, pastoral care actions (about me), consent records, audit events (by me)
**And** the worker uses a privileged mode that temporarily overrides RLS to iterate across tenants — each tenant's data is collected in a separate section of the export file, clearly labeled
**And** data from each module is collected via dedicated `exportUserData(userId, tenantId)` methods on each service — NOT by querying tables directly (respects module boundaries)
**And** a data completeness integration test validates: create a user with data in ALL tables (profile, groups, trails, meetings, progress, pastoral, consents) → export → verify ALL data is present. If a new table is added without updating `exportUserData()`, this test FAILS
**And** boundary test: a new user with zero activity generates a valid export file (empty sections, not an error)
**And** the export file is stored in MinIO under `exports/global/{userId}/{timestamp}.{format}` with storage policy `temporary` (auto-deleted after 30 days — enough time for user to download multiple times)
**And** a signed download URL (valid 48 hours, renewable) is generated via `storage.service.getSignedUrl()`

**Given** the export is complete
**When** the file is ready
**Then** the user is notified via in-app toast on next page load (polling `GET /api/v1/privacy/export/:jobId` — same pattern as Story 8.7 report jobs)
**And** an e-mail notification is sent when the export is ready — using BullMQ job in `queue:notifications` with stub implementation (console.log in dev, same pattern as Epic 4 Story 4.3 convites). E-mail includes a link to the download page (NOT the signed URL directly, for security)
**And** the download link is available in the profile settings page under "Meus Exports"
**And** the export is completed within 72 hours of the request (NFR-L1) — the job has a deadline check; if not completed in 48h, it is escalated to a high-priority queue

**Given** the export job fails
**When** the worker encounters an error
**Then** the job retries 3x with exponential backoff (1m, 5m, 30m)
**And** after 3 failures, the job is moved to `queue:privacy-export:failed` and an alert is sent to Sentry with `{ userId, tenantId, error }`
**And** the user sees status "Erro na exportação — tente novamente ou entre em contato com o suporte"

**Given** a user requests multiple exports
**When** an export is already in progress
**Then** the API returns 409 with message: "Já existe uma exportação em andamento. Aguarde a conclusão antes de solicitar outra."

### Story 9.2: Exclusão de Dados Pessoais (Eliminação LGPD)

As a Participante,
I want to request the deletion of all my personal data from the platform,
So that I can exercise my LGPD right to data elimination.

**Acceptance Criteria:**

**Given** I am authenticated as a user with `Líder` role and I lead active groups
**When** I attempt to request account deletion
**Then** the system blocks the request and displays: "Você lidera {N} grupo(s) ativos. Transfira a liderança de todos os grupos antes de solicitar a exclusão da conta."
**And** a list of groups with "Transferir Liderança" links is shown
**And** deletion is only allowed after all leadership roles are transferred or groups are archived

**Given** I am authenticated as any user (with no blocking leadership roles)
**When** I navigate to my profile settings and click "Solicitar exclusão da minha conta"
**Then** an AlertDialog (destructive variant) is displayed explaining:
  - "Ao confirmar, seus dados pessoais serão removidos em até 15 dias úteis"
  - "Dados que não podem ser removidos: registros de auditoria (exigência legal) e dados agregados anonimizados"
  - "Esta ação é irreversível após o período de cancelamento de 7 dias"
**And** I must type "EXCLUIR" to confirm (preventing accidental deletion)

**Given** I confirm the deletion request
**When** the request is submitted via `POST /api/v1/privacy/deletion`
**Then** the API returns 202 with `{ "data": { "requestId": "<uuid>", "status": "pending", "cancellableUntil": "<ISO8601 date +7 days>", "deletionDeadline": "<ISO8601 date +30 days>" } }`
**And** if a deletion request already exists for this user, the API returns the existing request status (idempotent — no duplicate requests created)
**And** my account is immediately flagged as `deletion_pending` — I can still log in during the 7-day grace period
**And** a banner is shown on every page: "Sua conta será excluída em {days} dias. [Cancelar solicitação]"

**Given** the 7-day grace period has passed
**When** the scheduled BullMQ job in `queue:privacy-deletion` executes
**Then** personal data is soft-deleted across all modules: profile, group memberships, trail progress, meeting attendance, lesson progress, pastoral care notes (about me)
**And** any data created by the user DURING the grace period (after the deletion request) is included in the soft-delete scope — the job captures all records with `userId` regardless of creation date
**And** the user's account status changes to `deleted` and all active sessions/tokens are revoked (Keycloak session invalidation + Redis session keys cleanup)
**And** all Redis keys matching `*:{userId}:*` across all namespaces (`cache:*`, `rt:*`, `queue:*`, `rate:*`, `session:*`) are scanned and deleted to ensure no personal data remains in cache
**And** the user can no longer log in
**And** audit log entries are RETAINED but the user reference is anonymized: `userId` replaced with `anonymous-<hash>` (legal requirement — audit immutability)
**And** aggregated analytics data is RETAINED in anonymized form (no personal identifiers)

**Given** the hard-delete deadline approaches (30 days from request per NFR-L2)
**When** the final cleanup job runs
**Then** the hard-delete is executed within a database transaction — if ANY delete fails due to FK constraints or unexpected errors, the entire transaction rolls back and the data remains in `soft_deleted` state
**And** on rollback, a Sentry alert with high severity is triggered including the failing table/constraint name, and the DPO is notified for manual resolution
**And** on success, all soft-deleted personal data is permanently purged from PostgreSQL
**And** all user files in MinIO under the user's path are permanently deleted
**And** a cascade integration test validates: create user with data in ALL modules → execute full deletion pipeline → verify EACH table: personal data removed, audit entries anonymized, aggregated data preserved, Redis keys cleaned, MinIO files deleted
**And** a completion record is stored in the audit log: `{ eventType: "privacy.deletion.completed", anonymizedUserId, tenantId, completedAt }`
**And** the entire process completes within 30 days of the confirmed request (NFR-L2)

**Given** I want to cancel my deletion request during the grace period
**When** I click "Cancelar solicitação" and confirm
**Then** the request is cancelled via `DELETE /api/v1/privacy/deletion/:requestId`
**And** my account returns to normal status immediately
**And** the cancellation is recorded in the audit log

**Given** the deletion job fails
**When** the worker encounters an error during data removal
**Then** the job retries 3x with exponential backoff (1h, 4h, 12h) — longer intervals because deletion is destructive
**And** after 3 failures, Sentry alert is triggered with high severity and the DPO (Data Protection Officer) is notified
**And** the user's data remains in `deletion_pending` state (not partially deleted)

### Story 9.3: Log de Auditoria Imutável

As a Super Admin,
I want an immutable audit log of all administrative actions across the platform,
So that I can trace who did what, when, and from where for compliance and security investigations.

**Acceptance Criteria:**

**Given** any authenticated user performs a mutative action (POST, PUT, PATCH, DELETE on: users, groups, trails, tenants, roles, configurations)
**When** the action is processed by the API
**Then** a NestJS `AuditInterceptor` (global, applied only to mutative HTTP methods — NOT GET/HEAD/OPTIONS) automatically captures and persists an audit event with:
  - `id` (UUID v7), `tenantId`, `userId`, `action` (enum: `create`, `update`, `delete`, `login`, `export`, `config_change`), `resource` (entity type), `resourceId`, `ipAddress`, `userAgent`
  - `previousState` (JSON — for updates, snapshot before change), `newState` (JSON — snapshot after change)
  - `timestamp` (ISO 8601), `severity` (enum: `info`, `warning`, `critical`)
**And** the audit event is persisted in the `audit_events` table via `audit.service.ts` (NOT repository pattern — audit is a supporting subdomain, uses Prisma directly)
**And** the `audit_events` table has NO `UPDATE` or `DELETE` RLS policies — only `INSERT` and `SELECT` (append-only, immutable)
**And** `tenantId` scoping via RLS ensures each tenant only sees their own audit events (Super Admin sees cross-tenant via privileged query)
**And** an immutability test validates: attempt `UPDATE` and `DELETE` directly on `audit_events` via raw SQL → confirm RLS blocks both operations. Attempt via Prisma → confirm `audit.service.ts` exposes NO update/delete methods
**And** a load test validates: simulate 10,000 audit events/hour → confirm viewer query responds in <2s with server-side pagination (50 items/page) and index on `(tenant_id, timestamp DESC)`

**Given** I am authenticated as Super Admin
**When** I navigate to the Audit Log viewer at `/app/admin/super/audit`
**Then** I see a table of audit events with columns: timestamp, user, action, resource, severity badge (✅/⚠️/❌)
**And** each row is expandable to show full details: previous/new state as formatted JSON, IP address, user agent
**And** the table supports server-side pagination (50 items per page)

**Given** I want to filter audit events
**When** I use the sticky filter bar at the top
**Then** I can filter by: event type (action), user, date range (date picker), severity level
**And** I can search by free-text on event description/resource
**And** filters are applied server-side — the API endpoint is `GET /api/v1/audit/events?action=&userId=&from=&to=&severity=&q=&page=&perPage=50`

**Given** I want to export audit events
**When** I click "Exportar" and choose CSV or JSON
**Then** the export follows the same async pattern as Story 8.7 (BullMQ job → polling → signed download URL)
**And** exported data includes all fields (not just visible columns)

**Given** the audit viewer is accessed
**When** the page renders
**Then** the UI is optimized for desktop (audit is an admin operation — not mobile-optimized per UX spec)
**And** auto-refresh occurs every 30 seconds for recent events

**Given** audit log retention
**When** events age beyond the retention period
**Then** audit events are NEVER auto-deleted — retention is permanent (legal compliance requirement)
**And** old events may be archived to cold storage (future optimization, not in scope for this story)

### Story 9.4: Base Legal & Histórico de Consentimento

As a Participante,
I want to see which legal bases justify the processing of my personal data and review my consent history,
So that I can understand how my data is used and exercise informed control over it.

**Acceptance Criteria:**

**Given** the platform processes personal data
**When** any data processing operation is defined in the system
**Then** each operation has a documented legal basis stored in a `DataProcessingRegistry` table with:
  - `id` (UUID v7), `operationName` (e.g., "trail_progress_tracking", "meeting_attendance", "pastoral_care_notes"), `legalBasis` (enum: `consent`, `legitimate_interest`, `legal_obligation`, `contract_execution`), `purpose` (human-readable PT-BR description), `dataCategories` (array: e.g., ["attendance", "engagement", "personal_profile"]), `retentionPeriod`, `thirdPartySharing` (array of third parties with whom data is shared, e.g., ["Keycloak (autenticação)", "LiveKit (vídeo)", "MinIO/S3 (armazenamento)", "Sentry (erros)"] — LGPD Art. 9 transparency requirement), `createdAt`, `updatedAt`
**And** this registry is seeded via migration with all current data processing operations (NFR-L5)
**And** the registry is accessible via `GET /api/v1/privacy/data-processing` (public endpoint, no auth required — transparency)

**Given** I am authenticated as any user
**When** I navigate to my profile settings under "Privacidade & Consentimento"
**Then** I see a consent history section with:
  - List of consent records: "Termos de Uso" (date accepted), "Política de Privacidade" (date accepted), feature-specific consents (e.g., "Monitoramento de foco em reuniões")
  - Status badge per item: ✅ Aceito (with date) or ⏳ Pendente
  - Link to the full text of each document
**And** I can withdraw optional consents (e.g., focus monitoring) via a toggle — mandatory consents (terms of use) cannot be withdrawn without account deletion

**Given** a consent is withdrawn
**When** I toggle off an optional consent
**Then** the system records the withdrawal in `ConsentRecord` table: `{ userId, tenantId, consentType, action: "withdrawn", timestamp }`
**And** the corresponding feature is immediately disabled for my account (e.g., focus monitoring stops being collected in my meetings)
**And** the withdrawal is recorded in the audit log
**And** historical data collected under the previous consent is NOT retroactively deleted (but stops being actively used for new calculations)
**And** a consent withdrawal integration test validates: withdraw focus monitoring consent → simulate a meeting (Epic 5) → verify focus data is NOT collected for this user during the meeting, while other participants' focus data IS collected normally

---

## Epic 10: Onboarding Avançado & Adoção

Wizard de onboarding guiado para Admin Tenant em 5 passos (perfil, igreja, grupo, líder, radar). Dados de demonstração ficcionais pré-populados para exploração antes de inserir dados reais. Importação em massa de participantes via CSV com validação em 4 etapas (upload, preview, resolução de erros, confirmação). Onboarding é Supporting Subdomain — service direto com Prisma, sem repository pattern.

### Story 10.1: Wizard de Onboarding para Admin Tenant

As a Admin Tenant (novo),
I want a guided 5-step wizard on my first login that walks me through initial platform setup,
So that I can configure my church, create my first group, assign a leader, and understand the pastoral radar in under 10 minutes.

**Acceptance Criteria:**

**Given** a new Admin Tenant logs in for the first time (no groups, no trails exist in the tenant)
**When** the dashboard loads
**Then** the `OnboardingWizard` component is displayed full-screen with 5 steps and a visual progress indicator (step dots + progress bar)
**And** the wizard cannot be dismissed on first login — it must be completed or explicitly skipped (skip records `onboardingSkippedAt` on tenant config)

**Given** Step 1: "Seu Perfil Pastoral"
**When** the admin fills in their profile
**Then** fields are: display name, photo (optional upload via MinIO), role title (e.g., "Pastor", "Coordenador")
**And** the profile is saved via `PATCH /api/v1/users/me`
**And** all labels and micro-copy use pastoral vocabulary from `vocabulary.ts` (UX-DR16) — e.g., "Como seus discípulos te conhecem?" instead of "Display name"

**Given** Step 2: "Sua Comunidade"
**When** the admin configures the church/organization
**Then** fields are: church name (required), denomination (optional), city/state (optional), logo upload (optional via MinIO with storage policy `permanent`)
**And** the tenant's display name, branding logo, and metadata are updated via `PATCH /api/v1/tenants/current`

**Given** Step 3: "Seu Primeiro Grupo de Discipulado"
**When** the admin reaches the group creation step
**Then** two options are presented: "Criar meu primeiro grupo" (form: group name + description) OR "Explorar com dados de demonstração" (skips to Step 5 using demo data from Story 10.2)
**And** if the admin chooses to create a group, it is created via `POST /api/v1/groups` (Epic 4 API) and the admin is automatically assigned as leader
**And** this step is skippable — choosing demo exploration still counts as completing Step 3

**Given** Step 4: "Convide um Líder"
**When** the admin optionally invites a leader
**Then** fields are: leader name, leader email
**And** if provided, an invite is sent via the same mechanism as Epic 4 Story 4.3 (BullMQ job, stub email)
**And** this step is skippable — "Fazer depois" button available
**And** if Step 3 was skipped (demo mode), Step 4 is also skipped automatically

**Given** Step 5: "Conheça o Radar Pastoral"
**When** the admin reaches the final step
**Then** an interactive explanation of the Pastoral Radar is displayed:
  - Visual of the traffic-light semáforo (green/yellow/red) with descriptions
  - Explanation that it's based on participation signals (meetings + trails)
  - Preview using demo data (Story 10.2) if available: "Veja como o radar funciona com dados de exemplo"
**And** a "Concluir Setup" button completes the wizard

**Given** the wizard is completed
**When** the admin clicks "Concluir Setup"
**Then** `onboardingCompletedAt` is recorded on the tenant config
**And** the admin is redirected to the main dashboard
**And** the wizard is NOT shown again on subsequent logins
**And** a "Rever tutorial" link is available in settings to replay the wizard in read-only mode

**Given** the wizard is rendered
**When** the component loads
**Then** the `OnboardingWizard` component uses `Administração` experience density (padding 12-16px, radius 6-8px) per UX-DR03
**And** each step supports keyboard navigation (Tab between fields, Enter to advance, Escape to go back)
**And** the wizard passes jest-axe accessibility tests
**And** state is persisted server-side per step via `onboardingProgress` JSON field on tenant config: `{ currentStep: 3, completedSteps: [1,2], stepData: {...} }` — saved via `PATCH /api/v1/tenants/current` after each step completion. If the browser closes mid-wizard, the admin resumes from the last completed step on next login
**And** each step completion emits a domain event `onboarding.wizard.step_completed` with `{ tenantId, step, stepName, timestamp }` for future adoption analytics (Epic 13)

### Story 10.2: Dados de Demonstração (Seed)

As a Admin Tenant (novo),
I want pre-populated demo data available in my tenant when I first access the platform,
So that I can explore features like groups, trails, meetings, and the pastoral radar with realistic (fictional) data before adding real members.

**Acceptance Criteria:**

**Given** a new tenant is provisioned (Epic 3)
**When** the provisioning process completes
**Then** an idempotent seed function `seedDemoData(tenantId)` is called automatically
**And** the seed creates fictional demo data scoped to this tenant:
  - 1 group: "Grupo Alpha"
  - 1 leader: "Marcos Silva" (fictional, with `isDemoData: true` flag)
  - 3 participants with distinct semáforo states:
    - "Ana Costa" — green (100% meeting attendance, 80% trail progress)
    - "Pedro Santos" — yellow (60% attendance, 40% trail progress, declining trend)
    - "Maria Oliveira" — red (20% attendance, 10% trail progress, 2 missed meetings)
  - 1 trail: "Fundamentos da Fé" with 2 modules, 4 lessons (mix of video stubs and rich text)
  - Trail progress records for each demo participant matching their semáforo state
  - 1 past meeting with presence data in PostgreSQL (`meeting_telemetry` table from Epic 5) simulating 2/3 participants present — NOT in Redis (Redis is for live data only and would be lost on restart)
  - 3 pastoral care actions: 1 completed (Ana), 1 pending (Pedro), 1 urgent (Maria)

**Prerequisite:** Epics 4 (groups), 5 (meetings), 8 (trails) must be complete — seed creates records in tables from all three epics.

**Given** demo data exists in the tenant
**When** the admin navigates to any feature area (groups, trails, radar)
**Then** demo data is displayed with a subtle `DemoOverlay` badge: "Dados de demonstração" with a dismiss button
**And** demo records are visually distinguished (e.g., faded opacity or dotted border) from real data

**Given** the admin starts adding real data
**When** the admin creates their first REAL group (not demo)
**Then** a nudge is displayed: "Você já tem dados reais! Deseja remover os dados de demonstração?" with "Remover agora" and "Manter por enquanto" options
**And** the admin can also remove all demo data at any time via "Limpar dados de demonstração" button in Settings
**And** this button calls `DELETE /api/v1/onboarding/demo-data` which removes all records with `isDemoData: true` for this tenant
**And** a confirmation dialog warns: "Isso removerá todos os dados de exemplo. Seus dados reais não serão afetados."

**Given** the seed function runs
**When** it is called multiple times (e.g., re-provisioning, testing)
**Then** it is idempotent — uses `upsert` to prevent duplicate demo records
**And** all demo records use UUID v7 with `isDemoData: true` flag for easy bulk cleanup
**And** the seed is also available as a Turborepo pipeline command: `pnpm turbo db:seed` (for dev/testing environments)

### Story 10.3: Importação CSV — Upload, Preview & Validação

As a Admin/Líder,
I want to upload a CSV file with participant data and preview it with inline validation before importing,
So that I can bulk-add members to my groups efficiently while catching data errors before they enter the system.

**Acceptance Criteria:**

**Given** I navigate to group management or a dedicated "Importar Participantes" page
**When** the import wizard loads (Step 1: Upload)
**Then** a `FileUploadZone` component is displayed with:
  - Drag & drop area with visual feedback (border highlight on drag-over)
  - "Selecionar arquivo" button as fallback
  - Accepted formats: `.csv` and `.xlsx` (max 5MB)
  - "Baixar template" link that downloads a CSV template with expected columns: `nome`, `email`, `grupo` (optional — defaults to current group), `papel` (optional — defaults to `participante`)
**And** on file selection, the file is parsed client-side (no upload yet) and row count is displayed: "42 linhas detectadas"
**And** the client-side parser auto-detects file encoding (UTF-8, ISO-8859-1, Windows-1252) and normalizes to UTF-8 before preview — critical for Brazilian CSVs exported from Excel where names like "João" and "Conceição" use legacy encoding
**And** XLSX parsing uses a dynamically imported library (`next/dynamic` / `import()`) to avoid bundling the ~300KB parser in the main chunk — loaded only when the user selects an .xlsx file

**Given** the file is parsed (Step 2: Preview & Validation)
**When** the preview screen loads
**Then** a `CSVPreviewTable` component displays the first 10 rows with all columns
**And** inline auto-validation highlights errors per cell:
  - 🔴 Critical (blocks import): invalid email format, duplicate email within file, duplicate email already in tenant (checked via `GET /api/v1/users/check-emails` batch endpoint)
  - 🟡 Warning (allows import): optional field empty (e.g., grupo not specified)
**And** a validation summary counter is displayed: "{N} válidos, {M} com erro"
**And** the "Próximo" button is disabled while any 🔴 critical errors exist

**Given** critical errors exist (Step 3: Error Resolution)
**When** the error resolution screen loads
**Then** a `ValidationErrorList` component groups errors by type (e.g., "3 e-mails inválidos", "2 e-mails duplicados")
**And** each error row supports inline editing: I can correct the email directly in the table
**And** each error row has an "Ignorar esta linha" option to skip it from import
**And** after resolving all 🔴 errors (via edit or ignore), the "Próximo" button is enabled
**And** re-validation runs automatically after each inline edit

**Given** the file is very large
**When** more than 500 rows are detected
**Then** only the first 10 rows are shown in preview, with a note: "Mostrando 10 de {N} linhas. Todas serão validadas."
**And** validation of all rows happens in the background and the summary counter updates progressively

### Story 10.4: Importação CSV — Confirmação & Processamento

As a Admin/Líder,
I want to confirm and execute the CSV import with a clear summary of results,
So that I know exactly how many participants were imported, which ones failed, and can take action on failures.

**Acceptance Criteria:**

**Given** all critical errors are resolved in Step 3
**When** I advance to Step 4 (Confirmation)
**Then** a summary is displayed:
  - Total rows: {N}
  - To be imported: {M} (valid rows)
  - Ignored: {K} (rows marked as ignore)
  - Group assignment: which group(s) will receive the new participants
**And** a "Confirmar Importação" button submits the data

**Given** I click "Confirmar Importação"
**When** the import is submitted via `POST /api/v1/groups/:groupId/members/import` with the validated data
**Then** for datasets ≤ 100 rows, the import is processed synchronously and the result is returned immediately (status 201)
**And** for datasets > 100 rows, the import is processed asynchronously via BullMQ job in `queue:csv-import` and the API returns 202 with `{ "jobId": "<uuid>" }` — client polls `GET /api/v1/import/jobs/:jobId` for status (same pattern as Story 8.7)

**Given** the import completes (sync or async)
**When** results are available
**Then** an `ImportResultSummary` component displays:
  - "✅ {N} importados com sucesso"
  - "⚠️ {M} ignorados" (with reason per row, expandable)
  - "❌ {K} falharam" (with error per row, e.g., "e-mail já cadastrado em outro tenant")
**And** for each successfully imported participant:
  - If the email is new to the platform: a user account is created and added as `participante` to the specified group
  - If the email already exists in ANOTHER tenant (FR03 multi-tenant): the user is NOT auto-linked. Instead, an invite is sent and the user must ACCEPT before being added to this tenant (consent requirement — cannot silently add someone to a new tenant)
  - If the email already exists in THIS tenant: the row is marked as "já existente" (not error, not re-imported)
  - An invite email is enqueued via BullMQ (stub in dev, same pattern as Epic 4 Story 4.3)

**Given** the import includes participants for multiple groups
**When** the CSV has a `grupo` column with different group names
**Then** participants are distributed to their respective groups (groups must already exist in the tenant)
**And** if a group name doesn't match any existing group, those rows are marked as ❌ failed with message: "Grupo '{name}' não encontrado no tenant"

**Given** the import is complete
**When** I want to review what was imported
**Then** a "Baixar relatório" link downloads a CSV with import results: original data + status column (imported/ignored/failed) + error detail
**And** the import event is recorded in the audit log (Epic 9, Story 9.3) with: action `import`, resource `members`, resourceId `groupId`, metadata `{ totalRows, imported, ignored, failed }`
**And** a domain event `onboarding.csv_import.completed` is emitted with `{ tenantId, groupId, totalRows, imported, ignored, failed, timestamp }` for future adoption analytics (Epic 13)

**Given** edge cases
**When** the CSV has no valid rows after error resolution
**Then** the "Confirmar Importação" button is disabled with message: "Nenhuma linha válida para importar"
**And** when all rows are duplicates of existing members, the result shows "0 importados, {N} já existentes" (not treated as error)

---

## Epic 11: Planos, Limites & Feature Gating

Configuração dinâmica de planos de assinatura (Free/Pro/Enterprise) com limites numéricos configuráveis, branding customizado por tenant, políticas e feature toggles, e prompt de upgrade contextual. Evolui os limites hardcoded do Epic 3 (Story 3.3) para configuração em banco. Feature gating duplo: Subscription Tiers (disponível) + Feature Toggles por tenant (ativo).

### Story 11.1: Planos de Assinatura & Limites Dinâmicos

As a Super Admin,
I want to manage subscription plans with configurable numeric limits per tier,
So that each tenant operates within the resource boundaries of their plan and I can adjust limits as the business evolves.

**Acceptance Criteria:**

**Given** the platform supports 3 subscription tiers
**When** the plan configuration is initialized
**Then** a `SubscriptionPlan` table is seeded with 3 plans:
  - **Free:** max 3 groups, 15 participants/group, 30 simultaneous users, 1 GB storage, no recording, standard branding, standard feature flags
  - **Pro:** max 20 groups, 50 participants/group, 100 simultaneous users, 50 GB storage, 90 days/10 GB recording, logo + colors branding, configurable feature flags
  - **Enterprise:** unlimited groups (configurable), custom participants/group, custom simultaneous users, custom storage, custom recording, white-label branding, fully custom feature flags
**And** each plan row stores: `id` (UUID v7), `name`, `tier` (enum: `free`, `pro`, `enterprise`), `limits` (JSONB: `{ maxGroups, maxParticipantsPerGroup, maxSimultaneousUsers, maxStorageGB, maxRecordingDaysRetention, maxRecordingGB }`), `features` (JSONB: available feature set), `isActive`, `createdAt`, `updatedAt`

**Given** a tenant has `plan: free` with hardcoded limits from Epic 3 (Story 3.3)
**When** Epic 11 is deployed
**Then** the existing hardcoded `PLAN_LIMITS` constants in the Guard are replaced by a dynamic lookup: `planService.getLimits(tenantId)` which reads from `SubscriptionPlan` table joined with `tenants.plan`
**And** the `plan_limits_override` JSONB field on `tenants` table (already created in Epic 3) allows per-tenant overrides of any limit — overrides take precedence over plan defaults. Override payload validated via `PlanLimitsOverrideSchema` (Zod): all numeric fields must be positive integers or `null` (null = use plan default). Invalid payloads return 422
**And** the Redis atomic counting (`INCR` with 5-min TTL) from Epic 3 continues to work — only the source of truth for max values changes from constant to database
**And** if Redis is unavailable, the PostgreSQL pessimistic lock fallback from Epic 3 is preserved
**And** if `SubscriptionPlan` table is empty or the query fails (e.g., seed didn't run), the Guard falls back to hardcoded defaults (`PLAN_LIMITS_FALLBACK` constant) — never returns 500 to the user. A warning is logged via Pino: "SubscriptionPlan table empty, using fallback defaults"
**And** a contract test validates: Guard behavior is IDENTICAL before (hardcoded) and after (dynamic) migration — create tenant on Free plan → verify same limits enforced in both modes
**And** a fallback test validates: delete all SubscriptionPlan rows → verify Guard uses fallback defaults → no 500 errors
**And** an override precedence test validates: plan says max 3 groups, override says max 10 → verify 10 is used. Override has `maxGroups: null` → verify plan default (3) is used

**Given** I am a Super Admin
**When** I access `GET /api/v1/admin/plans`
**Then** I see all subscription plans with their limits and active tenant counts per plan
**And** I can update plan limits via `PATCH /api/v1/admin/plans/:planId` — changes apply to ALL tenants on that plan (unless overridden by `plan_limits_override`)
**And** plan changes use write-through cache: the new limits are WRITTEN to Redis (`SET cache:plan-limits:{tenantId}`) immediately, not just invalidated (`DEL`) — this eliminates the race condition window between invalidation and the next cold-cache read

**Given** I want to override limits for a specific tenant
**When** I update `PATCH /api/v1/admin/tenants/:tenantId` with `planLimitsOverride` payload
**Then** the override is stored in `plan_limits_override` JSONB and takes precedence
**And** the override is recorded in the audit log (Epic 9)

**Given** a tenant's plan is downgraded (e.g., Pro → Free)
**When** the tenant has resources exceeding the new plan's limits (e.g., 10 groups but Free allows 3)
**Then** existing resources are NOT deleted — the tenant retains access to all existing groups, members, trails, etc.
**And** the tenant cannot CREATE new resources beyond the new plan's limits (read-only for excess resources)
**And** a banner is displayed: "Seu plano atual permite até {limit} {resource}. Você possui {current}. Para criar novos, faça upgrade ou remova os excedentes."

### Story 11.2: Branding Customizado do Tenant

As a Admin Tenant,
I want to customize the branding of my platform instance with my church's logo, colors, and display name,
So that participants see a familiar, branded experience when accessing our discipleship platform.

**Acceptance Criteria:**

**Given** I am an Admin Tenant on a Pro or Enterprise plan
**When** I navigate to Settings > "Identidade Visual"
**Then** I can configure:
  - **Logo:** Upload via MinIO (storage policy `permanent`, max 2MB, formats: PNG/JPG/SVG) — displayed in the sidebar/navigation and login page
  - **Colors:** Override `brand-teal` primary color and `brand-teal-light` secondary color via CSS custom properties — input: hex color picker with live preview. A contrast validation check runs on selection: if the chosen color has contrast ratio < 4.5:1 against `surface-base` (#FAFAF8) or `surface-elevated` (#FFFFFF), a warning is displayed: "Esta cor pode dificultar a leitura. Considere uma tonalidade mais escura." (warning only, not blocking — admin has final say)
  - **Display name:** Custom tenant name shown in the header and page titles
**And** changes are saved via `PATCH /api/v1/tenants/current/branding`
**And** branding is applied via CSS custom properties injected at the root layout level — `--color-brand-primary` and `--color-brand-secondary` override the defaults from `tailwind.preset.ts` (Epic 1, Story 1.7)

**Given** I am an Admin Tenant on the Free plan
**When** I navigate to Settings > "Identidade Visual"
**Then** the branding section shows "Disponível no plano Pro" with an upgrade prompt (Story 11.4 pattern)
**And** only the display name field is editable (Free plan includes standard branding with name customization)

**Given** branding is configured
**When** any user in my tenant loads the app
**Then** the custom logo replaces the default metanoia logo in the navigation
**And** the custom colors are applied via CSS custom properties without page reload
**And** the branding is cached in the browser (TanStack Query, staleTime: 30 minutes) and refreshed on next visit after changes

**Given** the logo upload
**When** the image is processed
**Then** the server validates dimensions (min 64x64, max 512x512) and file size (max 2MB)
**And** the image is resized synchronously on upload using `sharp` library (lightweight, native): 128x128 for navigation and 64x64 for favicon (if applicable). Sync processing is acceptable for ≤2MB images
**And** the signed URL for the logo is cached in Redis (`cache:branding:{tenantId}`, TTL 1 hour) to avoid MinIO calls on every page load

### Story 11.3: Políticas & Feature Toggles por Tenant

As a Admin Tenant,
I want to configure tenant-specific policies and feature toggles,
So that I can enable or disable features like focus monitoring and mandatory camera according to my church's pastoral approach.

**Acceptance Criteria:**

**Given** I am an Admin Tenant
**When** I navigate to Settings > "Políticas e Funcionalidades"
**Then** I see a list of configurable feature toggles, each with:
  - Toggle name (pastoral vocabulary from `vocabulary.ts`), description, current state (on/off)
  - Tier availability badge: if a feature requires Pro/Enterprise, the toggle shows "Requer plano Pro" and is disabled on Free

**Given** the following feature toggles exist
**When** the configuration page loads
**Then** the toggles include (but are not limited to):
  - `focusMonitoring` — "Indicador de foco em reuniões" (default: OFF for new tenants — NFR-L4). Tracks tab visibility during meetings
  - `mandatoryCamera` — "Câmera obrigatória em reuniões" (default: OFF). Requires participants to have camera on
  - `sequentialTrailAccess` — "Acesso sequencial padrão em trilhas" (default: OFF). New trails default to sequential mode
  - `autoPresenceTracking` — "Registro automático de presença" (default: ON). Tracks meeting attendance automatically
  - `expressMode` — "Modo Express" (default: ON for new tenants). Simplifies UI by hiding advanced features. Transition to Advanced Mode via this toggle — system suggests but never auto-transitions (per PRD decision)
**And** toggles are stored in a `TenantPolicies` table: `tenantId` (unique FK), `policies` (JSONB with all toggle values)
**And** default values are defined in code and applied when no tenant-specific config exists (convention over configuration)

**Given** I toggle a feature
**When** I change `focusMonitoring` from OFF to ON
**Then** the change is saved via `PATCH /api/v1/tenants/current/policies`
**And** the change takes effect immediately for all users in my tenant (no restart required)
**And** the Redis cache uses write-through: new policies are WRITTEN to `cache:policies:{tenantId}` with an incremented `policyVersion` counter. The frontend compares `policyVersion` (returned in API response header `X-Policy-Version`) against its cached version — on mismatch, TanStack Query invalidates the policies cache and refetches
**And** the change is recorded in the audit log (Epic 9) with `previousState` and `newState`
**And** if the feature requires a higher plan tier, the API returns 403 with: "Esta funcionalidade requer o plano {planName}. [Ver upgrade]"

**Given** a feature toggle affects user privacy (e.g., `focusMonitoring`)
**When** the toggle is enabled
**Then** participants are notified via the transparency banner mechanism from Epic 5 (FR50): "Seu líder ativou o indicador de foco nas reuniões"
**And** participants who have withdrawn consent for this feature (Epic 9, Story 9.4) are exempt — the feature is NOT activated for them regardless of the toggle
**And** a consent interaction test validates: enable `focusMonitoring` toggle → user who withdrew consent → verify feature stays OFF for that specific user while active for others in the same tenant

### Story 11.4: Prompt de Upgrade & Gestão de Limites

As a Admin Tenant,
I want to see contextual upgrade prompts when my tenant approaches or hits plan limits,
So that I can understand my usage and make informed decisions about upgrading.

**Acceptance Criteria:**

**Given** a tenant is on the Free plan with a limit of 3 groups
**When** the admin has 3 groups and tries to create a 4th via `POST /api/v1/groups`
**Then** the Guard (evolved from Epic 3) blocks the creation and returns 403 with:
  - `{ "statusCode": 403, "error": "PlanLimitExceeded", "message": "Limite do plano atingido (3/3 grupos). Seu plano permite até 3 grupos — considere fazer upgrade para acolher mais pessoas.", "details": { "resource": "groups", "current": 3, "limit": 3, "currentPlan": "free", "suggestedPlan": "pro" } }`
**And** the frontend displays an upgrade prompt card with: current usage, plan limit, and "Conhecer plano Pro" CTA button
**And** the prompt uses pastoral vocabulary: "acolher mais pessoas" instead of "increase capacity"

**Given** a tenant is approaching a limit (≥ 80% usage)
**When** the admin views the dashboard or the relevant management page
**Then** a non-blocking warning banner is displayed: "Você está usando {current}/{limit} {resource}. Conheça o plano {suggestedPlan} para expandir."
**And** the warning is dismissable (stored in localStorage, re-shown after 7 days)
**And** the 80% threshold is configurable via environment variable `PLAN_WARNING_THRESHOLD` (default: 0.8)

**Given** the admin clicks "Conhecer plano Pro" or "Ver planos"
**When** the upgrade page loads at `/app/admin/settings/plans`
**Then** a comparison table shows:
  - Current plan highlighted, with current usage per resource
  - Pro and Enterprise plans with their limits
  - Preços realistas no seed: Free (R$ 0), Pro (R$ 99/mês), Enterprise ("Sob consulta") — armazenados em `SubscriptionPlan.metadata` JSONB
  - "Assinar Pro" button (self-service checkout — stub/placeholder in this story, real payment integration is out of scope)
  - "Falar com vendas" button for Enterprise (opens email template or contact form)
**And** o seed (`prisma/seed.ts`) inclui os 3 planos com preços placeholder realistas para que a tabela comparativa funcione visualmente desde o MVP

**Given** the admin initiates a plan change
**When** self-service upgrade from Free → Pro is selected
**Then** for now, the system records the upgrade request via `POST /api/v1/tenants/current/upgrade` with `{ targetPlan: "pro" }`
**And** the API returns 202 with status "pending" — actual plan activation requires manual approval by Super Admin (full self-service billing is a future epic)
**And** the upgrade request is recorded in the audit log
**And** a domain event `tenant.upgrade.requested` is emitted with `{ tenantId, currentPlan, targetPlan, requestedBy, timestamp }`

**Given** a Super Admin needs to manage upgrade requests
**When** they access `GET /api/v1/admin/upgrade-requests?status=pending`
**Then** a paginated list is returned with: `tenantId`, `tenantName`, `currentPlan`, `targetPlan`, `requestedBy`, `requestedAt`, `status`
**And** the list supports filtering by `status` (`pending`, `approved`, `rejected`)
**And** the Super Admin dashboard shows a badge with the count of pending requests

**Given** a Super Admin approves the upgrade
**When** the plan is changed via `PATCH /api/v1/admin/tenants/:tenantId` with `{ plan: "pro" }`
**Then** the tenant's plan is updated immediately
**And** new limits take effect immediately (Redis cache invalidated via write-through: new limits written to Redis, not just deleted)
**And** existing resources are NOT affected (no data loss on upgrade)
**And** the admin is notified via in-app toast on next login: "Parabéns! Seu plano foi atualizado para Pro."

---

## Epic 12: Hardening de Acessibilidade & Qualidade UX

Auditoria completa de acessibilidade sobre todos os fluxos implementados nos Epics 1-11. Foco em navegação por teclado, contraste WCAG AA, formulários acessíveis e teste automatizado no CI. Componentes base já usam Radix (acessíveis por padrão); este épico cobre gaps de integração, validação manual e quality gates.

**Nota de escopo:** Screen reader testing (NFR-A4: compatibilidade com VoiceOver/NVDA/JAWS) é escopo de Release 2, não deste épico. Este épico cobre keyboard nav, contraste visual, formulários e CI gates. Stakeholders devem estar cientes de que acessibilidade "completa" inclui R2.

**NFRs cobertos:** NFR-A1, NFR-A2, NFR-A3
**UX-DRs cobertos:** UX-DR19, UX-DR21
**Pré-requisito:** Epics 1-11 (fluxos a auditar devem existir)

**Definition of Done (transversal):** Relatório de auditoria documentado com: issues encontradas, issues corrigidas, e issues aceitas como tech debt para R2 (se houver). axe-core report baseline (antes) vs. report final (depois) para medir progresso.

### Story 12.1: Navegação por Teclado — Fluxos Públicos & Infraestrutura (NFR-A1)

As a user with motor disabilities or keyboard preference,
I want to navigate public flows and infrastructure components using only the keyboard,
So that I can access the platform from the first interaction without depending on a mouse.

**Acceptance Criteria:**

**Given** a user accesses the application via keyboard only
**When** they navigate the login flow (email input → password input → submit → error/success)
**Then** tab order follows visual reading order (top-to-bottom, left-to-right)
**And** every interactive element receives visible focus via `:focus-visible`
**And** Enter activates buttons and links, Space toggles checkboxes

**Given** a user accesses the registration flow
**When** they navigate the multi-field form (nome → email → senha → confirmação → submit)
**Then** tab order is sequential through all fields
**And** password visibility toggle is keyboard-accessible (Space/Enter)

**Given** a user navigates any page
**When** they press Tab as the first action
**Then** a "Ir para conteúdo" skip navigation link appears as the first focable element
**And** the skip link is visually hidden by default (`sr-only`) but becomes visible on focus (`focus:not-sr-only`)
**And** when visible, it appears at the top of the viewport with solid background (`surface-elevated`), high contrast text, and `z-50`
**And** activating it moves focus to the `<main>` content area, bypassing sidebar/navbar

**Given** a user opens a modal dialog (any modal across the application)
**When** the modal renders
**Then** focus is trapped inside the modal (Tab cycles through modal elements only)
**And** Escape closes the modal and returns focus to the trigger element
**And** `aria-modal="true"` and `role="dialog"` are present
**And** Radix Dialog handles this natively — this AC validates it works correctly in all modals

**Given** a user navigates dropdown menus (sidebar navigation, action menus)
**When** they press Arrow Down/Up
**Then** focus moves between menu items sequentially
**And** Enter selects the focused item
**And** Escape closes the menu and returns focus to the trigger

**Given** components are loading (skeleton screens, SSR hydration)
**When** the user presses Tab during a loading state
**Then** tab order remains stable — focus does not jump to unexpected elements as content hydrates
**And** skeleton placeholders are not focable (`tabindex="-1"` or `aria-hidden="true"`)

**Sub-task 0 (Baseline):** Antes de qualquer correção, rodar axe-core em todos os fluxos públicos e gerar report baseline. Comparar com report final para medir progresso.

**Fluxos auditados:**
1. Login e registro (Epic 1)
2. Skip navigation (infraestrutura global)
3. Modal focus trap (infraestrutura global — validar em 3+ modais distintos)
4. Dropdown/menu keyboard (sidebar, action menus)

**Teste:** Playwright E2E com `page.keyboard` para cada fluxo. Teste manual cross-browser: Chrome, Firefox, Safari. Checklist de severidade: blocker (focus trap quebrado, skip nav ausente), major (tab order incorreta), minor (focus ring esteticamente inconsistente).

### Story 12.2: Navegação por Teclado — Fluxos Autenticados (NFR-A1)

As a user with motor disabilities or keyboard preference,
I want to navigate all authenticated flows using only the keyboard,
So that I can manage groups, trails, config, and plans without a mouse.

**Acceptance Criteria:**

**Given** a user navigates the dashboard (3 experiências: Consumo, Gestão, Admin)
**When** they use Tab through the main layout
**Then** focus follows: skip link → sidebar nav → main content area → action buttons
**And** sidebar items are navigable with Arrow Up/Down, Enter to select
**And** experience switching (if applicable) is keyboard-accessible

**Given** a user navigates CRUD de grupos (Epic 3)
**When** they create, edit, or delete a group
**Then** all form fields, buttons, and confirmation dialogs are keyboard-accessible
**And** the member invitation flow (email input, CSV upload button) is fully navigable

**Given** a user navigates CRUD de trilhas, módulos e lições (Epic 4)
**When** they interact with the trail builder
**Then** drag-and-drop reordering has a keyboard alternative (move up/down buttons with `aria-label`)
**And** all content editing fields are navigable by Tab

**Given** a user navigates the catálogo de trilhas e busca (Epic 8)
**When** they search and filter trails
**Then** search input, filter dropdowns, and result cards are all keyboard-navigable
**And** result cards can be activated with Enter

**Given** a user navigates configuração do tenant e branding (Epic 6)
**When** they edit settings and upload logo
**Then** color picker (if present) has keyboard alternative
**And** file upload button is focable and activable via Enter/Space

**Given** a user navigates gestão de planos e upgrade (Epic 11)
**When** they view the comparison table and initiate upgrade
**Then** plan cards are navigable with Tab, details expandable with Enter
**And** "Assinar Pro" and "Falar com vendas" CTAs are focable

**Fluxos auditados:**
1. Dashboard — 3 experiências (Epic 1)
2. CRUD de grupos e convite de membros (Epic 3)
3. CRUD de trilhas, módulos e lições (Epic 4)
4. Catálogo de trilhas e busca (Epic 8)
5. Configuração do tenant e branding (Epic 6)
6. Gestão de planos e upgrade (Epic 11)

**Teste:** Playwright E2E com `page.keyboard` para cada fluxo. Teste manual cross-browser: Chrome, Firefox, Safari. Mesmo checklist de severidade da Story 12.1.

### Story 12.3: Contraste WCAG AA & Focus Visible (NFR-A2, UX-DR19)

As a user with low vision,
I want all text, icons, and interactive elements to meet WCAG AA contrast ratios with visible focus indicators,
So that I can read and interact with the platform comfortably.

**Acceptance Criteria:**

**Given** the design token palette defined in `tailwind.preset.ts`
**When** text is rendered on any surface
**Then** the contrast ratio meets the minimum: 4.5:1 for normal text (< 18px), 3:1 for large text (≥ 18px bold or ≥ 24px regular)
**And** graphical elements and icons meet 3:1 minimum against their background

**Given** any interactive element (button, link, input, select, checkbox, radio, tab)
**When** the element receives keyboard focus
**Then** a visible focus ring is displayed using Tailwind/shadcn utilities: `focus-visible:ring-2 ring-brand-teal/30 ring-offset-2`
**And** the `--ring` CSS variable from shadcn theme is configured to match `brand-teal`
**And** `:focus-visible` is used (not `:focus`) to avoid showing ring on mouse clicks
**And** behavior is consistent across Chrome, Firefox, and Safari

**Given** the pastoral status indicators (semáforo colors) — *validável somente após Epic 7 estar done*
**When** displaying care status
**Then** color is NEVER the only indicator — always accompanied by icon + descriptive text
**And** care-urgent (#C1666B) + ⚠️ + "precisa de cuidado"
**And** care-attention (#D4A24C) + 👀 + "merece atenção"
**And** care-ok (#7BA38A) + ✓ + "está bem"

**Teste:** jest-axe (unit) para cada componente. Playwright com `@axe-core/playwright` para E2E. Teste manual cross-browser (Chrome, Firefox, Safari) com foco em focus ring visibility.

### Story 12.4: Touch Targets, Reduced Motion & Mobile Feedback (NFR-A2, UX-DR19)

As a user on mobile or with motion sensitivity,
I want touch-friendly targets and respect for motion preferences,
So that I can interact comfortably on any device.

**Acceptance Criteria:**

**Given** any interactive element on mobile or touch devices
**When** rendered
**Then** touch targets are ≥ 44×44px with ≥ 8px gap between adjacent targets
**And** this applies to: buttons, links, inputs, checkboxes, tabs, sidebar items, cards with CTA

**Given** a user touches an interactive element on mobile
**When** the touch begins (`:active` state)
**Then** visual feedback is provided: opacity reduction (`active:opacity-80`) or subtle scale (`active:scale-[0.98]`)
**And** the feedback is immediate (no delay) to confirm the touch was registered
**And** this is especially important for users with cognitive disabilities who need confirmation

**Given** the user has `prefers-reduced-motion: reduce` in OS settings
**When** any animation or transition would play
**Then** it is disabled or reduced to opacity-only (no motion)
**And** this applies to: page transitions, toast entrance/exit, skeleton shimmer, dropdown open/close
**And** verified via Playwright `page.emulateMedia({ reducedMotion: 'reduce' })` (supported since Playwright 1.12+)

**Teste:** Playwright E2E com `emulateMedia({ reducedMotion: 'reduce' })` para motion. Teste manual em dispositivo móvel real para touch targets e feedback. jest-axe para validar touch target sizing.

### Story 12.5: Formulários Acessíveis (NFR-A3)

As a user relying on assistive technology,
I want all forms to have proper labels, instructions, and error messages,
So that I can fill out forms correctly without visual context.

**Acceptance Criteria:**

**Given** any form in the application
**When** it renders
**Then** every input has an explicit `<label>` with `htmlFor` matching the input `id`
**And** required fields are marked with `aria-required="true"` and a visual indicator (*)
**And** optional fields are explicitly labeled "(opcional)"
**And** group-related inputs use `<fieldset>` + `<legend>` (e.g., radio groups, checkbox groups)

**Given** a form field has additional instructions or constraints
**When** the field renders
**Then** instructions are linked via `aria-describedby` (e.g., "Mínimo 8 caracteres" for password)
**And** the instruction text has sufficient contrast (4.5:1)

**Given** a user submits a form with validation errors
**When** errors are detected (Zod validation)
**Then** each error message is associated to its field via `aria-describedby`
**And** the error message uses `role="alert"` for immediate screen reader announcement (não combinar com `aria-live` — `role="alert"` já implica `aria-live="assertive"` + `aria-atomic="true"`)
**And** the invalid field has `aria-invalid="true"`
**And** the first field with error is scrolled into view (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) and then receives focus
**And** all error messages are extracted from `apps/web/messages/pt-BR.json` (i18n), never hardcoded — using pastoral vocabulary where appropriate (e.g., key `form.group.name.required` → "Por favor, preencha o nome do grupo")

**Given** a form is submitting (loading state)
**When** the submit button is processing
**Then** the button shows a spinner with `aria-busy="true"` and `aria-label` from i18n (key `form.submitting`)
**And** the button is disabled to prevent double submission

**Formulários auditados (prioridade por complexidade):**

*Must-have (críticos):*
1. Login (email + senha)
2. Registro (nome + email + senha + confirmação)
3. Wizard onboarding (5 steps: perfil, igreja, grupo, líder, radar) — mais complexo

*Should-have:*
4. Criar/editar grupo (nome, descrição, tipo)
5. Convidar membro (email ou CSV)
6. Criar/editar trilha (título, descrição, categoria)
7. Criar/editar módulo e lição
8. Configuração tenant (nome, logo, cores)
9. Branding (palette, logo upload)
10. Upgrade request

**Teste:** jest-axe para cada formulário. Playwright E2E validando `aria-invalid`, `aria-describedby`, `scrollIntoView` + focus management após submit com erro. Verificar que mensagens vêm do i18n (não hardcoded).

### Story 12.6: Teste Automatizado de Contraste & axe-core Quality Gate no CI (UX-DR21)

As a developer,
I want automated accessibility checks running in CI,
So that contrast regressions and a11y violations are caught before merge and never reach production.

**Acceptance Criteria:**

**Given** the project's design tokens
**When** the CI contrast script (`scripts/check-contrast.ts`) runs
**Then** it receives the token file path as parameter (`--tokens-path`), defaulting to `packages/config/tailwind.preset.ts` — never hardcoded
**And** it extracts all color tokens: text colors (`brand-*`, `care-*`, `neutral-*`) and surface colors (`surface-*`, `white`, `brand-*-dark`)
**And** it generates a matrix of all text × surface combinations
**And** it calculates WCAG contrast ratio for each pair using `color2k` (tree-shakeable, actively maintained — preferido sobre `wcag-contrast` que tem manutenção questionável)
**And** it flags any pair below 4.5:1 (normal text) or 3:1 (large text/graphics)

**Given** the script finds contrast violations
**When** it outputs the report
**Then** each violation shows: `[FAIL] text: brand-teal (#3AAFA9) on surface: surface-base (#FAFAF8) → ratio: 3.2:1 (min: 4.5:1)`
**And** it suggests a fix: `Suggestion: use brand-teal-dark (#17252A) instead (ratio: 14.1:1)`
**And** the script exits with code 1, blocking the PR merge

**Given** all token pairs pass contrast checks
**When** the script completes
**Then** it outputs a summary: `✓ {N} color pairs checked. All pass WCAG AA.`
**And** the script exits with code 0
**And** a `--verbose` flag shows ALL pairs (pass + fail) for full audit

**Given** a developer pushes a PR that modifies any file in `packages/config/`, `packages/ui/`, or `scripts/check-contrast.ts`
**When** the GitHub Actions workflow (`.github/workflows/a11y-checks.yml`) runs
**Then** the contrast script runs as one step
**And** `@axe-core/playwright` runs as a second step against the key pages (login, dashboard, groups list, trail detail) — this is a **permanent quality gate**, not limited to Epic 12
**And** both steps must pass for the PR check to succeed
**And** the workflow path filter covers `packages/config/**`, `packages/ui/**`, `apps/web/src/**`, and `scripts/check-contrast.ts`

**Given** a developer needs to understand a failure
**When** they read the CI output
**Then** the contrast script includes a legend explaining WCAG AA thresholds and how to fix
**And** the axe-core step generates an HTML report artifact attached to the workflow run

**Given** the axe-core quality gate runs on E2E
**When** new pages or components are added in future epics
**Then** the page list in the workflow config (`a11y-pages.json`) is extensible — devs add new pages to audit
**And** the workflow README documents how to add pages

**Teste:** Unit test do script com tokens de teste (pares que passam e pares que falham). Integration test do workflow via `act` (GitHub Actions local runner). Verificar que axe-core report é gerado como artifact.

---

## Epic 13: Relatórios Avançados & Analytics

Relatórios por reunião, por líder (consolidado), por tenant (agregado), métricas de plataforma (Super Admin), detecção automática de risco de evasão, e templates de conteúdo reutilizáveis. Analytics é supporting subdomain — service direto com Prisma, sem repository pattern. Materialized views para agregações pesadas.

**FRs cobertos:** FR42, FR63, FR65, FR66, FR67, FR79
**Pré-requisitos:** Epic 5 (reuniões — dados de presença), Epic 7 (Pastoral Radar — sinais semáforo), Epic 8 (trilhas completas — dados de progresso), Epic 14 (notificações — para alertar líder sobre risco de evasão)
**Nota:** FR42 (templates de conteúdo) é feature de gestão de trilhas, não analytics. Está neste épico por afinidade de Release 2 e maturidade de trilhas — implementado como milestone separado no sprint e potencialmente destacável.

**Orquestração de Materialized Views:** Dois jobs no `queue:reports`:
1. `refresh-tenant-views` — refresha `mv_tenant_report` (tenant-scoped), roda primeiro
2. `refresh-platform-views` — refresha `mv_platform_metrics` (cross-tenant), roda como child job após #1 completar (BullMQ parent/child flow)
Ambos usam `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Cron: a cada 15min. Timeout: 10min por job. Se duração > 5min, emite alerta.

### Story 13.1: Relatório por Reunião (FR63)

As a Líder de Grupo,
I want to see a detailed report for each meeting with attendance and engagement metrics,
So that I can understand group dynamics and follow up on absent participants.

**Acceptance Criteria:**

**Given** a meeting has been completed (status `completed` from Epic 5)
**When** the leader accesses `GET /api/v1/meetings/:id/report`
**Then** the report includes:
  - Total participants invited vs. present vs. absent
  - Attendance percentage
  - Per-participant: present (yes/no), join time, leave time, duration in meeting
  - Engagement score: `participantDuration / meetingDuration` (0.0 a 1.0) — classificação: ≥ 0.75 alto, 0.50–0.74 médio, < 0.50 baixo
**And** the response follows the standard format `{ data: { meetingId, date, groupName, metrics: {...}, participants: [...] }, meta: { generatedAt } }`

**Given** the leader views the report in the UI at `/app/gestao/meetings/:id/report`
**When** the report page renders
**Then** a summary card shows: total participants, attendance %, average engagement score com badge de classificação (alto/médio/baixo)
**And** a mini-chart of attendance trend shows the last 5 meetings of this group (sparkline: attendance % over time) — *nice-to-have, pode ser implementado como sub-task*
**And** a participant list shows each member with status icon (present ✓ / absent ✗), duration, and engagement score
**And** absent participants are highlighted with a "Cuidar" CTA linking to pastoral action (if Epic 7 Radar is available)

**Given** the leader wants to export the report
**When** they click "Exportar CSV"
**Then** a CSV file is generated with columns: name, email, status, joinTime, leaveTime, duration, engagementScore
**And** the export follows the same BullMQ async pattern from Epic 8 (`queue:reports`), returning 202 with download link via polling

**Given** a meeting has no attendance data (edge case — meeting created but never started)
**When** the leader accesses the report
**Then** the report shows "Nenhum dado de presença registrado para esta reunião" with empty state illustration
**And** the API returns 200 with empty `participants: []` and `metrics: { attendance: 0, total: N }`

**Teste:** Integration test com meeting fixtures (0 participants, partial, full attendance). Validar cálculo de engagement score e classificação. RLS isolation test: líder do tenant A NÃO vê reuniões do tenant B. E2E: Playwright para fluxo completo report → export CSV.

### Story 13.2a: Relatório Consolidado por Líder (FR79)

As a Líder de Grupo,
I want to see an aggregated report across all my groups,
So that I can have a holistic view of my pastoral impact.

**Acceptance Criteria:**

**Given** a leader has multiple groups
**When** they access `GET /api/v1/reports/leader-summary?period=30d`
**Then** the report includes per-group: attendance average, trail progress average, participants at risk count, active participants count
**And** an overall summary: total groups, total participants, overall attendance %, overall trail completion %
**And** the API supports period filter: `7d`, `30d`, `90d`, `custom` (with `startDate` and `endDate`)

**Given** the leader views the report in the UI at `/app/gestao/reports`
**When** the page loads
**Then** filters are available: período, grupo específico, status do semáforo
**And** each group card shows a summary with drill-down link to individual group details

**Teste:** Integration test com leader com 1, 3, 5 grupos e dados variados. RLS isolation test: líder do tenant A NÃO vê dados do tenant B. E2E: filtros de período e grupo.

### Story 13.2b: Relatório por Tenant com Materialized Views (FR65)

As an Admin Tenant,
I want to see aggregated metrics for the entire tenant,
So that I can monitor overall health and make strategic decisions.

**Acceptance Criteria:**

**Given** an admin accesses `GET /api/v1/reports/tenant-summary?period=30d`
**When** the tenant has multiple groups and leaders
**Then** the report includes per-group: leader name, attendance average, trail progress, risk count
**And** a tenant-wide summary: total groups, total leaders, total participants, overall metrics
**And** the data comes from a materialized view (`mv_tenant_report`) refreshed every 15 minutes via BullMQ job (`queue:reports`, job `refresh-tenant-views`)
**And** the `REFRESH MATERIALIZED VIEW CONCURRENTLY` command is used to avoid locking reads during refresh

**Given** the UI renders the report
**When** the page loads
**Then** a "Dados atualizados em: {timestamp}" label is displayed (timestamp from materialized view `last_refresh_at`)
**And** a "Atualizar agora" button triggers on-demand refresh (rate-limited: max 1 per 5min per tenant)
**And** during refresh, the button shows a spinner and is disabled
**And** if rate-limited, a toast is shown: "Atualização disponível em X minutos"
**And** on completion, the timestamp updates and a success toast confirms: "Dados atualizados com sucesso"
**And** filters are available: período, grupo específico, status do semáforo

**Given** the materialized view refresh job fails
**When** the next scheduled run executes
**Then** it retries with exponential backoff (3 attempts, 30s/60s/120s)
**And** stale data is still served with a warning banner: "Dados podem estar desatualizados"
**And** failure is logged with `correlation_id` for debugging
**And** if refresh duration > 5min, an alert metric is emitted via Pino for monitoring

**Teste:** Integration test com materialized view refresh (verify data freshness). Load test padronizado: 500 tenants × 10 grupos × 50 participantes = 250k participantes — query < 2s. RLS isolation test: admin do tenant A NÃO vê dados do tenant B. E2E: filtros, botão "Atualizar agora" com estados (loading, rate-limited, success).

### Story 13.3: Detecção de Risco de Evasão (FR66)

As a Líder de Grupo,
I want the system to automatically detect participants at risk of dropping out,
So that I can proactively reach out and provide pastoral care before they disengage.

**Acceptance Criteria:**

**Given** the daily evasion detection job runs (`queue:reports`, job `detect-evasion-risk`, cron `0 6 * * *`)
**When** it analyzes participant activity across all tenants
**Then** it flags participants matching either criterion (avaliação é *per-participant-per-group*, não global):
  - 3+ consecutive absences in their specific group's meetings
  - 2+ weeks without any platform access (`last_seen_at` from user profile)
**And** the job is tenant-isolated: processes one tenant at a time to respect RLS boundaries
**And** uses batch processing (100 participants per batch) to avoid memory spikes
**And** SLA: job completa em no máximo 30 minutos. Métricas de duração emitidas ao final via Pino (`job.duration_ms`, `job.tenants_processed`, `job.participants_flagged`)

**Given** a participant is flagged as at risk
**When** the detection job processes them
**Then** it checks if the leader manually changed the semáforo in the last 24h — if yes, the job does NOT override the manual pastoral decision
**And** otherwise, the semáforo status transitions automatically:
  - 🟢 (ok) → 🟡 (attention) on first detection
  - 🟡 (attention) → 🔴 (urgent) if still flagged after 7 more days
**And** a domain event `pastoral.participant.risk-detected` is emitted with `{ tenantId, participantId, riskType: 'absence' | 'inactivity', details: { consecutiveAbsences?, daysSinceLastAccess? }, previousStatus, newStatus }`
**And** the status change is recorded in the participant's care timeline (Epic 7)
**And** a notification is created for the group leader via the notification system (Epic 14): "⚠️ {Nome} pode precisar de cuidado — {motivo}" (ex: "3 ausências consecutivas" ou "Sem acesso há 15 dias")
**And** the reason (riskType + details) is visible on the participant's card in the Radar UI: tooltip ou label com motivo

**Given** a group is marked as "em recesso" (paused)
**When** the detection job runs
**Then** absences during the recesso period are NOT counted toward consecutive absence detection
**And** the recesso status is set by the leader via `PATCH /api/v1/groups/:id` with `{ status: 'on_break', breakUntil: '2026-07-01' }`
**And** the group automatically resumes when `breakUntil` date passes

**Given** a participant returns to activity after being flagged
**When** they attend a meeting or access the platform
**Then** the semáforo transitions back per-group: 🔴→🟡 (on first activity) and 🟡→🟢 (after 2 consecutive attendances in the *next 2 scheduled meetings of that specific group*)
**And** a domain event `pastoral.participant.risk-resolved` is emitted
**And** a `CelebrationBanner` (componente do Epic 7 — dependência explícita; se não existir, implementar banner simples inline) is shown to the leader: "{Nome} voltou a participar!"

**Given** the detection job encounters an error for a specific tenant
**When** the error occurs
**Then** it skips the failed tenant, logs the error with `tenantId` and `correlation_id`, and continues processing remaining tenants
**And** retries the failed tenant in the next scheduled run
**And** after 3 consecutive failures for the same tenant, an alert is sent to Super Admin

**Teste:** Unit test do algoritmo de detecção (fixtures: 0, 2, 3, 5 ausências; grupo em recesso; retorno; participante em múltiplos grupos com padrões diferentes). Integration test do job BullMQ end-to-end. Race condition test: líder altera semáforo manualmente → job roda nas próximas 24h → verifica que decisão manual prevalece. Snapshot tests obrigatórios para schemas Zod dos domain events `risk-detected` e `risk-resolved`. RLS isolation test. Load test padronizado: 500 tenants × 10 grupos × 50 participantes.

### Story 13.4: Métricas de Plataforma — Super Admin (FR67)

As a Super Admin,
I want to see platform-wide metrics across all tenants,
So that I can monitor platform health, adoption, and resource utilization.

**Acceptance Criteria:**

**Given** a Super Admin accesses `GET /api/v1/admin/platform-metrics/summary`
**When** the endpoint processes the request
**Then** it returns aggregate totals (cached in Redis, TTL 5min, key `cache:platform-metrics:summary`):
  - `totalTenants`, `activeTenants` (at least 1 login in last 30d), `totalUsers`, `activeUsers` (last 30d)
  - `totalGroups`, `totalMeetings` (last 30d), `totalTrails`
  - `averageAttendance` (platform-wide), `averageTrailCompletion`
  - `storageUsed` (total across tenants) — valor vem da tabela `tenant_storage_usage` (atualizada via hook de upload/delete no MinIO, não via query ao MinIO em tempo real)
  - `churnedTenants` (tenants ativos no mês anterior mas inativos agora), `netGrowth` (novos tenants - churned no período)
**And** the response format is `{ data: { ...metrics }, meta: { generatedAt, cacheTTL: 300 } }`

**Given** a Super Admin accesses `GET /api/v1/admin/platform-metrics/tenants?page=1&limit=20&sort=activeUsers:desc`
**When** the endpoint processes the request
**Then** it returns a paginated list of tenants with per-tenant metrics:
  - `tenantId`, `tenantName`, `plan`, `activeUsers`, `totalGroups`, `totalMeetings`, `storageUsed`, `createdAt`
**And** supports sorting by any metric column
**And** supports filtering by `plan` (`free`, `pro`, `enterprise`) and `status` (`active`, `inactive`)
**And** pagination follows standard `{ data: [...], meta: { total, page, limit, totalPages } }`

**Given** the Super Admin endpoint is called
**When** the guard validates the request
**Then** `@Roles('super_admin')` guard is enforced — no RLS (Super Admin sees cross-tenant data)
**And** the endpoint is under `/api/v1/admin/` namespace (separate from tenant-scoped `/api/v1/`)

**Given** the platform has 500+ tenants
**When** the summary endpoint is called without cache
**Then** the query completes in < 3s (materialized view `mv_platform_metrics` refreshed every 15min as child job of `refresh-tenant-views` — see Epic overview orchestration)
**And** on cache hit, response time is < 100ms

**Teste:** Integration test com 10+ tenants e dados variados. Load test padronizado: 500 tenants × 10 grupos × 50 participantes — verificar query < 3s. Validar que non-super-admin recebe 403. Validar cálculo de `churnedTenants` e `netGrowth`. Validar que `storageUsed` vem de `tenant_storage_usage` e não de query ao MinIO.

### Story 13.5: Templates de Conteúdo Reutilizáveis (FR42)

*Milestone separado — feature de gestão de trilhas agrupada neste épico por afinidade de Release 2. Pode ser implementada independentemente das stories 13.1–13.4.*

As an Admin Tenant,
I want to create and use reusable content templates,
So that I can quickly set up new trails based on proven structures without starting from scratch.

**Acceptance Criteria:**

**Given** the platform provides pre-built templates
**When** the system is seeded
**Then** a set of platform-scoped templates is available (read-only for tenants):
  - "Discipulado Básico" (4 módulos, 12 lições — estrutura apenas, sem conteúdo)
  - "Estudo Bíblico Temático" (3 módulos, 9 lições)
  - "Acolhimento de Novos Membros" (2 módulos, 6 lições)
**And** templates are stored in `ContentTemplate` table with `scope: 'platform' | 'tenant'` and `tenant_id: null` for platform-scoped

**Given** an admin wants to create a template from an existing trail
**When** they click "Salvar como Template" on a trail detail page
**Then** a `POST /api/v1/templates` is called with `{ sourceTrailId, name, description }`
**And** the system creates an immutable snapshot: copies module/lesson structure (titles, order, type) WITHOUT content (text, files, videos — fields `fileUrl`, `videoUrl`, `content` are set to `null` in the template)
**And** each version is a separate record in `ContentTemplate` with `sourceTrailId + version` as logical key
**And** version 1 is created on first save; subsequent "Salvar como Template" from the same trail creates version 2, 3, etc.
**And** the template is `scope: 'tenant'` and visible only within the tenant

**Given** an admin wants to create a new trail from a template
**When** they access the template library at `/app/admin/templates` and select a template
**Then** a preview shows: template name, description, structure tree (modules → lessons), source trail (if any), version, created date
**And** clicking "Usar Template" calls `POST /api/v1/trails` with `{ templateId, name, groupId }`
**And** a new trail is created with the template's structure, all content fields empty (ready to fill)
**And** the new trail has no link back to the template (independent copy — edits don't propagate)

**Given** an admin manages tenant templates
**When** they access `GET /api/v1/templates?scope=all`
**Then** the list shows both platform and tenant templates, clearly labeled
**And** the library supports: search by name, filter by scope (plataforma/tenant), sort by created date/name
**And** tenant templates support CRUD: edit name/description (`PATCH`), delete (`DELETE` — soft delete, no cascade to trails created from it)
**And** platform templates are read-only (no edit/delete for tenant admins)

**Given** the template versioning scenario
**When** an admin updates a template's source trail and wants to refresh the template
**Then** they must explicitly "Salvar como Template" again, creating a new version record
**And** the template list shows the latest version by default, with "Histórico de versões" link to see all versions
**And** existing trails created from older versions are NOT affected

**Teste:** Integration test: criar template from trail (com fileUrl/videoUrl nas lições) → verificar que template tem esses campos `null`. Usar template → verificar estrutura copiada. Versioning: salvar 2x → verificar 2 records com version 1 e 2. RLS isolation test: admin do tenant A NÃO vê templates do tenant B. E2E: fluxo completo library (busca, filtro) → preview → create trail. Edge case: template de trail vazia (0 módulos), template com 20+ lições.

---

## Epic 14: Notificações & Comunicação

Sistema de notificações in-app via SSE e email transacional via Resend. Notifications é supporting subdomain — service direto com Prisma. Pipeline: domain event → BullMQ `queue:notifications` → Channel Router → In-app (SSE push) | Email (Resend). Extensível para WhatsApp (Phase 3, fora de escopo).

**FRs cobertos:** FR77
**NFRs cobertos:** NFR-I1 (operação contínua 30min sem provedor), NFR-I2 (retry automático), NFR-I3 (timeouts explícitos), NFR-I4 (jobs falhados retidos), NFR-I5 (health check por integração)
**Pré-requisitos:** Epic 1 (auth + infra base), Epic 2 (multi-tenant + Keycloak)
**Nota:** FR78 (preferências granulares de notificação por tipo) é Post-MVP/Epic 16. Este épico inclui apenas um toggle "silenciar" (localStorage, limitação: local ao dispositivo; sincronização cross-device virá com FR78).
**Ordem de implementação:** 14.1 → 14.4 → 14.3 → 14.2a → 14.2b → 14.2c (14.3 depende de 14.4 para circuit breaker)

### Story 14.1: Infraestrutura de Notificações & Channel Router (FR77)

As a developer,
I want a notification infrastructure with a channel router,
So that any module can send notifications through multiple channels without coupling to delivery details.

**Acceptance Criteria:**

**Given** the notifications module is set up in `modules/notifications/`
**When** the Prisma migration runs
**Then** a `Notification` table is created with:
  - `id` (UUID v7), `tenant_id`, `user_id`, `type` (enum: `meeting_reminder`, `content_new`, `pastoral_alert`, `export_ready`, `system`), `title`, `body`, `channel` (enum: `in_app`, `email`), `status` (enum: `pending`, `sent`, `failed`, `read`), `read_at` (nullable), `metadata` (JSONB — flexible payload per type, includes `actionUrl`), `created_at`
**And** RLS policy enforces `tenant_id` isolation
**And** index on `(user_id, status, created_at DESC)` for notification center queries

**Given** a domain event is emitted (e.g., `pastoral.participant.risk-detected`, `meetings.meeting.scheduled`, `content.trail.published`)
**When** the `NotificationService.dispatch()` is called with `{ userId, type, title, body, channels: ['in_app', 'email'] }`
**Then** `tenant_id` is read from `RequestContext` (AsyncLocalStorage) — NUNCA passado como parâmetro (conforme regra do projeto)
**And** for BullMQ jobs that execute outside the request context, the processor recreates the context via `RequestContext.run({ tenantId, userId }, callback)` using the tenant_id stored in the job payload
**And** a BullMQ job is created in `queue:notifications` for each channel
**And** the Channel Router routes to the correct processor: `InAppChannel` or `EmailChannel`
**And** both channels implement a common `NotificationChannel` interface: `send(notification: NotificationPayload): Promise<NotificationResult>`
**And** the interface is extensible for future channels (WhatsApp) without modifying the router

**Given** multiple notifications of the same type are dispatched within a 5-minute window for the same user
**When** the batching logic processes them
**Then** a "delayed job" is created with 5min delay; when it fires, it collects all pending notifications of the same type/user and aggregates into a single digest: "{count} participantes precisam de cuidado no grupo {groupName}"
**And** the digest threshold is configurable via environment variable `NOTIFICATION_DIGEST_WINDOW_MS` (default: 300000)
**And** notifications of type `pastoral_alert` are NEVER batched — always dispatched immediately (critical for pastoral care)

**Given** a BullMQ job fails
**When** the failure occurs
**Then** the job is retried with exponential backoff (3 attempts, 30s/60s/120s)
**And** after all retries exhausted, the job is moved to the `failed` set (retained for investigation, NFR-I4)
**And** the notification status is updated to `failed`
**And** failure is logged with `correlation_id`, `channel`, `error_message`

**Teste:** Unit test do Channel Router (mock channels, verify routing). Integration test: dispatch → BullMQ job created → processor executes → verify `RequestContext.run()` sets correct tenant. Digest test: 10 notificações do mesmo tipo em 5min → 1 digest. Immediate test: `pastoral_alert` → verify NOT batched, sent immediately. Snapshot test para Zod schema do `NotificationPayload`. RLS isolation test.

### Story 14.2a: SSE Endpoint & Redis Pub/Sub Backend (FR77)

As a developer,
I want an SSE endpoint that pushes real-time notifications to connected clients,
So that users receive instant updates without polling.

**Acceptance Criteria:**

**Given** an authenticated user opens the application
**When** the frontend establishes an SSE connection to `GET /api/v1/sse/notifications`
**Then** the connection is tenant-scoped (guard validates Keycloak token, extracts `tenant_id` and `user_id`)
**And** the server sends a heartbeat comment (`: heartbeat`) every 30 seconds to keep the connection alive and detect dead connections
**And** the server enforces a maximum of 1000 concurrent SSE connections per NestJS instance (configurable via `SSE_MAX_CONNECTIONS`)
**And** if instance limit is reached, new connections receive 503 with `Retry-After: 30` header

**Given** a user already has SSE connections open in multiple tabs
**When** they open a 6th tab
**Then** the server tracks connections per user via Redis (`sse:connections:{tenantId}:{userId}` — SET of connection IDs)
**And** the maximum is 5 connections per user (configurable via `SSE_MAX_PER_USER`)
**And** when exceeded, the oldest connection is gracefully closed with an SSE event `event: close\ndata: { reason: 'max_connections_exceeded' }\n\n` before the new one is accepted

**Given** the `InAppChannel` processor sends a notification
**When** it processes the BullMQ job
**Then** the notification is saved to the `Notification` table with `status: 'sent'`
**And** an event is published to Redis Pub/Sub channel `rt:notifications:{tenantId}:{userId}` (tenant-scoped to prevent cross-tenant leakage)
**And** the SSE controller subscribes to the Redis channel and pushes to the client: `event: notification\ndata: { id, type, title, body, createdAt }\n\n`

**Given** the SSE connection is closed (user navigates away, tab closes)
**When** the server detects disconnection (via heartbeat timeout or explicit close)
**Then** the connection ID is removed from the Redis SET `sse:connections:{tenantId}:{userId}`
**And** the Redis Pub/Sub subscription for that connection is cleaned up

**Teste:** Integration test: dispatch notification → verify SSE event received via Redis Pub/Sub. Cross-tenant isolation test: user1 no tenant A e user1 no tenant B ambos conectados → notificação para tenant A → APENAS conexão do tenant A recebe. Per-user limit test: 6 connections → verify oldest closed. Load test: 500 concurrent SSE connections — critérios: memory heap < 512MB, event loop lag p99 < 100ms, zero dropped connections durante 5min. Heartbeat test: verify `: heartbeat` every 30s.

### Story 14.2b: Notification Center UI (FR77)

As a user,
I want a notification center in the header to view and manage my notifications,
So that I can quickly see what needs my attention and take action.

**Acceptance Criteria:**

**Given** a user is logged in
**When** they see the header
**Then** a bell icon is displayed with a badge showing unread count (capped at "99+")
**And** the badge has `aria-label="{count} notificações não lidas"` (or `"99 ou mais notificações não lidas"` when capped)
**And** when a new notification arrives via SSE, `aria-live="polite"` announces: "Nova notificação: {title}"

**Given** the user clicks the bell icon
**When** the notification dropdown opens
**Then** `GET /api/v1/notifications?status=unread&limit=20` returns the latest unread notifications
**And** each notification shows: icon by type, title, body preview (truncated at 100 chars), relative time ("há 5 min")
**And** clicking a notification marks it as read (`PATCH /api/v1/notifications/:id` with `{ status: 'read' }`) and navigates to `metadata.actionUrl`

**Given** the user has zero notifications
**When** they open the notification center
**Then** an empty state is displayed with illustration and message: "Tudo tranquilo por aqui! Suas notificações aparecerão aqui." (vocabulário pastoral, texto via i18n `pt-BR.json`)

**Given** a user wants to manage notifications
**When** they interact with the notification center
**Then** "Marcar todas como lidas" button marks all unread as read in batch (`PATCH /api/v1/notifications/mark-all-read`)
**And** a "Silenciar notificações" toggle is available — when enabled, SSE events are still received but no visual/audio alert is triggered
**And** the toggle is stored in `localStorage` (nota: local ao dispositivo; sincronização cross-device virá com FR78/Post-MVP)

**Teste:** E2E Playwright: bell icon → badge count → click → dropdown → notification list → click notification → mark as read → navigate to actionUrl. Empty state test: user sem notificações → verify empty state message. Silenciar toggle test: enable → verify no visual alert on new notification. Accessibility test: verify `aria-label` on badge, `aria-live` announcement.

### Story 14.2c: SSE Reconnection & Gap Fill (FR77)

As a user,
I want SSE connections to automatically reconnect and recover missed notifications,
So that I don't miss important updates due to network issues.

**Acceptance Criteria:**

**Given** the SSE connection is lost (network issue, server restart)
**When** the EventSource in the browser detects disconnection
**Then** it reconnects automatically with exponential backoff: 1s, 2s, 4s, 8s, max 30s
**And** a subtle indicator appears in the UI: "Reconectando..." (disappears on successful reconnect)

**Given** the SSE connection is re-established
**When** the client reconnects
**Then** it fetches missed notifications via `GET /api/v1/notifications?since={lastReceivedAt}&status=unread` to fill the gap
**And** the `lastReceivedAt` is tracked in memory (not persisted — page refresh fetches all unread)
**And** missed notifications are merged into the notification center without duplicates (deduplicate by `id`)

**Given** reconnection fails repeatedly (server down for extended period)
**When** backoff reaches max (30s) and 5 consecutive attempts fail
**Then** the reconnection continues in background but the UI shows: "Sem conexão. Notificações podem estar atrasadas." with a "Tentar agora" manual retry button

**Teste:** E2E Playwright: simulate disconnect (kill SSE endpoint) → verify auto-reconnect → verify gap fill fetches missed notifications. Extended outage test: 5 failed reconnects → verify UI warning. Reconnect success test: verify indicator disappears and missed notifications appear.

### Story 14.3: Notificações por Email via Resend (FR77, NFR-I1/I2/I3)

As a user,
I want to receive important notifications by email,
So that I'm informed even when I'm not using the platform.

**Acceptance Criteria:**

**Given** the `EmailChannel` processor receives a BullMQ job
**When** it processes the notification
**Then** it sends an email via Resend SDK using the `EmailService` abstraction (interface in `modules/notifications/channels/email.service.ts`)
**And** timeouts are enforced: connect ≤ 3s, read ≤ 10s (NFR-I3) via Resend SDK timeout config
**And** the email uses a template based on notification type:
  - `pastoral_alert`: subject "⚠️ {groupName}: participante precisa de cuidado", body with participant name, risk reason, CTA "Ver no Radar"
  - `meeting_reminder`: subject "Reunião amanhã: {groupName}", body with date, time, join link
  - `export_ready`: subject "Seu relatório está pronto", body with download link (signed URL, 1h expiry)
  - `content_new`: subject "Nova trilha disponível: {trailName}", body with description, CTA "Começar"
**And** all email templates use the tenant's branding (logo, colors from Epic 6) when available

**Given** a transient failure occurs (network timeout, Resend 5xx)
**When** the EmailChannel catches the error
**Then** it throws a retryable error (BullMQ retries with backoff, NFR-I2)
**And** after 3 failed retries, a fallback in-app notification is created: "📧 Não conseguimos enviar o email — confira aqui: {actionUrl}" (NFR-I1)
**And** the original notification status is updated to `failed` with `metadata.failureReason`

**Given** the email sending rate approaches the Resend free tier limit
**When** the daily counter reaches threshold (checked atomically via Redis Lua script: `if INCR result < threshold then allow else defer`)
**Then** at 80/100 daily emails: non-critical emails (`content_new`) are deferred to the next day
**And** `meeting_reminder` when deferred gets an immediate fallback in-app notification: "📅 Lembrete: Reunião amanhã no grupo {groupName}" — participant CANNOT miss a meeting reminder
**And** critical emails (`pastoral_alert`, `export_ready`, system emails like password reset) always continue to be sent regardless of counter
**And** the admin is notified in-app: "Limite diário de emails se aproximando. {sent}/{limit} enviados hoje."

**Given** the Resend API is completely unavailable for > 5 minutes
**When** the health check (Story 14.4) detects the outage
**Then** all new email notifications automatically fall back to in-app only
**And** a domain event `notifications.email.circuit-open` is emitted
**And** when Resend recovers (health check passes 3 consecutive times), the circuit closes and email delivery resumes
**And** deferred emails from the outage period are NOT retried (to avoid spam burst) — only new events use email

**Teste:** Integration test: send email via Resend (sandbox/test mode). Snapshot tests for each email template with representative data (nome com acentos, URL longa, tenant sem logo). Retry test: mock Resend 500 → verify 3 retries → verify fallback in-app created. Rate limit test: Redis Lua script atomicity — simulate 2 concurrent jobs at 79/100 → verify only 1 succeeds. Deferral test: meeting_reminder deferred → verify fallback in-app created. Circuit breaker test: mock Resend down → verify fallback → mock recovery → verify circuit closes. RLS isolation test.

### Story 14.4: Health Check de Integrações & Dashboard Super Admin (NFR-I5)

As a Super Admin,
I want to see the health status of all external integrations,
So that I can quickly identify and respond to service degradations.

**Acceptance Criteria:**

**Given** a Super Admin accesses `GET /api/v1/admin/health/integrations`
**When** the endpoint runs health checks
**Then** it checks each integration and returns:
  - **Resend** (email): `POST /emails` with dry-run or `GET /domains` — measure latency
  - **Keycloak** (auth): `GET /realms/{realm}/.well-known/openid-configuration` — measure latency
  - **MinIO** (storage): `HEAD` on health endpoint or bucket listing — measure latency
  - **Redis** (cache/jobs): `PING` command — measure latency
  - **PostgreSQL** (database): `SELECT 1` — measure latency
**And** each integration returns: `{ name, status, latencyMs, lastChecked, message? }`
**And** status classification: `healthy` (< 1s), `degraded` (1–5s), `unhealthy` (> 5s or error)
**And** the response includes a `summary: { total, healthy, degraded, unhealthy }` field

**Given** the health check cron runs
**When** it executes every 5 minutes
**Then** it runs as a BullMQ repeatable job (NOT `@nestjs/schedule` `@Cron`) to guarantee single-execution via Redis lock across multiple NestJS instances
**And** results are stored in `integration_health_log` table with `{ integration_name, status, latency_ms, message, checked_at }`

**Given** the Super Admin views the health dashboard at `/app/admin/health`
**When** the page loads
**Then** each integration shows: name, status badge (green/yellow/red), latency, last checked time
**And** a latency sparkline shows the last 24h (288 data points at 5min intervals) using a lightweight chart component (SVG inline or `@nivo/line`), responsive, hover shows exact value
**And** auto-refresh every 60 seconds with visible "Atualizado há X segundos" timestamp (visual warning when stale > 2min)
**And** clicking an integration shows detailed history with error messages (if any)

**Given** an integration's status changes
**When** it transitions from `healthy` to `degraded` or `unhealthy`
**Then** the change is debounced: notification is ONLY sent if the new status persists for 2 consecutive checks (10min) — prevents notification storm from flapping integrations
**And** a domain event `system.integration.status-changed` is emitted
**And** a notification is created for all Super Admins: "⚠️ {integrationName} está {status}" (via Story 14.1 infrastructure)
**And** the event is logged in the audit log with `correlation_id`

**Given** the health check endpoint is called by non-Super-Admin
**When** the guard validates
**Then** it returns 403 — health check data is Super Admin only

**Teste:** Integration test: mock cada integração respondendo healthy/degraded/unhealthy → verify status classification. Latency boundary test: 999ms → healthy, 1001ms → degraded, 5001ms → unhealthy. Flapping test: 5 alternâncias healthy/degraded em sequência → verify máximo 2-3 notificações (debounce). Guard test: non-super-admin → 403. BullMQ repeatable job test: verify single-execution with 2 NestJS instances simulated. E2E: dashboard com sparkline + auto-refresh + stale indicator.

---

## Epic 15: Acessibilidade Avançada

Compatibilidade com leitores de tela (VoiceOver, NVDA, JAWS) nas áreas críticas da plataforma e semáforo pastoral multimodal — garantindo que nenhuma informação dependa exclusivamente de cor. Continuação do Epic 12 (que cobriu keyboard nav, contraste WCAG AA, formulários acessíveis e axe-core no CI). Este épico fecha os gaps de acessibilidade para Release 2.

**NFRs cobertos:** NFR-A4, NFR-A5
**UX-DRs cobertos:** UX-DR20
**Pré-requisito:** Epic 12 (infraestrutura de acessibilidade base)

**Definition of Done (transversal):** Relatório de teste manual com pelo menos 3 screen readers (VoiceOver macOS/iOS, NVDA Windows, TalkBack Android) documentando: áreas testadas, issues encontradas, issues corrigidas. Nenhum blocker crítico (conteúdo inacessível) remanescente. Um membro da equipe designado como "accessibility champion" é responsável por validar os testes e manter o checklist atualizado. **Baseline axe-core:** antes de iniciar este épico, gerar snapshot do relatório axe-core em todas as rotas críticas (login, dashboard, trilhas, progresso). Após conclusão, comparar com o snapshot: o número de violations deve ser igual ou menor — qualquer aumento indica regressão e bloqueia o DoD.

### Story 15.1: Screen Reader — Autenticação, Navegação Global & Landmarks (NFR-A4)

As a user who relies on a screen reader,
I want to navigate authentication flows and global navigation using VoiceOver, NVDA, or JAWS,
So that I can access the platform independently from the very first interaction.

**Acceptance Criteria:**

**Given** a screen reader user accesses the login page
**When** the page loads
**Then** the page has proper landmark structure: `<header role="banner">`, `<nav role="navigation">`, `<main role="main">`, `<footer role="contentinfo">`
**And** the page title (`<title>`) announces "Entrar — {tenantName}" (or platform name if no tenant context)
**And** the login form has `aria-labelledby` pointing to a visible heading "Entrar"

**Given** a screen reader user navigates the login form
**When** they tab through the fields
**Then** each field announces: label text, field type, and required state (e.g., "E-mail, campo de texto, obrigatório")
**And** the password field has a visibility toggle that announces "Mostrar senha" / "Ocultar senha" with `aria-pressed` state
**And** the submit button announces "Entrar" with `role="button"`

**Given** a login attempt fails (invalid credentials)
**When** the error is displayed
**Then** the error message container has `role="alert"` (implicit `aria-live="assertive"`) so it is announced immediately
**And** the error text is descriptive: "E-mail ou senha incorretos" (not just "Erro")
**And** focus moves to the error message or to the first invalid field

**Given** a screen reader user navigates the registration flow
**When** they complete the multi-step form
**Then** each step announces its position: "Passo {n} de {total}: {stepName}" via `aria-label` on the form section
**And** validation errors are announced in real time via `aria-live="polite"` as the user leaves each field
**And** success feedback ("Conta criada com sucesso") uses `role="status"` for polite announcement

**Given** a screen reader user navigates the password reset flow
**When** they request a reset and enter the new password
**Then** all form fields, success messages, and error states follow the same patterns as login (landmarks, `role="alert"`, descriptive labels)

**Given** a screen reader user navigates any page in the platform
**When** they press Tab as the first action
**Then** the skip navigation link "Ir para conteúdo" (already implemented in Epic 12) is the first focusable element and is announced by the screen reader
**And** the sidebar navigation items announce their label and expanded/collapsed state (`aria-expanded`)
**And** the current page in the sidebar is announced as "atual" via `aria-current="page"`
**And** when multiple `<nav>` landmarks exist on the same page (e.g., sidebar + breadcrumbs), each has a distinct `aria-label`: `aria-label="Navegação principal"` vs `aria-label="Breadcrumbs"` — so screen readers can distinguish them

**Given** the page contains text in a language different from PT-BR (e.g., technical terms, feature names)
**When** the screen reader encounters these terms
**Then** inline `lang="en"` (or appropriate language) attributes wrap foreign-language terms so screen readers pronounce them correctly
**And** this applies globally across all pages, not just authentication flows

**Given** the onboarding flow (Epic 10) is accessed by a screen reader user
**When** the user goes through the first-time experience
**Then** all onboarding steps, tooltips, and guided tours are fully accessible (landmarks, focus management, `aria-live` for step transitions)
**And** if any onboarding component is NOT screen-reader accessible, it is documented as a gap and tracked as tech debt for remediation before this epic is considered complete

**Teste:** Manual testing with VoiceOver (macOS/Safari), NVDA (Windows/Chrome), and TalkBack (Android/Chrome) covering: login, registration, password reset, global navigation, onboarding flow. Automated: axe-core regression (already in CI from Epic 12) must pass with zero new violations. Checklist: every `role="alert"` confirmed to announce immediately, every `aria-live="polite"` confirmed to announce without interrupting, every landmark present and correctly nested, every `<nav>` has a distinct `aria-label`. TalkBack-specific: verify touch exploration works for all interactive elements. Language test: verify `lang` attribute on foreign terms (manually check 3+ pages with mixed-language content).

### Story 15.2: Screen Reader — Dashboard Líder, Radar Pastoral & Listas (NFR-A4)

As a Líder who uses a screen reader,
I want to navigate the pastoral dashboard, participant lists, and care actions using assistive technology,
So that I can fulfill my pastoral care responsibilities regardless of visual ability.

**Acceptance Criteria:**

**Given** a Líder using a screen reader accesses the dashboard (`/app/gestao/dashboard`)
**When** the page loads
**Then** the page title announces "Radar Pastoral — {groupName}"
**And** the page has a descriptive `<h1>` that is the first content landmark
**And** summary cards (total participantes, atenção necessária, reuniões agendadas) each have `role="region"` with `aria-label` describing the metric (e.g., "Participantes que precisam de atenção: 3")
**And** each summary card value is not just a number — it includes context (e.g., `aria-label="3 de 12 participantes precisam de atenção"`)

**Given** a Líder navigates the participant list
**When** the list renders
**Then** it uses `role="list"` with `role="listitem"` for each participant (or semantic `<ul>/<li>`)
**And** each participant item announces: name, semáforo status as text (e.g., "Maria Silva — Atenção necessária"), and available actions
**And** the list supports `aria-sort` if sortable, announcing sort direction when changed

**Given** a Líder expands a participant card (ParticipantCard, UX-DR05)
**When** the card expands
**Then** the trigger has `aria-expanded="false"` → `"true"` transition announced
**And** the expanded content includes: pastoral context, timeline, and action buttons
**And** each action button (e.g., "Registrar cuidado", "Ver histórico") has a descriptive `aria-label` if the visible text alone is ambiguous
**And** `aria-controls` links the trigger to the expanded panel

**Given** a Líder uses the participant filter/search
**When** they type in the search field
**Then** the field has `role="searchbox"` with `aria-label="Buscar participantes"`
**And** results count is announced via `aria-live="polite"`: "{n} participantes encontrados"
**And** if no results, "Nenhum participante encontrado" is announced

**Given** the dashboard shows data tables (e.g., attendance history, care timeline)
**When** a screen reader navigates the table
**Then** the table has `<caption>` describing its content (e.g., "Histórico de presença — últimas 4 reuniões")
**And** row/column headers use `<th scope="col">` and `<th scope="row">` correctly
**And** the screen reader can navigate cell-by-cell using table navigation shortcuts

**Given** real-time updates arrive on the dashboard (SSE from Epic 14)
**When** a participant's status changes
**Then** the change is announced via `aria-live="polite"` (UX-DR20): "{participantName} mudou para {newStatus}"
**And** the announcement is debounced: if multiple changes arrive within 3 seconds, they are batched into a single announcement: "{n} participantes atualizados"
**And** when the "silenciar notificações" toggle (Epic 14, localStorage) is active, `aria-live` announcements are ALSO suppressed — the toggle controls both visual notifications and screen reader announcements

**Given** the SSE connection drops (network issue, server restart)
**When** the dashboard detects the disconnection
**Then** a `role="status"` region announces: "Conexão em tempo real interrompida. Os dados podem estar desatualizados."
**And** a visual indicator (icon + text, not color-only) appears near the dashboard header
**And** when the SSE reconnects automatically, the first batch of updates waits 5 seconds before announcing (to accumulate represadas updates into a single batch instead of flooding)
**And** after the 5s grace period, the status announces: "Conexão restaurada. {n} participantes atualizados."
**And** the visual indicator disappears after successful reconnection

**Teste:** Manual testing with VoiceOver, NVDA, and TalkBack on: dashboard load, participant list navigation, card expansion, search/filter, table navigation, SSE updates, SSE disconnect/reconnect. Automated: axe-core on `/app/gestao/dashboard` — zero violations. Specific test: verify `aria-live` announcements are batched for rapid SSE updates (simulate 5 status changes in 2s → expect 1 batched announcement). SSE disconnect test: simulate network drop → verify announcement + visual indicator → restore → verify 5s grace period → verify single batched recovery announcement. Silenciar toggle test: activate toggle → verify `aria-live` region is set to `aria-live="off"` → no announcements arrive.

### Story 15.3: Semáforo Multimodal — Ícones, Texto Complementar & ARIA (NFR-A5)

As a user with color vision deficiency or using a screen reader,
I want the pastoral semáforo to communicate status through icons and text (not color alone),
So that I can understand participant engagement status regardless of how I perceive the interface.

**Acceptance Criteria:**

**Given** the semáforo component renders a participant's status
**When** the status is displayed
**Then** each status level includes THREE complementary channels:
  - **Color**: Verde (#22c55e), Amarelo (#eab308), Vermelho (#ef4444) — with dark mode variants maintaining 3:1 contrast against background
  - **Icon**: Distinct icon per status — ✅ (check-circle) for verde, ⚠️ (alert-triangle) for amarelo, 🔴 (alert-circle) for vermelho — using Lucide icons for consistency
  - **Text label**: "Ativo", "Atenção", "Crítico" — always visible (not tooltip-only)
**And** the combination of icon + text is sufficient to distinguish all states without any color perception

**Given** a screen reader encounters the semáforo
**When** it reads the component
**Then** the `aria-label` announces the full context: "{statusLabel} — {participantName}" (e.g., "Atenção — Maria Silva")
**And** the color indicator has `aria-hidden="true"` (since color is redundant with icon + text for AT users)
**And** the icon has `role="img"` with `aria-hidden="true"` (since the text label carries the meaning)
**And** Lucide SVG icons have `focusable="false"` to prevent SVGs from receiving spurious focus in any browser

**Given** a participant's semáforo status changes in real time (SSE)
**When** the transition occurs
**Then** `aria-live="polite"` announces: "{participantName}: status mudou para {newStatusLabel}" (UX-DR20)
**And** the visual transition includes a brief highlight animation (pulse border) that respects `prefers-reduced-motion`:
  - Motion enabled: 1s pulse animation on the status badge
  - Motion reduced: instant swap with no animation, only a subtle opacity transition (0.15s)
**And** the `prefers-reduced-motion` check uses CSS media query (NOT JavaScript) for performance

**Given** the semáforo appears in different contexts (ParticipantCard, dashboard summary, group list)
**When** rendered in compact mode (e.g., GroupCard aggregated view, UX-DR15)
**Then** the icon is always present even in compact view (minimum 16x16px)
**And** the text label may be truncated to initial letter ("A", "At", "C") in compact mode but full text is available via `aria-label` (NOT `title` — `title` is inconsistent across screen readers and inaccessible on mobile/touch)
**And** `aria-label` always contains the full status text regardless of visual truncation

**Given** the platform is in dark mode
**When** semáforo colors render
**Then** verde uses `#4ade80` (lighter), amarelo uses `#facc15`, vermelho uses `#f87171` — all maintaining >= 3:1 contrast ratio against dark surface (`#1e1e2e` or equivalent)
**And** contrast ratios are validated using `color2k` (per Epic 12 decision) in a unit test that fails if any combination drops below 3:1

**Teste:** Visual regression: screenshot comparison of semáforo in all 3 states × 2 themes (light/dark) × 2 sizes (full/compact). Unit test: `color2k` contrast check for all color/background combinations — must be >= 3:1 (WCAG AA for non-text). Manual screen reader test: VoiceOver + NVDA verify `aria-label` reads correctly and `aria-live` announces transitions. `prefers-reduced-motion` test: enable reduced motion in OS settings → verify no pulse animation, only opacity transition. Automated: axe-core scan of pages containing semáforo — zero violations related to color-only information.

### Story 15.4: Screen Reader — Trilhas, Progresso & Conteúdo (NFR-A4)

As a participant who uses a screen reader,
I want to navigate trails, track my progress, and consume content using assistive technology,
So that I can fully engage in discipleship content regardless of visual ability.

**Acceptance Criteria:**

**Given** a participant using a screen reader accesses the trail listing (`/app/trilhas`)
**When** the page loads
**Then** the page title announces "Trilhas disponíveis" (or "Minhas trilhas" if filtered)
**And** each trail card announces: trail name, description summary, progress percentage, and module count
**And** the list uses `role="list"` with semantic `<ul>/<li>` structure

**Given** a participant navigates inside a trail (`/app/trilhas/{trailId}`)
**When** the trail detail page loads
**Then** the trail name is an `<h1>` and is the first meaningful content
**And** the module list shows progression with each module announcing: "Módulo {n} de {total}: {moduleName} — {status}" where status is "Concluído", "Em andamento", or "Bloqueado"
**And** completed modules have `aria-label` including "Concluído" and a visual checkmark (which has `aria-hidden="true"`)
**And** the overall progress bar uses `role="progressbar"` with `aria-valuenow="{percentage}"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-label="Progresso na trilha: {percentage}%"`

**Given** a participant accesses a content module (text/document)
**When** the content renders
**Then** the content uses proper heading hierarchy (`<h2>`, `<h3>`, etc.) for navigability via heading shortcuts
**And** images have descriptive `alt` text (content creators must provide alt text; if missing, `alt="Imagem sem descrição"` as fallback)
**And** when a module is published with missing alt text, a flag `has_missing_alt_text: true` is set on the module record and the module appears in a "Conteúdo com acessibilidade incompleta" list visible to admins at `/app/admin/accessibility-gaps` — so fallbacks don't accumulate silently
**And** links within content have descriptive text (never "clique aqui")

**Given** a participant accesses a video module
**When** the video player renders
**Then** the video player uses Plyr (lightweight, ARIA-native) as the standard player — custom `<video>` controls are NOT implemented from scratch
**And** all player controls have accessible labels: "Reproduzir", "Pausar", "Volume: {n}%", "Tela cheia", "Avançar 10 segundos", "Retroceder 10 segundos" (Plyr provides these natively; this AC validates PT-BR localization is correctly configured)
**And** the current playback position is available via `aria-valuenow` on a `role="slider"` for the progress bar
**And** keyboard shortcuts for the player are documented in an accessible help panel (triggered by "?" key when player is focused)
**And** when the video ends, focus returns to the "Próximo módulo" button (if available) with a polite announcement: "Vídeo concluído. Avance para o próximo módulo."

**Given** a participant completes a module
**When** the completion is registered
**Then** a `role="status"` region announces: "Módulo {moduleName} concluído! Progresso: {newPercentage}%"
**And** the trail listing updates the progress bar `aria-valuenow` accordingly

**Given** a participant accesses the "Meu progresso" overview
**When** the page renders
**Then** each trail shows: trail name, progress bar (with `role="progressbar"`), modules completed out of total
**And** the page provides a summary at the top: "Você está participando de {n} trilhas. {completed} concluídas." via a `role="region"` with `aria-label`

**Teste:** Manual testing with VoiceOver, NVDA, and TalkBack on: trail listing, trail detail (module navigation), text content module, video player controls, progress tracking, completion flow. Automated: axe-core on `/app/trilhas` and `/app/trilhas/{id}` — zero violations. Specific: verify `role="progressbar"` attributes update correctly after module completion. Video player: verify all controls have labels, keyboard shortcuts work, end-of-video focus management. TalkBack-specific: verify touch exploration on video player controls and progress indicators.

---

## Epic 16: Resiliência, Offline & Expansões Futuras

Épico Post-MVP que agrupa funcionalidades de resiliência operacional, experiência offline, segurança avançada, observabilidade profunda e acessibilidade de conteúdo multimídia. Cada story é independente e pode ser priorizada individualmente — não há dependência sequencial obrigatória entre elas.

**FRs cobertos:** FR78, FR82
**NFRs cobertos:** NFR-S5, NFR-O4, NFR-O5, NFR-A6, NFR-C3, NFR-C5–C7
**Pré-requisito:** Epics 1-14 (infraestrutura core), Epic 15 (acessibilidade avançada — para NFR-A6 legendas)

**Definition of Done (transversal):** Cada story deve incluir documentação operacional (runbook ou seção em docs existentes) descrevendo: como monitorar, como diagnosticar falhas, como reverter em caso de problema.

### Story 16.1: Preferências Granulares de Notificação por Tipo (FR78)

As a user (Participante or Líder),
I want to configure my notification preferences by type and channel,
So that I receive only the notifications that matter to me, on my preferred channels, across all my devices.

**Acceptance Criteria:**

**Given** a user accesses `GET /api/v1/users/me/notification-preferences`
**When** the endpoint returns their preferences
**Then** the response contains a preference object per notification type:
  - `pastoral_alert`: { inApp: boolean, email: boolean }
  - `meeting_reminder`: { inApp: boolean, email: boolean }
  - `content_new`: { inApp: boolean, email: boolean }
  - `export_ready`: { inApp: boolean, email: boolean }
  - `system_announcement`: { inApp: boolean, email: boolean }
**And** default values are: all `inApp: true`, all `email: true`
**And** `pastoral_alert` for role Líder has `inApp: true` as non-overridable (Líder MUST receive pastoral alerts in-app — email can be toggled off)

**Given** a user updates their preferences via `PATCH /api/v1/users/me/notification-preferences`
**When** the request body contains partial updates (e.g., `{ meeting_reminder: { email: false } }`)
**Then** only the specified fields are updated (patch semantics, not replace)
**And** the preferences are stored in `notification_preferences` table with `{ user_id, tenant_id, notification_type, channel, enabled, updated_at }`
**And** a Zod schema in `packages/types` validates the request (shared FE+BE contract)
**And** the response returns the full updated preferences object (201 status)

**Given** a user accesses the preferences UI at `/app/configuracoes/notificacoes`
**When** the page renders
**Then** each notification type is displayed with its PT-BR label and description:
  - "Alertas pastorais" — "Quando um participante muda de status no semáforo"
  - "Lembretes de reunião" — "24h antes de uma reunião agendada"
  - "Novo conteúdo" — "Quando uma nova trilha é publicada no seu grupo"
  - "Relatórios prontos" — "Quando um relatório exportado está disponível"
  - "Anúncios do sistema" — "Atualizações e comunicados da plataforma"
**And** each type has toggles for "No app" and "E-mail"
**And** toggles use optimistic UI (update immediately, revert on API error)
**And** the non-overridable `pastoral_alert.inApp` toggle for Líder is visually disabled with tooltip: "Alertas pastorais no app não podem ser desativados"

**Given** the notification pipeline (Epic 14) processes a new notification
**When** it checks the user's preferences
**Then** it queries `notification_preferences` for the user+type+channel combination
**And** if `enabled: false`, the notification is NOT sent via that channel (but IS still created in the `notifications` table with `delivered: false, reason: 'user_preference'`)
**And** preferences are cached in Redis (`cache:notif-prefs:{userId}`, TTL 10min) to avoid DB queries on every notification
**And** cache is invalidated on PATCH
**And** if Redis is unavailable, the pipeline falls back to direct DB query (no notification is silently dropped due to cache miss) — the fallback is logged as a warning for observability

**Given** the old "silenciar" toggle (Epic 14, localStorage) coexists with the new preferences
**When** "silenciar" is active
**Then** it acts as a master override — ALL in-app notifications are suppressed regardless of per-type preferences
**And** the preferences UI shows a banner: "Todas as notificações no app estão silenciadas. Desative o modo silencioso para usar preferências por tipo."
**And** when a user with "silenciar" active accesses the preferences UI for the first time, a migration modal is shown: "Você estava com notificações silenciadas. Deseja manter tudo desativado ou configurar por tipo?" with two actions:
  - "Manter silenciado" → copies state to all `inApp: false` preferences in DB, removes localStorage toggle
  - "Configurar por tipo" → removes localStorage toggle, opens the preferences UI with all defaults (all enabled)
**And** after migration, the localStorage toggle is permanently removed for that user

**Given** a user's role changes (e.g., Líder → Participante or Participante → Líder)
**When** the role change is processed in Keycloak and synced to the application
**Then** non-overridable preferences are recalculated: if the user is no longer Líder, `pastoral_alert.inApp` becomes a regular toggle (user can disable it)
**And** if the user becomes a Líder, `pastoral_alert.inApp` is forced to `true` regardless of previous preference
**And** other preferences are preserved unchanged across role transitions
**And** the user is NOT notified of the automatic preference change (it's a system enforcement, not a user action)

**Teste:** Unit test: Zod schema validation — valid/invalid payloads. Integration test: PATCH preferences → verify DB state → verify Redis cache invalidated → send notification → verify channel respected. Guard test: Líder tries to disable pastoral_alert.inApp → 422 with descriptive error. E2E: toggle UI → verify optimistic update → simulate API failure → verify revert. Cache test: verify Redis TTL and invalidation on update. Coexistence test: silenciar active + preferences → verify master override wins. Migration test: user with localStorage "silenciar" → open preferences → select "Manter silenciado" → verify all inApp=false in DB + localStorage removed. Role change test: Líder → Participante → verify pastoral_alert.inApp becomes toggleable; Participante → Líder → verify pastoral_alert.inApp forced true.

### Story 16.2: PWA & Service Worker — Leitura Offline de Conteúdo (FR82)

As a participant,
I want to access previously viewed trail content when I'm offline,
So that I can continue my discipleship journey even without internet connectivity.

**Acceptance Criteria:**

**Given** the application is configured as a PWA
**When** it is loaded for the first time
**Then** a Web App Manifest (`manifest.json`) is served with:
  - `name`: "{tenantName} — Metanoia" (or platform name if no tenant)
  - `short_name`: "Metanoia"
  - `theme_color` and `background_color` from tenant branding (Epic 6), fallback to platform defaults
  - `display`: "standalone"
  - `icons`: 192px and 512px PNG (platform default, tenant-customizable in future)
  - `start_url`: "/app/trilhas"
  - `scope`: "/app/"
**And** the service worker is registered via Workbox directly (custom webpack config in `next.config.js`) — NOT via `next-pwa` wrapper (abandoned library, incompatibility risk with Next.js 16 App Router)

**Given** a participant views a text/document content module while online
**When** the content is rendered
**Then** the service worker caches the page HTML, CSS, JS bundles, and inline images using a Cache-First strategy (network-first for API calls)
**And** only content modules the user has actually visited are cached (NO pre-caching of unvisited content)
**And** cached content respects tenant isolation — cache keys include `tenantId` prefix: `cache:offline:{tenantId}:{moduleId}`
**And** total offline cache is capped at 50MB per user with LRU eviction (oldest accessed content removed first)

**Given** a participant goes offline after having viewed content
**When** they navigate to a previously viewed trail/module
**Then** the cached content is served instantly with a visible offline indicator: banner at top "Modo offline — conteúdo pode estar desatualizado" (icon + text, accessible per Epic 15)
**And** navigation within cached pages works (back/forward, module list)
**And** non-cached pages show a friendly fallback: "Este conteúdo não está disponível offline. Conecte-se para acessá-lo."

**Given** a participant completes progress actions while offline (e.g., marks module as read)
**When** they regain connectivity
**Then** queued actions are synced via Background Sync API (if supported by the browser — Chrome/Edge yes, Safari/Firefox NO) or on next page load as fallback
**And** the Safari/iOS limitation is documented in the PWA section of the user-facing help: "No Safari, o progresso offline será sincronizado na próxima vez que você abrir o app."
**And** conflicts are resolved with last-write-wins (server timestamp)
**And** the user is notified: "Progresso sincronizado. {n} ações atualizadas."
**And** if sync fails after 3 retries, the user is notified: "Não foi possível sincronizar {n} ações. Tente novamente."

**Given** the PWA install prompt (A2HS — Add to Home Screen)
**When** the browser supports it and the user is authenticated
**Then** a non-intrusive install banner appears once per session (dismissible): "Instale o Metanoia para acesso rápido e offline"
**And** after dismissal, the banner does NOT appear again for 30 days (stored in localStorage)
**And** the install option is always available in the user settings menu

**Given** video content modules
**When** cached for offline use
**Then** videos are NOT cached offline (too large) — only text/document/image content
**And** a video module accessed offline shows: "Vídeos não estão disponíveis offline. Conecte-se para assistir."
**And** the module metadata (title, description) IS cached so the user knows what they're missing

**Given** a new version of the application is deployed
**When** the service worker detects a new version (via `updatefound` event)
**Then** the new SW is installed in the background (does NOT activate immediately — avoids breaking the user's current session)
**And** a non-intrusive toast appears: "Nova versão disponível. [Atualizar agora]"
**And** clicking "Atualizar agora" calls `skipWaiting()` + `clients.claim()` and reloads the page
**And** if the user ignores the toast, the new version activates on the next full page load (browser close/reopen)
**And** stale cache entries from the previous SW version are purged on activation (cache versioning via `CACHE_VERSION` constant)

**Teste:** Integration test: visit 3 content modules online → simulate offline (service worker mock) → navigate to cached modules → verify content renders. Cache size test: fill cache to 50MB → visit new module → verify LRU eviction removes oldest. Sync test (split strategy): (a) unit test the sync queue independently — verify actions are queued to IndexedDB when offline, verify queue is drained and API calls made on "online" event; (b) E2E focuses on fallback "on next page load" path (testable in all browsers) — Background Sync API itself is NOT E2E tested (browser engine dependency, not automatable). A2HS test: verify install prompt appears once, respects 30-day cooldown. Tenant isolation test: cache keys include tenantId — switching tenant context does NOT serve wrong content. Video offline test: verify friendly fallback, not broken player. SW update test: deploy new version → verify toast appears → click "Atualizar agora" → verify page reloads with new version → verify stale cache purged. E2E: Playwright with `context.setOffline(true)` for offline simulation.

### Story 16.3: MFA para Papel Líder via Keycloak (NFR-S5)

As a Super Admin,
I want to enforce MFA (TOTP) for all users with the Líder role,
So that pastoral care data is protected by an additional authentication factor.

**Acceptance Criteria:**

**Given** a user is assigned the role Líder in Keycloak
**When** they log in for the first time after MFA enforcement
**Then** Keycloak redirects them to the TOTP setup flow (required action: `CONFIGURE_TOTP`)
**And** the setup page shows: QR code for authenticator app (Google Authenticator, Authy, etc.), manual entry code as fallback, and step-by-step instructions in PT-BR
**And** the user must successfully enter a valid TOTP code to complete setup
**And** after setup, 10 one-time recovery codes are generated and displayed ONCE with a "Copiar todos" button and a warning: "Guarde estes códigos em local seguro. Eles não serão exibidos novamente."

**Given** a Líder with MFA configured logs in
**When** they enter valid credentials
**Then** Keycloak prompts for the TOTP code as a second factor
**And** the TOTP input accepts 6-digit codes with a 30-second window (±1 step tolerance per RFC 6238)
**And** if the code is invalid, the error message says "Código inválido. Tente novamente." (no timing leaks)
**And** after 5 consecutive failed attempts, the account is locked for 15 minutes with message: "Conta temporariamente bloqueada. Tente novamente em 15 minutos."

**Given** a Líder has lost their authenticator device
**When** they click "Usar código de recuperação" on the TOTP screen
**Then** they can enter one of their 10 recovery codes
**And** each recovery code can only be used once (marked as consumed in Keycloak)
**And** after using a recovery code, the user is prompted to set up a new TOTP device
**And** if all 10 recovery codes are consumed, the Líder must contact a Super Admin to reset MFA

**Given** a "break glass" scenario where both the Líder AND Super Admin are locked out
**When** recovery is needed
**Then** a documented procedure exists in `docs/operations/mfa-break-glass.md` describing: direct access to Keycloak Admin Console (separate from the application), steps to reset TOTP credentials for any user, and required infrastructure credentials
**And** the break-glass procedure requires 2-person authorization (infrastructure team, not application-level) to prevent single-point-of-failure
**And** every break-glass access is logged in the audit log as `auth.mfa.break-glass-reset` with the identity of who performed it

**Given** a Super Admin accesses the user management at `/app/admin/usuarios`
**When** they view a Líder's profile
**Then** MFA status is visible: "MFA ativo" / "MFA pendente de configuração"
**And** the Super Admin can reset MFA for the Líder (generates new required action) with a confirmation dialog: "Isso removerá o MFA atual. O líder precisará configurar novamente no próximo login."
**And** a domain event `auth.user.mfa-reset` is emitted and logged in the audit log

**Given** MFA enforcement is configured in Keycloak
**When** the configuration is applied
**Then** MFA is enforced ONLY for the Líder role (not Participante, not Super Admin — Super Admin MFA is a separate future decision)
**And** the Keycloak realm configuration uses conditional authentication flow: `role:lider` → require TOTP
**And** the NestJS auth guard does NOT implement MFA logic — Keycloak handles it entirely (no custom MFA code in the application)

**Teste:** Integration tests use Keycloak Testcontainers (`@testcontainers/keycloak`) with a pre-configured realm export (`test/fixtures/keycloak-realm.json`) — avoids slow Keycloak startup per test suite. Integration test: create user with Líder role → first login → verify TOTP setup redirect. TOTP validation test: valid code → success, expired code → fail, reused recovery code → fail. Lockout test: 5 invalid codes → verify 15min lock → verify unlock after timeout. Super Admin test: reset MFA → verify Líder is prompted again on next login. Role isolation test: Participante login → verify NO MFA prompt. Keycloak config test: verify conditional auth flow targets correct role. Audit test: verify `auth.user.mfa-reset` event logged. Break-glass test: verify procedure documented and audit event emitted. Unit tests for NestJS guards: mock JWT token (MFA is Keycloak's responsibility — NestJS only validates the resulting token).

### Story 16.4: Métricas por Integração & Dashboard de Observabilidade (NFR-O4)

As a Super Admin,
I want to see detailed metrics per external integration (success rate, latency, retry rate),
So that I can proactively identify degradation patterns before they impact users.

**Acceptance Criteria:**

**Given** the application makes calls to external integrations (Resend, Keycloak, MinIO)
**When** each call completes (success or failure)
**Then** a metric is recorded with dimensions: `{ integration_name, operation, status, latency_ms, timestamp }`
**And** metrics are collected via `prom-client` (Prometheus client for Node.js) as histograms and counters:
  - `integration_requests_total` (counter): labels `{ integration, operation, status }`
  - `integration_request_duration_ms` (histogram): labels `{ integration, operation }`, buckets `[50, 100, 250, 500, 1000, 2500, 5000, 10000]`
  - `integration_retries_total` (counter): labels `{ integration, operation }`
**And** `operation` labels are restricted to a fixed enum set to prevent cardinality explosion (memory leak): `['send_email', 'verify_token', 'refresh_token', 'upload_object', 'get_object', 'delete_object', 'get_user', 'create_user']` — any unlisted operation is bucketed as `other`
**And** a `/metrics` endpoint (Prometheus format) is exposed on a separate port (9090) — NOT on the public API port

**Given** a Super Admin accesses the observability dashboard at `/app/admin/observabilidade`
**When** the page loads
**Then** it displays per-integration panels for: Resend (email), Keycloak (auth), MinIO (storage)
**And** each panel shows:
  - Success rate (%) — last 1h, 24h, 7d (calculated from `integration_requests_total`)
  - p50 / p95 / p99 latency — last 1h (from histogram)
  - Retry rate (%) — retries / total requests
  - Error breakdown by type (timeout, 4xx, 5xx, network)
  - Sparkline trend (last 24h, 5min resolution)
**And** data is fetched from a backend endpoint `GET /api/v1/admin/observability/integrations` that queries Prometheus (or reads from a materialized summary table if Prometheus is not available in deployment)

**Given** an integration's success rate drops below a configurable threshold
**When** the threshold is crossed (default: < 95% success in 15min window)
**Then** an alert is created for Super Admins via the notification system (Epic 14)
**And** the alert includes: integration name, current success rate, error sample, and link to the dashboard
**And** a domain event `system.integration.degraded` is emitted
**And** the alert is de-duplicated: only one alert per integration per 30min window

**Given** the metrics endpoint is scraped
**When** a Prometheus instance (or compatible scraper) connects
**Then** all metrics are exported in standard Prometheus exposition format
**And** the `/metrics` endpoint is protected by IP allowlist (only Prometheus scraper IPs) or HTTP Basic Auth (credentials via environment variable `METRICS_AUTH_TOKEN`) — defense in depth beyond port separation
**And** default Grafana dashboards are provided as JSON files in `infra/grafana/dashboards/` for import
**And** dashboards include: integration overview, per-integration detail, latency heatmap

**Teste:** Unit test: verify metric recording for each integration call (mock integration → verify counter/histogram incremented). Integration test: trigger 100 Resend calls (50 success, 30 retry, 20 fail) → verify metrics accuracy. Endpoint test: `/metrics` returns valid Prometheus format (parse with prom-client parser). Dashboard API test: verify aggregation logic (success rate, percentiles). Alert test: simulate < 95% success rate → verify notification created, verify de-duplication (second breach within 30min → no second alert). Security test: `/metrics` port 9090 is NOT accessible from public internet (infrastructure config).

### Story 16.5: Tracing Distribuído entre Serviços (NFR-O5)

As a developer or Super Admin,
I want distributed tracing across all service boundaries,
So that I can trace a request end-to-end and quickly identify bottlenecks or failures.

**Acceptance Criteria:**

**Given** the NestJS application is instrumented with OpenTelemetry
**When** the application starts
**Then** the OpenTelemetry SDK is initialized with:
  - `@opentelemetry/sdk-node` with auto-instrumentation for: HTTP, Express/Fastify, Prisma, BullMQ, Redis (ioredis)
  - `service.name`: "metanoia-api"
  - `service.version`: from `package.json`
  - `deployment.environment`: from `NODE_ENV`
**And** the SDK is configured via environment variables (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`) — no hardcoded endpoints

**Given** an HTTP request arrives at the API
**When** it is processed through guards, pipes, controllers, services, and repositories
**Then** a root span is created with: `http.method`, `http.url`, `http.status_code`, `user.id` (if authenticated), `tenant.id`
**And** child spans are created for: database queries (Prisma), Redis operations, BullMQ job dispatch, external HTTP calls (Resend, Keycloak)
**And** each span includes: `span.kind`, duration, status, and relevant attributes (e.g., `db.statement` for Prisma — sanitized with parameter values replaced by `?` placeholders to prevent PII leakage, `messaging.destination` for BullMQ)
**And** span filtering is configured to reduce noise: health check endpoints (`/health`, `/ready`) are excluded from tracing, and Prisma spans for simple `SELECT 1` keep-alive queries are dropped
**And** OTLP export batch size is limited to 512 spans per batch with 5s flush interval to prevent network saturation under high load
**And** `tenant_id` is propagated as a span attribute on ALL spans (for filtering by tenant in the tracing UI)

**Given** a Next.js SSR request makes API calls to NestJS
**When** the Server Component or `fetch` call is executed during SSR
**Then** the Next.js instrumentation (`instrumentation.ts` file, Next.js 16 native support) initializes OpenTelemetry with `service.name: "metanoia-web"`
**And** the `traceparent` header is propagated from the SSR request to the NestJS API call via `fetch` headers (W3C Trace Context propagation)
**And** this creates a true end-to-end trace: Browser → Next.js SSR → NestJS API → Prisma/Redis/BullMQ
**And** the SSR span includes: `http.url`, `http.method`, `next.route`, `next.rsc` (boolean), `tenant.id`

**Given** a BullMQ job is dispatched from an HTTP request
**When** the worker processes the job
**Then** the trace context (W3C `traceparent` header) is propagated via the job's `data` field: `{ ..., _traceContext: { traceparent, tracestate } }`
**And** the worker creates a linked span that continues the original trace
**And** the worker span includes: `job.name`, `job.id`, `job.attemptsMade`, `queue.name`

**Given** traces are exported
**When** the OTLP exporter sends data
**Then** traces are exported to the configured OTLP endpoint (Jaeger, Tempo, or any OTLP-compatible backend)
**And** in development, traces can also be viewed via `@opentelemetry/exporter-console` (enabled via `OTEL_TRACES_EXPORTER=console`)
**And** sampling is configured: 100% in dev, 10% in production (configurable via `OTEL_TRACES_SAMPLER_ARG`)

**Given** an error occurs during request processing
**When** the span records the error
**Then** the span status is set to `ERROR`
**And** `exception.type`, `exception.message`, and `exception.stacktrace` are recorded as span events
**And** the `correlation_id` from the request (already in logs from Epic 7) is added as a span attribute for log-trace correlation

**Teste:** Integration test: send HTTP request → verify root span created with correct attributes. Trace propagation test: HTTP request → dispatches BullMQ job → verify worker span is linked to original trace via `traceparent`. Prisma span test: execute a query → verify child span with `db.statement`. Error test: trigger a 500 error → verify span status ERROR with exception details. Sampling test: configure 50% sampling → send 100 requests → verify ~50 traces exported (±10%). Console exporter test: set `OTEL_TRACES_EXPORTER=console` → verify traces printed to stdout. Tenant isolation: verify `tenant_id` attribute present on all spans.

### Story 16.6: Legendas & Transcrição de Vídeo (NFR-A6)

As a content creator (Líder or Admin),
I want to upload subtitles for video content and have them displayed to participants,
So that video content is accessible to users who are deaf, hard of hearing, or in sound-sensitive environments.

**Acceptance Criteria:**

**Given** a content creator edits a video module in the trail editor
**When** they access the subtitle section
**Then** an upload area accepts subtitle files in VTT format (WebVTT — the web standard, NOT SRT)
**And** the upload validates: file extension `.vtt`, file size <= 1MB, valid WebVTT syntax (parser validates `WEBVTT` header and at least one cue)
**And** if validation fails, a descriptive error is shown: "Arquivo inválido. Use formato WebVTT (.vtt) com tamanho máximo de 1MB."
**And** cue text content is sanitized on upload: all HTML tags are stripped (WebVTT allows `<b>`, `<i>`, `<u>`, `<c>` tags but they can be abused for XSS via `<c.class>` or malformed tags) — only plain text is stored
**And** multiple language tracks can be uploaded per video, each with a `lang` label (e.g., "Português", "English", "Libras")

**Given** a subtitle file is uploaded successfully
**When** it is stored
**Then** the file is uploaded to MinIO/S3 under `{tenantId}/subtitles/{moduleId}/{lang}.vtt`
**And** a record is created in `module_subtitles` table: `{ module_id, tenant_id, language, file_key, uploaded_by, created_at }`
**And** the subtitle file URL is a signed URL (1h expiry) served via `GET /api/v1/modules/{moduleId}/subtitles/{lang}`
**And** tenant isolation is enforced via RLS — a tenant cannot access another tenant's subtitle files

**Given** a participant views a video module that has subtitles
**When** the Plyr player (defined in Epic 15 Story 15.4) loads
**Then** subtitle tracks are loaded as `<track kind="subtitles" src="{vttUrl}" srclang="{lang}" label="{langLabel}">`
**And** the first available track matching the user's browser language is enabled by default (if no match, subtitles are off by default)
**And** the user can toggle subtitles on/off and switch between language tracks via the player's CC button
**And** subtitle styling uses platform defaults (white text, semi-transparent dark background) — no custom CSS overrides that could break readability

**Given** a participant wants to read the full transcript
**When** they click "Ver transcrição" below the video player
**Then** the WebVTT file is parsed and displayed as a scrollable text block with timestamps
**And** each cue is a clickable element: clicking a timestamp seeks the video to that position
**And** the transcript is searchable via a text input: "Buscar na transcrição" with highlight of matching terms
**And** the transcript section is accessible: `role="region"` with `aria-label="Transcrição do vídeo"`

**Given** a video module has NO subtitles uploaded
**When** the module is displayed
**Then** no CC button appears in the player (clean UI — don't show a button that does nothing)
**And** an admin-facing indicator (not visible to participants) flags: "Este módulo não possui legendas" in the content management list, similar to the `has_missing_alt_text` flag from Epic 15

**Given** a video module with subtitles is deleted (soft-delete)
**When** the module enters soft-delete state
**Then** the subtitle records in `module_subtitles` are soft-deleted alongside the module (cascade)
**And** after the soft-delete retention period (30 days), a cleanup job hard-deletes the `module_subtitles` records AND the VTT files from MinIO/S3 (`{tenantId}/subtitles/{moduleId}/`)
**And** no orphan VTT files remain in storage after cleanup

**Teste:** Upload test: valid VTT → success, invalid format → descriptive error, oversized file → size error. XSS test: upload VTT with `<script>` in cue text → verify tags are stripped on storage. Plyr integration test: load video with 2 subtitle tracks → verify `<track>` elements rendered → toggle CC → verify display. Transcript test: parse VTT → verify all cues displayed → click timestamp → verify video seeks. Search test: search term in transcript → verify highlights. RLS test: tenant A uploads subtitle → tenant B cannot access via API. Cascade delete test: soft-delete module → verify subtitle records soft-deleted → advance 30 days (mock) → verify VTT files removed from MinIO. E2E: upload subtitle → view as participant → enable CC → view transcript → search → click timestamp.

### Story 16.7: Resiliência Operacional — Backup, Restore & Disaster Recovery (NFR-C3, NFR-C5–C7)

As a Super Admin or operations engineer,
I want documented and tested backup, restore, and disaster recovery procedures,
So that the platform can recover from data loss or infrastructure failures within acceptable RPO/RTO targets.

**Acceptance Criteria:**

**Given** a post-mortem process is needed (NFR-C3)
**When** an incident causes downtime > 30 minutes
**Then** a post-mortem template exists at `docs/operations/post-mortem-template.md` with sections:
  - Incident summary (what happened, duration, impact scope)
  - Timeline (detection → response → mitigation → resolution)
  - Root cause analysis (5 Whys or Fishbone)
  - Action items with owners and deadlines
  - Lessons learned
**And** the template is pre-filled with metadata fields: `incident_id`, `date`, `duration`, `severity` (P1-P4), `affected_tenants`
**And** completed post-mortems are stored in `docs/operations/post-mortems/` with naming convention `YYYY-MM-DD-incident-slug.md`

**Given** MinIO/S3 storage is configured (NFR-C5)
**When** objects are stored
**Then** bucket versioning is enabled for buckets containing: user uploads, content media, subtitle files, exported reports
**And** a lifecycle policy retains versions for 90 days, then deletes non-current versions
**And** versioning is NOT enabled for temporary/cache buckets (e.g., `tmp-exports`) to avoid unnecessary storage costs
**And** the versioning configuration is defined in IaC (Terraform/Pulumi or Docker Compose for dev) — not manual bucket settings

**Given** a database restore needs to be performed (NFR-C6)
**When** the restore procedure is executed
**Then** a restore script exists at `scripts/db-restore.sh` that:
  - Takes parameters: `backup_file`, `target_db`, `--dry-run` (validates without executing)
  - Validates backup integrity (checksum verification)
  - Restores to a temporary database first (not directly to production)
  - Runs a verification query set (`scripts/db-verify-restore.sql`): row counts for critical tables, latest timestamp sanity check, RLS policies present
  - Only swaps to production after verification passes
**And** a restore test is executed and documented at least once before Release 1b gate, using a seed database of at least 1GB (representative volume: ~5 tenants, ~1000 users, ~50 groups, ~200 trails with content) to validate performance under realistic data volume
**And** the restore script checks available disk space before starting (requires 2x backup size free) and fails with a clear error if insufficient: "Espaço em disco insuficiente. Necessário: {required}GB, disponível: {available}GB"
**And** the test results are stored in `docs/operations/restore-test-results/YYYY-MM-DD-restore-test.md` including: backup size, restore duration, verification results, disk usage

**Given** a disaster recovery scenario occurs (NFR-C7)
**When** the operations team needs to recover the platform
**Then** a DR runbook exists at `docs/operations/disaster-recovery-runbook.md` covering:
  - **Scenario 1: Database corruption/loss** — restore from backup (RPO ≤ 1h R1, ≤ 15min R2, RTO ≤ 4h)
  - **Scenario 2: Object storage loss** — restore from versioned objects + backups (RPO ≤ 24h, RTO ≤ 8h)
  - **Scenario 3: Full infrastructure failure** — rebuild from IaC + restore data (RTO ≤ 8h)
  - **Scenario 4: Keycloak corruption** — realm export/import procedure
  - **Scenario 5: Redis data loss** — cache rebuild strategy (ephemeral data, no backup needed, but document warm-up procedure)
**And** each scenario includes: step-by-step commands, expected duration, verification steps, rollback procedure
**And** the runbook is tested at least once before Release 1b gate (tabletop exercise or actual DR drill)
**And** test results are documented in `docs/operations/dr-test-results/YYYY-MM-DD-dr-drill.md`

**Given** a BullMQ scheduled job monitors backup health
**When** it runs daily at 03:00 UTC
**Then** it first checks if a backup is currently in progress (via a `backup_status` key in Redis: `{ status: 'running' | 'completed' | 'failed', started_at, completed_at }`)
**And** if a backup is in progress, it reports "backup em andamento" (NOT failure) and skips the age check
**And** if no backup is in progress, it verifies: latest PostgreSQL backup exists and is < 25h old, latest MinIO backup exists, backup file size is within expected range (not empty/truncated)
**And** if any check fails, a `system.backup.health-failed` domain event is emitted and Super Admins are notified: "⚠️ Verificação de backup falhou: {details}"
**And** the job runs as a BullMQ repeatable job (consistent with Epic 14 health check pattern)

**Given** the restore script needs ongoing validation (not just a one-time gate)
**When** CI runs monthly (or on any migration that alters schema)
**Then** a CI job executes `scripts/db-restore.sh --dry-run` against a fresh backup to validate the script still works with the current schema
**And** if the dry-run fails, the CI pipeline reports a warning (not blocking, but visible) and creates a notification for the operations team
**And** full restore tests (non-dry-run) are executed quarterly and documented

**Teste:** Post-mortem template test: verify template renders correctly with all sections, metadata fields are fillable. Versioning test: upload object → upload new version → verify both versions exist → verify lifecycle deletes after 90 days (mock time). Restore script test: create backup (seed ≥ 1GB) → corrupt test DB → run restore with --dry-run → run actual restore → verify data integrity → verify disk space check. DR runbook test: tabletop walkthrough of each scenario — verify commands are current and work against staging environment. Backup health job test: mock backup present → verify success, mock backup missing → verify alert, mock backup in progress → verify "em andamento" status (not false alarm). Dry-run CI test: verify monthly dry-run executes against current schema. Security test: restore script requires Super Admin credentials, not accessible from application runtime.
