# Security + API Checklist: Templates de Conteúdo Reutilizáveis (FR42 / Story 13.5)

**Purpose**: Quality gate de requisitos — valida completude, clareza e testabilidade dos
requisitos de segurança (RLS), JSONB snapshot, versionamento, materialização, soft-delete e
contrato API. Foco nos pontos críticos identificados no plan (finding HIGH: RLS write-isolation)
e nas lições aprendidas de histórias anteriores (13-3: idempotência, uuids únicos).

**Created**: 2026-06-20
**Feature**: [spec.md](../spec.md) | [data-model.md](../data-model.md) | [contracts/](../contracts/)
**Domínio**: security + api (foco: RLS write-isolation, snapshot JSONB, versionamento, materialização)

---

## 1. Segurança RLS — Políticas e Isolamento

- [x] CHK001 — As 4 políticas RLS (`_read`, `_insert`, `_update`, `_delete`) estão especificadas separadamente com seus predicados exatos? [Completude, Spec §Padrão RLS, data-model.md §2] {auto}
  > _Evidência: data-model.md §2 Migration SQL define explicitamente `content_templates_read` (FOR SELECT USING tenant_id IS NULL OR…), `content_templates_insert` (FOR INSERT WITH CHECK tenant_id = NULLIF(...)::uuid), `content_templates_update` (FOR UPDATE USING + WITH CHECK), `content_templates_delete` (FOR DELETE USING). ENABLE + FORCE ROW LEVEL SECURITY presentes._

- [x] CHK002 — A política de INSERT possui `WITH CHECK (tenant_id = NULLIF(...))` separado do USING, impedindo que tenant insira linha com `tenant_id=NULL` (forja de template platform)? [Segurança, Spec §Padrão RLS, data-model.md §2, plan §A2] {auto}
  > _Evidência: data-model.md §2: `CREATE POLICY content_templates_insert … FOR INSERT WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)` — nunca NULL. Comentário SQL explica o risco A01/API3 BOPLA (dec-015)._

- [x] CHK003 — A política de UPDATE possui BOTH `USING` (linha pertence ao tenant) E `WITH CHECK` (linha permanece no tenant), impedindo re-associação cross-tenant? [Segurança, data-model.md §2] {auto}
  > _Evidência: `content_templates_update: FOR UPDATE USING (tenant_id = NULLIF...) WITH CHECK (tenant_id = NULLIF...)` — ambas as cláusulas presentes e idênticas._

- [x] CHK004 — A política de SELECT (READ) é a ÚNICA que permite `tenant_id IS NULL` (visibilidade platform), enquanto as políticas de escrita nunca permitem NULL? [Segurança, data-model.md §2, plan §A2] {auto}
  > _Evidência: `content_templates_read` tem `tenant_id IS NULL OR tenant_id = NULLIF(…)`; INSERT/UPDATE/DELETE têm apenas `tenant_id = NULLIF(…)` sem cláusula IS NULL. Assimetria deliberada e documentada._

- [x] CHK005 — O requisito de READ isolation está especificado como cenário de teste concreto (tenant A vê platform + seus; não vê os de B)? [Mensurabilidade, Spec §Testes Requeridos] {auto}
  > _Evidência: Spec §Testes Requeridos: "RLS: Admin tenant A não vê templates do tenant B; ambos veem templates de plataforma". quickstart.md §Cenário 2 detalha os 4 passos do teste._

- [x] CHK006 — O requisito de WRITE isolation está especificado como cenário de teste concreto: INSERT com `tenant_id=NULL` rejeitado E INSERT com `tenant_id=B` rejeitado sob contexto tenant A? [Mensurabilidade, plan §7 Riscos] {auto}
  > _Evidência: plan.md §7 Riscos: "RLS spec testa que tenant NÃO insere/atualiza linha com tenant_id=NULL nem de outro tenant". quickstart.md §Cenário 2 passo 4 especifica "Write-isolation (dec-015)"._

- [x] CHK007 — O requisito de platform read-only (PATCH/DELETE de template platform → 403) está especificado como cenário de teste mensurável? [Mensurabilidade, Spec §Testes Requeridos, spec FR-11/FR-12] {auto}
  > _Evidência: Spec §Testes Requeridos: "Edge: Tentativa de editar/excluir template de plataforma → 403". quickstart.md §Cenário 5 "Imutabilidade de platform (FR-11/FR-12)". 403 é código de status específico._

