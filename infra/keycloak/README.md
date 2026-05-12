# Keycloak Infrastructure

This directory contains realm exports and supporting files for the Metanoia Keycloak instance (Keycloak 24, Quarkus-based).

## Files

- `realm-export.json` — versioned realm definition imported on container boot (`start-dev --import-realm`). Defines the `metanoia` realm, clients (`metanoia-web`, `metanoia-api`), roles, and protocol mappers.
- `mock-idp.json` — fixture for testing identity-provider flows.

## Secret Resolution

The `metanoia-api` confidential client secret is resolved at boot via Keycloak variable substitution:

```json
"secret": "${KEYCLOAK_API_CLIENT_SECRET:dev-secret-only-not-for-production}"
```

Keycloak reads `KEYCLOAK_API_CLIENT_SECRET` from the container environment. When unset, it falls back to the dev default. The dev default is also the value tracked in `.env.example` (root) for consistency.

The root `docker-compose.yml` forwards the host env var to the container:

```yaml
keycloak:
  environment:
    KEYCLOAK_API_CLIENT_SECRET: ${KEYCLOAK_API_CLIENT_SECRET:-dev-secret-only-not-for-production}
```

## Secret Rotation (Production)

Rotate the `metanoia-api` client secret without committing the new value:

```bash
# 1. Generate a strong secret
openssl rand -base64 48
# example output: dQ8w...kZmHc=

# 2. Set the env var on the Keycloak host (do NOT commit)
export KEYCLOAK_API_CLIENT_SECRET='dQ8w...kZmHc='

# 3. Restart Keycloak so it re-reads the realm-import file with the new substitution
docker compose restart keycloak

# 4. Apply the same secret to the API consumer
export KEYCLOAK_API_CLIENT_SECRET='dQ8w...kZmHc='
# (or update the secret manager / k8s secret that feeds apps/api)
pnpm --filter @metanoia/api start:prod

# 5. Validate with a live token request
curl -s -X POST "$KEYCLOAK_URL/realms/metanoia/protocol/openid-connect/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=metanoia-api" \
  -d "client_secret=$KEYCLOAK_API_CLIENT_SECRET" | jq .access_token
```

> **Note:** `--import-realm` only imports if the realm does not yet exist. To force a re-import after editing `realm-export.json`, run `docker compose down -v && docker compose up keycloak` (drops the Keycloak database).

## Audience Mapper

The `metanoia-web` client carries an `oidc-audience-mapper` that inserts `metanoia-api` into the `aud` array of every access token. The API guard (`KeycloakAuthGuard`) rejects tokens whose `aud` does not include the value read from `KEYCLOAK_EXPECTED_AUDIENCE` (default `metanoia-api`). This prevents tokens issued for unrelated clients in the same realm from passing API authentication.
