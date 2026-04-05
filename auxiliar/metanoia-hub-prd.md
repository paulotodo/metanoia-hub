# Metanoia Hub — PRD inicial (MVP)

**Documento:** `prd.md`  
**Produto:** Metanoia Hub  
**Versão:** 0.1  
**Status:** Rascunho inicial validado com insumos do solicitante  
**Data:** 2026-04-04  
**Idioma-base:** PT-BR

---

## 1. Resumo executivo

Metanoia Hub é uma plataforma multi-tenant voltada para discipulado cristão, ensino online e acompanhamento de jornadas de formação. O MVP deve permitir que igrejas, ministérios, redes de igrejas e escolas bíblicas criem grupos/turmas, realizem discipulados online ao vivo, publiquem trilhas de ensino e acompanhem presença, engajamento, progresso e retenção dos participantes.

O produto precisa nascer com arquitetura preparada para escala e isolamento por tenant, combinando:

- **Microserviços** desde o início;
- **Arquitetura orientada a eventos (EDA)** para integração entre domínios;
- **Clean Architecture** dentro de cada serviço;
- **Observabilidade, auditoria e compliance** desde o MVP;
- **Modelo comercial por tenant**, com possibilidade de tenants enterprise com isolamento mais forte e white-label de acordo com o contrato.

---

## 2. Problema que o produto resolve

Hoje, o discipulado online geralmente acontece em ferramentas genéricas de videoconferência e ensino, sem integração nativa entre:

- reuniões ao vivo;
- controle de presença e engajamento;
- lembretes automáticos;
- gestão de trilhas de ensino;
- acompanhamento de progresso;
- gamificação;
- relatórios por grupo, líder e participante.

O Metanoia Hub nasce para ser um sistema especializado para discipulado e formação cristã, permitindo que o líder não apenas conduza reuniões, mas também acompanhe objetivamente quem participou, quanto permaneceu na reunião, quanto tempo ficou fora da aba, como avançou na trilha e qual é o nível de engajamento do discipulado.

---

## 3. Visão do produto

Criar uma plataforma de discipulado online com experiência própria de produto, preparada para uso interno no MVP e futura comercialização para múltiplos tenants, permitindo:

- encontros ao vivo em grupos de discipulado;
- automações de lembrete via WhatsApp;
- trilhas configuráveis de ensino;
- progresso individual e gamificado;
- avaliações e quizzes;
- relatórios para líderes e administradores;
- governança, auditoria e conformidade com LGPD.

---

## 4. Objetivos do MVP

### 4.1 Objetivos de negócio

1. Validar o uso real do módulo de reuniões online.
2. Validar o uso das trilhas de ensino.
3. Validar retenção e engajamento dos participantes.
4. Viabilizar homologação interna do produto.
5. Criar base técnica para vender o sistema comercialmente por tenant.

### 4.2 Objetivos de produto

1. Permitir a criação manual de reuniões de discipulado para grupos/turmas.
2. Registrar presença com regras objetivas.
3. Registrar indicadores de engajamento durante a reunião.
4. Permitir criação de trilhas por grupo/turma.
5. Permitir upload e consumo de conteúdos em múltiplos formatos.
6. Exibir progresso individual e gamificação.
7. Enviar lembretes configuráveis via WhatsApp.
8. Fornecer relatórios operacionais e gerenciais.

### 4.3 Metas iniciais consideradas no MVP

- 1 tenant inicial.
- Aproximadamente 50 usuários no primeiro tenant.
- Capacidade-alvo inicial: até 100 participantes simultâneos.
- Base arquitetural preparada para expansão a múltiplos tenants.

---

## 5. Público-alvo

O MVP deve atender uma combinação de perfis institucionais e operacionais:

### 5.1 Clientes pagantes potenciais

- igrejas locais;
- ministérios;
- redes de igrejas;
- escolas bíblicas.

### 5.2 Perfis de usuário

