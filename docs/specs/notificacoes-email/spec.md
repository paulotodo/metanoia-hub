# Feature Spec: Notificações por Email via Resend

**Short name**: `notificacoes-email`  
**Status**: Clarified  
**Data**: 2026-06-21  
**FR principal**: FR77  
**NFRs**: NFR-I1 (operação continua 30min sem provedor), NFR-I2 (retry com backoff), NFR-I3 (timeouts explícitos)  
**Fonte primária**: `_bmad-output/implementation-artifacts/14-3-notificacoes-por-email-via-resend-fr77-nfr-i1i2i3.md`  
**Dependências**: Story 14-1 (canal in-app + BullMQ — DONE), Story 14-4 (health-check/circuit-breaker — NÃO done → integração via abstração-stub), Epic 6 (branding do tenant — DONE)

---

## Clarifications

### Session 2026-06-21

- Q: O limite diário de 100 emails é hardcoded ou configurável por tenant? → A: Hardcoded como constantes `EMAIL_DAILY_LIMIT=100` e `EMAIL_RATE_THRESHOLD=80`; Lua script recebe o limite como argumento permitindo configurabilidade pós-MVP sem reestruturar.
- Q: `content_new` deve coexistir com `content_update` ou substituí-lo? → A: Coexistem. `content_update` mantém semântica de atualização de conteúdo existente; `content_new` é para disponibilização de novo conteúdo pela primeira vez. Rate limiter trata ambos como tipos não-críticos deferríveis.
- Q: Qual o remetente padrão quando tenant não tem sender configurado? → A: Variável de ambiente `EMAIL_DEFAULT_FROM` (ex: `notifications@metanoia.app`); domínio deve ser verificado no Resend antes do deploy. Implementação lê da env com fallback para constante.
- Q: TTL do rate counter é reset à meia-noite UTC ou TTL fixo de 24h? → A: TTL calculado como segundos até próxima meia-noite UTC (não TTL fixo). Chave `{YYYYMMDD}` implica semântica de dia-calendário; Lua script calcula `TTL = seconds_until_midnight_utc`.


## Contexto & Motivação

O metanoia-hub já entrega notificações in-app em tempo real via SSE (Story 14-2a) e
exibe o centro de notificações na UI (Story 14-2b). Entretanto, quando o participante
ou líder não está com a plataforma aberta, alertas críticos (risco pastoral, lembrete
de reunião, relatório pronto) chegam tarde ou não chegam.

Esta feature completa o canal email do sistema de notificações: o canal de entrega
por email `EmailChannel` substitui o stub da Story 14-1 por uma implementação real
integrada ao Resend, com comportamento resiliente (retry, fallback, rate limiting,
circuit breaker via abstração integrável à Story 14-4).

---

## User Stories (priorizadas)

### P1 — Receber email de alerta pastoral

**Como** líder de grupo,  
**quero** receber um email quando o sistema detectar que um participante precisa de
cuidado (sinal de risco),  
**para que** eu seja notificado mesmo que não esteja com a plataforma aberta.

**Acceptance scenarios**:
- Alerta pastoral disparado → email chega ao líder em até 1 minuto
- Subject identifica o grupo e indica urgência
- Email contém nome do participante, motivo do risco e link direto para o Radar
- Email usa logo e cores do tenant quando disponíveis (Epic 6); sem branding configurado, usa visual padrão
- Se o envio falhar 3 vezes consecutivas, líder recebe notificação in-app como fallback com link equivalente
- Edge case: Resend indisponível → fallback in-app imediato; nenhuma tentativa de email fica silenciosa

### P2 — Receber lembrete de reunião por email

**Como** participante de um grupo,  
**quero** receber um email de lembrete quando uma reunião estiver próxima,  
**para que** eu não perca encontros mesmo estando com o app fechado.

**Acceptance scenarios**:
- Lembrete enviado antes da reunião com data, horário e link de acesso
- Participante NUNCA perde o lembrete: se email for diferido pelo rate limiter, um fallback in-app imediato é criado automaticamente — não há caso em que o aviso não chegue
- Edge case: participante fora do range de envio de email diário → recebe notificação in-app automaticamente com o mesmo conteúdo

### P3 — Receber email quando relatório exportado estiver pronto

**Como** admin ou líder,  
**quero** receber um email com o link de download quando uma exportação de relatório
estiver concluída,  
**para que** eu acesse o arquivo sem precisar monitorar a plataforma.

**Acceptance scenarios**:
- Email contém link de download seguro com validade de 1 hora
- Após expiração do link, a notificação in-app permanece disponível com opção de regenerar
- Email nunca contém o arquivo em anexo — apenas o link assinado

### P4 — Receber email sobre nova trilha disponível

**Como** participante,  
**quero** ser notificado por email quando uma nova trilha de formação estiver disponível
para meu grupo,  
**para que** eu saiba que tenho novo conteúdo de crescimento.

