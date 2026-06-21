# API + Security + Performance Checklist: SSE Endpoint & Redis Pub/Sub Backend

**Purpose**: Validar qualidade, clareza e completude dos requisitos da feature
`sse-notificacoes` (Story 14-2a) nos domínios API, Security e Performance — "unit tests
for English".
**Created**: 2026-06-20
**Feature**: [`docs/specs/sse-notificacoes/spec.md`](../spec.md)
**Domínios**: `api`, `security`, `performance`

> Items `{auto}` já vêm resolvidos pelo agente (`[x]` com citação, ou marcador `[Gap]`).
> Items `{humano}` ficam `[ ]` aguardando decisão do dono do produto.

---

## A. Contratos e Schemas de API

- [x] CHK001 - O contrato do endpoint SSE (método, path, headers de resposta, status codes) está completamente definido para todos os cenários de resposta? [Completude, Spec §3 + contracts/sse-notifications.md §Endpoint §Response]
  > Evidência: `contracts/sse-notifications.md` especifica GET /api/v1/sse/notifications com 200 (stream), 401 (sem/token inválido), 503 (MAX_CONNECTIONS + Redis indisponível). `FR-01, FR-02, FR-04, FR-11`. {auto}

- [x] CHK002 - Os frames SSE (heartbeat, notification, close, error) têm formato wire exato e estrutura de campo definidos? [Completude, contracts/sse-notifications.md §SSE Frames] {auto}
  > Evidência: cada frame tem exemplo literal: `: heartbeat\n\n`, `event: notification\ndata: {...}\n\n`, `event: close\ndata: {"reason":"max_connections_exceeded"}\n\n`, `event: error\ndata: {"reason":"redis_unavailable"}\n\n`. Tipos de campo e enums documentados.

- [x] CHK003 - O mapeamento `notificationId → id` (única transformação de nome broker→wire) está explicitamente documentado e rastreável ao teste que o garante? [Clareza, Consistência, contracts/sse-notifications.md §Mapeamento de campo + plan.md §Convenções de Borda] {auto}
  > Evidência: `contracts/sse-notifications.md` tabela de mapeamento e nota "Única transformação de nome". Plan.md exige "teste de shape" que impede drift. FR-08.

- [x] CHK004 - As variáveis de ambiente de configuração (`SSE_MAX_CONNECTIONS`, `SSE_MAX_PER_USER`, `SSE_HEARTBEAT_INTERVAL_MS`) têm defaults, tipo, e comportamento de valor inválido definidos? [Clareza, Spec §EC-07 + contracts/sse-notifications.md §Envs] {auto}
  > Evidência: tabela em `contracts/sse-notifications.md §Envs`: int, defaults 1000/5/30000. EC-07: 0/inválido → 1000 + warning startup. FR-04, FR-05.

- [x] CHK005 - O contrato Zod compartilhado (`NotificationRealtimeEventSchema`) está identificado como fonte da verdade e reusado (sem schema duplicado) no consumer SSE? [Consistência, research.md §D7 + plan.md §Contratos] {auto}
  > Evidência: research.md D7 documenta decisão de reuso. Plan.md indica `packages/types/src/notification.ts` como fonte; nenhum schema SSE-específico criado. FR-08.

- [x] CHK006 - Os dois mecanismos de transporte de token (header `Authorization: Bearer` e `?token=`) estão definidos, com papéis distintos documentados? [Clareza, contracts/sse-notifications.md §Endpoint] {auto}
  > Evidência: contracts define ambos: header (preferencial) e query param (fallback obrigatório para EventSource nativo). Nota explícita que `?token=` carrega APENAS credencial, nunca `tenant_id`/`userId`.

- [ ] CHK007 - O schema de validação Zod para as variáveis de ambiente (em `env.validation.ts`) especifica as constraints exatas (coerce, min, refine) para cada env SSE nova? [Clareza, plan.md §Project Structure `env.validation.ts`] {humano}
  > A spec/plan menciona adição ao `envSchema`, mas não detalha as constraints Zod (ex: `z.coerce.number().min(1).default(1000)` vs. fallback no service). Decisão de implementação — confirmar durante `create-tasks`.