- **Super Admin da plataforma**: administração global da solução.
- **Admin do tenant/igreja**: gestão operacional e de configuração do tenant.
- **Líder**: responsável por grupos/turmas e acompanhamento dos participantes.
- **Discipulador**: papel ministerial operacional semelhante a líder, com escopo definido pelo tenant.
- **Participante / discipulado / aluno**: consome reuniões, conteúdos e trilhas.

---

## 6. Escopo funcional do MVP

### 6.1 Cadastro, login e acesso

O sistema deve permitir:

- cadastro com **e-mail e senha**;
- login via **Google**;
- um mesmo usuário associado a **mais de um tenant**;
- autenticação centralizada;
- autorização com permissões granulares;
- escopo por tenant;
- associação do usuário a grupos/turmas.

### 6.2 Multi-tenancy

O produto deve suportar:

- multi-tenant desde o MVP;
- tenants com branding próprio dependendo da contratação;
- tenants enterprise com isolamento mais forte;
- evolução para white-label parcial ou total;
- segregação de dados e permissões por tenant.

### 6.3 Grupos / turmas

O admin/líder deve conseguir:

- criar grupos/turmas;
- definir nome e descrição do grupo;
- vincular líderes/discipuladores ao grupo;
- vincular participantes;
- associar trilhas ao grupo;
- criar reuniões manuais por grupo.

### 6.4 Reuniões online de discipulado

#### Requisitos obrigatórios do MVP

- vídeo e áudio;
- chat;
- compartilhamento de tela;
- gravação;
- sala de espera;
- controle do líder;
- lista de presença;
- relatório pós-reunião.

#### Modelo operacional

- 1 líder para vários participantes;
- múltiplos grupos/turmas;
- cada grupo com seu próprio nome e histórico.

#### Decisão de produto para o MVP

O MVP deve priorizar **módulo próprio de reunião embutido na plataforma**, em vez de depender da experiência principal do Google Meet.

**Estratégia recomendada**:
- **Primário no MVP:** reunião própria com infraestrutura self-hosted baseada em componente de videoconferência embarcável.
- **Fallback operacional:** integração com provedor externo apenas como contingência de rollout, não como arquitetura-alvo.

### 6.5 Regras de presença e engajamento

#### Presença integral

Um participante será considerado com **presença integral** quando:

- entrar na sala; e
- permanecer por **mais de 75%** do tempo total da reunião; e
- manter câmera ligada por **mais de 50%** do tempo total da reunião.

#### Presença parcial

Um participante será considerado com **presença parcial** quando entrar na reunião, mas não cumprir integralmente os critérios de presença integral.

#### Engajamento

O sistema deve registrar como indicadores:

- tempo total na sala;
- percentual de permanência;
- tempo acumulado fora da aba;
- percentual de tempo com câmera ligada;
- interações relevantes de sessão (expansível futuramente).

#### Observação importante

O indicador “tempo fora da aba” será tratado como **proxy técnico de atenção**, não como prova absoluta de atenção real.

### 6.6 Lembretes e automações

O sistema deve permitir:

- envio de lembretes via **WhatsApp**;
- configuração por tenant/administrador;
- criação de múltiplos alarmes por evento;
- lembretes parametrizáveis por reunião;
- lembretes antes da próxima reunião;
- envio associado a reuniões recorrentes.

#### Regras operacionais atuais

- reuniões de discipulado serão **criadas manualmente**;
- a recorrência pode existir como configuração, mas a criação operacional inicial das reuniões é manual.

### 6.7 Trilhas de ensino

As trilhas serão definidas **por grupo/turma**.

O administrador deve conseguir:

- criar trilhas;
- criar módulos dentro da trilha;
- criar aulas dentro de módulos;
- ordenar módulos e aulas;
- configurar acesso sequencial ou livre;
- configurar pré-requisitos entre módulos/aulas;
- publicar e versionar conteúdos.

### 6.8 Tipos de conteúdo do MVP

Cada aula poderá conter um ou mais dos seguintes tipos:

- vídeo;
- texto rico;
- PDF/DOC;
- links externos;
- quiz;
- tarefa;
- checklist.

### 6.9 Regras de conclusão de conteúdo