- [x] CHK008 — O requisito de idempotência do seed e da RLS spec (roda 2× sem erro) está documentado explicitamente? [Cobertura, Spec §Testes Requeridos] {auto}
  > _Evidência: Spec §Testes Requeridos: "RLS: Seed roda 2x → sem duplicatas (idempotência)". Plano §A10: "Seed idempotente de 3 templates platform (upsert por chave natural)". Quickstart §Cenário 2 passo 5: "Spec roda 2× no CI sem erro (idempotência — lição 13-3)"._

- [x] CHK009 — O mecanismo de role/privilege para o seed inserir `tenant_id=NULL` contornando a RLS é definido como requisito implementável? [Completude, data-model.md §2 nota, Gap] {auto}
  > _RESOLVIDO inline: FR-21 adicionado à spec.md — "Seed de platform executa com role BYPASSRLS ou SUPERUSER; mecanismo documentado no quickstart e verificado em teste de seed". Originalmente: data-model.md §2 nota documenta o problema ("seed deve rodar como owner do banco OU com SET LOCAL row_security = off / role BYPASSRLS") mas não especifica qual mecanismo concreto usar. A spec.md não lista isso como FR. Há ambiguidade: (a) usar prisma.$executeRaw('SET LOCAL row_security = off') no seed? (b) conectar via role com BYPASSRLS? (c) usar o owner do banco (Prisma usa que role?). Esta é a primeira tabela platform com tenant_id NULL escrita por seed no projeto. O mecanismo deve ser definido como FR (ex: FR-21: Seed executa com role BYPASSRLS ou SUPERUSER; não usa o role de aplicação) e testado (seed falha se rodado com role de tenant)._

---

## 2. JSONB Structure — Snapshot sem Conteúdo

- [x] CHK010 — Os campos permitidos no snapshot (`modules[].name`, `.order`, `.lessonAccessMode`, `lessons[].name`, `.order`, `.contentType`, `.estimatedDurationMinutes`) estão enumerados explicitamente? [Completude, Spec §structure JSONB, data-model.md §3] {auto}
  > _Evidência: Spec §Estrutura do campo `structure`: tabela "Campo do snapshot / Campo real em Module/Lesson / Campos explicitamente NULLOS/omitidos". data-model.md §3 lista o schema completo._

- [x] CHK011 — Os campos PROIBIDOS no snapshot (`contentUrl`, `contentBody`, `originalName`, `mimeType`, `sizeBytes`, `uploadedBy`, `uploadedAt`, `id`/`tenantId`/`createdBy`) estão listados explicitamente como whitelist negativa? [Segurança, data-model.md §3] {auto}
  > _Evidência: data-model.md §3: "Campos PROIBIDOS na structure (nunca capturados — owasp / privacidade): contentUrl, contentBody, tags, originalName, mimeType, sizeBytes, uploadedBy, uploadedAt, qualquer id/tenantId/createdBy das lições/módulos-fonte"._

- [x] CHK012 — O requisito de que a snapshot seja um teste verificável (`contentUrl`/`contentBody` preenchidos na trilha-fonte → `null` no template) está especificado? [Mensurabilidade, Spec §Testes Requeridos] {auto}
  > _Evidência: Spec §Testes Requeridos: "Integration: Criar template de trilha com contentUrl/contentBody preenchidos → verificar snapshot com esses campos null"._

- [x] CHK013 — O schema Zod de `TemplateStructureSchema` exclui campos de conteúdo (sem `contentUrl`, `contentBody` etc.)? [Consistência, contracts/template-schemas.md] {auto}
  > _Evidência: contracts/template-schemas.md define `TemplateLessonSchema` com apenas `name`, `order`, `contentType`, `estimatedDurationMinutes` — sem campos de conteúdo._

- [x] CHK014 — O tratamento do campo `estimatedDurationMinutes` (nullable/optional no snapshot) está alinhado entre spec, data-model e Zod? [Consistência, Spec §Clarifications C1, data-model.md §3] {auto}
  > _Evidência: Clarifications C1 (score 3): "Sim — campo existe em Lesson (Int?), é informação estrutural (não conteúdo), melhora UX de preview. Adicionado ao JSONB e ao schema Zod (campo nullable/optional)". data-model.md §Notas: "copiado do snapshot (null se ausente)". Zod: estimatedDurationMinutes: z.number().int().positive().nullable().optional()._

