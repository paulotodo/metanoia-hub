# PRD Requirements Extraction — Metanoia Hub

**Extraction Date:** 2026-04-06
**Source:** `_bmad-output/planning-artifacts/prd.md` (1508 lines)
**Validation Report:** `_bmad-output/planning-artifacts/metanoia-hub-prd-validation-report.md`

---

## 1. Functional Requirements (FRs) — Complete Extraction

**Total: 82 FRs** (FR01–FR82, with FR47 split into FR47a/FR47b/FR47c)

### 1.1 Identidade & Acesso (11 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR01 | O sistema deve permitir cadastro de usuario com e-mail e senha | 1a |
| FR02 | O sistema deve permitir login via provedor OAuth (Google) | 1a |
| FR03 | O sistema deve permitir que um mesmo usuario esteja associado a multiplos tenants | 1a |
| FR04 | O sistema deve autenticar usuarios de forma centralizada via provedor de identidade | 1a |
| FR05 | O sistema deve autorizar acoes com base em papeis do usuario e contexto do tenant, garantindo que cada papel acesse apenas os recursos permitidos | 1a |
| FR06 | O sistema deve suportar os papeis: Super Admin, Admin Tenant, Lider, Participante | 1a |
| FR07 | O sistema deve isolar dados e operacoes por tenant, impedindo acesso cruzado | 1a |
| FR08 | O sistema deve permitir que um Admin Tenant gerencie usuarios e papeis dentro do seu tenant | 1a |
| FR09 | O sistema deve implementar defesa em profundidade com multiplas camadas de autorizacao independentes | 1a |
| FR10 | O sistema deve permitir que o usuario selecione o tenant ativo ao acessar a plataforma | 1a |
| FR11 | O sistema deve revogar sessoes e tokens quando um usuario for removido de um tenant | 1a |

### 1.2 Tenant & Configuracao (8 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR12 | O sistema deve permitir o provisionamento de novos tenants com dados minimos (nome, admin, plano) | 1a |
| FR13 | O sistema deve associar cada tenant a um plano de assinatura (Free, Pro, Enterprise) com limites definidos | 1b |
| FR14 | O sistema deve aplicar limites numericos por plano (grupos, participantes, storage, reunioes simultaneas) | 1b |
| FR15 | O sistema deve permitir que o Admin Tenant configure branding basico (logo, cores, nome de exibicao) | 1b |
| FR16 | O sistema deve permitir que o Admin Tenant configure politicas do tenant (feature toggles para monitoramento de foco, camera obrigatoria, etc.) | 1b |
| FR17 | O sistema deve exibir prompt de upgrade quando o tenant atingir limites do plano atual | 1b |
| FR18 | O sistema deve permitir que o Super Admin visualize e gerencie todos os tenants da plataforma | 1a |
| FR19 | O sistema deve registrar metadata do tenant (data de criacao, plano, status, configuracoes ativas) | 1a |

### 1.3 Grupos & Membros (9 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR20 | O sistema deve permitir que Admin/Lider crie, edite e exclua grupos dentro do tenant | 1a |
| FR21 | O sistema deve permitir que Admin/Lider vincule e desvincule participantes a um grupo | 1a |
| FR22 | O sistema deve permitir que Admin/Lider vincule e desvincule lideres a um grupo | 1a |
| FR23 | O sistema deve permitir que Admin/Lider convide participantes via e-mail ou link de convite | 1a |
| FR24 | O sistema deve permitir que Admin/Lider associe trilhas de conteudo a um grupo | 1a |
| FR25 | O sistema deve exibir para o Lider a lista de membros do grupo com status de participacao | 1a |
| FR26 | O sistema deve permitir que um participante visualize os grupos dos quais faz parte | 1a |
| FR27 | O sistema deve suportar importacao em massa de participantes via arquivo CSV | 1b |
| FR28 | O sistema deve validar dados importados e reportar erros de importacao ao usuario | 1b |

### 1.4 Trilhas & Conteudo (14 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR29 | O sistema deve permitir que Admin/Lider crie trilhas de ensino com nome, descricao e configuracoes | 1a |
| FR30 | O sistema deve permitir que Admin/Lider crie modulos dentro de uma trilha e os ordene | 1a |
| FR31 | O sistema deve permitir que Admin/Lider crie aulas dentro de modulos e as ordene | 1a |
| FR32 | O sistema deve suportar os tipos de conteudo: video, texto rico, PDF/DOC, links externos | 1a |
| FR33 | O sistema deve permitir upload de arquivos de conteudo para armazenamento proprio da plataforma | 1a |
| FR34 | O sistema deve permitir visualizacao de conteudo inline (sem download obrigatorio) | 1a |
| FR35 | O sistema deve permitir configuracao de acesso sequencial ou livre entre modulos/aulas | 1b |
| FR36 | O sistema deve permitir configuracao de pre-requisitos entre modulos/aulas | 1b |
| FR37 | O sistema deve registrar o progresso individual do participante por aula, modulo e trilha | 1a |
| FR38 | O sistema deve calcular e exibir percentual de conclusao da trilha por participante | 1a |
| FR39 | O sistema deve suportar regras de conclusao de aula: video assistido, documento lido, marcacao manual pelo usuario ou lider | 1b |
| FR40 | O sistema deve permitir publicacao e versionamento de conteudo (rascunho -> publicado) | 1b |
| FR41 | O sistema deve permitir que o tenant defina trilhas no nivel do tenant (catalogo) e as associe a multiplos grupos | 1b |
| FR42 | O sistema deve suportar templates de conteudo reutilizaveis para agilizar criacao de trilhas | 2 |

