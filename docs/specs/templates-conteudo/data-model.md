# Data Model — Templates de Conteúdo Reutilizáveis (FR42 / Story 13.5)

## 1. Novo model Prisma: `ContentTemplate`

```prisma
enum TemplateScope {
  platform
  tenant
}

/// ContentTemplate — snapshot imutável da ESTRUTURA de uma trilha (Story 13-5 / FR42).
/// structure JSONB contém apenas metadados estruturais — NUNCA conteúdo real.
model ContentTemplate {
  id            String        @id @db.Uuid                       // uuidv7()
  tenantId      String?       @map("tenant_id") @db.Uuid         // NULL = platform
  scope         TemplateScope                                    // platform | tenant
  sourceTrailId String?       @map("source_trail_id") @db.Uuid   // FK→trails (nullable)
  name          String        @db.VarChar(255)
  description   String?       @db.VarChar(1000)
  version       Int           @default(1)
  structure     Json                                             // JSONB (ver §3)
  createdBy     String        @map("created_by") @db.Uuid
  createdAt     DateTime      @default(now()) @map("created_at") @db.Timestamptz
  deletedAt     DateTime?     @map("deleted_at") @db.Timestamptz

  sourceTrail Trail? @relation("TrailTemplates", fields: [sourceTrailId], references: [id], onDelete: SetNull, onUpdate: Cascade)

  @@unique([sourceTrailId, version], name: "content_templates_source_trail_version")
  @@index([tenantId])
  @@index([tenantId, scope])
  @@index([tenantId, deletedAt])
  @@index([sourceTrailId])
  @@map("content_templates")
}
```

Relação inversa em `Trail` (adicionar):
```prisma
  // dentro de model Trail
  contentTemplates ContentTemplate[] @relation("TrailTemplates")
```

### Notas de campos

| Campo | Tipo | Regra |
|-------|------|-------|
| `id` | UUID | `uuidv7()` — nunca `@default(uuid())`. |
| `tenant_id` | UUID? | `NULL` = platform (FR-02). Prisma extension auto-injeta em writes de tenant; platform inserido pelo seed. |
| `scope` | enum | `platform`/`tenant`. Redundante com `tenant_id IS NULL` mas explícito p/ filtro/UX (FR-09). |
| `source_trail_id` | UUID? | FK→`trails(id)` `ON DELETE SET NULL`. NULL para templates platform (seed). |
| `name` | varchar(255) | obrigatório. |
| `description` | varchar(1000)? | nullable. |
| `version` | int | default 1; `MAX(version)+1` por `source_trail_id` (FR-08). |
| `structure` | JSONB | §3; sem conteúdo. |
| `created_by` | UUID | `ctx.userId` (RequestContext). Seed platform: UUID do operador/sistema. |
| `created_at` | timestamptz | default now(). |
| `deleted_at` | timestamptz? | soft delete (FR-12). |

> **`updated_at`:** a spec lista somente `created_at`. PATCH atualiza `name`/`description`
> in-place sem exigir `updated_at`. Se for adicionado posteriormente, lembrar lição 13-2b
> (seeds raw precisam setar `updated_at=now()`). Mantido **fora** por ora.

## 2. Migration SQL (`20260628000000_13-5-content-templates/migration.sql`)

```sql
-- Story 13-5 / FR42: Content Templates (reusable trail structure snapshots)

-- 1. Enum scope (Prisma-managed type)
CREATE TYPE "TemplateScope" AS ENUM ('platform', 'tenant');

-- 2. Table
CREATE TABLE content_templates (
  id              UUID          NOT NULL PRIMARY KEY,
  tenant_id       UUID,                                  -- NULL = platform
  scope           "TemplateScope" NOT NULL,
  source_trail_id UUID          REFERENCES trails(id) ON DELETE SET NULL ON UPDATE CASCADE,
  name            VARCHAR(255)  NOT NULL,
  description     VARCHAR(1000),
  version         INTEGER       NOT NULL DEFAULT 1,
  structure       JSONB         NOT NULL,
  created_by      UUID          NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- 3. Logical version key
CREATE UNIQUE INDEX content_templates_source_trail_version_idx
  ON content_templates (source_trail_id, version);

-- 4. Query indexes
CREATE INDEX content_templates_tenant_idx        ON content_templates (tenant_id);
CREATE INDEX content_templates_tenant_scope_idx  ON content_templates (tenant_id, scope);
CREATE INDEX content_templates_tenant_deleted_idx ON content_templates (tenant_id, deleted_at);
CREATE INDEX content_templates_source_trail_idx  ON content_templates (source_trail_id);

-- 5. RLS — split READ (platform visible to all) from WRITE (own tenant only).
--    SECURITY-CRITICAL (owasp gate, dec-015): a single bare USING() with the
--    `tenant_id IS NULL` branch is ALSO applied to writes when WITH CHECK is
--    absent — that would let ANY tenant INSERT/UPDATE a row with tenant_id=NULL,
--    forging a platform template visible to all tenants (A01 Broken Access
--    Control / API3 BOPLA). So:
--      * READ  policy (FOR SELECT): USING allows NULL (platform) OR own tenant.
--      * WRITE policy (INSERT/UPDATE/DELETE): WITH CHECK restricts to own
--        tenant_id ONLY — NEVER NULL. Platform rows are written exclusively by
--        the seed (elevated role / RLS bypass), not the request path. Mirrors
--        meeting_events_tenant_insert (consolidate_rls_nullif migration).
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates FORCE ROW LEVEL SECURITY;

-- READ: platform (NULL) visible to everyone + own tenant rows
CREATE POLICY content_templates_read ON content_templates
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- INSERT: only own tenant_id (no NULL — tenants cannot forge platform rows)
CREATE POLICY content_templates_insert ON content_templates
  FOR INSERT
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- UPDATE: row belongs to own tenant (USING) AND stays in own tenant (WITH CHECK)
CREATE POLICY content_templates_update ON content_templates
  FOR UPDATE
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- DELETE: only own tenant rows (platform not deletable via request path)
CREATE POLICY content_templates_delete ON content_templates
  FOR DELETE
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
```