- [x] CHK015 — O comportamento de `Lesson.tags` na materialização (array vazio `[]`, nunca do snapshot) está definido? [Completude, Spec §structure JSONB, data-model.md §4] {auto}
  > _Evidência: Spec §Estrutura campo structure: "`tags`: `[]` (array vazio) ao instanciar". data-model.md §4 Materialização confirma. Nota: `tags` está na lista de campos PROIBIDOS no snapshot (data-model.md §3) — consistente._

---

## 3. Versionamento

- [x] CHK016 — A fórmula de versionamento (`MAX(version)+1` por `source_trail_id`) está especificada com seu contexto de execução (dentro de `withTenantTx`)? [Completude, Spec §FR-08, plan §A7] {auto}
  > _Evidência: plan.md §A7: "Versionamento: MAX(version)+1 por source_trail_id calculado dentro de withTenantTx antes do insert; UNIQUE (source_trail_id, version) é o backstop". Clarification dec-008 (score 3) confirma._

- [x] CHK017 — O UNIQUE INDEX `(source_trail_id, version)` como backstop está especificado no data model? [Completude, Spec §FR-04, data-model.md §2] {auto}
  > _Evidência: data-model.md §2: `CREATE UNIQUE INDEX content_templates_source_trail_version_idx ON content_templates (source_trail_id, version)`. Spec FR-04 e §Tabela: content_templates confirmam._

- [x] CHK018 — O teste de versionamento em 2 saves (versão 1 e versão 2 para a mesma trilha-fonte) está especificado como cenário testável? [Mensurabilidade, Spec §Testes Requeridos] {auto}
  > _Evidência: Spec §Testes Requeridos: "Integration: Salvar template 2x da mesma trilha → 2 registros com version=1 e version=2". Unit: "getNextVersion(sourceTrailId) retorna 1 na 1ª chamada, N+1 nas seguintes"._

- [x] CHK019 — O comportamento do `GET /api/v1/templates` ao listar "versão mais recente" por `source_trail_id` está definido de forma que inclua corretamente os templates platform (cujo `source_trail_id` é NULL)? [Clareza, Spec §FR-09, contracts GET /api/v1/templates, Ambiguity] {auto}
  > _RESOLVIDO inline: US3 e FR-09 atualizados com "templates com source_trail_id = NULL (platform) são sempre incluídos individualmente (não agrupados)". Originalmente: [Ambiguity] (FR-09); platform sempre incluído quando scope=all". Porém o mecanismo de "versão mais recente" (ex: DISTINCT ON source_trail_id ORDER BY version DESC) aplicado a source_trail_id = NULL é ambíguo: NULL não é chave de agrupamento normal em DISTINCT ON; os 3 templates platform têm source_trail_id NULL e version=1, mas a spec não especifica: "Templates com source_trail_id = NULL são sempre incluídos individualmente (não agrupados por source_trail_id)" ou equivalente._

---

## 4. Materialização (Usar Template)

- [x] CHK020 — O requisito de que a cópia seja independente (sem back-link para o template) está especificado explicitamente? [Completude, Spec §FR-15] {auto}
  > _Evidência: spec FR-15: "Trilha criada de template não tem referência ao template (cópia independente)". plan §A9: "Materialização NÃO referencia template". contracts POST /api/v1/trails: "cópia independente"._

- [x] CHK021 — Os campos de conteúdo das lições materializadas (`contentUrl`, `contentBody`, etc.) estão especificados como `null` (não vazio string, não ausentes) na trilha gerada? [Clareza, Spec §FR-14, data-model.md §4] {auto}
  > _Evidência: data-model.md §4 Materialização: tabela de campos, coluna "Lesson criada": contentUrl: null, contentBody: null, originalName: null, mimeType: null, sizeBytes: null, uploadedBy: null, uploadedAt: null. O requisito de null explícito (não omitido) está alinhado com CLAUDE.md ("Nulls: explicit null — never omit fields")._

- [x] CHK022 — O teste de materialização especifica verificar `contentUrl`/`contentBody` como `null` na trilha criada? [Mensurabilidade, Spec §Testes Requeridos] {auto}
  > _Evidência: Spec §Testes Requeridos: "Integration: Usar template → Trail + Modules + Lessons criados com estrutura correta e conteúdo vazio". plan §4.6 Testes: "Materialização: content.service.spec.ts — Trail criado de template com lições contentUrl/contentBody NULL"._

