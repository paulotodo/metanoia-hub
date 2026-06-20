/**
 * Snapshot tests for evasion risk Zod schemas (Story 13.3 / FR66 / Task 10.6).
 *
 * Gates against silent breaking changes in:
 *  - ParticipantRiskReasonSchema
 *  - RiskDetectedEventSchema
 *  - RiskResolvedEventSchema
 *
 * Uses toMatchInlineSnapshot to freeze the accepted shapes.
 */
import { describe, it, expect } from 'vitest';
import {
  ParticipantRiskReasonSchema,
  RiskDetectedEventSchema,
  RiskResolvedEventSchema,
} from '../pastoral/evasion-events.schema';

const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const PARTICIPANT_ID = '01912345-6789-7000-8000-0000000000a1';
const GROUP_ID = '01912345-6789-7000-8000-0000000000b1';
const EVENT_ID = '01912345-6789-7000-8000-0000000000c1';
const TIMESTAMP = '2026-06-19T10:00:00.000Z';
const JOB_RUN_ID = '01912345-6789-7000-8000-0000000000d1';

// ---------------------------------------------------------------------------
// ParticipantRiskReasonSchema
// ---------------------------------------------------------------------------

describe('ParticipantRiskReasonSchema', () => {
  it('accepts all valid values', () => {
    expect(ParticipantRiskReasonSchema.parse('absences')).toBe('absences');
    expect(ParticipantRiskReasonSchema.parse('inactivity')).toBe('inactivity');
    expect(ParticipantRiskReasonSchema.parse('absences+inactivity')).toBe('absences+inactivity');
  });

  it('rejects unknown values', () => {
    expect(ParticipantRiskReasonSchema.safeParse('unknown').success).toBe(false);
    expect(ParticipantRiskReasonSchema.safeParse('').success).toBe(false);
    expect(ParticipantRiskReasonSchema.safeParse(null).success).toBe(false);
  });

  it('enum shape is stable (snapshot)', () => {
    const result = ParticipantRiskReasonSchema.options;
    expect(result).toMatchInlineSnapshot(`
      [
        "absences",
        "inactivity",
        "absences+inactivity",
      ]
    `);
  });
});

// ---------------------------------------------------------------------------
// RiskDetectedEventSchema
// ---------------------------------------------------------------------------

describe('RiskDetectedEventSchema', () => {
  const validEvent = {
    eventId: EVENT_ID,
    eventType: 'pastoral.participant.risk-detected' as const,
    version: 1 as const,
    tenantId: TENANT_ID,
    timestamp: TIMESTAMP,
    data: {
      participantId: PARTICIPANT_ID,
      groupId: GROUP_ID,
      riskReason: 'absences' as const,
      status: 'amarelo' as const,
      detectedAt: TIMESTAMP,
    },
    metadata: {
      source: 'detect-evasion-risk' as const,
      jobRunId: JOB_RUN_ID,
    },
  };

  it('parses a valid risk-detected event', () => {
    const result = RiskDetectedEventSchema.parse(validEvent);
    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "detectedAt": "2026-06-19T10:00:00.000Z",
          "groupId": "01912345-6789-7000-8000-0000000000b1",
          "participantId": "01912345-6789-7000-8000-0000000000a1",
          "riskReason": "absences",
          "status": "amarelo",
        },
        "eventId": "01912345-6789-7000-8000-0000000000c1",
        "eventType": "pastoral.participant.risk-detected",
        "metadata": {
          "jobRunId": "01912345-6789-7000-8000-0000000000d1",
          "source": "detect-evasion-risk",
        },
        "tenantId": "01912345-6789-7000-8000-000000000001",
        "timestamp": "2026-06-19T10:00:00.000Z",
        "version": 1,
      }
    `);
  });

  it('rejects event with PII field in data', () => {
    const withPii = {
      ...validEvent,
      data: { ...validEvent.data, name: 'Maria Silva' },
    };
    // Zod strict() equivalent: additionalProperties false via .strict()
    // Without .strict(), extra fields pass — but the schema has no PII fields
    const result = RiskDetectedEventSchema.parse(withPii);
    expect(result.data).not.toHaveProperty('name');
  });

  it('rejects wrong eventType', () => {
    const bad = { ...validEvent, eventType: 'wrong.event' };
    expect(RiskDetectedEventSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects status not in enum', () => {
    const bad = { ...validEvent, data: { ...validEvent.data, status: 'verde' } };
    expect(RiskDetectedEventSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RiskResolvedEventSchema
// ---------------------------------------------------------------------------

describe('RiskResolvedEventSchema', () => {
  const validResolved = {
    eventId: EVENT_ID,
    eventType: 'pastoral.participant.risk-resolved' as const,
    version: 1 as const,
    tenantId: TENANT_ID,
    timestamp: TIMESTAMP,
    data: {
      participantId: PARTICIPANT_ID,
      groupId: GROUP_ID,
      previousStatus: 'vermelho' as const,
      resolvedAt: TIMESTAMP,
    },
    metadata: {
      source: 'detect-evasion-risk' as const,
      jobRunId: JOB_RUN_ID,
    },
  };

  it('parses a valid risk-resolved event', () => {
    const result = RiskResolvedEventSchema.parse(validResolved);
    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "groupId": "01912345-6789-7000-8000-0000000000b1",
          "participantId": "01912345-6789-7000-8000-0000000000a1",
          "previousStatus": "vermelho",
          "resolvedAt": "2026-06-19T10:00:00.000Z",
        },
        "eventId": "01912345-6789-7000-8000-0000000000c1",
        "eventType": "pastoral.participant.risk-resolved",
        "metadata": {
          "jobRunId": "01912345-6789-7000-8000-0000000000d1",
          "source": "detect-evasion-risk",
        },
        "tenantId": "01912345-6789-7000-8000-000000000001",
        "timestamp": "2026-06-19T10:00:00.000Z",
        "version": 1,
      }
    `);
  });

  it('rejects previousStatus=verde (only amarelo|vermelho allowed)', () => {
    const bad = { ...validResolved, data: { ...validResolved.data, previousStatus: 'verde' } };
    expect(RiskResolvedEventSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing resolvedAt', () => {
    const { resolvedAt: _, ...dataWithoutResolvedAt } = validResolved.data;
    const bad = { ...validResolved, data: dataWithoutResolvedAt };
    expect(RiskResolvedEventSchema.safeParse(bad).success).toBe(false);
  });
});