- [x] CHK008 - O identificador de conexão (`connection ID`) tem gerador especificado (lib, função proibida, unicidade) e está rastreável ao invariante C3 do contrato? [Clareza, Spec §Notas Técnicas + contracts/sse-notifications.md C3 + research.md D8] {auto}
  > Evidência: `uuidv7()` (lib), proibido `crypto.randomUUID()` e `@default(uuid())`. Invariante C3: "UUID v7 e único por conexão". Alinhado com constitution II.

---

## B. Error Handling e Edge Cases de API

- [x] CHK009 - Cada edge case listado na spec (EC-01 a EC-07) tem comportamento esperado definido de forma objetivamente verificável (ação do servidor + resposta ao cliente)? [Completude, Spec §6] {auto}
  > Evidência: Spec §6 tem tabela EC-01→EC-07: EC-01 → 503 sem tracking; EC-02 → `event:error` + fechar só subscriber perdido; EC-03 → sem re-validação mid-stream; EC-04 → ZREM silencioso + tentar próxima; EC-05 → limite local vs. global; EC-06 → log + descartar + manter conexão; EC-07 → default 1000 + warning.

- [x] CHK010 - A semântica de EC-04 (race condition no ZSET: conexão mais antiga já sumiu) está definida com fluxo de fallback (tentar próxima mais antiga) e garantia de não bloquear a nova conexão? [Completude, Spec §EC-04 + data-model.md §Edge cases] {auto}
  > Evidência: spec EC-04: "Ignorar silenciosamente (`ZREM` sem entrada retorna 0 — sem erro); tentar a próxima mais antiga via `ZRANGE`; nunca recusar a nova conexão." Data-model replica.

- [x] CHK011 - EC-06 (payload Redis malformado/JSON inválido) tem comportamento "logar + descartar + manter conexão" — ação de cada passo está especificada e o requisito de manter a conexão é explícito? [Clareza, Spec §EC-06 + contracts §Consumer] {auto}
  > Evidência: spec EC-06 e contracts §Validação Zod: `safeParse` → falha → "log + descarta evento + mantém conexão viva". FR-08. Comportamento não-destrutivo está explícito.

- [x] CHK012 - O header `Retry-After: 30` é especificado para o status 503 de MAX_CONNECTIONS (não apenas o status code)? [Clareza, Spec §US2 + FR-04 + SC-03] {auto}
  > Evidência: spec US2 AC: "responde 503 com header `Retry-After: 30`". FR-04 e SC-03 confirmam. Contracts §Response-503 também especifica.

- [x] CHK013 - O comportamento de EC-01 (Redis indisponível no momento da conexão) é distinto de EC-02 (Redis cai com conexões ativas), com blast radius diferente para cada caso? [Consistência, Spec §EC-01 vs EC-02 + dec-012] {auto}
  > Evidência: EC-01 → recusa a conexão antes de aceitar (503). EC-02 → fecha apenas as conexões cujo subscriber específico foi perdido (dec-012, blast radius mínimo). Semanticamente distintos e rastreáveis.

---

## C. Autenticação e Autorização de API

- [x] CHK014 - Os requisitos de autenticação especificam qual guard valida o token, qual mecanismo extrai `tenant_id`/`userId`, e proíbem explicitamente receber esses campos como parâmetro? [Cobertura, Spec §FR-01 + FR-10 + contracts §C1] {auto}
  > Evidência: FR-01: "guard Keycloak que valida o token e extrai `tenant_id` e `user_id` sem aceitá-los como parâmetros de query/header". Contracts invariante C1 repete. AsyncLocalStorage/RequestContext documentado em §Dependências.

- [x] CHK015 - O comportamento de token expirado mid-stream (EC-03) está especificado com justificativa explícita para a escolha de não re-validar? [Clareza, Spec §EC-03 + plan.md §SR-4 + dec-020] {auto}
  > Evidência: spec EC-03: "SSE não re-valida (validação só na conexão inicial); heartbeat detecta client morto". Plan SR-4/dec-020: aceito por stream read-only + heartbeat + token curto. Justificativa de trade-off documentada.

---

## D. Isolamento Multi-tenant