### 1.5 Reunioes ao Vivo (11 FRs, with FR47 split into 3)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR43 | O sistema deve permitir que Admin/Lider crie reunioes vinculadas a um grupo com data, hora e duracao | 2 |
| FR44 | O sistema deve integrar com provedor de videoconferencia de forma agnostica (abstracao por interface) | 2 |
| FR45 | O sistema deve receber eventos do provedor de videoconferencia (entrada, saida, estado de midia) | 2 |
| FR46 | O sistema deve registrar presenca automatica classificada como integral ou parcial conforme regras configuraveis | 2 |
| FR47a | O sistema deve registrar o tempo com camera ligada por participante durante a reuniao | 2 |
| FR47b | O sistema deve registrar o tempo de permanencia na sala por participante durante a reuniao | 2 |
| FR47c | O sistema deve registrar indicador de foco (proxy tecnico de atencao via visibilidade de aba) por participante, controlado por feature toggle do tenant | 2 |
| FR48 | O sistema deve tolerar desconexoes tecnicas sem penalizar a presenca do participante (janela de reconexao configuravel) | 2 |
| FR49 | O sistema deve gerar relatorio pos-reuniao automatico com presenca, engajamento e duracao | 2 |
| FR50 | O sistema deve exibir banner de transparencia durante a reuniao informando que sinais de presenca e engajamento estao sendo registrados | 2 |
| FR51 | O sistema deve manter estado da reuniao ativa em cache e persistir ao encerrar | 2 |
| FR52 | O sistema deve permitir que o Lider visualize a lista de presenca em tempo real durante a reuniao | 2 |
| FR53 | O sistema deve notificar participantes sobre reunioes agendadas (via plataforma) | 2 |

### 1.6 Visibilidade Pastoral (9 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR54 | O sistema deve exibir dashboard semaforo (verde/amarelo/vermelho) por participante para o Lider, baseado em sinais de presenca, engajamento e progresso | 2 |
| FR55 | O sistema deve calcular a classificacao semaforo com base em regras objetivas e configuraveis por tenant | 2 |
| FR56 | O sistema deve permitir que o Lider visualize o perfil consolidado de um participante (historico de presenca, progresso em trilhas, sinais de engajamento) | 2 |
| FR57 | O sistema deve permitir que o Lider registre acoes de cuidado pastoral vinculadas a um participante | 2 |
| FR58 | O sistema deve atualizar o dashboard semaforo em tempo real via SSE | 2 |
| FR59 | O sistema deve exibir indicadores de tendencia por participante (melhorando, estavel, declinio) | 2 |
| FR60 | O sistema deve permitir que o Admin Tenant visualize dashboard agregado de todos os grupos do tenant | 2 |
| FR61 | O sistema deve exibir alertas quando um participante mudar de status no semaforo (ex.: verde->amarelo ou amarelo->vermelho) | 2 |
| FR62 | O sistema deve enquadrar toda a comunicacao de monitoramento com vocabulario pastoral (cuidado, nao vigilancia) | 2 |

### 1.7 Relatorios & Analytics (6 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR63 | O sistema deve gerar relatorio por reuniao com metricas de presenca e engajamento | 2 |
| FR64 | O sistema deve gerar relatorio por trilha com metricas de progresso e conclusao por participante | 1b |
| FR65 | O sistema deve gerar relatorio por tenant com metricas agregadas de todos os grupos | 2 |
| FR66 | O sistema deve identificar e sinalizar participantes em risco de evasao com base em padroes de ausencia e inatividade | 2 |
| FR67 | O sistema deve gerar metricas de plataforma para Super Admin (tenants ativos, usuarios, utilizacao de recursos) | 2 |
| FR68 | O sistema deve permitir exportacao de relatorios em formato adequado para analise (CSV ou equivalente) | 1b |

