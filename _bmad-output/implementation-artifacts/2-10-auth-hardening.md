# Story 2.10: Auth Hardening (Audience JWT, Secret Rotation, Immutable Guard State)

Status: ready-for-dev

## Story

As a security engineer responsável pela superfície de autenticação,
I want validação de audience (`aud`) no JWT, secret do client metanoia-api parametrizado por env e estado interno do `KeycloakAuthGuard` imutável após boot,
so that tokens emitidos para outros clients (mesmo realm) não passam silenciosamente pela API, secrets de produção não vazam via realm-export, e mutações acidentais downstream (ex: tampering em `request.user.roles`) ficam estruturalmente impossíveis.

## Acceptance Criteria

**Given** o JWT emitido por Keycloak hoje contém `aud: "metanoia-web"` (vide `apps/api/src/auth/__tests__/keycloak.guard.spec.ts:36` e o client `metanoia-web` em `infra/keycloak/realm-export.json:53-114`) e o `KeycloakAuthGuard.verifyToken` (`apps/api/src/auth/keycloak.guard.ts:121-138`) faz `jwtVerify(token, this.jwks, { issuer: this.issuer })` SEM `audience` — qualquer token do mesmo realm passa, inclusive um emitido para outro app
**When** esta story é entregue
**Then** `infra/keycloak/realm-export.json` ganha um `oidc-audience-mapper` no client `metanoia-web` cuja configuração adiciona `metanoia-api` ao claim `aud` do access token:
```json
{
  "name": "audience-metanoia-api",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-audience-mapper",
  "config": {
    "included.client.audience": "metanoia-api",
    "id.token.claim": "false",
    "access.token.claim": "true"
  }
}
```
**And** o `KeycloakAuthGuard.verifyToken` passa `audience: this.expectedAudience` no `jwtVerify`, onde `this.expectedAudience` vem de `config.get('KEYCLOAK_EXPECTED_AUDIENCE', { infer: true })` populado em `onModuleInit`
**And** `apps/api/src/config/env.validation.ts` adiciona `KEYCLOAK_EXPECTED_AUDIENCE: z.string().min(1).default('metanoia-api')` ao schema `EnvConfig`
**And** `.env.example` ganha `KEYCLOAK_EXPECTED_AUDIENCE=metanoia-api` na seção `# --- Keycloak ---`
**And** unit test novo em `keycloak.guard.spec.ts` cobre: (a) JWT com `aud: 'metanoia-api'` → 200 (passa); (b) JWT com `aud: 'metanoia-web'` (token web puro, sem mapper) → 401 (`Invalid authentication token` — jose throw); (c) JWT com `aud: ['metanoia-web', 'metanoia-api']` (multi-audience após mapper aplicado) → 200; (d) JWT com `aud: 'outro-client'` → 401

**Given** o secret do client `metanoia-api` está hardcoded em `infra/keycloak/realm-export.json:125` (`"secret": "dev-secret-only-not-for-production"`) — o realm-export é versionado no repo, então o secret está exposto em qualquer fork/clone, e o valor é o MESMO em todas as instalações
**When** esta story é entregue
**Then** o `realm-export.json` substitui o valor literal por placeholder de variable substitution suportado pelo Keycloak: `"secret": "${KEYCLOAK_API_CLIENT_SECRET:dev-secret-only-not-for-production}"` (sintaxe `${ENV:default}` resolvida pelo Keycloak no boot — ver Dev Notes para confirmar suporte na versão usada)
**And** `infra/keycloak/docker-compose.keycloak.yml` (ou equivalente) passa `KEYCLOAK_API_CLIENT_SECRET` como env do container — alimentado pelo `docker-compose.yml` root da raiz do projeto a partir do `.env`
**And** o `.env.example` já tem `KEYCLOAK_API_CLIENT_SECRET=dev-secret-only-not-for-production` (verificado em `.env.example:28`) — apenas adicionar comentário acima: `# Override per environment. Dev default matches realm-export.json fallback.`
**And** `infra/keycloak/README.md` (criar se não existir) documenta o procedimento de rotation para produção: gerar secret via `openssl rand -base64 48`, exportar como `KEYCLOAK_API_CLIENT_SECRET`, reiniciar Keycloak, atualizar API env

