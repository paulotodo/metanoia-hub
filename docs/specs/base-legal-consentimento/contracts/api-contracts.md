# API Contracts: Base Legal & Histórico de Consentimento (Story 9-4)

## 1. Novos Schemas Zod (`packages/types/src/consent.ts`)

### 1.1 ConsentType (estendido)

```typescript
export const ConsentTypeSchema = z.enum([
  'terms_of_service',
  'privacy_policy',
  'focus_monitoring',
]);
export type ConsentType = z.infer<typeof ConsentTypeSchema>;
```

### 1.2 DataProcessingRegistry

```typescript
export const LegalBasisSchema = z.enum([
  'consent',
  'legitimate_interest',
  'legal_obligation',
  'contract_execution',
]);
export type LegalBasis = z.infer<typeof LegalBasisSchema>;

export const DataProcessingRegistryItemSchema = z.object({
  id: z.string().uuid(),
  operationName: z.string().min(1),
  legalBasis: LegalBasisSchema,
  purpose: z.string().min(1),
  dataCategories: z.array(z.string()),
  retentionPeriod: z.string().min(1),
  thirdPartySharing: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DataProcessingRegistryItem = z.infer<typeof DataProcessingRegistryItemSchema>;

export const DataProcessingRegistryResponseSchema = z.object({
  data: z.array(DataProcessingRegistryItemSchema),
});
export type DataProcessingRegistryResponse = z.infer<typeof DataProcessingRegistryResponseSchema>;
```

### 1.3 ConsentRecord (revogação)

```typescript
export const ConsentRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  consentType: ConsentTypeSchema,
  action: z.literal('withdrawn'),
  timestamp: z.string().datetime(),
});
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;
```

### 1.4 ConsentHistoryItem (consolidado aceites + revogações)

```typescript
export const ConsentStatusBadgeSchema = z.enum([
  'accepted',
  'withdrawn',
  'pending',
]);
export type ConsentStatusBadge = z.infer<typeof ConsentStatusBadgeSchema>;

export const ConsentHistoryItemSchema = z.object({
  consentType: ConsentTypeSchema,
  status: ConsentStatusBadgeSchema,
  isMandatory: z.boolean(),
  acceptedAt: z.string().datetime().nullable(),
  withdrawnAt: z.string().datetime().nullable(),
  documentUrl: z.string().url().nullable(),
});
export type ConsentHistoryItem = z.infer<typeof ConsentHistoryItemSchema>;

export const ConsentHistoryResponseSchema = z.object({
  data: z.array(ConsentHistoryItemSchema),
});
export type ConsentHistoryResponse = z.infer<typeof ConsentHistoryResponseSchema>;
```

### 1.5 WithdrawConsent

```typescript
export const WithdrawConsentInputSchema = z.object({
  consentType: ConsentTypeSchema,
});
export type WithdrawConsentInput = z.infer<typeof WithdrawConsentInputSchema>;

export const WithdrawConsentResponseSchema = z.object({
  data: z.object({
    consentType: ConsentTypeSchema,
    action: z.literal('withdrawn'),
    timestamp: z.string().datetime(),
  }),
});
export type WithdrawConsentResponse = z.infer<typeof WithdrawConsentResponseSchema>;
```

## 2. Endpoints

### 2.1 GET /api/v1/privacy/data-processing

**Auth**: nenhuma (público). **Guard**: nenhum.

Response `200`:
```json
{
  "data": [
    {
      "id": "019...",
      "operationName": "focus_monitoring",
      "legalBasis": "consent",
      "purpose": "Monitoramento de atenção em reuniões para apoio pastoral",
      "dataCategories": ["comportamento", "presença"],
      "retentionPeriod": "2 anos após última reunião",
      "thirdPartySharing": ["LiveKit"],
      "createdAt": "2026-06-18T00:00:00.000Z",
      "updatedAt": "2026-06-18T00:00:00.000Z"
    }
  ]
}
```

### 2.2 GET /api/v1/consent/history

**Auth**: `KeycloakAuthGuard`. **Consent**: `@SkipConsent()`.

Response `200`:
```json
{
  "data": [
    {
      "consentType": "terms_of_service",
      "status": "accepted",
      "isMandatory": true,
      "acceptedAt": "2026-04-09T10:00:00.000Z",
      "withdrawnAt": null,
      "documentUrl": "/privacidade/termos-de-uso"
    },
    {
      "consentType": "focus_monitoring",
      "status": "withdrawn",
      "isMandatory": false,
      "acceptedAt": null,
      "withdrawnAt": "2026-06-11T14:30:00.000Z",
      "documentUrl": null
    }
  ]
}
```

### 2.3 PATCH /api/v1/consent/:consentType/withdraw

**Auth**: `KeycloakAuthGuard`. **Consent**: `@SkipConsent()`.

Path param: `consentType` (validado contra `ConsentTypeSchema`).

Response `200`:
```json
{
  "data": {
    "consentType": "focus_monitoring",
    "action": "withdrawn",
    "timestamp": "2026-06-11T14:30:00.000Z"
  }
}
```

Error `400` se `consentType` é mandatório (`terms_of_service` / `privacy_policy`):
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Este consentimento é obrigatório para usar o serviço. Para revogá-lo, exclua sua conta."
}
```

## 3. Snapshot Tests (NFR-L6)

Arquivo: `packages/types/src/__tests__/consent.snap.spec.ts`

Cobrir:
- `DataProcessingRegistryItemSchema`
- `ConsentHistoryItemSchema`
- `ConsentRecordSchema`
- `WithdrawConsentInputSchema`
- `WithdrawConsentResponseSchema`

Padrão: `expect(schema.parse(validInput)).toMatchSnapshot()`.

## 4. MSW Handlers (apps/web)

Adicionar em `apps/web/src/mocks/handlers/consent.ts`:
- `GET /api/v1/privacy/data-processing` → 200 com array de 10 registros mock
- `GET /api/v1/consent/history` → 200 com array de 3 itens (2 aceitos, 1 revogado)
- `PATCH /api/v1/consent/:consentType/withdraw` → 200 para `focus_monitoring`; 400 para `terms_of_service`