### 1.8 Onboarding & Adocao (7 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR69 | O sistema deve exibir tela de boas-vindas personalizada no primeiro acesso do usuario | 1b |
| FR70 | O sistema deve oferecer onboarding guiado para Admin Tenant na configuracao inicial do tenant | 1b |
| FR71 | O sistema deve disponibilizar dados de demonstracao para que o Admin explore funcionalidades antes de inserir dados reais | 1b |
| FR72 | O sistema deve coletar consentimento explicito do usuario para tratamento de dados conforme LGPD | 1a |
| FR73 | O sistema deve permitir que o usuario exporte seus dados pessoais (direito de portabilidade LGPD) | 1b |
| FR74 | O sistema deve permitir que o usuario solicite exclusao de seus dados pessoais (direito de eliminacao LGPD) | 1b |
| FR75 | O sistema deve exibir politica de privacidade e termos de uso no cadastro e mante-los acessiveis | 1a |

### 1.9 Capabilities Transversais (7 FRs)

| ID | Requisito Funcional | Release |
|----|---------------------|---------|
| FR76 | O sistema deve permitir busca por conteudo dentro de trilhas, aulas e materiais do tenant | 1b |
| FR77 | O sistema deve permitir envio de notificacoes in-app para usuarios (reunioes, atualizacoes de conteudo, alertas pastorais) | 2 |
| FR78 | O sistema deve permitir que o usuario configure preferencias de notificacao por tipo | Post-MVP |
| FR79 | O sistema deve gerar relatorio consolidado por lider com visao agregada de todos os seus grupos | 2 |
| FR80 | O sistema deve registrar log de auditoria de acoes administrativas (criacao/edicao/exclusao de recursos, alteracoes de permissao, configuracoes de tenant) | 1b |
| FR81 | O sistema deve exibir mensagens de erro claras e acionaveis, orientando o usuario sobre como resolver o problema | 1b |
| FR82 | O sistema deve manter funcionalidade basica de leitura (visualizacao de trilhas e conteudo ja carregado) em caso de instabilidade de conexao | Post-MVP |

### FR Distribution by Release

| Release | Count | Areas |
|---------|-------|-------|
| **1a — Core Loop** | 24 | Identidade (11), Tenant parcial (3), Grupos (7), Trilhas parcial (7), LGPD (2) |
| **1b — Polish** | 23 | Tenant config (5), Grupos importacao (2), Trilhas complementar (7), Relatorio trilha (2), Onboarding (5), Busca (1), Auditoria (1), UX erro (1) |
| **2 — Radar Pastoral** | 27 | Reunioes (11+split), Visibilidade Pastoral (9), Relatorios reuniao/tenant (4), Templates (1), Notificacoes (1), Relatorio lider (1) |
| **Post-MVP** | 8 | Preferencias notificacao (1), Resiliencia offline (1), demais em Phases 3-5 |
| **Total** | **82** | |

---

## 2. Non-Functional Requirements (NFRs) — Complete Extraction

**Total: 52 NFRs** organized across 9 categories

### 2.1 Performance (8 NFRs)

**Web Vitals (p75):**

| Metrica | Target |
|---------|--------|
| LCP (Largest Contentful Paint) | <= 2,5s |
| INP (Interaction to Next Paint) | <= 200ms |
| CLS (Cumulative Layout Shift) | <= 0,1 |

**Targets por Fluxo Critico:**

| ID | Fluxo | Target | Condicao |
|----|-------|--------|----------|
| NFR-P1 | Entrada na reuniao | < 3s | 4G bom |
| NFR-P2 | Dashboard do lider (navegacao recorrente) | <= 2s | Cache quente |
| NFR-P3 | Atualizacao do semaforo apos evento | <= 2s | Ponta a ponta |
| NFR-P4 | Lista de presenca (entrada/saida) | <= 1s | Tempo real |
| NFR-P5 | Pagina de trilha | <= 2,5s | Primeiro carregamento |
| NFR-P6 | Player de video visivel | <= 2s | Rede estavel |
| NFR-P7 | Inicio de reproducao de video | <= 3s | Rede estavel |
| NFR-P8 | Documento/texto de aula | <= 2s | Legivel e navegavel |

### 2.2 Seguranca (10 NFRs)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-S1 | Senhas devem ser armazenadas com hash resistente a ataques de GPU e side-channel | 1a |
| NFR-S2 | Senha minima: 12 caracteres; suportar ate 64+ caracteres | 1a |
| NFR-S3 | Senhas vazadas/comuns devem ser bloqueadas no cadastro (lista OWASP/NIST) | 1a |
| NFR-S4 | MFA obrigatorio para Super Admin e Admin Tenant | 1a |
| NFR-S5 | MFA opcional para Lider no MVP, com expansao planejada | Post-MVP |
| NFR-S6 | TLS obrigatorio em transito, inclusive entre servicos internos sensiveis | 1a |
| NFR-S7 | Criptografia at-rest obrigatoria para banco, storage de arquivos/gravacoes e backups | 1a |
| NFR-S8 | Segredos gerenciados fora do codigo via cofre/secret manager centralizado | 1a |
| NFR-S9 | Sessoes com alta entropia para IDs de sessao | 1a |
| NFR-S10 | Nenhum dado de um tenant deve ser acessivel por outro tenant, verificavel por suite de testes automatizada executada em cada deploy | 1a |