**Given** o `KeycloakAuthGuard` tem estado interno mutável (`private jwks!: JWTVerifyGetKey; private issuer!: string; private expectedAudience!: string`) populado em `onModuleInit` e NUNCA mais deveria mudar durante o lifecycle — mas TypeScript não previne reassignment em runtime, e um bug downstream (ex: outro `onModuleInit` mal escrito) poderia silenciosamente sobrescrever esses campos
**When** esta story é entregue
**Then** ao final de `onModuleInit`, o guard chama um helper interno `freezeInitState()` que aplica `Object.defineProperty(this, 'issuer', { writable: false, configurable: false })` (e equivalente para `jwks` e `expectedAudience`) — qualquer tentativa de reassignment posterior throws em strict mode
**And** o `AuthenticatedUser` montado no `canActivate` (`apps/api/src/auth/keycloak.guard.ts:94-99`) é congelado com `Object.freeze(user)` antes de `request.user = user` — handlers downstream que tentem `req.user.roles.push('admin')` ou `req.user.tenantId = '...'` throws em strict mode
**And** unit test cobre: (a) reassignment de `guard['issuer'] = 'evil'` após init → throws `TypeError`; (b) `req.user.roles.push('admin')` após middleware → throws `TypeError`; (c) comportamento normal (`canActivate` retorna `true` com user populado) continua verde

**Given** todas as mudanças afetam o caminho crítico de autenticação e o realm Keycloak
**When** esta story é entregue
**Then** suite RLS completa (`apps/api/test/rls/*.rls-spec.ts`) continua verde — guarda audience não muda comportamento de queries DB
**And** suite integration (`apps/api/test/**/*.integration-spec.ts`) continua verde — em particular os specs que dependem do Keycloak local (Docker compose) funcionam com o realm-export atualizado
**And** novo integration test fim-a-fim `apps/api/test/auth/audience-validation.integration-spec.ts` exercita o caminho completo: login real via Keycloak local → token contém `aud=metanoia-api` → request à API passa; mock um token sem `aud=metanoia-api` (forjado com chave de teste) → request retorna 401
**And** `pnpm turbo test build lint --filter=@metanoia/api` verde
**And** smoke test manual: rebuild docker Keycloak, login Paulo via FE, verificar (jwt.io ou debug) que o access token tem `aud` contendo `metanoia-api`

## Tasks / Subtasks

### Task 1 — Audience mapper no realm-export.json (AC1)
- [ ] Adicionar mapper `audience-metanoia-api` ao `protocolMappers` do client `metanoia-web` em `infra/keycloak/realm-export.json` (após o último mapper existente, linha ~110 da seção do client)
- [ ] (Opcional, se serviceAccount de `metanoia-api` for usado) Adicionar mapper análogo no client `metanoia-api` para auto-audiência
- [ ] Rebuild local: `docker compose down -v && docker compose up keycloak` para recarregar realm
- [ ] Verificar via `curl` direct no token endpoint que o access token novo contém `aud: ["metanoia-web", "metanoia-api"]` (jose decode)

### Task 2 — KeycloakAuthGuard valida audience (AC1 cont.)
- [ ] Adicionar `private expectedAudience!: string` em `apps/api/src/auth/keycloak.guard.ts`
- [ ] Em `onModuleInit`: `this.expectedAudience = this.config.get('KEYCLOAK_EXPECTED_AUDIENCE', { infer: true })`
- [ ] Em `verifyToken`: passar `audience: this.expectedAudience` ao `jwtVerify` (segundo opt do segundo argumento de jose). Jose suporta string ou array — passar string única; jose aceita match parcial se o claim aud do token for array contendo a string
- [ ] Cobrir caso de erro: jose throw `'audience' claim check failed` → mapear para `UnauthorizedException('Invalid authentication token')` (não vazar detalhe pro client; logger.warn com detalhe)
- [ ] Atualizar fixture de teste em `keycloak.guard.spec.ts:36` para `aud: 'metanoia-api'` (ou `['metanoia-web', 'metanoia-api']` para refletir realidade pós-mapper)
- [ ] Adicionar 4 tests novos (a-d na AC1)

### Task 3 — env validation + .env.example (AC1 + AC2)
- [ ] Em `apps/api/src/config/env.validation.ts`, adicionar:
  - `KEYCLOAK_EXPECTED_AUDIENCE: z.string().min(1).default('metanoia-api')`
- [ ] Em `.env.example`, adicionar abaixo de `KEYCLOAK_API_CLIENT_SECRET=...`:
  - `KEYCLOAK_EXPECTED_AUDIENCE=metanoia-api`
  - Comentário: `# Override per environment. Dev default matches realm-export.json fallback.` acima de `KEYCLOAK_API_CLIENT_SECRET`