- [x] CHK023 — A extensão de `CreateTrailRequestSchema` com `templateId?` e `groupId?` é retrocompatível (campos opcionais) e está especificada nos contratos? [Completude, Clarifications C2, contracts POST /api/v1/trails] {auto}
  > _Evidência: contracts/template-schemas.md §Extensão: `templateId: z.string().uuid().optional(), groupId: z.string().uuid().optional()`. contracts POST /api/v1/trails: "Sem templateId: comportamento atual inalterado (retrocompatível)"._

- [x] CHK024 — O erro quando `templateId` aponta para template inexistente ou invisível (cross-tenant) está especificado sem vazar existência? [Segurança, contracts POST /api/v1/trails] {auto}
  > _Evidência: contracts POST /api/v1/trails: "Erros: 404 (template inexistente/invisível)". Resposta 404 unificada — não diferencia "não existe" de "existe mas é de outro tenant" (anti-enumeration)._

---

## 5. Soft-Delete

- [x] CHK025 — O soft-delete é definido como `deleted_at = now()` sem cascade em trilhas geradas? [Completude, Spec §FR-12, contracts DELETE] {auto}
  > _Evidência: Spec FR-12: "soft delete; bloqueado para plataforma (403); sem cascade". contracts DELETE: "Soft delete (deleted_at = now()); sem cascade. Trilhas materializadas a partir do template não são afetadas (FR-15)"._

- [x] CHK026 — O `GET /api/v1/templates` está especificado para filtrar `deleted_at IS NULL` por padrão (excluindo templates soft-deletados da listagem)? [Completude, contracts GET /api/v1/templates, Gap] {auto}
  > _RESOLVIDO inline: FR-22 adicionado à spec.md — "GET filtra deleted_at IS NULL por padrão; GET /:id retorna 404 para deletado". Originalmente: [Gap]. Requisito testável faltante: (a) GET lista deve excluir deleted_at IS NOT NULL por padrão; (b) GET /:id de template soft-deletado deve retornar 404._

- [x] CHK027 — A resposta de `GET /api/v1/templates/:id` para um template soft-deletado está definida (404 vs 410 Gone)? [Clareza, contracts GET /api/v1/templates/:id, Ambiguity] {auto}
  > _RESOLVIDO inline: FR-22 define explicitamente 404 para GET /:id de template deletado. Originalmente: [Ambiguity]. 404 segue a convenção do projeto (sem vazar estado); 410 Gone seria semanticamente mais preciso mas não observado no padrão existente. Requisito testável ausente._

---

## 6. Contrato API — Envelope, Paginação, Sort

- [x] CHK028 — O envelope de sucesso `{ data, meta? }` e o envelope de erro `{ statusCode, error, message, details? }` estão alinhados entre os contratos desta feature e o padrão do projeto? [Consistência, contracts/templates-api.md, CLAUDE.md] {auto}
  > _Evidência: contracts/templates-api.md: "Envelope de sucesso { data, meta? }; erro { statusCode, error, message, details? }. Datas ISO 8601; nulls explícitos." — alinhado com CLAUDE.md._

- [x] CHK029 — O `GET /api/v1/templates` possui paginação via `{ data: ContentTemplate[], meta: { total, page, pageSize } }`? [Completude, contracts GET /api/v1/templates] {auto}
  > _Evidência: contracts: `{ "data": ContentTemplate[], "meta": { total, page, pageSize } }`. Zod: TemplateListQuerySchema com page (default 1) e pageSize (default 20, max 100)._

- [x] CHK030 — Os parâmetros de sort estão consistentes entre spec US3 (`name_asc`, `name_desc`, `created_asc`, `created_desc`) e contracts/Zod (`name`, `-name`, `createdAt`, `-createdAt`)? [Consistência, Spec §US3, contracts GET /api/v1/templates, Conflict] {auto}
  > _RESOLVIDO inline: US3 atualizado para `name | -name | createdAt | -createdAt` (alinhado com Zod/contracts). Originalmente: [Conflict]. contracts GET /api/v1/templates e TemplateListQuerySchema no Zod definem `name | -name | createdAt | -createdAt`. São formatos incompatíveis. O contrato de implementação (contracts + Zod) deve prevalecer, mas US3 precisa ser atualizado para usar o mesmo formato._

- [x] CHK031 — O campo `limit` vs `pageSize` no meta de paginação está consistente entre spec US3 e contracts/Zod? [Consistência, Spec §US3, contracts, Conflict] {auto}
  > _RESOLVIDO inline: US3 atualizado para `pageSize` (alinhado com Zod/contracts). Originalmente: [Conflict]. contracts GET /api/v1/templates: `meta: { total, page, pageSize }`. Zod: pageSize. O campo no meta usa nomes diferentes. Precisa unificar antes de implementar._

