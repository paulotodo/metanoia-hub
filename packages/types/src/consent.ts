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