#### Vídeo

Uma aula em vídeo poderá ser concluída por:

- 90% assistido;
- assistiu até o fim;
- marcação manual pelo usuário;
- marcação manual pelo líder.

#### Documento

Uma aula baseada em documento poderá ser concluída quando:

- o usuário chegar ao fim do documento; ou
- houver marcação manual do usuário/líder, se habilitada.

### 6.10 Quiz e avaliação

O MVP deve incluir:

- quizzes por aula ou módulo;
- avaliações com nota;
- geração de quiz ao término da trilha;
- quiz aleatório por usuário;
- possibilidade de gerar perguntas com apoio de inteligência artificial com base no conteúdo da trilha.

### 6.11 Gamificação

O MVP deve incluir gamificação individual com:

- barra de progresso;
- pontos;
- níveis;
- ranking.

### 6.12 Relatórios e dashboards

O sistema deve oferecer dashboards com indicadores como:

- presença;
- engajamento;
- progresso;
- evasão;
- conclusão;
- adesão por trilha.

### 6.13 Conteúdo e armazenamento

O MVP deve suportar:

- upload próprio de arquivos;
- armazenamento em infraestrutura do próprio produto em VPS;
- visualização de conteúdo sem download no MVP;
- busca no conteúdo;
- versionamento de conteúdo.

### 6.14 Importação em massa

O sistema poderá permitir importação em massa de usuários via planilha/CSV.

---

## 7. Pergunta respondida: por que validar se a trilha é por tenant inteiro ou por grupo/turma?

Essa validação foi necessária porque há duas estratégias de produto diferentes:

### 7.1 Trilha por tenant inteiro

Nesse modelo, a igreja/ministério cria um currículo institucional único e o reaproveita em vários grupos. Isso favorece:

- padronização doutrinária;
- reuso de conteúdo;
- gestão centralizada;
- menor custo operacional.

### 7.2 Trilha por grupo/turma

Nesse modelo, cada grupo pode ter sua própria trilha, com mais flexibilidade para:

- discipulados em níveis diferentes;
- grupos temáticos;
- jornadas personalizadas;
- formações específicas por turma.

### 7.3 Decisão para o MVP

O produto seguirá com **trilhas por grupo/turma**, com possibilidade futura de permitir modelos híbridos:

- trilha global do tenant;
- trilha herdada para grupos;
- trilha customizada por grupo.

---

## 8. Fora do escopo do MVP

Itens não obrigatórios nesta primeira versão:

- aplicativo mobile nativo;
- marketplace de cursos;
- billing completo e autoatendimento comercial;
- SSO corporativo avançado;
- legendas e transcrição automáticas em produção;
- analytics avançado com IA em tempo real durante a reunião;
- moderação automática por IA ao vivo;
- download de materiais pelos usuários;
- criação automática de reuniões de discipulado;
- certificados no MVP, salvo decisão posterior.

---

## 9. Requisitos não funcionais

### 9.1 Escalabilidade

A solução deve nascer preparada para:

- múltiplos tenants;
- tenants enterprise com isolamento dedicado;
- expansão horizontal dos serviços stateless;
- separação entre plano de controle e plano de tenant.

### 9.2 Segurança

- autenticação centralizada;
- autorização por papéis e permissões granulares;
- isolamento por tenant;
- criptografia em trânsito (TLS);
- trilha de auditoria completa;
- retenção configurável de dados;
- proteção de upload e acesso a mídia.

### 9.3 Observabilidade

- métricas;
- logs estruturados;
- tracing distribuído;
- dashboards operacionais;
- alertas.

### 9.4 Auditoria

Auditar ao menos:

- login e autenticação;
- alterações de usuários e permissões;
- criação/edição/exclusão de trilhas;
- criação/edição/exclusão de reuniões;
- disparos de notificações;
- alterações administrativas;
- eventos de progresso;
- eventos de presença e engajamento.

### 9.5 Compliance e LGPD

O MVP deve contemplar:

