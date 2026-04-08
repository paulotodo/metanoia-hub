> **Nota:** Este documento foi fragmentado. Cada épico está em seu próprio arquivo nesta pasta.

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
**FRs cobertos:** FR01–FR11, FR72, FR75
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

## Navegação

- [Epic 1: Fundação Habilitadora do Produto](epic-01.md)
- [Epic 2: Identidade, Acesso & Multi-tenancy](epic-02.md)
- [Epic 3: Provisionamento de Tenant & Configuração Básica](epic-03.md)
- [Epic 4: Grupos, Membros & Convites](epic-04.md)
- [Epic 5: Reuniões ao Vivo & Presença MVP](epic-05.md)
- [Epic 6: Radar Pastoral & Visibilidade MVP](epic-06.md)
- [Epic 7: Onboarding Mínimo](epic-07.md)
- [Epic 8: Trilhas, Conteúdo, Progresso, Relatórios & Busca](epic-08.md)
- [Epic 9: Privacidade, LGPD & Compliance](epic-09.md)
- [Epic 10: Onboarding Avançado & Adoção](epic-10.md)
- [Epic 11: Planos, Limites & Feature Gating](epic-11.md)
- [Epic 12: Hardening de Acessibilidade & Qualidade UX](epic-12.md)
- [Epic 13: Relatórios Avançados & Analytics](epic-13.md)
- [Epic 14: Notificações & Comunicação](epic-14.md)
- [Epic 15: Acessibilidade Avançada](epic-15.md)
- [Epic 16: Resiliência, Offline & Expansões Futuras](epic-16.md)