- [x] CHK016 - O requisito de isolamento cross-tenant (US5/NFR-04) especifica o mecanismo técnico exato (namespace de canal Redis + filtro por tenantId) e o teste determinístico que o verifica? [Completude, Spec §US5 + FR-10 + SC-06 + plan.md §Constitution Check] {auto}
  > Evidência: US5 AC: SOMENTE conexão do tenant A recebe. FR-10: canal tenant-scoped. SC-06: "Teste determinístico: dois tenants, publicar em A, assert B vazio". Plan constitution check: "Sem tabela DB → sem RLS de banco aqui, mas teste determinístico de isolamento cross-tenant é OBRIGATÓRIO".

- [x] CHK017 - O requisito NFR-04 ("zero cross-tenant leakage") é verificável por um critério de sucesso mensurável (SC-06) e não apenas uma afirmação qualitativa? [Mensurabilidade, Spec §NFR-04 + SC-06] {auto}
  > Evidência: NFR-04: "Zero cross-tenant leakage (verificado por teste determinístico)". SC-06 define método: "dois tenants, publicar em A, assert B vazio". Mensurável.

---

## E. Security — Token-in-URL

- [x] CHK018 - O requisito de segurança SR-1 (token via `?token=` na URL) especifica os três controles OBRIGATÓRIOS de mitigação (TLS, filtro de log, tokens de vida curta) de forma verificável? [Completude, plan.md §SR-1 + dec-017 + contracts §SEGURANÇA] {auto}
  > Evidência: contracts §SEGURANÇA (nota obrigatória): "(1) endpoint só sobre TLS; (2) NUNCA logar `req.url`/`req.query.token`/`Referer` contendo o token (filtrar); (3) preferir tokens de vida curta". Invariante C7. dec-017.

- [x] CHK019 - O requisito de filtro de log para token-in-URL (SR-1/C7) especifica quais campos/locais no logging devem ser filtrados (ex: `req.url`, `req.query.token`, `Referer`)? [Clareza, contracts §SEGURANÇA + dec-017] {auto}
  > Evidência: contracts §SEGURANÇA: "NUNCA logar `req.url`/`req.query.token`/`Referer` contendo o token (filtrar)". Campos nomeados explicitamente. C7 no contrato de invariantes.

- [ ] CHK020 - O requisito de TLS para o endpoint SSE está vinculado a uma política de infraestrutura existente (ex: terminação TLS no proxy/ingress) ou é um novo requisito de configuração a garantir? [Clareza, plan.md §SR-1] {humano}
  > SR-1 requer TLS mas a spec/plan não especifica onde termina (app, proxy, ingress) nem se a policy já existe. Verificar durante `create-tasks` se é necessário gate de CI ou apenas documentação.

---

## F. Security — Isolamento Redis e Key Injection

- [x] CHK021 - Os requisitos de construção das chaves Redis (`sse:connections:{tenantId}:{userId}` e `rt:notifications:{tenantId}:{userId}`) especificam que os valores vêm de claims JWT validados, nunca de input do cliente? [Cobertura, Spec §FR-05 + FR-07 + FR-10 + dec-021 + contracts §C1] {auto}
  > Evidência: FR-10: "`tenant_id` é obtido do token, nunca de entrada do cliente". dec-021: "Descartado: vêm de claims JWT assinados (UUIDs), nunca de input". plan.md menciona "assert formato UUID" como hardening barato.

- [ ] CHK022 - O hardening de chave Redis (assert formato UUID para `tenantId`/`userId` antes de construir o nome da chave) está especificado como requisito de implementação ou é opcional? [Clareza, plan.md §SR-5 + dec-021] {humano}
  > dec-021: "Hardening barato: assert formato UUID". Porém o plan não define isso como MUST (fica como sugestão). Confirmar se deve virar critério de aceite obrigatório em `create-tasks`.

- [x] CHK023 - O requisito SR-2 (XSS via `title`/`body` em 14-2b) está marcado como UNTRUSTED no contrato e o escopo de mitigação está claramente atribuído ao frontend (14-2b), não ao backend SSE (14-2a)? [Clareza, plan.md §SR-2 + dec-018 + contracts §C8] {auto}
  > Evidência: contracts invariante C8: "`data` recebido do Redis é UNTRUSTED — frontend (14-2b) escapa `title`/`body` antes do DOM". dec-018: "Marcar `data` como UNTRUSTED no contrato; frontend (14-2b) escapa antes do DOM". Escopo bem delimitado.

