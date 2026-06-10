import { describe, it, expect } from 'vitest';
import {
  TrendTypeSchema,
  PastoralAlertWithTrendSchema,
  AlertListResponseSchema,
  ALERT_SCHEMA_SHAPES,
} from '../pastoral/alert.schema';

describe('TrendTypeSchema snapshot', () => {
  it('enum values are frozen — silent breaking changes detected', () => {
    expect(ALERT_SCHEMA_SHAPES.TrendTypeValues).toMatchInlineSnapshot(`
      [
        "melhorando",
        "estavel",
        "declinio",
      ]
    `);
  });

  it('accepts all valid trend values', () => {
    expect(TrendTypeSchema.parse('melhorando')).toBe('melhorando');
    expect(TrendTypeSchema.parse('estavel')).toBe('estavel');
    expect(TrendTypeSchema.parse('declinio')).toBe('declinio');
  });

  it('rejects invalid trend value', () => {
    expect(() => TrendTypeSchema.parse('improving')).toThrow();
    expect(() => TrendTypeSchema.parse('')).toThrow();
  });
});

describe('RadarStatusTypeSchema snapshot', () => {
  it('enum values are frozen', () => {
    expect(ALERT_SCHEMA_SHAPES.RadarStatusTypeValues).toMatchInlineSnapshot(`
      [
        "verde",
        "amarelo",
        "vermelho",
      ]
    `);
  });
});

describe('PastoralAlertWithTrendSchema', () => {
  const validAlert = {
    id: '00000000-0000-7000-8000-000000000001',
    tenantId: '00000000-0000-7000-8000-000000000002',
    groupId: '00000000-0000-7000-8000-000000000003',
    participantId: '00000000-0000-7000-8000-000000000004',
    previousStatus: 'verde' as const,
    newStatus: 'amarelo' as const,
    trend: 'declinio' as const,
    readAt: null,
    dismissedAt: null,
    createdAt: '2026-06-10T12:00:00.000Z',
  };

  it('parses a valid alert', () => {
    const result = PastoralAlertWithTrendSchema.parse(validAlert);
    expect(result.id).toBe(validAlert.id);
    expect(result.previousStatus).toBe('verde');
    expect(result.newStatus).toBe('amarelo');
    expect(result.trend).toBe('declinio');
    expect(result.readAt).toBeNull();
  });

  it('accepts nullable fields as null', () => {
    const result = PastoralAlertWithTrendSchema.parse({
      ...validAlert,
      previousStatus: null,
      newStatus: null,
      trend: null,
      readAt: null,
      dismissedAt: null,
    });
    expect(result.previousStatus).toBeNull();
    expect(result.newStatus).toBeNull();
    expect(result.trend).toBeNull();
  });

  it('rejects missing required field', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...withoutId } = validAlert;
    expect(() => PastoralAlertWithTrendSchema.parse(withoutId)).toThrow();
  });

  it('rejects invalid UUID', () => {
    expect(() =>
      PastoralAlertWithTrendSchema.parse({ ...validAlert, id: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects invalid trend value', () => {
    expect(() =>
      PastoralAlertWithTrendSchema.parse({ ...validAlert, trend: 'worsening' }),
    ).toThrow();
  });
});

describe('AlertListResponseSchema', () => {
  it('parses an empty list', () => {
    const result = AlertListResponseSchema.parse({ data: [] });
    expect(result.data).toHaveLength(0);
  });

  it('parses a list with one alert', () => {
    const alert = {
      id: '00000000-0000-7000-8000-000000000001',
      tenantId: '00000000-0000-7000-8000-000000000002',
      groupId: '00000000-0000-7000-8000-000000000003',
      participantId: '00000000-0000-7000-8000-000000000004',
      previousStatus: 'amarelo' as const,
      newStatus: 'vermelho' as const,
      trend: 'declinio' as const,
      readAt: null,
      dismissedAt: null,
      createdAt: '2026-06-10T12:00:00.000Z',
    };
    const result = AlertListResponseSchema.parse({ data: [alert] });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].newStatus).toBe('vermelho');
  });
});