**Auditoria (eventos minimos a registrar):**
- Login e autenticacao (sucesso e falha)
- Alteracao de permissao e papeis
- Criacao/edicao/exclusao de conteudo
- Acesso a gravacoes
- Exportacao de dados pessoais
- Alteracoes administrativas de tenant

### 2.3 Escalabilidade (3 NFRs + progressive targets)

**Targets Progressivos por Release:**

| Metrica | Release 1 | Release 2 | 12 meses |
|---------|-----------|-----------|----------|
| Usuarios simultaneos | 20 | 50 | 250 |
| Tenants ativos | 1-3 | 3-5 | 5-10 |
| Usuarios cadastrados | 50-100 | 100-300 | 300-800 |
| UAM (ativos mensais) | 20-50 | 50-150 | 150-300 |
| Grupos recorrentes (tenant mais ativo) | 2-3 | 3-6 | 5-12 |
| Reunioes simultaneas | -- | 1-3 | 3-8 |
| Participantes por reuniao tipica | -- | 15-30 | 30-50 |

**Principios de Escalabilidade:**

| ID | Requisito |
|----|-----------|
| NFR-E1 | App/API/workers devem escalar horizontalmente |
| NFR-E2 | Reuniao ao vivo e processamento assincrono devem escalar independentemente do app principal |
| NFR-E3 | Semaforo deve ser atualizado por eventos assincronos, nao por processamento sincrono pesado |

### 2.4 Confiabilidade (7 NFRs)

**Disponibilidade:**

| ID | Requisito | Target |
|----|-----------|--------|
| NFR-C1 | Uptime da plataforma principal | >= 99,5% (janela de 30 dias) |
| NFR-C2 | Alerta de uptime configurado com notificacao imediata | Release 1a |
| NFR-C3 | Post-mortem documentado para cada incidente com downtime > 30 min | Release 1b |

**RPO/RTO Progressivos:**

| Tipo de Dado | RPO Release 1 | RPO Release 2 | RTO |
|--------------|---------------|---------------|-----|
| Dados transacionais criticos (usuarios, grupos, presenca, progresso) | <= 1h | <= 15 min | <= 4h |
| Gravacoes e documentos (com versionamento/snapshot) | <= 24h | <= 24h | <= 8h |

**Tolerancia a Perda de Dados:**

| Tipo | Tolerancia | Cenario de Verificacao |
|------|-----------|------------------------|
| Presenca consolidada/final | Zero perda | Simular crash do servidor durante reuniao e verificar que dados de presenca sao recuperaveis |
| Telemetria bruta durante reuniao | <= 60s de eventos nao confirmados | Simular queda de conexao de 60s e verificar que <= 60s de telemetria sao perdidos apos reconexao |
| Eventos de progresso/trilha | <= 1 evento perdido por sessao | Simular falha de gravacao e verificar reprocessamento automatico |

**Backup & Restore:**

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-C4 | Banco: snapshots diarios + backups incrementais | 1a |
| NFR-C5 | Storage: versionamento de objetos quando aplicavel | 1b |
| NFR-C6 | Teste de restore executado e documentado | Gate Release 1b |
| NFR-C7 | Runbook de disaster recovery testado e documentado | Gate Release 1b |

### 2.5 Acessibilidade (6 NFRs)

**Target:** WCAG 2.1 AA (com mentalidade WCAG 2.2 AA onde possivel)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-A1 | Navegacao por teclado em todos os fluxos principais | 1b |
| NFR-A2 | Contraste e foco visivel conforme WCAG AA | 1b |
| NFR-A3 | Formularios acessiveis com labels e mensagens de erro claras | 1b |
| NFR-A4 | Compatibilidade com leitores de tela nas areas criticas: login, dashboard, trilhas, progresso, semaforo | 2 |
| NFR-A5 | Semaforo nao dependente apenas de cor para comunicar estado (icones/texto complementar obrigatorios) | 2 |
| NFR-A6 | Legendas/transcricao quando houver video essencial na trilha | Post-MVP |

### 2.6 Integracao & Resiliencia (5 NFRs)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-I1 | O sistema deve continuar operando funcionalidades core quando um provedor externo estiver indisponivel por ate 30 minutos | 2 |
| NFR-I2 | Falhas transitorias em integracoes externas devem ser reprocessadas automaticamente antes de gerar erro para o usuario | 2 |
| NFR-I3 | Timeouts explicitos para todas as chamadas externas: connect <= 3s, read <= 10s | 2 |
| NFR-I4 | Jobs falhados devem ser retidos para reprocessamento e investigacao | 1b |
| NFR-I5 | Health check por integracao ativa com status acessivel ao Super Admin | 2 |

**Fallbacks por Provedor:**

| Provedor | Fallback | Release |
|----------|----------|---------|
| Videoconferencia | Sala reserva / reinicio de sessao; modo audio prioritario em degradacao; remarcacao rapida + notificacao automatica se provider falhar antes da reuniao | 2 |
| WhatsApp | Reencaminhar por fila; fallback para notificacao in-app ou e-mail quando existir; registrar status final (enviado, falhou, reprocessado) | Post-MVP |