- consentimento e transparência adequados ao tratamento;
- política de privacidade;
- definição de base legal por operação;
- exportação de dados do titular;
- exclusão de dados quando aplicável;
- RIPD inicial;
- feature toggle para monitoramento de foco/aba por tenant.

---

## 10. Arquitetura recomendada

## 10.1 Princípios

- microserviços desde o início;
- EDA como padrão de integração entre domínios;
- Clean Architecture dentro dos serviços;
- APIs síncronas apenas onde fizer sentido de experiência imediata;
- eventos para desacoplamento, auditoria e processamento assíncrono;
- isolamento mais forte para tenants enterprise.

## 10.2 Estratégia de implantação recomendada

### Camada 1 — Control Plane

Serviços compartilhados de plataforma:

- gestão global de tenants;
- identidade central;
- provisionamento de tenants;
- catálogo de planos/contratação (futuro);
- roteamento, branding e feature flags;
- observabilidade central;
- auditoria central consolidada.

### Camada 2 — Tenant Plane

Runtime do tenant:

- grupos/turmas;
- trilhas;
- reuniões;
- presença;
- notificações;
- relatórios;
- armazenamento;
- componentes de mídia.

### Política recomendada de isolamento

- **Plano padrão/shared:** tenants em infraestrutura compartilhada com isolamento lógico forte.
- **Plano enterprise:** tenant em stack dedicada, idealmente com banco, storage e mídia isolados.

### Observação sobre a sua ideia de 1 VPS por tenant

Essa estratégia pode ser usada para tenants enterprise e clientes mais exigentes, mas é custosa para operar em escala. Para o MVP e primeiros clientes, a recomendação é:

- 1 ambiente compartilhado para desenvolvimento/homologação;
- 1 ambiente de produção shared para tenants menores;
- tenants enterprise em infraestrutura dedicada quando necessário.

---

## 11. Stack recomendada

## 11.1 Frontend

- **Next.js + TypeScript**
- **React**
- **Tailwind CSS**
- **shadcn/ui**
- **TanStack Query**
- **Zustand** para estado local de sessão/UI

### Justificativa

Entrega rápida, boa experiência de produto, ecossistema maduro, SSR quando útil e integração simples com autenticação, dashboards, player de conteúdo e módulos administrativos.

## 11.2 Backend de produto / microserviços

- **NestJS + TypeScript** para os serviços de negócio
- **Fastify adapter** no NestJS
- **Clean Architecture** por bounded context

### Justificativa

É a melhor combinação para este projeto entre velocidade de entrega, produtividade, padronização e capacidade de evolução. O gargalo principal do produto não estará no CRUD, mas na mídia em tempo real, storage e notificações.

## 11.3 Realtime / videoconferência

### Recomendação do MVP

- **Jitsi self-hosted embutido na plataforma**

### Motivos

- reduz tempo de implementação do módulo próprio de reunião;
- permite experiência com cara de produto próprio;
- atende vídeo, áudio, chat, screen share e waiting room com menor esforço inicial;
- possibilita gravação com componente adicional;
- permite integração com eventos da sessão.

### Evolução futura recomendada

- avaliar **LiveKit** para uma experiência ainda mais customizada, com maior controle fino do produto, se o módulo ao vivo se tornar o principal diferencial competitivo.

## 11.4 Event bus / mensageria

- **NATS JetStream**

### Uso principal

- publicação de eventos de domínio;
- fan-out para notificações, auditoria, analytics e projeções;
- processamento desacoplado;
- fila durável para consumidores de eventos.

## 11.5 Banco de dados transacional

- **PostgreSQL 16**
- **pgBouncer**
- **pgvector** habilitado desde o início

### Uso principal

- dados transacionais dos serviços;
- relatórios operacionais;
- projeções;
- base futura para recursos de IA e busca semântica.

## 11.6 Cache, sessões e jobs de curta duração

- **Redis**
- **BullMQ** para scheduling de lembretes e tarefas temporizadas

## 11.7 Armazenamento de objetos

- **MinIO** em VPS própria, com buckets versionados

### Uso principal

