# Deferred Work

## Deferred from: code review of story 1-4 (2026-04-09)

- Secret do client `metanoia-api` hardcoded no realm-export.json — configuração de dev apenas, substituir por secret gerado em produção
- `SET LOCAL` em transação pode ser explorado se tenantId não é UUID — fix de SQL injection já aplicado com template literal, validação de formato UUID seria defesa em profundidade
- Google OAuth placeholders requerem credenciais reais do Google Cloud Console para teste E2E completo
- Guard HTTP-only: não suporta WebSocket ou GraphQL — fora do escopo do spike, implementar quando necessário
- `authorization.split(' ')` vulnerável a múltiplos espaços no header — edge case improvável em clients reais
- Teste E2E do Google OAuth — requer credenciais reais, validar quando Google Cloud Console estiver configurado
- APP_GUARD registration order (KeycloakAuthGuard antes de RolesGuard) — funciona na prática mas a ordem não é explícita no código
- mockClear pattern inconsistente nos testes — apenas um teste faz mockClear, deveria estar no beforeEach para consistência
- Audience (`aud`) validation no JWT — token `aud` contém `metanoia-web`, API precisa de audience mapper no Keycloak para validar corretamente. Decisão: defer (party mode 3-0 unânime). Resolver em story de auth hardening

## Deferred from: code review of story-1-5 (2026-04-09)

- Adicionar header X-Request-Id na response do middleware — melhoria de observabilidade para clientes
- Store mutable no guard — considerar Object.freeze() após população para segurança
- LoggerModule.forRoot avaliado em load time — migrar para forRootAsync com ConfigService
- tenantId inicializado como '' ao invés de null — alinhar com regra de null explícito
- SET LOCAL sem transaction boundary no Prisma extension — verificar eficácia do RLS sem $transaction
- tracesSampleRate hardcoded — tornar configurável via env var SENTRY_TRACES_SAMPLE_RATE
- redact config só cobre authorization header — expandir para cookies e outros headers sensíveis