### Task 4 — Secret rotation via env (AC2)
- [ ] Em `infra/keycloak/realm-export.json:125`, substituir literal por `"secret": "${KEYCLOAK_API_CLIENT_SECRET:dev-secret-only-not-for-production}"`
- [ ] **VERIFICAR** versão Keycloak em uso (`docker-compose.yml` raiz) — variable substitution `${ENV:default}` é suportada nativamente desde Keycloak 18. Se versão < 18, usar approach alternativa: realm-export sem secret + script de bootstrap pós-import (`kcadm.sh update clients/$ID -s secret=$KEYCLOAK_API_CLIENT_SECRET`). Documentar a escolha no Change Log
- [ ] Em `infra/keycloak/docker-compose.keycloak.yml` (ou wherever Keycloak service é definido), garantir que `KEYCLOAK_API_CLIENT_SECRET` é exposto como env do container — pode requerer adicionar `environment: [KEYCLOAK_API_CLIENT_SECRET=${KEYCLOAK_API_CLIENT_SECRET}]`
- [ ] Criar `infra/keycloak/README.md` (se não existir) com seção `## Secret Rotation`:
  - Procedimento p/ produção
  - Comando `openssl rand -base64 48`
  - Steps: atualizar env, reiniciar Keycloak, atualizar API env, validar via login real

### Task 5 — Object.freeze interno (AC3)
- [ ] Em `KeycloakAuthGuard`, criar método privado `freezeInitState(): void` chamado ao final de `onModuleInit`:
  ```ts
  private freezeInitState(): void {
    for (const key of ['issuer', 'jwks', 'expectedAudience'] as const) {
      Object.defineProperty(this, key, { writable: false, configurable: false });
    }
  }
  ```
- [ ] Em `canActivate`, antes de `request.user = user`, chamar `Object.freeze(user)` (e `Object.freeze(user.roles)` se quiser bloquear mutação no array — Object.freeze é raso)
- [ ] Adicionar 3 unit tests novos (a-c na AC3) — para teste (a) e (b) usar `try/catch` + asserção `TypeError` (strict mode é default em ESM/TS)

### Task 6 — Integration test audience + suite verde + Change Log + PR
- [ ] Criar `apps/api/test/auth/audience-validation.integration-spec.ts` com 2 specs: (a) token real Keycloak passa; (b) token forjado sem `aud=metanoia-api` 401
- [ ] `pnpm turbo test build lint --filter=@metanoia/api` verde
- [ ] Suite RLS verde
- [ ] Atualizar `_bmad-output/implementation-artifacts/deferred-work.md`: marcar as 3 entradas tagged `Sprint 8 (Story 2-10 auth-hardening)` como ✅ Resolvido com link
- [ ] Atualizar `_bmad-output/implementation-artifacts/sprint-status.yaml`: `2-10-auth-hardening: ready-for-dev → in-progress → review → done`
- [ ] PR título: `feat(api, story-2-10): auth hardening — audience JWT + secret rotation + immutable guard state` em PT-BR

## Dev Notes

