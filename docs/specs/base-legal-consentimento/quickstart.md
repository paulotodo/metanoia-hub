# Quickstart: Base Legal & Histórico de Consentimento (Story 9-4)

## Cenário 1 — Consulta Pública do Registry

```bash
# Sem autenticação — qualquer pessoa pode consultar
curl -s http://localhost:3001/api/v1/privacy/data-processing | jq '.data | length'
# Esperado: 10

curl -s http://localhost:3001/api/v1/privacy/data-processing | jq '.[0].operationName, .[0].legalBasis'
# Esperado: "user_authentication", "contract_execution"
```

## Cenário 2 — Histórico de Consentimentos

```bash
TOKEN="Bearer <keycloak-access-token>"

curl -s -H "Authorization: $TOKEN" \
  http://localhost:3001/api/v1/consent/history | jq '.data[] | {type: .consentType, status: .status}'
```

## Cenário 3 — Withdrawal + Efeito Imediato (FR-11 roundtrip)

```bash
TOKEN="Bearer <keycloak-access-token-participante>"

# 1. Revogar consentimento de monitoramento de foco
curl -s -X PATCH -H "Authorization: $TOKEN" \
  http://localhost:3001/api/v1/consent/focus_monitoring/withdraw | jq '.data'
# Esperado: { consentType: "focus_monitoring", action: "withdrawn", timestamp: "..." }

# 2. Verificar que history reflete revogação
curl -s -H "Authorization: $TOKEN" \
  http://localhost:3001/api/v1/consent/history | \
  jq '.data[] | select(.consentType == "focus_monitoring") | .status'
# Esperado: "withdrawn"

# 3. Disparar focus heartbeat (simula reunião em andamento)
MEETING_ID="<uuid-de-reuniao-ativa>"
curl -s -X POST -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visible": true}' \
  http://localhost:3001/api/v1/meetings/$MEETING_ID/focus-heartbeat
# Esperado: 204 No Content (heartbeat aceito mas NÃO persiste para userId revogante)
```

## Cenário 4 — Tentativa de Revogar Mandatório (erro esperado)

```bash
curl -s -X PATCH -H "Authorization: $TOKEN" \
  http://localhost:3001/api/v1/consent/terms_of_service/withdraw | jq '.statusCode, .message'
# Esperado: 400, "Este consentimento é obrigatório para usar o serviço..."
```

## Cenário 5 — Tela FE (desenvolvimento)

```bash
# Com NEXT_PUBLIC_API_MOCKING=true (MSW habilitado)
open http://localhost:3000/app/perfil/privacidade
# Esperado: lista de consentimentos com toggles
# - Termos de Uso: toggle desabilitado (com tooltip)
# - Política de Privacidade: toggle desabilitado
# - Monitoramento de atenção: toggle habilitado (pode revogar)

# Tela pública (sem auth)
open http://localhost:3000/privacidade/bases-legais
# Esperado: tabela com 10 operações de tratamento
```

## Validação Local (antes de PR)

```bash
cd /home/quad101restadores/metanoia-hub
pnpm --filter @metanoia/api exec prisma generate
turbo build --filter=@metanoia/types
turbo lint
turbo test --filter=@metanoia/api -- --testPathPattern="consent|privacy|rls/consent"
turbo test --filter=@metanoia/types -- --testPathPattern="consent.snap"
```