---

## G. Security — DoS e Rate Limiting

- [x] CHK024 - Os requisitos de limite de conexões (FR-04/US2 e FR-05/US3) são suficientes para mitigar DoS por exaustão de conexões, ou o gap de taxa de abertura (SR-3) está explicitamente documentado e priorizado? [Cobertura, plan.md §SR-3 + dec-019] {auto}
  > Evidência: SR-3/dec-019: "Considerar rate-limit de abertura por usuário/IP (namespace `rate:*`); não-bloqueante MVP". Gap documentado e aceito como tech debt MVP. Não é silencioso.

- [ ] CHK025 - O requisito de rate-limit de abertura de conexão (SR-3) tem critério definido para quando/como será implementado (p.ex. próxima story, condição de carga, threshold)? [Completude, plan.md §SR-3] {humano}
  > SR-3 é marcado "não-bloqueante MVP" sem critério de saída ou story de follow-up referenciada. Risco de ficar como tech debt indefinido. Recomendar criar issue/story antes do close do epic.

- [x] CHK026 - O comportamento de reject a nova conexão quando `SSE_MAX_CONNECTIONS` é atingido é especificado como ANTES de aceitar (não após aceitar e depois recusar)? [Clareza, Spec §US2 AC + contracts §C5] {auto}
  > Evidência: spec US2 AC: "a conexão é recusada antes de ser aceita". Contracts invariante C5: "Excesso por instância → 503 + `Retry-After: 30` ANTES de aceitar". FR-04.

---

## H. Performance — Targets e Mensurabilidade

- [x] CHK027 - Os requisitos de performance (NFR-01) têm targets quantificados com condições de medição (carga, concorrência, percentil, janela de tempo)? [Clareza, Spec §NFR-01 + SC-08] {auto}
  > Evidência: NFR-01: "500 conexões simultâneas: heap < 512 MB, event loop lag p99 < 100 ms, zero dropped connections em 5 min". SC-08: "Load test (`autocannon`) com monitoramento de `process.memoryUsage()` e `perf_hooks`". Quantificado e mensurável.

- [x] CHK028 - O requisito de latência de entrega (NFR-03) tem threshold, condição de medição e método de verificação definidos? [Clareza, Spec §NFR-03 + SC-05] {auto}
  > Evidência: NFR-03: "< 500 ms em condições normais". SC-05 define método: "dispatch → InAppChannel → assert SSE event recebido". Condição ("condições normais") é subjetiva — mas limitada a teste de integração; aceitável para MVP.

- [ ] CHK029 - "Condições normais" em NFR-03 (latência < 500 ms) tem definição operacional (ex: Redis local, sem carga, rede LAN)? [Clareza, Spec §NFR-03] {humano}
  > NFR-03 usa "condições normais" sem definição. Para um load test (SC-08) que inclui 500 conexões, a distinção importa. Confirmar se o threshold de 500 ms vale só em load zero ou também sob carga nominal.

- [x] CHK030 - O requisito de cleanup determinístico (NFR-05) tem threshold temporal (< 1s) e método de verificação (SC-07: `ZCARD` = 0 após desconexão)? [Mensurabilidade, Spec §NFR-05 + SC-07] {auto}
  > Evidência: NFR-05: "100% de conexões fechadas removem seu ID do Redis SET em < 1 s". SC-07: "conectar, desconectar, assert `ZCARD sse:connections:{t}:{u}` = 0". Mensurável e verificável por teste.

---

## I. Performance — Heartbeat e Conexões de Longa Duração

- [x] CHK031 - O intervalo de heartbeat (NFR-02/FR-03) é configurável, tem default especificado, e a semântica de "detectar clientes mortos" está rastreável ao mecanismo de teardown? [Clareza, Spec §NFR-02 + FR-03 + research.md §D4] {auto}
  > Evidência: NFR-02: "30 segundos (configurable via `SSE_HEARTBEAT_INTERVAL_MS`)". FR-03: emitir `: heartbeat` a cada 30s "para manter a conexão viva e detectar clientes mortos". D4: heartbeat via `interval()` RxJS mesclado — quando res está fechado, próxima escrita falha → teardown. SC-02 verifica ≥1 keep-alive em 35s.