**Acceptance scenarios**:
- Email contém título da trilha, breve descrição e link direto para começar
- Este tipo de notificação é considerado não-crítico: se o limite diário de envio estiver próximo (80/100), é diferido para o próximo dia
- Diferimento registrado; participante não recebe email duplicado no dia seguinte se já tiver visto a notificação in-app

### P5 — Visibilidade quando o limite diário de emails se aproxima (admin)

**Como** admin do tenant,  
**quero** receber uma notificação in-app quando o volume diário de emails se aproximar
do limite,  
**para que** eu possa planejar ou fazer upgrade antes de impactar os usuários.

**Acceptance scenarios**:
- Notificação in-app criada quando o contador diário atingir 80 de 100
- Mensagem informa quantos emails foram enviados e o limite total
- Notificação não é repetida a cada envio — apenas uma por threshold por dia

---

## Functional Requirements

### Canal de entrega por email

**FR-01** — O sistema deve entregar notificações por email via provedor externo com
suporte a templates por tipo de notificação (alertas pastorais, lembretes, exportações,
conteúdo novo).

**FR-02** — Cada template deve incluir branding do tenant (logo e cores) quando
configurado; na ausência de branding, usa identidade visual padrão da plataforma.

**FR-03** — O canal de email deve aplicar timeouts explícitos à comunicação com o
provedor externo: conexão em no máximo 3 segundos, leitura em no máximo 10 segundos
(NFR-I3).

**FR-04** — O isolamento multi-tenant deve ser garantido: cada notificação de email
usa o contexto do tenant correto (logo, identidade visual, remetente configurado);
nenhuma cross-tenant data leak é tolerada. Quando o tenant não tiver remetente
customizado, o sistema usa o remetente padrão da plataforma definido pela variável
de ambiente `EMAIL_DEFAULT_FROM` (ex: `Metanoia <notifications@metanoia.app>`),
cujo domínio deve estar verificado no Resend antes do deploy.

### Resiliência e continuidade (NFR-I1, NFR-I2)

**FR-05** — Falhas transitórias na entrega (timeout, erro 5xx do provedor) devem
disparar retry automático com backoff exponencial (3 tentativas).

**FR-06** — Após esgotamento das 3 tentativas de retry, o sistema deve criar
automaticamente uma notificação in-app equivalente como fallback, garantindo que a
informação chegue ao destinatário por pelo menos um canal (NFR-I1: operação continua
sem o provedor de email).

**FR-07** — A notificação original deve ser atualizada com status `failed` e registro
do motivo da falha (`metadata.failureReason`) para auditoria.

**FR-08** — Jobs com falha permanente devem ser retidos para inspeção (não removidos
automaticamente da fila).

### Rate limiting

**FR-09** — O sistema deve manter um contador diário de emails enviados por tenant,
verificado atomicamente antes de cada envio. O limite diário é definido pela constante
`EMAIL_DAILY_LIMIT=100`, configurável via variável de ambiente para evolução pós-MVP.

**FR-10** — Quando o contador atingir o threshold de alerta (constante `EMAIL_RATE_THRESHOLD=80`, configurável via env var) dos `EMAIL_DAILY_LIMIT=100` envios diários:
- Emails de tipo `content_new` são diferidos para o próximo dia
- Emails de tipo `meeting_reminder` são diferidos mas geram fallback in-app imediato
- Emails críticos (`pastoral_alert`, `export_ready`, emails de sistema) continuam sendo
  enviados independentemente do contador
- Admin recebe notificação in-app de alerta de limite (uma por threshold por dia)

**FR-11** — A verificação do contador deve ser atômica para evitar race conditions
em envios concorrentes (dois processos simultâneos não podem ultrapassar o limite).

### Circuit breaker e integração com health-check

**FR-12** — O sistema deve detectar indisponibilidade prolongada do provedor de email
(mais de 5 minutos consecutivos de falha) e entrar em modo de contingência: todas as
novas notificações de email são automaticamente redirecionadas para in-app.

**FR-13** — Ao entrar em modo de contingência, o sistema deve emitir um evento de
domínio sinalizando a abertura do circuit breaker.

**FR-14** — O circuit breaker deve fechar automaticamente após 3 verificações de saúde
consecutivas com sucesso do provedor, retomando o envio de emails para novas
notificações.

**FR-15** — Notificações diferidas durante o período de contingência **não** devem ser
reenviadas após a recuperação (evitar rajada de emails tardios).

**FR-16** — A integração com o mecanismo de health-check (Story 14-4, ainda não
implementada) deve ser feita via abstração: o canal de email depende de uma interface
de verificação de saúde que pode ser satisfeita por um stub até que a Story 14-4
implemente a versão real. O ponto de integração pendente deve ser documentado no código.

### Rastreabilidade e auditoria

