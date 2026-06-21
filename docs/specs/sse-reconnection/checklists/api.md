# API Checklist: SSE Reconnection & Gap Fill

**Purpose**: Validar a qualidade dos requisitos da camada de API — filtro `since`, contratos Zod, error handling, RLS e observabilidade — antes da implementação.
**Created**: 2026-06-21
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [contracts/notifications-since.md](../contracts/notifications-since.md)

## Contratos e Schemas

- [x] CHK001 - O formato do parâmetro `since` (ISO 8601) está definido no contrato de request? [Completude, Spec §FR-015] {auto}
  > _Evidência_: FR-015 define `since` como ISO 8601; plan §Backend passo 1 define `z.string().datetime().optional()` no `NotificationsQuerySchema` de `packages/types`.

- [x] CHK002 - O schema Zod de `NotificationsQuerySchema` é compartilhado FE/BE (única fonte de verdade, sem duplicação inline)? [Consistência, Spec §FR-017] {auto}
  > _Evidência_: plan §Backend passo 2 especifica explicitamente remover o schema inline do controller e importar de `@metanoia/types`; FR-017 impõe schema compartilhado.

- [x] CHK003 - O snapshot test do schema Zod é atualizado para incluir `since`? [Completude, plan §Backend passo 1] {auto}
  > _Evidência_: plan §Backend passo 1 menciona "atualizar snapshot test"; arquivo `packages/types/src/__tests__/notification.snapshot.spec.ts` listado no Project Structure.

- [x] CHK004 - A resposta de sucesso mantém o envelope `{data, meta}` inalterado após a adição do filtro `since`? [Consistência, Spec §FR-016, plan §Constitution Check IV] {auto}
  > _Evidência_: plan Constitution Check IV: "envelope `{data,meta}` inalterado". O filtro `since` é aplicado na query, não no shape da resposta.

- [x] CHK005 - O contrato de URL do gap-fill (`?since={lastReceivedAt}&status=unread`) está documentado como fonte da verdade? [Completude, Spec §FR-010] {auto}
  > _Evidência_: `contracts/notifications-since.md` listado no Project Structure; plan §Convenções de Borda documenta `since`/`status`/`perPage` como query params camelCase.

## Error Handling

- [x] CHK006 - O código HTTP de erro para `since` com formato inválido está especificado (400)? [Completude, Spec §FR-019] {auto}
  > _Evidência_: FR-019: "parâmetro `since` inválido (formato não-ISO 8601) DEVE resultar em resposta 400". Enforçado via `ZodValidationPipe`.

- [x] CHK007 - A mensagem de erro 400 para `since` inválido é definida como segura para exibição ao usuário final? [Clareza, Spec §FR-019] {auto}
  > _Evidência_: FR-019 especifica "mensagem de erro clara". O `ZodValidationPipe` emite `{ statusCode, error, message, details? }` — sem stack trace para o frontend (CLAUDE.md §API Contracts).

- [x] CHK008 - O comportamento com `since` futuro (lista vazia) está especificado no cenário de teste? [Cobertura, Spec §US3 AC1, plan §Backend passo 4] {auto}
  > _Evidência_: spec US3 Independent Test: "Testar com timestamp futuro → lista vazia". plan §Backend passo 4: "integration (controller spec) para `since` válido/inválido/futuro/ausente".

- [x] CHK009 - O comportamento quando `since` está ausente (compatibilidade backward) está especificado? [Cobertura, Spec §US3 AC3] {auto}
  > _Evidência_: spec US3 AC3: "quando `since` não é fornecido, o comportamento é idêntico ao atual (sem filtro de timestamp)". plan §Backend passo 3: filtro aplicado apenas quando `since` está presente.

- [ ] CHK010 - A resposta de erro do gap-fill (falha de rede durante o fetch) está especificada com código HTTP e payload concreto? [Completude, Spec §Edge Cases] {humano}
  > _Nota_: spec §Edge Cases define que "a falha é silenciosa para o usuário" e as notificações não são recuperadas, mas não especifica o código de erro HTTP nem o payload de erro retornado pelo backend nesse cenário (timeout, 503, etc.). Decisão do dono do produto sobre o nível de detalhe necessário.

## Autenticação e Autorização

- [x] CHK011 - O filtro `since` respeita o isolamento de tenant (RLS) sem necessidade de configuração adicional? [Completude, Spec §FR-018, plan §Constitution Check I] {auto}
  > _Evidência_: FR-018: "filtro se aplica apenas às notificações do inquilino do usuário autenticado". plan Constitution Check I: "filtro `since` ortogonal ao RLS; `withTenantTx` mantido".

- [x] CHK012 - A política de autenticação do endpoint (token Keycloak via query string para SSE) está documentada? [Clareza, plan §Convenções de Borda, Spec §Edge Cases] {auto}
  > _Evidência_: spec §Edge Cases (401): "a conexão SSE reutiliza o endpoint de 14-2a com o mesmo mecanismo de token por query string". plan §5 (hook): "NUNCA logar a URL (contém `?token=`)".

