import { expect, test } from 'vitest';
import { LeaderSummaryResponseSchema, LeaderSummaryQuerySchema } from '../leader-summary';

test('snapshot: LeaderSummaryResponseSchema', () => {
  const valid = {
    data: {
      groups: [{
        groupId: '018e3a00-0000-7000-8000-000000000001',
        groupName: 'Células Norte',
        avgAttendancePercent: 75.5,
        avgTrailProgressPercent: 60,
        atRiskCount: 2,
        activeParticipantsCount: 10,
      }],
      summary: {
        totalGroups: 1,
        totalParticipants: 10,
        overallAttendancePercent: 75.5,
        overallTrailCompletionPercent: 60,
      },
    },
    meta: { period: '30d', startDate: '2026-05-18T00:00:00.000Z', endDate: '2026-06-17T23:59:59.999Z' },
  };
  expect(LeaderSummaryResponseSchema.parse(valid)).toMatchSnapshot();
});

test('rejects custom period without dates', () => {
  const result = LeaderSummaryQuerySchema.safeParse({ period: 'custom' });
  expect(result.success).toBe(false);
});

test('rejects startDate >= endDate for custom period', () => {
  const result = LeaderSummaryQuerySchema.safeParse({
    period: 'custom',
    startDate: '2026-06-17T00:00:00Z',
    endDate: '2026-06-16T00:00:00Z',
  });
  expect(result.success).toBe(false);
});

test('accepts 30d period without dates', () => {
  const result = LeaderSummaryQuerySchema.safeParse({ period: '30d' });
  expect(result.success).toBe(true);
});

test('nullable avgAttendancePercent', () => {
  const valid = {
    data: {
      groups: [{
        groupId: '018e3a00-0000-7000-8000-000000000001',
        groupName: 'Grupo A',
        avgAttendancePercent: null,
        avgTrailProgressPercent: 0,
        atRiskCount: 0,
        activeParticipantsCount: 0,
      }],
      summary: {
        totalGroups: 1,
        totalParticipants: 0,
        overallAttendancePercent: null,
        overallTrailCompletionPercent: 0,
      },
    },
    meta: { period: '7d', startDate: '2026-06-10T00:00:00.000Z', endDate: '2026-06-17T23:59:59.999Z' },
  };
  expect(LeaderSummaryResponseSchema.parse(valid)).toMatchSnapshot();
});
