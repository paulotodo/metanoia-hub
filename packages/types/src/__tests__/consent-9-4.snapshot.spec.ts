/* eslint-disable @metanoia/no-surveillance-terms --
 * `focus_monitoring` is the canonical ConsentType enum value (defined in
 * consent.ts, where it is rule-exempt as a z.enum member). These snapshot
 * tests must feed that exact literal as object-property values, which the rule
 * would otherwise flag. No user-facing surveillance vocabulary is introduced. */
import { describe, it, expect } from 'vitest';
import {
  DataProcessingRegistryItemSchema,
  ConsentHistoryItemSchema,
  ConsentRecordSchema,
  WithdrawConsentInputSchema,
  WithdrawConsentResponseSchema,
  // Verify story 2-8 schemas not broken
  ConsentDocumentTypeSchema,
  AcceptConsentInputSchema,
  AcceptConsentResponseSchema,
  ConsentStatusResponseSchema,
} from '../consent';

// ---------------------------------------------------------------------------
// Story 9-4 — Snapshot tests (gate against silent breaking changes)
// ---------------------------------------------------------------------------

describe('DataProcessingRegistryItemSchema snapshot', () => {
  it('parses a valid registry item', () => {
    const input = {
      id: '0197a000-0000-7000-8000-000000000001',
      operationName: 'Autenticação e Controle de Acesso',
      legalBasis: 'contract',
      purpose: 'Verificar identidade do usuário e controlar acesso à plataforma.',
      dataCategories: ['email', 'hashed_password', 'session_token'],
      retentionPeriod: '90 days after account deletion',
      thirdPartySharing: 'Keycloak (identity provider, same data controller)',
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    };
    expect(DataProcessingRegistryItemSchema.parse(input)).toMatchSnapshot();
  });

  it('accepts null thirdPartySharing', () => {
    const input = {
      id: '0197a000-0000-7000-8000-000000000002',
      operationName: 'Notas Pastorais',
      legalBasis: 'legitimate_interest',
      purpose: 'Registro de acompanhamento pastoral pelo líder.',
      dataCategories: ['pastoral_notes', 'care_actions'],
      retentionPeriod: '5 years',
      thirdPartySharing: null,
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
    };
    expect(DataProcessingRegistryItemSchema.parse(input)).toMatchSnapshot();
  });
});

describe('ConsentHistoryItemSchema snapshot', () => {
  it('parses accepted mandatory item', () => {
    const input = {
      consentType: 'terms_of_service',
      status: 'accepted',
      isMandatory: true,
      acceptedAt: '2026-01-01T10:00:00.000Z',
      acceptedVersion: '1.0',
      withdrawnAt: null,
    };
    expect(ConsentHistoryItemSchema.parse(input)).toMatchSnapshot();
  });

  it('parses withdrawn optional item', () => {
    const input = {
      consentType: 'focus_monitoring',
      status: 'withdrawn',
      isMandatory: false,
      acceptedAt: '2026-01-01T10:00:00.000Z',
      acceptedVersion: '1.0',
      withdrawnAt: '2026-06-11T08:00:00.000Z',
    };
    expect(ConsentHistoryItemSchema.parse(input)).toMatchSnapshot();
  });

  it('parses pending item (no consent yet)', () => {
    const input = {
      consentType: 'focus_monitoring',
      status: 'pending',
      isMandatory: false,
      acceptedAt: null,
      acceptedVersion: null,
      withdrawnAt: null,
    };
    expect(ConsentHistoryItemSchema.parse(input)).toMatchSnapshot();
  });
});

describe('ConsentRecordSchema snapshot', () => {
  it('parses a withdrawal record with tenantId', () => {
    const input = {
      id: '0197a000-0000-7000-8000-000000000010',
      userId: '0197a000-0000-7000-8000-000000000020',
      tenantId: '0197a000-0000-7000-8000-000000000030',
      consentType: 'focus_monitoring',
      action: 'withdrawn' as const,
      timestamp: '2026-06-11T08:00:00.000Z',
    };
    expect(ConsentRecordSchema.parse(input)).toMatchSnapshot();
  });

  it('parses a withdrawal record with null tenantId', () => {
    const input = {
      id: '0197a000-0000-7000-8000-000000000011',
      userId: '0197a000-0000-7000-8000-000000000021',
      tenantId: null,
      consentType: 'focus_monitoring',
      action: 'withdrawn' as const,
      timestamp: '2026-06-11T09:00:00.000Z',
    };
    expect(ConsentRecordSchema.parse(input)).toMatchSnapshot();
  });
});

describe('WithdrawConsentInputSchema snapshot', () => {
  it('parses empty body (strict)', () => {
    expect(WithdrawConsentInputSchema.parse({})).toMatchSnapshot();
  });

  it('rejects extra fields (strict mode)', () => {
    expect(() =>
      WithdrawConsentInputSchema.parse({ reason: 'no longer needed' }),
    ).toThrow();
  });
});

describe('WithdrawConsentResponseSchema snapshot', () => {
  it('parses a withdrawal response', () => {
    const input = {
      data: {
        recordId: '0197a000-0000-7000-8000-000000000040',
        consentType: 'focus_monitoring',
        action: 'withdrawn' as const,
        withdrawnAt: '2026-06-11T08:00:00.000Z',
      },
    };
    expect(WithdrawConsentResponseSchema.parse(input)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Story 2-8 — Verify existing schemas not broken (regression guard)
// ---------------------------------------------------------------------------

describe('Story 2-8 schemas not broken by 9-4 additions', () => {
  it('ConsentDocumentTypeSchema still accepts only terms_of_service and privacy_policy', () => {
    expect(ConsentDocumentTypeSchema.options).toEqual([
      'terms_of_service',
      'privacy_policy',
    ]);
  });

  it('AcceptConsentInputSchema parses valid input', () => {
    const input = { documentType: 'terms_of_service', version: '1.0' };
    expect(AcceptConsentInputSchema.parse(input)).toMatchSnapshot();
  });

  it('AcceptConsentResponseSchema parses valid response', () => {
    const input = {
      data: {
        consentId: '0197a000-0000-7000-8000-000000000050',
        documentType: 'privacy_policy',
        version: '1.0',
        acceptedAt: '2026-06-11T08:00:00.000Z',
      },
    };
    expect(AcceptConsentResponseSchema.parse(input)).toMatchSnapshot();
  });

  it('ConsentStatusResponseSchema parses valid response', () => {
    const input = {
      data: {
        documents: [
          {
            documentType: 'terms_of_service',
            currentVersion: '1.0',
            acceptedVersion: '1.0',
            acceptedAt: '2026-01-01T00:00:00.000Z',
            isUpToDate: true,
          },
        ],
        allUpToDate: true,
      },
    };
    expect(ConsentStatusResponseSchema.parse(input)).toMatchSnapshot();
  });
});
