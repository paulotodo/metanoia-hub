# Story 2.10: Auth Hardening (Audience JWT, Secret Rotation, Immutable Guard State)

Status: in-review
baseline_commit: 8606067008a8005709a2fd6332fd3409d5f1b7f9

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
- [x] Mapper `audience-metanoia-api` adicionado ao `protocolMappers` do client `metanoia-web` (`infra/keycloak/realm-export.json` linhas ~114-122)
- [ ] (Opcional, se serviceAccount de `metanoia-api` for usado) Mapper análogo no client `metanoia-api` — deixado fora (sem service account flow no fluxo atual)
- [ ] Rebuild manual (smoke test do operador — não bloqueia merge)
- [ ] Verificação via `curl` (smoke test do operador)

### Task 2 — KeycloakAuthGuard valida audience (AC1 cont.)
- [x] `private expectedAudience!: string` em `keycloak.guard.ts`
- [x] `onModuleInit` lê `this.config.get('KEYCLOAK_EXPECTED_AUDIENCE', { infer: true })`
- [x] `verifyToken` passa `audience: this.expectedAudience` para `jwtVerify`
- [x] Erro de audience capturado em ramo dedicado do `catch` (logger.warn com detalhe, `UnauthorizedException('Invalid authentication token')` para o cliente — não vaza)
- [x] Fixture `validPayload.aud` atualizada para `['metanoia-web', 'metanoia-api']` (realidade pós-mapper)
- [x] 4 unit tests novos no bloco `describe('audience validation')` cobrem casos a/b/c/d

### Task 3 — env validation + .env.example (AC1 + AC2)
- [x] `KEYCLOAK_EXPECTED_AUDIENCE: z.string().min(1).default('metanoia-api')` em `env.validation.ts`
- [x] `.env.example`: `KEYCLOAK_EXPECTED_AUDIENCE=metanoia-api` + comentário "Override per environment" acima de `KEYCLOAK_API_CLIENT_SECRET`

### Task 4 — Secret rotation via env (AC2)
- [x] `realm-export.json:125`: `"secret": "${KEYCLOAK_API_CLIENT_SECRET:dev-secret-only-not-for-production}"` — Keycloak 24 (Quarkus, > v18) suporta substitution nativa, confirmado em `docker-compose.yml:37`
- [x] `docker-compose.yml` Keycloak service: `KEYCLOAK_API_CLIENT_SECRET: ${KEYCLOAK_API_CLIENT_SECRET:-dev-secret-only-not-for-production}` exposto ao container
- [x] `infra/keycloak/README.md` criado com seção `## Secret Rotation` (passos de produção + `openssl rand -base64 48`), `## Secret Resolution` e `## Audience Mapper`

### Task 5 — Object.freeze interno (AC3)
- [x] `freezeInitState()` privado chamado ao fim de `onModuleInit` — `Object.defineProperty(this, key, { value: this[key], writable: false, configurable: false, enumerable: true })` para `issuer`, `jwks`, `expectedAudience` (definido via constante `IMMUTABLE_INIT_FIELDS`)
- [x] `canActivate` constrói `user` via `Object.freeze({...})` e `roles` via `Object.freeze([...])` (copy + freeze, evita mutação por referência ao array original do payload)
- [x] 4 unit tests novos no bloco `describe('immutable post-init state')`: reassign issuer/expectedAudience/jwks → `TypeError`; mutar `user.tenantId` e `user.roles.push` → `TypeError`; `Object.isFrozen` checks

### Task 6 — Integration test audience + suite verde + Change Log + PR
- [x] `apps/api/test/auth/audience-validation.integration-spec.ts` criado — usa `jose` real (não mock) com keypair RS256 local + `createRemoteJWKSet` mockado para resolver a chave pública local; 3 specs: aud array inclui `metanoia-api` passa, aud=`metanoia-web` rejeita, aud=`unrelated-client` rejeita
- [x] `pnpm lint && pnpm build` verdes
- [x] 342 tests passing (mesma exclusão `test/rls/**` `test/marketing/**` `test/migrations/**` pré-existentes vermelhos por env DB)
- [x] `deferred-work.md` — 3 entradas marcadas ✅ Resolvido
- [x] `sprint-status.yaml` — `2-10-auth-hardening: ready-for-dev → in-review`; bundle 1-9 housekeeping: `1-9-config-hardening: in-review → done` + Status do spec 1-9 → `done`
- [ ] PR a abrir após push

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

