# Story 1.2: Docker Compose Completo com Keycloak, MinIO e LiveKit

Status: ready-for-dev

## Story

As a developer,
I want the Docker Compose extended with Keycloak, MinIO and LiveKit services,
So that all infrastructure dependencies are available locally for auth, storage and video features.

## Acceptance Criteria

**Given** Docker is installed and the base Docker Compose from Story 1.1 is running
**When** I run `docker compose up` with the complete configuration
**Then** Keycloak is running on port 8080 with a `metanoia` realm loaded from `infra/keycloak/realm-export.json` on startup
**And** MinIO is running on port 9000 with a `metanoia-storage` bucket created
**And** LiveKit is running on port 7880 with test API keys configured in `.env`
**And** NestJS boot completes without errors and connects to all services (PostgreSQL, Redis, Keycloak, MinIO)
**And** `.env.example` is updated with all new environment variables documented
**And** a `docker-compose.test.yml` is created for CI environment with ephemeral databases and minimal resource allocation
**And** a new developer cloning the repo can run `docker compose up && pnpm dev` without any manual Keycloak configuration

## Tasks / Subtasks

- [ ] Task 1: Adicionar Keycloak ao Docker Compose (AC: #1, #7)
  - [ ] 1.1 Adicionar serviço Keycloak 24+ ao `docker-compose.yml` na porta 8080
  - [ ] 1.2 Criar `infra/keycloak/realm-export.json` com realm `metanoia` pré-configurado
  - [ ] 1.3 Configurar import automático do realm no startup via volume mount
  - [ ] 1.4 Verificar que nenhuma configuração manual é necessária após `docker compose up`

- [ ] Task 2: Adicionar MinIO ao Docker Compose (AC: #2)
  - [ ] 2.1 Adicionar serviço MinIO ao `docker-compose.yml` na porta 9000
  - [ ] 2.2 Criar script de inicialização para bucket `metanoia-storage`
  - [ ] 2.3 Configurar console MinIO na porta 9001

- [ ] Task 3: Adicionar LiveKit ao Docker Compose (AC: #3)
  - [ ] 3.1 Adicionar serviço LiveKit ao `docker-compose.yml` na porta 7880
  - [ ] 3.2 Gerar e configurar test API keys no `.env`

- [ ] Task 4: Verificar conectividade NestJS (AC: #4)
  - [ ] 4.1 Adicionar health checks para Keycloak e MinIO no boot do NestJS
  - [ ] 4.2 Configurar dependências de serviço no Docker Compose (depends_on com healthcheck)

- [ ] Task 5: Atualizar .env.example (AC: #5)
  - [ ] 5.1 Documentar variáveis de Keycloak (KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, etc.)
  - [ ] 5.2 Documentar variáveis de MinIO (MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET)
  - [ ] 5.3 Documentar variáveis de LiveKit (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

- [ ] Task 6: Criar docker-compose.test.yml para CI (AC: #6)
  - [ ] 6.1 Criar `docker-compose.test.yml` com databases efêmeros e recursos mínimos
  - [ ] 6.2 Configurar tmpfs para PostgreSQL de teste
  - [ ] 6.3 Reduzir memory limits para CI

## Dev Notes

### Stack & Versões
- Keycloak 24+
- MinIO (latest)
- LiveKit Server 1.x
- Docker Compose v2

### Guardrails Arquiteturais
- Multi-tenancy: tenant_id em toda tabela, RLS obrigatório, AsyncLocalStorage (nunca parâmetro)
- IDs: UUID v7 via uuidv7() — nunca @default(uuid()) do Prisma
- Validação: Zod em packages/types, ZodValidationPipe custom no NestJS
- Auth: Keycloak 3 camadas (token → guard → RLS)
- API: REST /api/v1/, response { data, meta? }, error { statusCode, error, message }
- Testes: co-located *.spec.ts, factories com tenantId

### Dependencies
- Story 1.1 (Scaffold do Monorepo) — Docker Compose base com PostgreSQL e Redis

### Project Structure Notes
```
/
├── infra/
│   └── keycloak/
│       └── realm-export.json   # Realm metanoia pré-configurado
├── docker-compose.yml          # Dev completo (PG, Redis, Keycloak, MinIO, LiveKit)
├── docker-compose.test.yml     # CI com recursos mínimos
└── .env.example                # Atualizado com todas variáveis
```

### References
- [Source: _bmad-output/planning-artifacts/epics/epic-01.md — Story 1.2]
- [Source: docs/project-context.md — Docker environments]
- [Source: _bmad-output/planning-artifacts/architecture.md — Infrastructure services]
