import type { ConsentDocumentType } from '@metanoia/types';

/**
 * Current canonical versions of legal documents. Bump these to force users
 * to re-consent on next request that hits the ConsentGuard.
 *
 * Format: YYYY-MM-DD. Story 9-4 (Release 1b) replaces this with a DB-driven
 * registry plus a complete history of past versions.
 */
export const CURRENT_CONSENT_VERSIONS: Record<ConsentDocumentType, string> = {
  terms_of_service: '2026-04-09',
  privacy_policy: '2026-04-09',
};

export const REQUIRED_DOCUMENT_TYPES: ConsentDocumentType[] = [
  'terms_of_service',
  'privacy_policy',
];
