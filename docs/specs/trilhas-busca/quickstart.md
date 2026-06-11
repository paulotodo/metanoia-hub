# Quickstart: Busca Full-Text (`trilhas-busca` / Story 8-8)

Validação manual + roundtrip end-to-end real (backend, não mock) confirmando que o
shape de resposta bate com `contracts/search-api.md`.

---

## Pré-requisitos

```bash
# infra local
docker compose up -d            # postgres (com contrib/unaccent), redis, keycloak
pnpm install                    # se houve mudança de deps
pnpm exec prisma generate
pnpm exec prisma migrate dev    # aplica a migration 8-8 (tsvector + trigger + GIN + unaccent)
pnpm exec prisma migrate status # DEVE estar limpo (sem drift) — coluna Unsupported declarada
```

Seed demo (já existe `db:seed:demo`) garante tenant + trilha + módulo + aulas com nomes/tags.

---

## Cenário A — Roundtrip End-to-End (REAL, não mock)

Objetivo: chamar o backend de verdade e comparar o shape com o contrato.

```bash
# 1. Subir a API
pnpm --filter @metanoia/api dev   # ou pnpm dev (turbo)

# 2. Obter token de um participante do tenant demo (fluxo Keycloak já existente).
#    TOKEN=<access_token do participante>

# 3. Buscar um termo presente no nome/tags de uma aula publicada
curl -s "http://localhost:3001/api/v1/search?q=discipulado" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Asserções do roundtrip** (comparar com `contracts/search-api.md`):
- Status 200.
- `data` é array com ≤ 20 itens, ordenado por `rank` desc.
- Cada item tem EXATAMENTE: `lessonId, lessonName, moduleId, moduleName, trailId,`
  `trailName, contentType, snippet, rank, isDraft` (camelCase; sem campos extras).
- `snippet` contém `<b>` ... `</b>` em torno do termo.
- `meta` = `{ total: <n>, query: "discipulado" }`.
- Nenhum campo `undefined`; `isDraft` é booleano explícito.

```bash
# 4. Diacríticos (FR-002 / SC-002): com e sem acento → MESMO conjunto
curl -s "http://localhost:3001/api/v1/search?q=educa%C3%A7%C3%A3o" -H "Authorization: Bearer $TOKEN" | jq '.data | map(.lessonId)'
curl -s "http://localhost:3001/api/v1/search?q=educacao"           -H "Authorization: Bearer $TOKEN" | jq '.data | map(.lessonId)'
# Os dois arrays de lessonId DEVEM ser iguais.

# 5. Prefixo (FR-003 / SC-003): "disc" casa "discipulado"
curl -s "http://localhost:3001/api/v1/search?q=disc" -H "Authorization: Bearer $TOKEN" | jq '.data | length'   # > 0

# 6. Sem resultado (FR-010 / SC-007): lista vazia, não erro
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/v1/search?q=zzznaoexiste" -H "Authorization: Bearer $TOKEN"  # 200
curl -s "http://localhost:3001/api/v1/search?q=zzznaoexiste" -H "Authorization: Bearer $TOKEN" | jq '.data, .meta.total'        # [] e 0

# 7. Caracteres especiais (Edge Cases): NUNCA 500
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3001/api/v1/search?q=%22(%29%22' -H "Authorization: Bearer $TOKEN"   # 200 (data: [])

# 8. XSS no snippet (A03/CWE-79, research D4.1): criar aula com name '<script>alert(1)</script>'
#    e tag/termo casável; buscar; o snippet NÃO pode conter <script>, só <b> + entidades escapadas.
curl -s "http://localhost:3001/api/v1/search?q=<termo-da-aula-xss>" -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[].snippet' | grep -qi '<script' && echo "FALHA XSS" || echo "OK: snippet sem <script>"
```

---

## Cenário B — Visibilidade por papel (US2 / FR-007/008/SC-004)

```bash
# Pré: uma aula cujo módulo pertence a uma trilha em status 'draft'.
# Participante NÃO vê:
curl -s "http://localhost:3001/api/v1/search?q=<termo-da-aula-draft>" -H "Authorization: Bearer $TOKEN_PARTICIPANTE" | jq '.data | map(.lessonId)'
#   -> NÃO contém o lessonId da aula draft.

# Líder vê COM badge:
curl -s "http://localhost:3001/api/v1/search?q=<termo-da-aula-draft>" -H "Authorization: Bearer $TOKEN_LIDER" | jq '.data[] | {lessonId, isDraft}'
#   -> contém o lessonId com isDraft: true.
```

---

## Cenário C — Isolamento de tenant (US3 / FR-006/011 / SC-005)

Coberto por `apps/api/test/rls/lessons-search.rls-spec.ts` (2 tenants, aulas de nomes
idênticos): busca via `withTenantTx(tenantA)` retorna só lessons de A. Manual:

```bash
# Tenant A e Tenant B com aula de nome idêntico; token de A:
curl -s "http://localhost:3001/api/v1/search?q=<nome-compartilhado>" -H "Authorization: Bearer $TOKEN_TENANT_A" | jq '.data | map(.trailId)'
#   -> só trailIds do Tenant A.
```

---

## Cenário D — Soft-delete sai do índice (FR-009 / SC-006)

```bash
# Antes: aula aparece na busca. Soft-delete a aula (DELETE lógico via fluxo de conteúdo).
# Depois (após o UPDATE que seta deleted_at → trigger limpa search_vector):
curl -s "http://localhost:3001/api/v1/search?q=<termo-da-aula>" -H "Authorization: Bearer $TOKEN" | jq '.data | map(.lessonId)'
#   -> NÃO contém mais o lessonId removido (em < 1min, SC-006).
```

---

## Cenário E — FE (US4) — campo de busca em /consumo/trilhas

```bash
pnpm --filter @metanoia/web dev
# Navegar autenticado para /app/consumo/trilhas
# - Digitar termo -> lista resultados (lessonName, moduleName, trailName, contentType).
# - Limpar campo -> resultados somem sem erro.
# - Termo sem match -> empty state pastoral PT-BR (sem termo técnico de erro).
# - snippet: FE faz split pelas sentinelas (\x02/\x03) e monta <b>{trecho}</b> em JSX
#   (React escapa o autor). SEM dangerouslySetInnerHTML, SEM DOMPurify (dec-014).
# - XSS check: aula com name '<script>alert(1)</script>' aparece como texto inerte, não executa.
```

---

## Checklist de aceite (mapeado a SC)

- [ ] SC-001: busca <500ms com ~10k lessons (medir com EXPLAIN ANALYZE / k6 opcional).
- [ ] SC-002: acento == sem acento (Cenário A.4).
- [ ] SC-003: prefixo ≥3 letras casa (Cenário A.5).
- [ ] SC-004: participante nunca vê draft; líder vê (Cenário B).
- [ ] SC-005: tenant A nunca vê B (Cenário C + RLS spec).
- [ ] SC-006: soft-deleted some <1min (Cenário D).
- [ ] SC-007: sem match retorna vazio <200ms (Cenário A.6).
- [ ] Roundtrip: shape == `contracts/search-api.md` (Cenário A asserções).