> **Seed de platform vs RLS de escrita (sondar no execute-task):** com a policy de
> INSERT restrita a `tenant_id = current_tenant`, uma linha platform (`tenant_id
> NULL`) NÃO passa se inserida por role comum. O seed deve rodar como owner do
> banco (RLS não se aplica ao owner) OU com `SET LOCAL row_security = off` / role
> `BYPASSRLS`. Esta é a 1ª linha platform escrita por seed no projeto
> (`subscription-plans` não tem tenant nullable) — confirmar o mecanismo de seed.

> **Auditoria de colunas (lição 13-2b):** cada coluna acima mapeia 1:1 com o model Prisma
> (`@map`). Validar com `prisma generate` + `prisma migrate diff` antes de fechar a task.
> O `UNIQUE (source_trail_id, version)` permite múltiplos NULL em `source_trail_id`
> (Postgres trata NULL como distinto) — OK para os 3 templates platform (todos
> `source_trail_id NULL`, versões iguais a 1 não colidem porque NULL≠NULL no índice único).

## 3. JSONB `structure` — schema (sem conteúdo)

```jsonc
{
  "modules": [
    {
      "name": "string",
      "order": 0,
      "lessonAccessMode": "free | sequential",
      "lessons": [
        {
          "name": "string",
          "order": 0,
          "contentType": "<LessonContentType>",
          "estimatedDurationMinutes": 0
        }
      ]
    }
  ]
}
```

**Campos PROIBIDOS na structure** (nunca capturados — owasp / privacidade):
`contentUrl`, `contentBody`, `tags`, `originalName`, `mimeType`, `sizeBytes`,
`uploadedBy`, `uploadedAt`, qualquer `id`/`tenantId`/`createdBy` das lições/módulos-fonte.

## 4. Materialização (usar template → Trail+Module+Lesson)

`POST /api/v1/trails` com `templateId?`:
1. `template = TemplateRepository.findByIdForMaterialization(templateId)` (passa pela RLS:
   platform OU mesmo tenant).
2. Dentro de um `withTenantTx`:
   - cria `Trail` (`name` do body OU do template; `status='draft'`, `accessMode='free'`, `createdBy=ctx.userId`).
   - para cada módulo da `structure`: cria `Module` (`name`, `order`, `lessonAccessMode`).
   - para cada lição: cria `Lesson` com `name`, `order`, `contentType`,
     `estimatedDurationMinutes`, e **TODOS** os campos de conteúdo NULL
     (`contentUrl=null`, `contentBody=null`, `tags=[]`, `originalName=null`, `mimeType=null`,
     `sizeBytes=null`, `uploadedBy=null`, `uploadedAt=null`).
   - opcional: se `groupId?` presente, cria `GroupTrail` (assign à célula).
3. **Sem** gravar referência ao template na trilha (FR-15: cópia independente). DELETE do
   template depois não afeta a trilha.

## 5. Snapshot de criação de template (criar template ← trilha existente)

`POST /api/v1/templates` (`sourceTrailId`, `name`, `description?`):
1. Lê Trail + Modules + Lessons (não-deletados) do `sourceTrailId` (RLS garante same-tenant).
2. Monta `structure` whitelistando SÓ os campos estruturais (§3).
3. `version = nextVersion(sourceTrailId)` = `MAX(version)+1` (default 1 se primeiro).
4. Insere `ContentTemplate` (`scope='tenant'`, `tenant_id=ctx.tenantId`, `created_by=ctx.userId`).

## 6. Constraints / invariantes

- INV-1: template `platform` (`tenant_id NULL`) é read-only via API (PATCH/DELETE→403) E
  inescrevível via request-path (RLS write policies exigem `tenant_id = current_tenant`,
  nunca NULL — defesa em profundidade DB+service; dec-015).
- INV-2: `structure` nunca contém conteúdo (validado por owasp gate + service whitelist).
- INV-3: `(source_trail_id, version)` único.
- INV-4: trilha materializada é independente (sem FK reversa ao template).
- INV-5: tenant_id sempre via RequestContext, nunca parâmetro.