- [x] CHK013 - O requisito de não expor o token SSE em logs está especificado? [Completude, Spec §Edge Cases, OWASP M1] {auto}
  > _Evidência_: spec §Edge Cases: "A reconexão não deve logar a URL (contém token)". plan §5 hook: "NUNCA logar a URL (contém `?token=`)". Alinhado com finding M1 do OWASP gate.

- [x] CHK014 - O tratamento diferenciado de 401 (token expirado) versus falha transitória de rede está especificado? [Completude, Spec §Edge Cases, OWASP M2] {auto}
  > _Evidência_: spec §Edge Cases: "O fluxo de reconexão deve respeitar erros de autenticação sem expor o token em logs". Finding M2 do OWASP gate reforça necessidade de não entrar em loop com credencial morta. FR-001 define reconexão automática, mas o comportamento em 401 precisa discriminar: ver CHK015.

- [ ] CHK015 - Está especificado que em 401 o sistema interrompe o loop de reconexão (não tenta indefinidamente com credencial morta)? [Completude, OWASP M2] {humano}
  > _Gap_: spec §Edge Cases menciona "respeitar erros de autenticação" mas não define explicitamente que um 401 interrompe o backoff exponencial e aciona um fluxo de re-autenticação (vs. apenas log silencioso). Decisão de produto: redirecionar para login? exibir aviso específico "Sessão expirada"? Sem essa definição, a implementação pode entrar em loop com token morto.

## Bind Parametrizado e Injeção

- [x] CHK016 - O requisito de bind parametrizado posicional para `since` (não interpolação de string) está explícito? [Completude, OWASP L1, plan §Backend passo 3] {auto}
  > _Evidência_: plan §Backend passo 3: "adicionar `AND created_at > $N::timestamptz` (bind posicional, nunca interpolado) ao SELECT e ao COUNT". Finding L1 do OWASP gate confirmado como requisito de implementação.

- [x] CHK017 - O requisito de renumeração posicional cuidadosa dos parâmetros (quando outros params existem antes de `since`) está documentado? [Clareza, OWASP L1, contracts/notifications-since.md] {auto}
  > _Evidência_: finding L1 do OWASP gate: "`since` como bind parametrizado (não interpolar); renumeração posicional cuidadosa". contracts/notifications-since.md documenta o contrato.

## RLS e Multi-tenância

- [x] CHK018 - O teste de RLS para isolamento cross-tenant sob filtro `since` está especificado (2× no CI)? [Cobertura, OWASP L2, plan §Backend passo 4] {auto}
  > _Evidência_: plan §Backend passo 4: "RLS spec para isolamento sob `since`". Finding L2 do OWASP gate: "teste RLS asseverando não-vazamento cross-tenant sob `since`, rodando 2× no CI". Arquivo alvo: `apps/api/test/rls/notifications.rls-spec.ts`.

- [x] CHK019 - O userId é obtido via `RequestContext` (AsyncLocalStorage), sem ser passado como parâmetro de função? [Completude, CLAUDE.md §Multi-tenancy, plan §Constitution Check I] {auto}
  > _Evidência_: plan Constitution Check I: "`userId` do RequestContext (BOLA-safe). Sem novo `tenant_id` em parâmetro." CLAUDE.md §Multi-tenancy: "Never pass tenant_id as function parameter".

## Paginação e Filtros

- [x] CHK020 - Quando o gap-fill retorna mais notificações que `perPage`, a especificação cobre a necessidade de paginação/load-more? [Cobertura, OWASP L3, Spec §Edge Cases] {auto}
  > _Evidência_: finding L3 do OWASP gate: "gap-fill completo quando nº de perdidas > perPage (paginação/load-more)". Spec §Edge Cases não cobre explicitamente esse caso — ver CHK021.

- [ ] CHK021 - Está especificado o comportamento do gap-fill quando o número de notificações perdidas excede `perPage` (primeira página apenas vs. fetch paginado completo)? [Completude, OWASP L3] {humano}
  > _Gap_: finding L3 do OWASP gate aponta que o gap-fill precisa de tratamento quando as notificações perdidas > perPage. A spec descreve apenas o caso feliz (merge + dedup). Decisão de produto: buscar todas as páginas sequencialmente? carregar apenas a primeira e exibir "N notificações podem estar faltando"? A ausência dessa especificação pode causar perda silenciosa de notificações em outages longos.

## Observabilidade

- [ ] CHK022 - Requisitos de logging estruturado para o path do filtro `since` (sucesso, erro, latência) estão definidos? [Cobertura, Gap] {humano}
  > _Gap_: spec e plan não definem requisitos de observabilidade específicos para o filtro `since` (métricas de latência, taxa de erro 400, etc.). Feature de infraestrutura — nível de cobertura de monitoring é decisão de produto/SRE.

## Notes

- Items `{auto}` resolvidos com `[x]` incluem citação da seção da spec/plan que sustenta a conclusão.
- Items `{humano}` aguardam decisão do dono do produto antes de `/create-tasks`.
- Gaps abertos (`[Gap]`) em CHK010, CHK015, CHK021, CHK022 devem virar tarefas de definição de requisito.