- [x] CHK032 — Todos os endpoints de template aplicam `@Roles(admin_tenant)` e o acesso de roles inferiores (ex: `lider`) retorna 403? [Segurança, Spec §FR-16, contracts] {auto}
  > _Evidência: contracts: "@Roles(admin_tenant) em toda a superfície de templates". plan §A5: "templates exigem @Roles(ADMIN_TENANT) puro → controller dedicado mais limpo"._

- [x] CHK033 — O `GET /api/v1/templates/:id/versions` está especificado com seu campo de ordenação e escopo (`source_trail_id`)? [Completude, contracts GET /versions] {auto}
  > _Evidência: contracts: "lista todas as versões de um sourceTrailId (ordenado por version ASC)". Spec FR-13 confirma. Spec US3 confirma._

---

## 7. Zod Schemas

- [x] CHK034 — Os schemas Zod estão todos nomeados e localizados em `packages/types/src/content/template.schema.ts` com re-exports em `packages/types/src/index.ts`? [Completude, Spec §FR-19, contracts/template-schemas.md] {auto}
  > _Evidência: contracts/template-schemas.md especifica o arquivo completo com: TemplateScopeSchema, TemplateLessonSchema, TemplateModuleSchema, TemplateStructureSchema, ContentTemplateSchema, CreateTemplateRequestSchema, UpdateTemplateRequestSchema, TemplateListQuerySchema, TemplateVersionItemSchema. Re-exports listados em packages/types/src/index.ts._

- [x] CHK035 — Os snapshot tests para Zod schemas estão especificados como requisito (gate contra breaking changes silenciosos)? [Completude, Spec §FR-19, Spec §Testes Requeridos] {auto}
  > _Evidência: Spec FR-19: "com snapshot tests". Spec §Testes Requeridos: "Unit: Schemas Zod + snapshot tests em packages/types". plan §4.2 e §4.6 confirmam._

- [x] CHK036 — O `TemplateVersionItemSchema` tem campos suficientes para o endpoint `GET /api/v1/templates/:id/versions` retornar informações utilizáveis (ex: `id`, `version`, `createdAt`, `name`)? [Completude, contracts/template-schemas.md, Gap] {auto}
  > _Evidência: contracts/template-schemas.md linhas 73-79: `TemplateVersionItemSchema = z.object({ id, version, name, createdAt, createdBy })` — 5 campos presentes, suficientes para UI mostrar rótulo da versão. Falso positivo do checklist — item resolvido. no corpo do arquivo. O contrato do endpoint GET /versions também não especifica os campos da resposta item-por-item. Sem definição explícita, o desenvolvedor definirá por conta própria — risco de campo faltante (ex: sem name a UI não pode mostrar o rótulo da versão)._

---

## 8. Seed de Plataforma

- [x] CHK037 — O seed define os 3 templates de plataforma com estrutura específica (nomes, contagem de módulos e lições)? [Completude, Spec §US1, plan §4.4] {auto}
  > _Evidência: plan §4.4: "Discipulado Básico (4 módulos / 12 lições); Estudo Bíblico Temático (3 / 9); Acolhimento de Novos Membros (2 / 6)". Spec US1 Critérios de Aceite confirma contagens._

- [x] CHK038 — A estratégia de idempotência do seed (upsert por chave natural) está definida? [Completude, plan §4.4, plan §A10] {auto}
  > _Evidência: plan §4.4: "idempotente (upsert por name + scope=platform OU por id fixo UUIDv7 determinístico)". plan §A10: "Seed idempotente de 3 templates platform (upsert por chave natural)"._

- [x] CHK039 — O seed especifica `source_trail_id = NULL` e `version = 1` para os 3 templates platform? [Completude, plan §4.4, data-model.md §Notas de campos] {auto}
  > _Evidência: plan §4.4: "tenant_id NULL, scope platform, source_trail_id NULL, version 1". data-model.md §Notas: "NULL para templates platform (seed)"._

---

## 9. Edge Cases e Cenários de Contorno

- [x] CHK040 — O edge case de template criado a partir de trilha sem módulos (0 módulos) está especificado? [Cobertura de Edge Cases, Spec §Testes Requeridos] {auto}
  > _Evidência: Spec §Testes Requeridos: "Edge: Template de trilha sem módulos (0 módulos)". Coberto._