Entrega 3-em-1 (audience JWT + secret rotation + immutable state) sob `feat/story-2-10-auth-hardening` (baseline `8606067`). Adicionalmente, bundle housekeeping da Story 1-9: spec status e sprint-status para `done` (PR #104 já mergeada).

### Completion Notes

- **Keycloak 24 confirmado** (`docker-compose.yml:37` → `quay.io/keycloak/keycloak:24.0`) — Quarkus-based, > v17, suporta `${ENV:default}` variable substitution nativa. Sem necessidade de fallback kcadm.
- **Audience mapper só no client `metanoia-web`** — não adicionei mapper análogo em `metanoia-api` (Task 1 item opcional) porque `metanoia-api` não usa service-account flow no fluxo corrente; pode ser absorvido em story futura quando worker → API for separado.
- **`Object.freeze(user)` é shallow** — daí o copy + freeze de `roles` separado: `Object.freeze([...(payload.realm_roles ?? [])])`. Garante que mesmo reference-grab de `req.user.roles` falhe em mutação. Aceita o custo do array copy (uso é rare-write, frequent-read).
- **`Object.defineProperty` em vez de `Object.freeze(this)`** — Nest providers podem ter state interno re-assigned em alguns cenários; preferi proteger CIRURGICAMENTE os 3 campos imutáveis (`issuer`, `jwks`, `expectedAudience`) em vez de freezar a instância inteira.
- **Integration test usa jose real:** o spec sugeria "token real Keycloak". Sem live Keycloak no CI, fiz o caminho cirúrgico — gerei keypair RS256 local, assinei tokens com `jose.SignJWT` e mockei APENAS `createRemoteJWKSet` para retornar a public key local. Toda a verificação (issuer + audience + exp + signature) usa jose real, validando comportamento de produção.

### Debug Log

- RLS suite + marketing + migrations vermelhos no baseline (env DB ausente) — não tocado.
- O ramo `error.message.toLowerCase().includes('aud')` no catch é defensivo: jose tem variado a mensagem entre versões (`'audience' claim check failed`, `"aud" claim check failed`). Match case-insensitive cobre ambos.

## File List

**NEW**
- `apps/api/test/auth/audience-validation.integration-spec.ts` — integration test com jose real (RS256 keypair) + 3 specs (aud OK, aud só web rejeita, aud client desconhecido rejeita)
- `infra/keycloak/README.md` — Secret Resolution + Secret Rotation procedure + Audience Mapper

**MODIFIED**
- `apps/api/src/auth/keycloak.guard.ts` — `expectedAudience` field + `freezeInitState()` + `Object.freeze(user)` + audience opt em `jwtVerify` + ramo de audience no catch
- `apps/api/src/auth/__tests__/keycloak.guard.spec.ts` — fixture `aud` array + 8 tests novos (4 audience + 4 immutable state) + `mockConfig` retorna `KEYCLOAK_EXPECTED_AUDIENCE`
- `apps/api/src/config/env.validation.ts` — `KEYCLOAK_EXPECTED_AUDIENCE: z.string().min(1).default('metanoia-api')`
- `.env.example` — `KEYCLOAK_EXPECTED_AUDIENCE=metanoia-api` + comentário acima de `KEYCLOAK_API_CLIENT_SECRET`
- `infra/keycloak/realm-export.json` — mapper `audience-metanoia-api` no client `metanoia-web` + secret do client `metanoia-api` via `${KEYCLOAK_API_CLIENT_SECRET:default}`
- `docker-compose.yml` — env `KEYCLOAK_API_CLIENT_SECRET` propagado ao container Keycloak
- `_bmad-output/implementation-artifacts/deferred-work.md` — 3 entradas marcadas ✅
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-10-auth-hardening: in-review`, `1-9-config-hardening: done` (housekeeping)
- `_bmad-output/implementation-artifacts/1-9-config-hardening.md` — Status: `done` + `merged_commit` + `pr: 104` (housekeeping)

**DELETED**
- Nenhum

## Change Log

| Date | Change |
|------|--------|
| 2026-05-11 | Story criada como ready-for-dev. Absorve 3 itens P0/P1 do deferred-work.md (review stories 1-4 e 1-5, 2026-04-09) em uma única entrega de hardening da camada de autenticação. P0: audience validation (decisão party mode 3-0). |
| 2026-05-12 | Implementação completa em `feat/story-2-10-auth-hardening` (baseline `8606067`). 3 ACs entregues: (1) `oidc-audience-mapper` insere `metanoia-api` no `aud` do access token + guard valida via jose `audience` opt + `KEYCLOAK_EXPECTED_AUDIENCE` validado em Zod; (2) `${KEYCLOAK_API_CLIENT_SECRET:default}` no realm-export + env propagado via docker-compose + procedimento de rotation em `infra/keycloak/README.md`; (3) `freezeInitState()` torna `issuer`/`jwks`/`expectedAudience` imutáveis após `onModuleInit`; `request.user` e `user.roles` `Object.freeze`-ados antes de attach na request. Bundle housekeeping Story 1-9 (status → done). 342 unit/integration tests verdes, lint + build verdes. |