### 2.7 Observabilidade (5 NFRs)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-O1 | Logs estruturados devem estar disponiveis para troubleshooting em <= 5 minutos apos incidente | 1a |
| NFR-O2 | Erros de aplicacao devem gerar alerta automatico com contexto suficiente para diagnostico | 1a |
| NFR-O3 | Metricas basicas de saude (CPU, memoria, disco, latencia de resposta) disponiveis via dashboard | 1b |
| NFR-O4 | Metricas detalhadas por provedor de integracao (sucesso, falha, latencia, taxa de retry) | Phase 3 |
| NFR-O5 | Tracing distribuido entre servicos | Phase 3 |

### 2.8 Privacidade & LGPD (5 NFRs)

| ID | Requisito | Release |
|----|-----------|---------|
| NFR-L1 | Dados pessoais exportados devem estar disponiveis em <= 72h apos solicitacao do titular | 1b |
| NFR-L2 | Exclusao de dados pessoais deve ser executada em <= 30 dias apos solicitacao confirmada | 1b |
| NFR-L3 | Consentimento para tratamento de dados deve ser coletado antes de qualquer processamento de dados pessoais | 1a |
| NFR-L4 | Feature toggle para monitoramento de foco/aba deve estar desativado por padrao em novos tenants | 2 |
| NFR-L5 | Base legal por operacao de tratamento de dados deve estar documentada e acessivel | 1b |

### 2.9 Experiencia de Onboarding (3 NFRs)

| ID | Requisito | Target | Release |
|----|-----------|--------|---------|
| NFR-X1 | Admin Tenant deve conseguir criar o primeiro grupo com participantes | <= 10 min apos primeiro login | 1b |
| NFR-X2 | Lider deve conseguir acessar o dashboard e visualizar seu grupo | <= 3 min apos primeiro login | 1b |
| NFR-X3 | Participante deve conseguir acessar sua primeira trilha | <= 2 min apos aceitar convite | 1b |

### NFR Summary Count

| Categoria | Contagem |
|-----------|----------|
| Performance (NFR-P1 to P8) | 8 |
| Seguranca (NFR-S1 to S10) | 10 |
| Escalabilidade (NFR-E1 to E3) | 3 |
| Confiabilidade (NFR-C1 to C7) | 7 |
| Acessibilidade (NFR-A1 to A6) | 6 |
| Integracao & Resiliencia (NFR-I1 to I5) | 5 |
| Observabilidade (NFR-O1 to O5) | 5 |
| Privacidade & LGPD (NFR-L1 to L5) | 5 |
| Experiencia de Onboarding (NFR-X1 to X3) | 3 |
| **Total** | **52** |

---

## 3. Additional Requirements

### 3.1 Design Principles (Constraints Transversais)

**UX para Buyer Nao-Tecnico:**
- Sem termos tecnicos desnecessarios na interface do usuario
- Icone sempre acompanhado de texto
- CTA claro e direto — explicar o valor da acao, nao apenas o nome da funcionalidade
- Poucos caminhos por tela — reduzir carga cognitiva
- Feedback imediato apos cada acao (confirmacao visual, mensagem de status)
- Interface pensada para uso em celular (touch targets >= 44px, tipografia legivel)

**Vocabulario Pastoral como Constraint:**
- Linguagem varia conforme o papel do usuario (Admin: operacional; Lider: acompanhamento e cuidado; Participante: acolhedor, motivador)
- Toda nova tela ou componente deve passar por revisao de vocabulario antes de ser considerada pronta

**Posicionamento Anti-Vigilancia (Reframing Obrigatorio):**
- Evitar: "Usuarios inativos" -> Preferir: "Precisam de atencao"
- Evitar: "Falha de presenca" -> Preferir: "Baixo engajamento recente"
- Evitar: "Baixa performance" -> Preferir: "Sinais de afastamento"
- Evitar: "Monitoramento" -> Preferir: "Acompanhamento"
- Evitar: "Controle" -> Preferir: "Visibilidade pastoral"
- Evitar linguagem punitiva e metricas expostas de forma agressiva
- Presenca digital e um sinal limitado — decisao final e sempre humana

**Complexidade Progressiva:**
- Modo Express (padrao): criar grupo, agendar reuniao, acompanhar presenca, ver semaforo, enviar lembrete
- Modo Avancado (sob demanda): trilhas com regras de progresso, automacoes, permissoes granulares, relatorios detalhados
- Transicao do modo express para avancado e sempre iniciada pelo usuario (nunca automatica)

**Acessibilidade como Principio de Design:**
- Acessibilidade considerada em cada decisao de design, nao apenas na validacao final
- Componentes custom (semaforo, player, dashboard) projetados acessiveis desde o inicio
- Semaforo nunca depende apenas de cor
- Target: WCAG 2.1 AA, direcao para WCAG 2.2 AA

