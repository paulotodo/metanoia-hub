# Quickstart — Templates de Conteúdo Reutilizáveis (FR42 / Story 13.5)

Cenários de validação ponta-a-ponta. Servem de base para os testes de aceitação
(RLS spec + service spec + E2E autenticado) gerados em create-tasks/execute-task.

## Pré-requisitos
- Postgres local de teste (docker-compose.test.yml) com migration `13-5-content-templates` aplicada.
- `pnpm --filter @metanoia/api exec prisma generate` após editar schema.
- Seed de templates platform executado.

## Cenário 1 — Seed de plataforma (US1 / FR-06)
1. Rodar `content-templates-seed.ts`.
2. Esperado: 3 linhas `content_templates` com `tenant_id NULL`, `scope='platform'`,
   `source_trail_id NULL`, `version=1`:
   - Discipulado Básico (structure: 4 módulos, 12 lições)
   - Estudo Bíblico Temático (3 / 9)
   - Acolhimento de Novos Membros (2 / 6)
3. Rodar o seed **de novo** → contagem permanece 3 (idempotente, sem duplicar).

## Cenário 2 — RLS platform visível a todos + tenant isolado (FR-02/FR-03)
1. `SET LOCAL app.current_tenant_id = TENANT_A` → `SELECT * FROM content_templates`
   retorna os 3 platform.
2. `SET LOCAL app.current_tenant_id = TENANT_B` → também os 3 platform.
3. TENANT_A cria template (scope=tenant). TENANT_B **não** o vê. TENANT_A vê platform + o seu.
4. **Write-isolation (dec-015):** sob `tenant_id=TENANT_A`, INSERT com `tenant_id=NULL`
   (forjar platform) é REJEITADO pela policy `content_templates_insert`; UPDATE de
   linha de TENANT_B é REJEITADO; DELETE de linha platform via request-path é REJEITADO.
5. Spec roda 2× no CI sem erro (idempotência — lição 13-3).

## Cenário 3 — Criar template de trilha (US2 / FR-07/FR-08)
1. Como admin_tenant de A, ter trilha com 2 módulos / 3 lições (com conteúdo real).
2. `POST /api/v1/templates { sourceTrailId, name:"Meu Template" }` → 201.
3. Verificar `structure`: módulos/lições com `name/order/contentType/estimatedDurationMinutes`
   e **nenhum** `contentUrl/contentBody/originalName/mimeType/sizeBytes/uploadedBy/tags`.
4. `POST` de novo p/ mesma trilha → `version=2`. UNIQUE `(source_trail_id, version)` honrado.

## Cenário 4 — Listar / filtrar / versões (US3 / FR-09/FR-10/FR-13)
1. `GET /api/v1/templates` (scope=all) → platform + tenant; última versão por source_trail_id.
2. `GET /api/v1/templates?scope=platform` → só os 3 platform.
3. `GET /api/v1/templates?search=Discipulado` → filtra por nome.
4. `GET /api/v1/templates/:id/versions` → histórico (v1, v2, ...).

## Cenário 5 — Imutabilidade de platform (FR-11/FR-12)
1. `PATCH /api/v1/templates/:platformId` → **403**.
2. `DELETE /api/v1/templates/:platformId` → **403**.
3. `PATCH`/`DELETE` no template do próprio tenant → 200 / 204.

## Cenário 6 — Usar template (US4 / FR-14/FR-15)
1. `POST /api/v1/trails { templateId, name:"Trilha Nova" }` → 201; cria Trail + Modules + Lessons.
2. Verificar lições: `contentUrl/contentBody NULL`, `tags=[]`, sem upload-metadata.
3. **DELETE do template** depois → a trilha materializada permanece intacta (cópia independente).
4. Com `groupId`: `GroupTrail` criado vinculando a trilha à célula.

## Cenário 7 — UI biblioteca (US5)
1. `/app/admin/templates` (autenticado, admin_tenant) lista templates por scope, busca,
   preview da árvore módulos/lições.
2. Fora do gate axe público (Epic 12); a11y autenticado = tech-debt R2.

## Gates de saída (execute-task)
- [ ] Migration aplica limpa em Postgres local; colunas auditadas vs schema (13-2b).
- [ ] RLS spec passa 2× (idempotência).
- [ ] Snapshot tests Zod atualizados.
- [ ] `tenant_id` nunca como parâmetro; IDs `uuidv7()`.
- [ ] owasp: structure sem conteúdo; platform read-only; soft-delete sem cascade.