**FR-17** — Toda tentativa de envio deve ser rastreável: notificação criada com status
`pending`, atualizada para `sent` em sucesso ou `failed` após esgotamento de retries.

**FR-18** — Metadados de falha (`failureReason`) devem ser persistidos na notificação
para permitir diagnóstico post-mortem sem acesso a logs externos.

---

## Key Entities

**Notification** (existente — estendida por esta feature):
- `id` — identificador único (UUID v7)
- `tenant_id` — isolamento multi-tenant (RLS obrigatório)
- `user_id` — destinatário
- `type` — tipo da notificação: `pastoral_alert`, `meeting_reminder`, `export_ready`, `content_new`, `system`
- `channel` — canal de entrega: `email` | `in_app`
- `status` — `pending` → `sent` | `failed` (→ fallback in-app criado)
- `metadata` — JSON livre para `failureReason`, `actionUrl`, `signedUrl`, etc.

> Nota: os tipos `export_ready` e `content_new` precisam ser **adicionados** (não substituem tipos existentes)
> ao enum `NotificationType` em `packages/types` (atualmente: `pastoral_alert`,
> `group_message`, `content_update`, `meeting_reminder`, `system`). `content_update`
> permanece com semântica de atualização de conteúdo existente; `content_new` é para
> disponibilização de novo conteúdo pela primeira vez. O rate limiter trata ambos como
> tipos não-críticos deferríveis (FR-10).

**EmailRateCounter** (novo — estado Redis, não persistido em banco):
- Chave: `rate:email:{tenantId}:{YYYYMMDD}`
- Valor: contador inteiro, incrementado atomicamente via Lua script
- TTL: calculado como segundos até a próxima meia-noite UTC (`EXPIREAT`), não TTL fixo de 86400s — garante reset exato por dia-calendário alinhado com a chave `{YYYYMMDD}`

**CircuitBreakerState** (novo — estado gerenciado via abstração health-port):
- Estado: `closed` (funcionando) | `open` (contingência)
- Contador de checks saudáveis consecutivos para fechamento
- Timestamp de abertura (para detectar 5 minutos de indisponibilidade)

---

## Success Criteria

**SC-01** — 100% dos alertas pastorais são entregues (email ou fallback in-app) em
até 1 minuto após o disparo; nenhum alerta crítico é silenciado.

**SC-02** — Nenhum participante perde um lembrete de reunião: quando o email é diferido
pelo rate limiter, a notificação in-app equivalente é criada no mesmo instante.

**SC-03** — O sistema mantém entrega contínua por 30 minutos após indisponibilidade
total do provedor de email, usando fallback in-app (NFR-I1).

**SC-04** — Envios concorrentes nunca ultrapassam o limite diário configurado; a
atomicidade do contador é garantida sob carga de requisições simultâneas.

**SC-05** — O circuit breaker fecha automaticamente após recuperação do provedor sem
intervenção manual, retomando o fluxo normal para novas notificações.

**SC-06** — Templates de email com branding do tenant são validados por snapshot tests:
nomes com acentos, URLs longas e tenant sem logo configurado todos produzem output
correto e sem truncamento.

**SC-07** — A integração com o health-check (Story 14-4) é feita via interface
abstraída; trocar o stub pela implementação real não requer alteração no código do
canal de email.

---

## Decisões de Infraestrutura

**FR-INFRA-SCHED**: não aplicável — o canal de email é ativado por eventos (jobs BullMQ);
não há scheduling periódico próprio.

**FR-INFRA-LOCK**: atomicidade do rate counter via Lua script Redis (INCR + comparação
em única operação); sem lock distribuído separado necessário.

**FR-INFRA-IDEMP**: idempotência por `notificationId` no job BullMQ; re-enqueue do mesmo
job não cria nova notificação (jobId baseado em digest:userId:type:bucket para tipos não-críticos;
`notificationId` como chave para alertas imediatos).

**FR-INFRA-REFRESH**: não aplicável — sem token externo com TTL a gerenciar.

**Ponto de integração pendente (Story 14-4)**: o circuit breaker desta feature depende
de uma interface `EmailHealthPort` que a Story 14-4 implementará. Até lá, um stub sempre
retorna `healthy`, desabilitando efetivamente o circuit breaker no ambiente de desenvolvimento.
A interface deve ser documentada e testada de forma independente.

---

## Fora de Escopo

- Interface de configuração do remetente (sender name/email) por tenant — Post-MVP
- Unsubscribe / gestão de preferências de email por usuário — Post-MVP
- Templates de email configuráveis pelo admin via UI — Post-MVP
- Envio de emails em lote (bulk) ou campanhas — fora do escopo deste produto
- Monitoramento de bounce / hard bounce handling — Post-MVP
- Suporte a múltiplos provedores de email (apenas Resend nesta feature)
- Canal WhatsApp (Post-MVP separado)