### 3.2 Business Constraints

**Equipe:** 1-2 desenvolvedores com suporte de IA (AI-assisted development). 1 dev + IA como baseline.
**Cadencia:** Sprints de 2 semanas, demo a cada sprint.
**CI/CD:** GitHub Actions desde o dia 1 com deploy automatico para staging.

**Subscription Tiers:**

| Recurso | Free | Pro | Enterprise |
|---------|------|-----|------------|
| SLA | Best effort | 99,5% | 99,9% + penalidades |
| Grupos | 3 | 20 | Ilimitado |
| Participantes por grupo | 15 | 50 | Custom |
| Participantes simultaneos | 30 | 100 | Custom |
| Trilhas publicadas | 2 | 20 | Ilimitado |
| Armazenamento | 1 GB | 50 GB | Custom |
| Gravacao | Nao incluida | 90 dias, 10 GB | Custom |
| Branding | Padrao | Logo + cores | White-label completo |
| Suporte | Comunidade | E-mail | Dedicado |
| Isolamento | Shared (RLS) | Shared (RLS) | Database dedicado |
| API publica | Nao | Rate limited | Custom limits |
| Feature flags | Padrao | Configuravel | Totalmente custom |

**Timeline Estimada:**

| Release | Duracao | Acumulado | Dev(s) |
|---------|---------|-----------|--------|
| Release 1a (Core Loop) | 6-8 semanas | 6-8 sem | 1 dev + IA |
| Release 1b (Polish) | 4-6 semanas | 10-14 sem | 1-2 devs |
| Release 2 (Radar Pastoral) | 8-10 semanas | 18-24 sem | 1-2 devs |
| MVP completo | -- | ~5-6 meses | -- |

### 3.3 Integration Requirements

| Integracao | Tipo | Status |
|------------|------|--------|
| Keycloak | Auth/IAM | Release 1a |
| MinIO | Object storage | Release 1a |
| Redis | Cache + jobs + estado de reuniao | Release 1a |
| Provedor de videoconferencia | Reuniao ao vivo | Release 2 (agnostica via webhooks) |
| NATS JetStream | Event bus interno | Release 2+ (quando 3+ servicos) |
| ChatMaster Veloz | WhatsApp API | Phase 3 |
| Grafana/Prometheus/Loki | Observabilidade completa | Phase 3+ |
| pgvector | Busca semantica | Preparado no MVP, ativo Phase 5 |

**WhatsApp via ChatMaster Veloz (constraints):**
- Compartilhamento minimo de dados com operador/suboperador
- Dados limitados: nome + numero + conteudo do lembrete
- Contrato DPA com o provedor
- Registro de todas as operacoes de envio
- Gestao de preferencias granular por tipo de notificacao
- Opt-out parcial sem perda de funcionalidade core

**Videoconferencia (constraints):**
- Integracao agnostica via webhooks
- Registro de presenca auditavel independente do provedor
- Suporte a fallback para dispositivos limitados

### 3.4 Key Assumptions

- MVP atende exclusivamente adultos (>= 18 anos); atendimento a adolescentes (12-17) planejado para fase posterior
- Single-tenant tenant-aware no MVP (deployment compartilhado com isolamento logico forte via RLS)
- Evolucao para database-per-tenant em tiers enterprise quando houver demanda real
- Provisionamento de tenant pelo Super Admin (MVP); self-service futuro
- Chat persistente, mensageria tipo comunidade/feed e DM entre usuarios estao fora do MVP
- Gravacao de reunioes movida para Phase 3
- Modo de reengajamento movido para Phase 3
- Gestao de lideres (reatribuicao, redistribuicao) movida para Phase 3

### 3.5 Domain-Specific Compliance

**LGPD:**
- Consentimento e transparencia adequados
- Base legal mapeada por operacao de tratamento
- Direitos do titular: exportacao, exclusao, revogacao de consentimento
- RIPD inicial desde o MVP
- Trilha de consentimento auditavel
- Politica de privacidade e termos de uso publicados

**Retencao diferenciada por tipo de dado:**
- Gravacoes de reuniao: 90 dias (configuravel por tenant)
- Logs de auditoria: minimo 1 ano
- Dados de presenca/engajamento: alinhados ao ciclo do programa
- Notificacoes enviadas: 6 meses
- Dados pessoais inativos: politica de purgacao apos periodo definido

**Child Safety (fase posterior ao MVP):**
- Consentimento parental/responsavel obrigatorio
- Controles adicionais de gravacao e acesso
- Mecanismos de afericao de idade
- Aprovacao humana obrigatoria para conteudo voltado a menores

**SLA por tier:**
- Free: best-effort
- Pro: 99,5% disponibilidade mensal
- Enterprise: 99,9% com penalidades contratuais

### 3.6 Content Governance