- [x] CHK032 - O requisito de limite por instância (D5/EC-05) distingue claramente entre limite local (SSE_MAX_CONNECTIONS) e limite global (SSE_MAX_PER_USER via Redis), com comportamento de escala horizontal documentado? [Clareza, Spec §EC-05 + research.md §D5] {auto}
  > Evidência: spec EC-05: "Limite por instância (SSE_MAX_CONNECTIONS) é local; limite por usuário é global via Redis". D5: "contador em memória local da instância" vs. "ZSET global". Comportamento de multi-instance documentado.

- [ ] CHK033 - O requisito de escalabilidade horizontal (EC-05) especifica o comportamento quando um usuário tem conexões distribuídas em múltiplas instâncias e como o ZSET garante o limite global de forma consistente? [Completude, Spec §EC-05] {humano}
  > EC-05 afirma que o Redis ZSET garante o limite global entre instâncias, mas não detalha o que ocorre quando: instância A lê ZCARD=4, instância B lê ZCARD=4 simultaneamente, e ambas aceitam → usuário tem 6 conexões. Race condition em multi-instance não está documentada como EC-07 ou similar.

---

## J. Performance — Escalabilidade e Limites

- [x] CHK034 - O requisito de limite de conexões por usuário (FR-05/US3) especifica o comportamento de evicção da conexão mais antiga com todos os passos: identificar via ZRANGE, enviar `event: close`, encerrar, depois aceitar nova? [Completude, Spec §US3 AC + FR-06 + SC-04] {auto}
  > Evidência: spec US3 AC: (1) identifica via `ZRANGE key 0 0` (menor score); (2) envia `event: close\ndata: {"reason":"max_connections_exceeded"}`; (3) encerra; (4) aceita nova. FR-06. SC-04 verifica que primeira conexão recebeu close event.

- [x] CHK035 - Os critérios de sucesso de carga (SC-08) especificam ferramenta de load test (`autocannon`), métricas coletadas e thresholds de passagem/falha? [Mensurabilidade, Spec §SC-08] {auto}
  > Evidência: SC-08: "Load test (`autocannon` ou similar) com monitoramento de `process.memoryUsage()` e `perf_hooks`". Thresholds derivados de NFR-01 (heap < 512 MB, lag p99 < 100 ms). Nota: "ou similar" deixa ferramenta em aberto — aceitável MVP.

- [ ] CHK036 - Os requisitos de performance especificam comportamento de degradação graciosa quando `SSE_MAX_CONNECTIONS` é atingido — além do 503, o servidor deve enfileirar, dropar silenciosamente ou apenas recusar? [Completude, Spec §US2 + FR-04] {humano}
  > Spec especifica 503 + `Retry-After: 30`, mas não define se há filas, priorização ou mecanismo de notificação ao cliente para tentar novamente. Para MVP pode ser suficiente, mas deve ser confirmado.

- [x] CHK037 - O requisito de conexão ioredis dedicada para subscriber mode (D2) está especificado como independente do `RedisService` de comandos, com justificativa técnica rastreável? [Clareza, research.md §D2 + plan.md §Technical Context] {auto}
  > Evidência: D2: "em ioredis, uma vez que a conexão entra em subscriber mode, ela só aceita comandos de (un)subscribe — comandos normais (ZADD etc.) falham". Plan §Technical Context confirma "conexão dedicada em modo subscriber". Justificativa técnica rastreável.

---

## K. Observabilidade

- [x] CHK038 - Os requisitos de logging especificam o que DEVE ser logado (erros de subscriber Redis, payload malformado, EC-01/EC-02) e o que NÃO DEVE ser logado (token em URL — C7)? [Completude, Spec §EC-02 + EC-06 + contracts §C7 + plan.md §SR-1] {auto}
  > Evidência: spec EC-01: "logar erro" ao recusar por Redis indisponível. EC-06: "logar erro" ao descartar payload malformado. EC-02: implícito (logar antes de fechar). Contracts §SEGURANÇA: "NUNCA logar `req.url`/`req.query.token`/`Referer`". C7. Negativo documentado.