### Por que audience mapper no client `metanoia-web` (não `metanoia-api`)
Em Keycloak, o token é emitido pelo client que o usuário usa para login (aqui: `metanoia-web`). Para que outro recurso (API) consuma o token validando `aud`, o client emissor precisa **declarar** a audiência alvo via `oidc-audience-mapper`. O config `included.client.audience: "metanoia-api"` instrui o emissor a inserir `"metanoia-api"` no array `aud` do access token. A API valida `aud` contém `metanoia-api`. Esse é o padrão recomendado em [RFC 7519 §4.1.3](https://datatracker.ietf.org/doc/html/rfc7519) e a [doc oficial Keycloak](https://www.keycloak.org/docs/latest/server_admin/#audience-support).

### Por que `audience` em `jwtVerify` e não check manual
A lib jose (`apps/api/src/auth/keycloak.guard.ts:11`) aceita `audience: string | string[] | RegExp` na opção do `jwtVerify`. Quando passada, jose:
- Faz match `string === claim` ou `string in claim[]` (se claim é array)
- Throws `JWTClaimValidationFailed` se não bater
- Throws ocorrem **antes** do payload retornar, fechando a porta para qualquer caminho assíncrono que poderia ler claims fora de ordem

Implementar check manual após `verifyToken` (ex: `if (!payload.aud.includes(expectedAud)) throw`) é redundante e introduz risk de race. Preferir o param nativo.

### Por que `${ENV:default}` no realm-export (não kcadm post-import)
Variable substitution é resolvida pelo Keycloak ao carregar o realm — zero step pós-boot, zero scripts custom. Funciona em Quarkus-based Keycloak (>= v17). Trade-off: requer confirmar versão. Se a versão em uso for legacy WildFly-based, fallback para script kcadm (Task 4 documenta isso).

### Por que `Object.defineProperty(writable: false)` e não `Object.freeze(this)`
`Object.freeze(this)` em um Nest provider freezou TODA a instância — bloqueia adição de propriedades, mas Nest pode atribuir circular refs ou state interno pós-init em alguns cenários (ex: scope: REQUEST). Definir writable: false APENAS nos campos imutáveis (`issuer`, `jwks`, `expectedAudience`) é cirúrgico: protege o que importa sem quebrar Nest internals.

### Por que congelar `AuthenticatedUser` no canActivate
Hoje `request.user.roles` é referência ao array `payload.realm_roles` — um middleware downstream poderia mutar `request.user.roles.push('admin_tenant')` e escalar privilégios silenciosamente. `Object.freeze(user)` torna isso impossível (TypeError em strict mode). Mesmo que algum handler pegue o array por ref, freeze é raso — para defesa em profundidade, freezar `user.roles` também é trivial e barato.

### Por que NÃO adicionar `getKeyId` validation, exp validation manual, ou rotation policy nesta story
- `exp` já é validado por jose `jwtVerify` (default behavior, falha automática)
- `kid` (key id) já é validado pelo `createRemoteJWKSet` (jose busca a key correta automaticamente)
- Rotation policy de JWKS é responsabilidade do Keycloak admin, não da API — fora de escopo
- Esses items NÃO estão no deferred-work.md tagged para esta story

### Guardrails Arquiteturais
- Multi-tenancy: validação de `aud` é por client, NÃO por tenant — todos os tenants compartilham `aud=metanoia-api`. Tenant isolation segue via `tenant_id` claim + RLS (não muda nesta story)
- IDs: UUID v7 — não aplicável (audience é string fixa)
- Validação: Zod em `env.validation.ts` para `KEYCLOAK_EXPECTED_AUDIENCE`
- Auth: Keycloak 3 camadas (token → guard → RLS) — esta story endurece a camada `token` e `guard`
- API: REST contracts não mudam — apenas o 401 fica mais restritivo
- Testes: co-located + integration em `apps/api/test/auth/`

### Dependencies
- `jose` (já em uso) — suporta `audience` em `jwtVerify`
- `zod` (já em uso) — para schema env
- Keycloak >= 17 (Quarkus-based) — confirmar versão antes de Task 4
- Nenhuma nova dependência

### Project Structure Notes
- Guard: `apps/api/src/auth/keycloak.guard.ts`
- JWT payload type: `apps/api/src/auth/interfaces/jwt-payload.interface.ts`
- Realm export: `infra/keycloak/realm-export.json`
- Env validation: `apps/api/src/config/env.validation.ts`
- Integration tests: `apps/api/test/auth/`

### Fora de escopo (não nesta story)
- Refresh token rotation policy (Sprint 17 / hardening posterior)
- Service account flow para worker → API (story dedicada se necessário)
- JWKS cache TTL custom (jose default é razoável)
- Anomaly detection / brute force protection no Keycloak (config Keycloak nativa, não código API)
- Migração para `EnumKeycloakClient` enum em vez de string (refactor cosmético, deferir)

### References
- `_bmad-output/implementation-artifacts/deferred-work.md` — entradas com tag `→ Sprint 8 (Story 2-10 auth-hardening)`:
  - Secret do client `metanoia-api` hardcoded no realm-export.json (review story 1-4, 2026-04-09)
  - Audience (`aud`) validation no JWT — decisão party mode 3-0 unânime em 2026-04-09 (review story 1-4) — **P0**
  - Store mutable no guard — Object.freeze() após população (review story 1-5, 2026-04-09)
- `_bmad-output/planning-artifacts/sprint-roadmap.md` — Sprint 8 (Release 1a-beta)
- `infra/keycloak/realm-export.json:52-114` (client metanoia-web) e `:116-160` (client metanoia-api)
- `apps/api/src/auth/keycloak.guard.ts` (guard atual)
- [Keycloak Audience Support](https://www.keycloak.org/docs/latest/server_admin/#audience-support)
- [jose `jwtVerify` API](https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md)

## Dev Agent Record

### Implementation Plan

_(preencher pelo dev ao iniciar)_

### Completion Notes

_(preencher pelo dev ao concluir)_

### Debug Log

_(preencher pelo dev se houver achados não óbvios)_

## File List

_(preencher pelo dev — NEW/MODIFIED/DELETED por área)_

## Change Log

| Date | Change |
|------|--------|
| 2026-05-11 | Story criada como ready-for-dev. Absorve 3 itens P0/P1 do deferred-work.md (review stories 1-4 e 1-5, 2026-04-09) em uma única entrega de hardening da camada de autenticação. P0: audience validation (decisão party mode 3-0). |