- vídeos;
- documentos;
- gravações;
- anexos de aula;
- trilhas de versão dos arquivos.

## 11.8 Auth / IAM

- **Keycloak** como provedor de identidade central

### Estratégia recomendada

- autenticação centralizada no Keycloak;
- tenants, memberships e permissões de negócio mantidos nos bancos do produto;
- RBAC + permissões granulares no domínio da aplicação.

## 11.9 Busca no conteúdo

### MVP

- **PostgreSQL Full-Text Search**

### Futuro

- ampliar com índice vetorial via **pgvector** e pipeline de embeddings.

## 11.10 Observabilidade

- **OpenTelemetry**
- **Prometheus**
- **Grafana**
- **Loki**
- **Tempo** ou stack equivalente para tracing

## 11.11 Infraestrutura

### Recomendação prática para início

- **Hetzner VPS**
- **Docker**
- **Traefik** como reverse proxy
- **GitHub Actions** para CI/CD

### Orquestração recomendada

#### MVP inicial
- Docker Compose ou Docker Swarm, se a equipe já dominar bem o operacional.

#### Evolução de escala
- K3s para cenários com maior densidade de serviços, múltiplas VPSs e tenants enterprise mais exigentes.

---

## 12. Serviços sugeridos

### 12.1 Identity Service
Responsável por:
- usuários base;
- memberships por tenant;
- perfis;
- permissões;
- vinculação com provedor de identidade.

### 12.2 Tenant Service
Responsável por:
- cadastro de tenant;
- branding;
- plano/contratação;
- configurações;
- feature flags por tenant.

### 12.3 Group Service
Responsável por:
- grupos/turmas;
- vínculo de líderes e participantes;
- matrícula.

### 12.4 Learning Path Service
Responsável por:
- trilhas;
- módulos;
- aulas;
- ordenação;
- pré-requisitos;
- versionamento.

### 12.5 Content Service
Responsável por:
- uploads;
- metadados;
- armazenamento;
- visualização controlada;
- indexação de busca.

### 12.6 Meeting Service
Responsável por:
- agenda manual de reuniões;
- salas;
- tokens de acesso;
- vínculo com provedor de videoconferência;
- configurações de sessão.

### 12.7 Attendance & Engagement Service
Responsável por:
- presença;
- tempo de sala;
- câmera ligada;
- tempo fora da aba;
- score de engajamento;
- relatórios pós-reunião.

### 12.8 Notification Service
Responsável por:
- lembretes;
- alarmes configuráveis;
- templates;
- integrações com WhatsApp;
- logs de entrega.

### 12.9 Quiz & Assessment Service
Responsável por:
- quizzes;
- banco de questões;
- avaliação;
- notas;
- geração assistida por IA.

### 12.10 Progress & Gamification Service
Responsável por:
- progresso por aula/módulo/trilha;
- pontos;
- níveis;
- ranking.

### 12.11 Audit Service
Responsável por:
- trilha de auditoria completa;
- retenção;
- busca por eventos administrativos;
- exportação para compliance.

### 12.12 Reporting Service
Responsável por:
- dashboards;
- projeções materializadas;
- KPIs por tenant, grupo, trilha e usuário.

---

## 13. Eventos de domínio sugeridos (EDA)

Exemplos iniciais de eventos:

- `tenant.created`
- `tenant.updated`
- `user.invited`
- `user.joined_tenant`
- `group.created`
- `group.member_added`
- `learning_path.created`
- `lesson.published`
- `meeting.created`
- `meeting.reminder_scheduled`
- `meeting.started`
- `meeting.participant_joined`
- `meeting.participant_left`
- `meeting.focus_lost`
- `meeting.focus_restored`
- `meeting.camera_on`
- `meeting.camera_off`
- `meeting.ended`
- `attendance.computed`
- `lesson.completed`
- `quiz.generated`
- `quiz.completed`
- `progress.updated`
- `notification.dispatched`
- `notification.delivered`
- `audit.event_recorded`

---

## 14. Regras principais de negócio

### 14.1 Reuniões

