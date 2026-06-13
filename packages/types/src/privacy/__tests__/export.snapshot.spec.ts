/**
 * Snapshot tests for privacy export Zod schemas (Story 9-1 / FASE 1.1.4).
 * Gate against silent breaking changes in schema shape.
 */
import { describe, expect, it } from 'vitest';
import {
  PrivacyExportRequestSchema,
  PrivacyExportJobResponseSchema,
  PrivacyExportStatusSchema,
  UserProfileExportSchema,
  UserExportDataSchema,
  GroupsExportDataSchema,
  MeetingsExportDataSchema,
  TrailsExportDataSchema,
  PastoralExportDataSchema,
  ConsentExportDataSchema,
  AuditExportDataSchema,
  FullExportPayloadSchema,
} from '../export';

const now = '2026-06-12T10:00:00.000Z';
const uuid = '00000000-0000-7000-8000-000000000001';

describe('PrivacyExportRequestSchema', () => {
  it('accepts json format', () => {
    const result = PrivacyExportRequestSchema.parse({ format: 'json' });
    expect(result).toMatchSnapshot();
  });

  it('accepts pdf format', () => {
    const result = PrivacyExportRequestSchema.parse({ format: 'pdf' });
    expect(result).toMatchSnapshot();
  });

  it('rejects unknown format', () => {
    expect(() => PrivacyExportRequestSchema.parse({ format: 'xml' })).toThrow();
  });
});

describe('PrivacyExportJobResponseSchema', () => {
  it('matches snapshot', () => {
    const result = PrivacyExportJobResponseSchema.parse({
      jobId: uuid,
      status: 'accepted',
      estimatedCompletionHours: 24,
    });
    expect(result).toMatchSnapshot();
  });
});

describe('PrivacyExportStatusSchema', () => {
  it('matches snapshot — accepted', () => {
    const result = PrivacyExportStatusSchema.parse({
      jobId: uuid,
      status: 'accepted',
      signedUrl: null,
      expiresAt: null,
      failureReason: null,
    });
    expect(result).toMatchSnapshot();
  });

  it('matches snapshot — completed', () => {
    const result = PrivacyExportStatusSchema.parse({
      jobId: uuid,
      status: 'completed',
      signedUrl: 'https://example.com/file.json?sig=abc',
      expiresAt: now,
      failureReason: null,
    });
    expect(result).toMatchSnapshot();
  });

  it('matches snapshot — failed', () => {
    const result = PrivacyExportStatusSchema.parse({
      jobId: uuid,
      status: 'failed',
      signedUrl: null,
      expiresAt: null,
      failureReason: 'Internal error',
    });
    expect(result).toMatchSnapshot();
  });
});

describe('UserProfileExportSchema', () => {
  it('matches snapshot', () => {
    const result = UserProfileExportSchema.parse({
      id: uuid,
      email: 'user@example.com',
      name: 'Test User',
      status: 'active',
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(result).toMatchSnapshot();
  });

  it('accepts null onboardingCompletedAt', () => {
    const result = UserProfileExportSchema.parse({
      id: uuid,
      email: 'user@example.com',
      name: 'Test User',
      status: 'pending_verification',
      onboardingCompletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(result).toMatchSnapshot();
  });
});

describe('UserExportDataSchema', () => {
  it('matches snapshot', () => {
    const result = UserExportDataSchema.parse({
      profile: {
        id: uuid,
        email: 'user@example.com',
        name: 'Test User',
        status: 'active',
        onboardingCompletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      tenants: [{ tenantId: uuid, role: 'participante', joinedAt: now }],
    });
    expect(result).toMatchSnapshot();
  });

  it('accepts null profile', () => {
    const result = UserExportDataSchema.parse({ profile: null, tenants: [] });
    expect(result).toMatchSnapshot();
  });
});

describe('GroupsExportDataSchema', () => {
  it('matches snapshot', () => {
    const result = GroupsExportDataSchema.parse({
      memberships: [{ groupId: uuid, groupName: 'Célula Norte', role: 'membro', joinedAt: now }],
    });
    expect(result).toMatchSnapshot();
  });
});

describe('MeetingsExportDataSchema', () => {
  it('matches snapshot', () => {
    const result = MeetingsExportDataSchema.parse({
      attendance: [
        {
          meetingId: uuid,
          title: 'Reunião Semanal',
          presenceType: 'integral',
          joinTime: now,
          leaveTime: now,
        },
      ],
      participantRecords: [
        { id: uuid, meetingId: uuid, duration: 3600, joinedAt: now, leftAt: now },
      ],
    });
    expect(result).toMatchSnapshot();
  });
});

describe('TrailsExportDataSchema', () => {
  it('matches snapshot', () => {
    const result = TrailsExportDataSchema.parse({
      trailProgress: [
        {
          trailId: uuid,
          trailName: 'Trilha Discipulado',
          progressPercent: 80,
          completedAt: null,
          updatedAt: now,
        },
      ],
      lessonProgress: [
        {
          lessonId: uuid,
          lessonName: 'Aula 1',
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        },
      ],
    });
    expect(result).toMatchSnapshot();
  });
});

describe('PastoralExportDataSchema', () => {
  it('matches snapshot', () => {
    const result = PastoralExportDataSchema.parse({
      alertsAboutMe: [{ id: uuid, signalType: 'absence', createdAt: now }],
      notesAboutMe: [
        { id: uuid, noteType: 'care', occurredAt: now, content: 'Visitei o membro' },
      ],
    });
    expect(result).toMatchSnapshot();
  });
});

describe('ConsentExportDataSchema', () => {
  it('matches snapshot', () => {
    const result = ConsentExportDataSchema.parse({
      acceptances: [{ documentType: 'terms_of_service', version: '1.0', acceptedAt: now }],
      withdrawals: [{ consentType: 'marketing_emails', timestamp: now }],
    });
    expect(result).toMatchSnapshot();
  });
});

describe('AuditExportDataSchema', () => {
  it('matches snapshot', () => {
    const result = AuditExportDataSchema.parse({
      events: [
        { action: 'user.login', resource: 'session', resourceId: null, timestamp: now },
      ],
    });
    expect(result).toMatchSnapshot();
  });
});

describe('FullExportPayloadSchema', () => {
  it('matches snapshot', () => {
    const result = FullExportPayloadSchema.parse({
      exportedAt: now,
      format: 'json',
      user: {
        profile: {
          id: uuid,
          email: 'user@example.com',
          name: 'Test User',
          status: 'active',
          onboardingCompletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        tenants: [{ tenantId: uuid, role: 'participante', joinedAt: now }],
      },
      tenants: [
        {
          tenantId: uuid,
          groups: { memberships: [] },
          meetings: { attendance: [], participantRecords: [] },
          trails: { trailProgress: [], lessonProgress: [] },
          pastoral: { alertsAboutMe: [], notesAboutMe: [] },
          consent: { acceptances: [], withdrawals: [] },
          audit: { events: [] },
        },
      ],
    });
    expect(result).toMatchSnapshot();
  });
});
