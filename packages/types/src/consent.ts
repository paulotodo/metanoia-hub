import { z } from 'zod';

// ============================================================================
// Story 2-8 — LGPD consent + terms.
//
// Each user has consent records in the `consents` table. The current version
// of each document lives server-side (constant for now; DB-driven once
// Story 9-4 lands). This contract drives the consent middleware and the
// re-consent endpoint shown to users when versions drift.
// ============================================================================

export const ConsentDocumentTypeSchema = z.enum([
  'terms_of_service',
  'privacy_policy',
]);
export type ConsentDocumentType = z.infer<typeof ConsentDocumentTypeSchema>;

// ============================================================================
// Story 9-4 — Base Legal & Histórico de Consentimento (LGPD Art. 7º / 9º).
//
// ConsentTypeSchema extends document types with focus_monitoring (consent-based
// processing that users may withdraw). Maps 1:1 to ConsentDocumentType for
// terms_of_service and privacy_policy (mandatory; withdrawal forbidden).
// ============================================================================

/**
 * ConsentTypeSchema: all consent-trackable types in the system.
 * - terms_of_service / privacy_policy: mandatory (LGPD Art. 7º IV — contract)
 * - focus_monitoring: optional (LGPD Art. 7º I — consent-based)
 */
export const ConsentTypeSchema = z.enum([
  'terms_of_service',
  'privacy_policy',
  'focus_monitoring',
]);
export type ConsentType = z.infer<typeof ConsentTypeSchema>;

/**
 * LegalBasisSchema: LGPD Art. 7º legal grounds for data processing.
 */
export const LegalBasisSchema = z.enum([
  'consent',         // Art. 7º I  — titular consent
  'contract',        // Art. 7º IV — contract performance
  'legal_obligation',// Art. 7º II — legal obligation
  'legitimate_interest', // Art. 7º IX — legitimate interest
]);
export type LegalBasis = z.infer<typeof LegalBasisSchema>;

/**
 * DataProcessingRegistryItemSchema: single entry from data_processing_registry.
 * Global (no tenant_id); public endpoint GET /api/v1/privacy/data-processing.
 */
export const DataProcessingRegistryItemSchema = z.object({
  id: z.string().uuid(),
  operationName: z.string().min(1),
  legalBasis: LegalBasisSchema,
  purpose: z.string().min(1),
  dataCategories: z.array(z.string()),
  retentionPeriod: z.string().min(1),
  thirdPartySharing: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DataProcessingRegistryItem = z.infer<typeof DataProcessingRegistryItemSchema>;

export const DataProcessingRegistryResponseSchema = z.object({
  data: z.array(DataProcessingRegistryItemSchema),
});
export type DataProcessingRegistryResponse = z.infer<typeof DataProcessingRegistryResponseSchema>;

/**
 * ConsentRecordSchema: single row from consent_records (withdrawal log).
 * Tenant-scoped (RLS NULLIF); append-only.
 */
export const ConsentRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  consentType: ConsentTypeSchema,
  action: z.literal('withdrawn'),
  timestamp: z.string().datetime(),
});
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

/**
 * ConsentStatusBadgeSchema: UI badge for a consent item.
 */
export const ConsentStatusBadgeSchema = z.enum([
  'accepted',
  'withdrawn',
  'pending',
]);
export type ConsentStatusBadge = z.infer<typeof ConsentStatusBadgeSchema>;

/**
 * ConsentHistoryItemSchema: merged view of aceites + withdrawals for one
 * ConsentType. Powers the "Privacidade & Consentimento" profile page.
 */
export const ConsentHistoryItemSchema = z.object({
  consentType: ConsentTypeSchema,
  status: ConsentStatusBadgeSchema,
  isMandatory: z.boolean(),
  acceptedAt: z.string().datetime().nullable(),
  acceptedVersion: z.string().nullable(),
  withdrawnAt: z.string().datetime().nullable(),
});
export type ConsentHistoryItem = z.infer<typeof ConsentHistoryItemSchema>;

export const ConsentHistoryResponseSchema = z.object({
  data: z.array(ConsentHistoryItemSchema),
});
export type ConsentHistoryResponse = z.infer<typeof ConsentHistoryResponseSchema>;

/**
 * WithdrawConsentInputSchema: PATCH /api/v1/consent/:consentType/withdraw body.
 * Body is intentionally empty (consentType comes from path param); kept as
 * typed object for future extension (e.g. reason field).
 */
export const WithdrawConsentInputSchema = z.object({}).strict();
export type WithdrawConsentInput = z.infer<typeof WithdrawConsentInputSchema>;

export const WithdrawConsentResponseSchema = z.object({
  data: z.object({
    recordId: z.string().uuid(),
    consentType: ConsentTypeSchema,
    action: z.literal('withdrawn'),
    withdrawnAt: z.string().datetime(),
  }),
});
export type WithdrawConsentResponse = z.infer<typeof WithdrawConsentResponseSchema>;

/** Mandatory consent types — withdrawal forbidden (BadRequestException 400). */
export const MANDATORY_CONSENT_TYPES: ConsentType[] = [
  'terms_of_service',
  'privacy_policy',
] as const;

export const ConsentDocumentStatusSchema = z.object({
  documentType: ConsentDocumentTypeSchema,
  currentVersion: z.string().min(1),
  acceptedVersion: z.string().nullable(),
  acceptedAt: z.string().datetime().nullable(),
  isUpToDate: z.boolean(),
});
export type ConsentDocumentStatus = z.infer<typeof ConsentDocumentStatusSchema>;

export const ConsentStatusResponseSchema = z.object({
  data: z.object({
    documents: z.array(ConsentDocumentStatusSchema),
    allUpToDate: z.boolean(),
  }),
});
export type ConsentStatusResponse = z.infer<typeof ConsentStatusResponseSchema>;

export const AcceptConsentInputSchema = z.object({
  documentType: ConsentDocumentTypeSchema,
  version: z.string().min(1),
});
export type AcceptConsentInput = z.infer<typeof AcceptConsentInputSchema>;

export const AcceptConsentResponseSchema = z.object({
  data: z.object({
    consentId: z.string().uuid(),
    documentType: ConsentDocumentTypeSchema,
    version: z.string(),
    acceptedAt: z.string().datetime(),
  }),
});
export type AcceptConsentResponse = z.infer<typeof AcceptConsentResponseSchema>;