- reuniões de discipulado serão cadastradas manualmente;
- poderão ter recorrência parametrizada;
- ficam vinculadas a um grupo/turma;
- líder controla a sessão e a admissão de participantes.

### 14.2 Presença

- presença integral depende de tempo de sala e tempo de câmera ligada;
- presença parcial depende de participação insuficiente para presença integral;
- regras devem ser configuráveis por tenant futuramente, mas podem nascer com padrão global no MVP.

### 14.3 Engajamento

- tempo fora da aba impacta indicadores de engajamento;
- esse indicador é informativo e operacional, não probatório;
- feature pode ser habilitada ou desabilitada por tenant.

### 14.4 Trilhas

- pertencem a grupos/turmas no MVP;
- podem ter pré-requisitos;
- podem ser lineares ou flexíveis;
- suportam múltiplos tipos de conteúdo.

### 14.5 Conteúdo

- o usuário visualiza, mas não baixa, no MVP;
- conteúdo pode ter versões;
- conclusão de vídeo/documento segue regras objetivas.

### 14.6 Gamificação

- individual no MVP;
- baseada em progresso, conclusão e desempenho.

---

## 15. Modelo inicial de dados (alto nível)

Entidades sugeridas:

- Tenant
- TenantBranding
- User
- IdentityLink
- Membership
- Role
- Permission
- Group
- GroupLeader
- GroupMember
- LearningPath
- Module
- Lesson
- LessonContent
- LessonVersion
- Meeting
- MeetingParticipant
- MeetingAttendance
- MeetingEngagement
- ReminderPolicy
- ReminderDispatch
- Quiz
- QuizQuestion
- QuizAttempt
- ProgressRecord
- GamificationProfile
- AuditLog
- FileObject
- RecordingAsset

---

## 16. Privacidade, segurança e LGPD

### 16.1 Dados pessoais previstos no MVP

Somente dados básicos, como:

- nome;
- e-mail;
- vínculo com tenant/grupo;
- dados de acesso;
- dados de uso e progresso;
- registros de sessão e presença.

### 16.2 Requisitos obrigatórios

- política de privacidade;
- termos de uso;
- transparência sobre coleta de métricas de sessão;
- base legal mapeada por operação;
- exportação de dados;
- exclusão quando aplicável;
- trilha de consentimento quando necessário;
- RIPD inicial.

### 16.3 Ponto sensível do produto

O monitoramento de foco/aba deve ser tratado com cuidado jurídico e de UX. É necessário deixar claro:

- que o sistema pode detectar perda de foco/ocultação da página;
- para qual finalidade esse dado é utilizado;
- se isso impacta presença/engajamento;
- como esse tratamento pode ser habilitado ou desabilitado por tenant.

---

## 17. Relatórios do MVP

### 17.1 Relatórios por reunião

- lista de presentes;
- percentual de presença;
- câmera ligada por usuário;
- tempo fora da aba por usuário;
- presença integral/parcial;
- resumo da sessão;
- link da gravação, se houver.

### 17.2 Relatórios por trilha

- número de matriculados;
- progresso médio;
- taxa de conclusão;
- evasão;
- nota média de avaliações.

### 17.3 Relatórios por usuário

- progresso individual;
- pontos e nível;
- histórico de presença;
- histórico de quizzes;
- ranking individual no tenant/grupo.

### 17.4 Relatórios por líder/admin

- engajamento por grupo;
- participantes em risco de evasão;
- grupos com maior/menor adesão;
- performance de trilhas.

---

## 18. Roadmap sugerido

### Fase 1 — Fundação

- autenticação e multi-tenant base;
- grupos/turmas;
- trilhas e conteúdos;
- upload e visualização;
- dashboards básicos;
- auditoria base.

### Fase 2 — Reuniões ao vivo

- módulo de reuniões;
- presença;
- engajamento;
- waiting room;
- gravação;
- relatórios pós-reunião.

### Fase 3 — Automações

- lembretes via WhatsApp;
- alarmes configuráveis;
- logs de envio/entrega;
- recorrência operacional.

