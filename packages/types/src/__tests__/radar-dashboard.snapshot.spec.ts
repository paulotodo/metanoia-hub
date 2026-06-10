import { describe, it, expect } from 'vitest';
import {
  RADAR_AGGREGATE_CACHE_TTL_SECONDS,
  RADAR_AGGREGATE_CACHE_KEY_PREFIX,
  RADAR_AGGREGATE_QUEUE_NAME,
  RadarStatusDistributionSchema,
  RadarGroupSummarySchema,
  RadarDashboardResponseSchema,
  DashboardTrendSchema,
} from '../pastoral';

describe('RADAR_AGGREGATE constants — Story 6-6', () => {
  it('aggregate cache TTL is 30 seconds', () => {
    expect(RADAR_AGGREGATE_CACHE_TTL_SECONDS).toBe(30);
  });

  it('aggregate cache key prefix is correct', () => {
    expect(RADAR_AGGREGATE_CACHE_KEY_PREFIX).toBe('cache:radar-aggregate');
  });

  it('aggregate queue name is correct', () => {
    expect(RADAR_AGGREGATE_QUEUE_NAME).toBe('radar-aggregate');
  });
});

describe('RadarStatusDistributionSchema snapshot', () => {
  it('parses a valid distribution', () => {
    const result = RadarStatusDistributionSchema.parse({
      verde: 5,
      amarelo: 3,
      vermelho: 2,
      total: 10,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "amarelo": 3,
        "total": 10,
        "verde": 5,
        "vermelho": 2,
      }
    `);
  });
});

describe('RadarGroupSummarySchema snapshot', () => {
  it('parses a valid group summary', () => {
    const result = RadarGroupSummarySchema.parse({
      groupId: '01912345-6789-7000-8000-000000000001',
      groupName: 'Grupo Alpha',
      verde: 4,
      amarelo: 2,
      vermelho: 1,
      total: 7,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "amarelo": 2,
        "groupId": "01912345-6789-7000-8000-000000000001",
        "groupName": "Grupo Alpha",
        "total": 7,
        "verde": 4,
        "vermelho": 1,
      }
    `);
  });
});

describe('DashboardTrendSchema', () => {
  it('accepts valid trend values', () => {
    expect(DashboardTrendSchema.parse('melhora')).toBe('melhora');
    expect(DashboardTrendSchema.parse('estavel')).toBe('estavel');
    expect(DashboardTrendSchema.parse('piora')).toBe('piora');
  });

  it('rejects invalid trend', () => {
    expect(() => DashboardTrendSchema.parse('crescendo')).toThrow();
  });
});

describe('RadarDashboardResponseSchema snapshot', () => {
  it('parses a full dashboard response', () => {
    const result = RadarDashboardResponseSchema.parse({
      data: {
        distribution: { verde: 5, amarelo: 3, vermelho: 2, total: 10 },
        byGroup: [
          {
            groupId: '01912345-6789-7000-8000-000000000001',
            groupName: 'Grupo Alpha',
            verde: 4,
            amarelo: 2,
            vermelho: 1,
            total: 7,
          },
        ],
        trend: 'estavel',
        calculatedAt: '2026-06-10T12:00:00.000Z',
      },
      meta: {
        groupCount: 1,
        cachedAt: '2026-06-10T12:00:00.000Z',
      },
    });

    expect(result.data.distribution.total).toBe(10);
    expect(result.data.trend).toBe('estavel');
    expect(result.data.byGroup).toHaveLength(1);
    expect(result.meta?.groupCount).toBe(1);
  });

  it('meta is optional', () => {
    const result = RadarDashboardResponseSchema.parse({
      data: {
        distribution: { verde: 0, amarelo: 0, vermelho: 0, total: 0 },
        byGroup: [],
        trend: 'estavel',
        calculatedAt: '2026-06-10T12:00:00.000Z',
      },
    });
    expect(result.meta).toBeUndefined();
  });
});