- Apenas admins e editores autorizados podem publicar conteudo
- Fluxo obrigatorio: rascunho -> aprovacao -> publicacao
- Versionamento de conteudo com historico de alteracoes
- Para conteudo voltado a menores (fase posterior): aprovacao humana obrigatoria pre-publicacao

### 3.7 Tenant Hierarchy & Data Governance (Phase 4)

- Tenant pai ve dados agregados, nunca dados individuais de participantes
- Base legal especifica para compartilhamento entre tenants hierarquicos
- Isolamento de dados pessoais entre niveis hierarquicos
- Controlador de dados definido por nivel
- Configuracao de visibilidade por nivel hierarquico

---

## 4. PRD Completeness Assessment

### 4.1 BMAD Sections Present

| Secao | Status | Notas |
|-------|--------|-------|
| Frontmatter YAML | Present | Completo com classificacao, stepsCompleted, inputDocuments |
| Executive Summary | Present | Claro, com "What Makes This Special" |
| Project Classification | Present | Tabela completa |
| Glossario | Present | 16 termos definidos |
| Design Principles & Constraints | Present | 4 principios detalhados |
| Success Criteria | Present | User, Business, Technical + Measurable Outcomes |
| Estrategia de Distribuicao | Present | Go-to-market + canais prioritarios |
| Product Scope | Present | Fases 1-5 com mapeamento fase->release |
| User Journeys | Present | 5 jornadas detalhadas com edge cases |
| Domain-Specific Requirements | Present | LGPD, Child Safety, Acessibilidade, SLA, Technical Constraints |
| Innovation & Novel Patterns | Present | 6 areas de inovacao + defensibilidade + market context |
| SaaS B2B + Web App Requirements | Present | Browser matrix, SEO, real-time, rate limiting, tenant model, RBAC, tiers |
| Project Scoping & Phased Development | Present | MVP strategy, releases, gates, timeline, risks |
| Functional Requirements | Present | 82 FRs formais numerados com release tags |
| Non-Functional Requirements | Present | 52 NFRs formais com IDs e targets mensuraveis |

**Assessment:** ALL standard BMAD sections are present. This is a significant improvement from the original PRD that was validated (which scored 3/6 core sections).

### 4.2 FR <-> User Journey Traceability

The PRD includes a "Journey Requirements Summary" table mapping each of the 5 journeys to capabilities:

| Jornada | Capabilities Reveladas |
|---------|----------------------|
| Lider | Dashboard semaforo, perfil com historico, registro de acao de cuidado, reuniao integrada, presenca automatica, relatorio pos-reuniao, tolerancia a falhas, notificacao de indisponibilidade, reagendamento |
| Participante | Tela de boas-vindas, onboarding simplificado, trilha mobile-first, conclusao automatica, entrada rapida na reuniao, progresso individual, gamificacao, lembretes WhatsApp, presenca via webhook, modo de reengajamento |
| Admin tenant | Dashboard agregado, visibilidade de lideres e grupos, gestao de lideres, catalogo de templates, configuracao de politicas, relatorios consolidados |
| Super Admin | Provisionamento de tenant, control plane, observabilidade, alertas proativos, metricas por tenant, gestao de limites |
| Adocao | Landing page, onboarding guiado, conta free, dados demo, templates prontos, conversao self-service, primeiro valor em < 10 min |

**Assessment:** Journey-to-capability mapping exists. However, there is NO formal FR-to-Journey traceability matrix (e.g., "FR54 traces to Journey 1, Journey 3"). This is a gap.

### 4.3 NFRs with Measurable Targets

| Categoria | Measurable? | Notes |
|-----------|-------------|-------|
| Performance (P1-P8) | YES | All have specific time targets with conditions |
| Seguranca (S1-S10) | MOSTLY | Most are specific; S1 and S9 are slightly abstract |
| Escalabilidade (E1-E3) | PARTIAL | Principles stated, numeric targets in separate table |
| Confiabilidade (C1-C7) | YES | Uptime %, RPO/RTO values, specific requirements |
| Acessibilidade (A1-A6) | MOSTLY | WCAG AA referenced; some lack specific test criteria |
| Integracao (I1-I5) | YES | Specific timeouts, durations |
| Observabilidade (O1-O5) | MOSTLY | O1 has 5-min target; O4/O5 lack specific SLOs |
| LGPD (L1-L5) | YES | 72h, 30 days, etc. |
| Onboarding (X1-X3) | YES | Specific time targets per role |

**Assessment:** Strong measurability overall. The NFRs are a major improvement over the original PRD which had zero measurable NFRs.

### 4.4 Ambiguous Requirements Identified