### Fase 4 — Avaliação e gamificação

- quiz;
- avaliações;
- progresso;
- pontos;
- níveis;
- ranking.

### Fase 5 — IA aplicada

- geração de quiz baseada no conteúdo;
- busca semântica;
- insights de retenção e engajamento.

---

## 19. Riscos e mitigação

### 19.1 Vídeo ao vivo com gravação

**Risco:** gravação em videoconferência aumenta custo e complexidade operacional.  
**Mitigação:** separar a infraestrutura de gravação da de reuniões, com capacidade controlada e política clara de retenção.

### 19.2 1 VPS por tenant desde o início

**Risco:** custo operacional alto e provisionamento mais lento.  
**Mitigação:** usar arquitetura híbrida com shared tier + dedicated tier.

### 19.3 WhatsApp como único canal de lembrete

**Risco:** dependência de opt-in, templates, aprovação e custos do provedor.  
**Mitigação:** modelar Notification Service com adaptadores para adicionar outros canais depois.

### 19.4 Métrica de “tempo fora da aba”

**Risco:** interpretação equivocada como atenção real.  
**Mitigação:** comunicar como indicador técnico e permitir feature toggle por tenant.

### 19.5 Microserviços desde o dia 1

**Risco:** aumento de complexidade operacional no MVP.  
**Mitigação:** usar poucos bounded contexts iniciais, contratos claros e EDA enxuta, evitando fragmentação excessiva.

---

## 20. Decisões já tomadas neste PRD

1. Produto multi-tenant desde o MVP.
2. Possibilidade de white-label dependendo do contrato.
3. Login por e-mail/senha e Google.
4. Um usuário pode pertencer a múltiplos tenants.
5. Controle granular de permissões é obrigatório.
6. Trilhas serão por grupo/turma.
7. Reuniões serão criadas manualmente.
8. WhatsApp será o canal inicial de lembretes.
9. Haverá relatório de presença, engajamento, progresso, evasão, conclusão e adesão por trilha.
10. Haverá auditoria completa desde o MVP.
11. Haverá retenção de relatórios, logs, gravações e notificações.
12. Haverá requisitos iniciais de LGPD e RIPD.

---

## 21. Itens em aberto para próxima iteração do PRD

1. Definir prazo alvo do MVP (`12.50` não informado).
2. Definir política de retenção com prazos exatos para:
   - gravações;
   - logs;
   - eventos de presença;
   - notificações;
   - arquivos versionados.
3. Definir se o ranking será por grupo, tenant ou ambos.
4. Definir fórmula do score de engajamento.
5. Definir se quizzes por IA terão revisão humana obrigatória antes da publicação.
6. Definir pacote mínimo de branding/white-label por plano comercial.
7. Definir se o modo shared tier terá limites por tenant.
8. Definir se haverá provisionamento automático de tenant no futuro.

---

## 22. Recomendação final de produto para início do projeto

Para iniciar com menor risco e maior aderência ao que foi pedido, a recomendação é:

- começar com **MVP web-first**;
- usar **Jitsi self-hosted embarcado** como reunião própria do produto no MVP;
- estruturar **control plane + tenant plane**;
- manter **microserviços enxutos**, evitando fragmentação exagerada;
- usar **NATS + PostgreSQL + Redis + MinIO** como base de backend;
- manter **Keycloak** como identidade central;
- deixar **pgvector habilitado** desde o início para IA futura;
- tratar **tempo fora da aba** como proxy técnico de engajamento;
- preparar desde já trilha de auditoria, consentimento e LGPD.

---

## 23. Próximo artefato recomendado

Com base neste PRD, o próximo documento ideal é um destes:

1. **`architecture.md`** — desenho técnico detalhado por serviço, bancos, eventos e deploy.
2. **`mvp-scope.md`** — backlog fechado da versão 1 com prioridades P0/P1/P2.
3. **`domain-model.md`** — entidades, agregados, relacionamentos e regras.
4. **`delivery-plan.md`** — plano de execução por sprints.