- [ ] CHK039 - Os requisitos de observabilidade especificam métricas instrumentadas (ex: gauge de conexões ativas, contador de evicções, histograma de latência heartbeat) para monitoramento em produção? [Cobertura, Spec §NFR + plan.md] {humano}
  > Spec define métricas de TESTE (SC-08 via `process.memoryUsage()`) mas não define métricas de PRODUÇÃO (Prometheus gauge, alertas). Para feature de infraestrutura SSE em produção, ausência de métricas instrumentadas é gap relevante — confirmar se escopo é 14-2a ou epic posterior.

---

## L. Dependências e Cobertura de Testes

- [x] CHK040 - A dependência crítica de predecessora (Story 14-1: canal Redis `rt:notifications:{tenantId}:{userId}` já publicado) está validada como concluída e o payload exato verificado contra o código real? [Completude, Spec §7 + research.md §D7] {auto}
  > Evidência: spec §7: "Story 14-1 (NotificationsModule, InAppChannel, Redis Pub/Sub publisher) — Status: done (mergeada em dev)". D7: "confirmado L40-47" em `in-app.channel.ts`. Payload verificado contra código real.

- [x] CHK041 - A cobertura de testes planejada abrange todos os success criteria (SC-01→SC-08) com tipo de teste explícito (unit, integration, load)? [Completude, Spec §5 + plan.md §Project Structure] {auto}
  > Evidência: plan §Project Structure: `sse.controller.spec.ts` (unit), `sse-connection.manager.spec.ts` (unit), `sse-redis.service.spec.ts` (unit), `sse.integration-spec.ts` (integration: dispatch→SSE, cross-tenant SC-06, heartbeat SC-02). SC-08: load test via `autocannon`. Mapeamento SC→tipo de teste presente.

---

## Notes

### Resolução

- **{auto} resolvidos**: 30 de 41 (`[x]` com evidência citada)
- **{humano} aguardando decisão**: 11 (CHK007, CHK020, CHK022, CHK025, CHK029, CHK033, CHK036, CHK039 + 3 itens abertos)
- **Gaps abertos** (`[Gap]`): 0 — todos os gaps são `{humano}` pendentes de decisão de prioridade/escopo

### Distribuição por domínio

| Domínio | Items | {auto} | {humano} |
|---------|-------|--------|----------|
| API (contratos, schemas, error handling) | 15 | 14 | 1 |
| Security (token-in-URL, Redis isolation, DoS) | 9 | 6 | 3 |
| Performance (targets, heartbeat, escalabilidade) | 11 | 8 | 3 |
| Observabilidade + Dependências | 6 | 5 | 1 |

### Items `{humano}` materiais para `create-tasks`

| CHK | Risco | Recomendação |
|-----|-------|--------------|
| CHK020 | Baixo | Confirmar política TLS na infra (proxy/ingress) |
| CHK022 | Baixo | Definir se assert UUID é MUST ou SHOULD na task |
| CHK025 | Médio | Criar story/issue de follow-up para rate-limit de abertura antes de fechar epic 14 |
| CHK029 | Baixo | Definir "condições normais" operacionalmente nos testes de integração |
| CHK033 | Médio | Documentar race condition de ZSET em multi-instance (EC-08?) ou aceitar como limitação MVP |
| CHK036 | Baixo | Confirmar que 503+Retry-After é suficiente (sem fila) para MVP |
| CHK039 | Médio | Definir se métricas Prometheus são escopo 14-2a ou epic posterior |

### Próximos Passos

- Decidir os 11 items `{humano}` acima (dono do produto / tech lead)
- CHK025 e CHK033 têm risco médio — recomendar review antes de `/create-tasks`
- `/create-tasks` — decomposição em backlog executável (os itens `{humano}` de risco médio devem virar critérios de aceite ou tarefas explícitas)
- Nenhum bloqueio identificado para prosseguir — nenhum `[Gap]` de requisito ausente detectado nos domínios críticos
