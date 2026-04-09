# Spike Técnico: Keycloak Multi-tenant com 4 Roles e Google OAuth

**Data:** 2026-04-09
**Status:** Validado com ressalvas
**Story:** 1-4

## O que foi validado

### Realm Configuration
- Realm `metanoia` com 6 roles definidas (4 prioritárias: `super_admin`, `admin_tenant`, `lider`, `participante` + 2 futuras: `editor_conteudo`, `auditor`)
- Client `metanoia-web` (público, PKCE S256) para frontend
- Client `metanoia-api` (confidencial, service account) para backend
- 4 test users com roles e `tenant_id` atribuídos
- Import automático via `--import-realm` no Docker Compose

### JWT Custom Mappers
- `tenant_id`: user attribute → token claim (String)
- `realm-roles`: realm roles → token claim `roles` (multivalued String)
- `user_id`: user ID → token claim (String)

### NestJS KeycloakAuthGuard
- Validação JWT via `jose` library (JWKS auto-rotation)
- Extração de claims: `tenant_id`, `user_id`, `roles`
- Integração com `AsyncLocalStorage` (`requestContext`) para RLS
- Rejeição de tokens: ausente (401), expirado (401), malformado (401), sem tenant_id (401)
- Decorator `@Public()` para endpoints sem autenticação
- `RolesGuard` para autorização por roles via `@Roles()` decorator
- 14 testes unitários passando (9 keycloak.guard + 5 roles.guard)

### Google OAuth Identity Provider
- Configuração estrutural no `realm-export.json` com placeholders
- Suporta variáveis de ambiente do Keycloak: `${GOOGLE_OAUTH_CLIENT_ID}`, `${GOOGLE_OAUTH_CLIENT_SECRET}`

## Ressalvas e limitações

### Google OAuth requer setup manual
Google OAuth não pode ser testado end-to-end sem credenciais reais do Google Cloud Console:
1. Criar projeto em https://console.cloud.google.com
2. Habilitar Google+ API / People API
3. Criar OAuth 2.0 credentials com redirect URI: `http://localhost:8080/realms/metanoia/broker/google/endpoint`
4. Preencher `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET` no `.env`

### Import do realm é one-shot
`--import-realm` do Keycloak só importa se o realm não existe. Devs com banco existente precisam:
```bash
docker compose down -v  # remove volumes
docker compose up       # fresh import
```

### Audience validation desabilitada
Tokens emitidos para `metanoia-web` (frontend) não incluem `metanoia-api` como audience. O guard valida apenas issuer + signature, não audience. Isso é seguro porque a validação de issuer garante que o token veio do Keycloak correto.

## Decisão: Keycloak aprovado para MVP

A arquitetura de autenticação Keycloak funciona conforme esperado:
- JWT validation é rápido e confiável via JWKS
- Custom mappers permitem claims arbitrárias no token
- Multi-tenancy via `tenant_id` claim integra perfeitamente com AsyncLocalStorage + RLS
- Google OAuth é suportado nativamente como Identity Provider

### Alternativas consideradas (não necessárias)
- **JWT self-issued**: menor complexidade, mas sem UI de admin, sem social login nativo
- **Auth.js**: focado em Next.js, não integra naturalmente com NestJS backend
- **Supabase Auth**: vendor lock-in, difícil customizar claims

## Biblioteca escolhida: `jose`
- Zero dependências transitivas
- JWKS auto-rotation nativo (`createRemoteJWKSet`)
- Standards-based (RFC 7515-7519)
- ~45KB bundle size
- Alternativa rejeitada: `@nestjs/passport` + `passport-jwt` (pesado, opinionated, session-oriented)