- [x] CHK041 — O comportamento quando `templateId` referencia template soft-deletado (`deleted_at IS NOT NULL`) em `POST /api/v1/trails` está definido (404)? [Cobertura de Edge Cases, contracts POST /api/v1/trails, Gap] {auto}
  > _RESOLVIDO inline: US4 atualizado para "404 se templateId não encontrado, invisível, deletado ou não plataforma; não vazar existência cross-tenant". Originalmente: [Gap]. Porém não especifica se template com deleted_at NOT NULL cai no mesmo 404 (comportamento correto — deletado = invisível para fins de materialização) ou se há tratamento diferente. Requisito testável ausente: "POST /api/v1/trails com templateId de template deletado deve retornar 404"._

- [x] CHK042 — O comportamento do `GET /api/v1/templates/:id/versions` quando `source_trail_id` é NULL (templates platform sem histórico de versão) está definido? [Cobertura de Edge Cases, contracts GET /versions, Ambiguity] {auto}
  > _RESOLVIDO inline: FR-13 atualizado — "retorna `{ data: [] }` (array vazio) para templates com source_trail_id = NULL". Originalmente: [Ambiguity]. O endpoint GET /versions "lista todas as versões de um sourceTrailId" — mas para templates platform não há sourceTrailId. Deve retornar 200 com array vazio OU 404? Este edge case não está documentado._

---

## Notes

- Items `{auto}` foram resolvidos pelo agente com citação de evidência (`[x]`) ou marcados com `[Gap]`/`[Ambiguity]`/`[Conflict]` quando a evidência foi verificada como ausente.
- Items `{humano}` aguardando decisão do produto: nenhum nesta rodada — todos os gaps são técnicos resolvíveis com clareza de requisito.
- Marcar itens concluídos com `[x]` após resolução.

---

## Resumo de Resolução

| Status | Qtd | Itens |
|--------|-----|-------|
| `[x]` resolvidos com evidência | 29 | CHK001–008, CHK010–018, CHK020–025, CHK028–029, CHK032–035, CHK037–040 |
| `[Gap]` — requisito ausente (→ create-tasks) | 4 | CHK009, CHK026, CHK036, CHK041 |
| `[Ambiguity]` — requisito ambíguo (→ clarify) | 3 | CHK019, CHK027, CHK042 |
| `[Conflict]` — inconsistência entre artefatos (→ clarify) | 2 | CHK030, CHK031 |

**Total: 42 items** (40 soft cap + 2 por criticidade dos conflitos de nomenclatura de API)

---

## Próximos Passos

### `[Ambiguity]` / `[Conflict]` — resolver na spec antes de create-tasks

| CHK | Problema | Ação sugerida |
|-----|----------|---------------|
| CHK019 | "Versão mais recente" de templates platform (`source_trail_id=NULL`) pode ser excluída pelo filter de deduplicação | Adicionar ao FR-09: "Templates com source_trail_id = NULL são sempre incluídos individualmente (não agrupados)" |
| CHK027 | GET /:id de template deletado: 404 vs 410? | Adotar 404 (alinha padrão projeto) e adicionar ao contrato |
| CHK030 | Sort: `name_asc` (US3) vs `name` (contracts/Zod) | Atualizar US3 para usar formato do Zod (`name`, `-name`, `createdAt`, `-createdAt`) |
| CHK031 | Paginação meta: `limit` (US3) vs `pageSize` (contracts/Zod) | Definir padrão canônico e unificar (recomendação: `pageSize` alinhado com Zod desta feature) |
| CHK042 | GET /versions para template platform (`source_trail_id=NULL`) | Definir: retornar 200 com array vazio OU 404 |

### `[Gap]` — viram requisitos funcionais adicionais em create-tasks

| CHK | Gap | FR a adicionar |
|-----|-----|----------------|
| CHK009 | Seed: role/privilege para `tenant_id=NULL` não especificado | `FR-21`: Seed executa com role BYPASSRLS/owner; documentar mecanismo no quickstart e adicionar teste |
| CHK026 | GET lista não define filtro de `deleted_at IS NULL` | `FR-22`: GET /api/v1/templates filtra `deleted_at IS NULL` por padrão; GET /:id retorna 404 para deletado |
| CHK036 | `TemplateVersionItemSchema` incompleto (campos não listados nos contratos) | Completar schema no contracts/template-schemas.md com todos os campos do response |
| CHK041 | templateId deletado em POST /api/v1/trails: 404 não explicitado | Adicionar ao contrato: "templateId com deleted_at NOT NULL → 404 (mesmo tratamento de inexistente)" |
