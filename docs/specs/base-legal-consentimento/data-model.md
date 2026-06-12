# Data Model: Base Legal & Histórico de Consentimento (Story 9-4)

## 1. Tabelas Novas

### 1.1 `data_processing_registry`

```sql
CREATE TABLE "data_processing_registry" (
    "id"                UUID         NOT NULL,
    "operation_name"    TEXT         NOT NULL UNIQUE,
    "legal_basis"       TEXT         NOT NULL CHECK (legal_basis IN (
                            'consent',
                            'legitimate_interest',
                            'legal_obligation',
                            'contract_execution'
                        )),
    "purpose"           TEXT         NOT NULL,
    "data_categories"   TEXT[]       NOT NULL DEFAULT '{}',
    "retention_period"  TEXT         NOT NULL,
    "third_party_sharing" TEXT[]     NOT NULL DEFAULT '{}',
    "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "data_processing_registry_pkey" PRIMARY KEY ("id")
);
```

**Sem tenant_id.** Tabela global da plataforma. **Sem RLS.** `prisma.client` (não-extendido).

Prisma model:
```prisma
model DataProcessingRegistry {
  id                String   @id @db.Uuid
  operationName     String   @unique @map("operation_name")
  legalBasis        String   @map("legal_basis")
  purpose           String
  dataCategories    String[] @map("data_categories")
  retentionPeriod   String   @map("retention_period")
  thirdPartySharing String[] @map("third_party_sharing")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("data_processing_registry")
}
```

### 1.2 `consent_records`

```sql
CREATE TABLE "consent_records" (
    "id"            UUID         NOT NULL,
    "user_id"       UUID         NOT NULL,
    "tenant_id"     UUID,                   -- nullable (consentimentos pré-tenant)
    "consent_type"  TEXT         NOT NULL CHECK (consent_type IN (
                        'terms_of_service',
                        'privacy_policy',
                        'focus_monitoring'
                    )),
    "action"        TEXT         NOT NULL CHECK (action IN ('withdrawn')),
    "timestamp"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);
```

**tenant_id nullable** (mesma razão de `consents.tenant_id`). RLS com NULLIF.

Prisma model:
```prisma
model ConsentRecord {
  id          String   @id @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  tenantId    String?  @map("tenant_id") @db.Uuid
  consentType String   @map("consent_type")
  action      String
  timestamp   DateTime @default(now()) @db.Timestamptz

  user User @relation(fields: [userId], references: [id])

  @@index([userId, consentType])
  @@index([tenantId])
  @@map("consent_records")
}
```

## 2. FK e Indexes

```sql
-- consent_records → users (CASCADE delete — user excluído limpa registros)
ALTER TABLE "consent_records"
    ADD CONSTRAINT "consent_records_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Index para lookup de withdrawal por user+type (FR-08, FR-11)
CREATE INDEX "consent_records_user_consent_idx"
    ON "consent_records" ("user_id", "consent_type");

-- Index para RLS
CREATE INDEX "consent_records_tenant_idx"
    ON "consent_records" ("tenant_id");

-- data_processing_registry não tem FK (tabela global independente)
```

## 3. RLS — `consent_records`

```sql
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant-scoped com NULLIF para registros sem tenant
CREATE POLICY "consent_records_tenant_isolation"
    ON "consent_records"
    USING (
        NULLIF(current_setting('app.current_tenant_id', true), '')::uuid IS NULL
        OR tenant_id IS NULL
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    );

-- INSERT: idem
CREATE POLICY "consent_records_tenant_insert"
    ON "consent_records"
    FOR INSERT
    WITH CHECK (
        tenant_id IS NULL
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    );
```

`data_processing_registry` **não tem RLS** — tabela global.

## 4. Seed via Migration (NFR-L5)

A migration inclui `INSERT INTO "data_processing_registry"` com as 10 operações iniciais.
Idempotente via `ON CONFLICT (operation_name) DO NOTHING`.

```sql
INSERT INTO "data_processing_registry"
  ("id", "operation_name", "legal_basis", "purpose",
   "data_categories", "retention_period", "third_party_sharing")
VALUES
  ('...uuid7...', 'user_authentication', 'contract_execution',
   'Autenticação e controle de acesso ao sistema',
   ARRAY['identificação', 'credenciais'], '5 anos após inatividade',
   ARRAY['Keycloak']),
  -- ... demais 9 operações
ON CONFLICT (operation_name) DO NOTHING;
```

## 5. User model — relação nova

Adicionar relação em `User` no schema.prisma:

```prisma
// no model User, adicionar:
consentRecords ConsentRecord[]
```

## 6. Convenções de Nomenclatura

| Camada | Padrão |
|---|---|
| Tabela SQL | snake_case via `@@map` |
| Coluna SQL | snake_case via `@map` |
| Model Prisma | PascalCase |
| Campo Prisma | camelCase |
| ID | UUID v7 via `generateId()` — sem `@default(uuid())` |
| timestamps | `@db.Timestamptz` em todos os campos de data |