| Requirement | Ambiguity | Recommendation |
|-------------|-----------|----------------|
| FR09 | "multiplas camadas de autorizacao independentes" — how many? which layers? | Implementation notes clarify 3 layers, but FR itself is vague |
| FR39 | "documento lido" — how to verify? scroll %, time on page, manual confirm? | Needs acceptance criteria for "lido" |
| FR42 | "templates de conteudo reutilizaveis" — scope unclear: pre-built templates or user-created? | Needs clarification: system templates, tenant templates, or both? |
| FR62 | "vocabulario pastoral" — subjective; who validates compliance? | Needs vocabulary audit process or reference dictionary |
| FR66 | "padroes de ausencia e inatividade" — thresholds undefined | Needs configurable rules or default thresholds |
| FR76 | "busca por conteudo" — full-text? title only? semantic? | Needs scope definition |
| FR82 | "funcionalidade basica de leitura" — what exactly is available offline? | Needs explicit list of offline capabilities |
| NFR-S1 | "hash resistente a ataques de GPU e side-channel" — no algorithm specified in NFR | Implementation notes recommend Argon2id, but NFR is outcome-based (acceptable) |
| NFR-E1/E2/E3 | Scalability principles without numeric break points for scaling triggers | Add trigger conditions: "scale when CPU > X% or latency > Yms" |

### 4.5 Gaps in Acceptance Criteria

- **No FR has formal acceptance criteria (Given/When/Then or equivalent).** The FRs define WHAT but not acceptance conditions. This will need to be added during epic/story decomposition.
- **Success Criteria gaps documented in PRD itself:**
  - NPS do lider >= 40: No FR for NPS collection (manual for first 3 months; FR planned for Phase 3)
  - Reengajamento pastoral documentado: Mode moved to Phase 3; FR57 (registro de acoes de cuidado) serves as proxy
  - Tempo de ativacao <= 7 dias: Includes organizational adoption, not just technical onboarding

### 4.6 Release Structure Clarity

**Assessment: EXCELLENT**

The release structure is well-defined with:
- 3 MVP releases (1a, 1b, 2) + Post-MVP phases (3, 4, 5)
- Clear gates per release with checkbox criteria
- Dependency graph between phases
- Timeline estimates with dev allocation
- Risk mitigation per phase
- FR distribution table showing count and areas per release
- Final MVP acceptance criteria

---

## 5. Validation Report Findings Summary

The validation report (`metanoia-hub-prd-validation-report.md`) was conducted on the **original input PRD** (`auxiliar/metanoia-hub-prd.md`), NOT the final BMAD-processed PRD. The final PRD at `prd.md` addresses most of the critical findings:

| Validation Area | Original Score | Status in Final PRD |
|-----------------|---------------|---------------------|
| Format Detection | 3/6 core sections | All sections present |
| Information Density | 21 violations (Critical) | Improved: FRs formalized, less filler |
| Measurability | ~116 violations (Critical) | Resolved: 82 numbered FRs + 52 NFRs with metrics |
| Traceability | Chain completely broken (Critical) | Improved: Journeys added, journey-capability mapping exists; FR-to-journey matrix still missing |
| Implementation Leakage | 3 in FRs + 6 entire sections (Critical) | Partially resolved: Architecture sections moved to appropriate context; some implementation notes remain (informative) |
| Domain Compliance | 1/4 (Warning) | Resolved: LGPD, accessibility, child safety, SLA all covered |
| Project-Type Compliance | 30% (Warning) | Resolved: Browser matrix, responsive design, performance targets, RBAC matrix, tiers all added |
| SMART Quality | 14% acceptable (Critical) | Significantly improved: formal FRs with release tags |
| Holistic Quality | 2/5 | Estimated 4/5 in final PRD |
| Completeness | 40% (Warning) | Estimated 85-90% in final PRD |

**Remaining gaps from validation report not fully addressed:**
1. FR-to-Journey formal traceability matrix (journey summary exists but not FR-level mapping)
2. Formal acceptance criteria per FR (deferred to epic/story phase)
3. Scalability NFRs could use more specific trigger conditions
4. Content moderation policy for trilhas (partially addressed via content governance section)

---

## 6. Overall Assessment

### Strengths
- Complete BMAD structure with all sections
- 82 well-defined FRs covering 9 capability areas
- 52 NFRs with measurable targets across 9 categories
- Clear release structure (1a -> 1b -> 2 -> Phases 3-5) with gates
- 5 detailed user journeys with edge cases
- Strong design principles (pastoral vocabulary, anti-surveillance, progressive complexity, accessibility)
- Comprehensive domain coverage (LGPD, child safety, data governance, SLA)
- Realistic timeline and resource planning (1-2 devs + AI)

### Weaknesses
- No formal acceptance criteria on individual FRs (deferred to stories)
- No FR-to-Journey traceability matrix
- Some FRs remain slightly ambiguous (FR39, FR42, FR66, FR76, FR82)
- Scalability NFRs are principle-based rather than threshold-based
- Post-MVP FRs only have 8 formally defined; Phases 3-5 features are described narratively

### Recommendation
The PRD is production-ready for architecture and epic/story decomposition. The primary action items are:
1. Add acceptance criteria during story writing (not a PRD gap per se)
2. Create FR-to-Journey traceability matrix for validation
3. Clarify the 9 ambiguous requirements identified in section 4.4
