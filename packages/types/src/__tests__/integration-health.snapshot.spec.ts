import { describe, it, expect } from 'vitest';
import {
  IntegrationHealthStatusSchema,
  IntegrationHealthItemSchema,
  IntegrationHealthSummarySchema,
  IntegrationHealthResponseSchema,
  IntegrationHealthHistoryPointSchema,
  IntegrationHealthHistoryResponseSchema,
  IntegrationHealthHistoryQuerySchema,
} from '../integration-health';

// ---------------------------------------------------------------------------
// Snapshot tests — gate contra breaking changes silenciosos nos schemas.
// Story 14-4 §FR-009 / CLAUDE.md: snapshot test obrigatório para schemas Zod.
// ---------------------------------------------------------------------------

describe('IntegrationHealthStatusSchema', () => {
  it('options snapshot — não mudar silenciosamente', () => {
    expect(IntegrationHealthStatusSchema.options).toMatchSnapshot();
  });

  it('aceita todos os status válidos', () => {
    for (const s of ['healthy', 'degraded', 'unhealthy']) {
      expect(IntegrationHealthStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it('rejeita status desconhecido', () => {
    expect(IntegrationHealthStatusSchema.safeParse('ok').success).toBe(false);
    expect(IntegrationHealthStatusSchema.safeParse('error').success).toBe(false);
    expect(IntegrationHealthStatusSchema.safeParse('').success).toBe(false);
  });
});

describe('IntegrationHealthItemSchema', () => {
  const valid = {
    name: 'Resend',
    status: 'healthy' as const,
    latencyMs: 120,
    lastChecked: '2026-06-22T04:00:00Z',
    message: null,
  };

  it('aceita item válido com latência', () => {
    expect(IntegrationHealthItemSchema.safeParse(valid).success).toBe(true);
  });

  it('aceita item com latencyMs null (timeout)', () => {
    expect(
      IntegrationHealthItemSchema.safeParse({ ...valid, latencyMs: null }).success,
    ).toBe(true);
  });

  it('snapshot da estrutura do schema', () => {
    const result = IntegrationHealthItemSchema.safeParse(valid);
    expect(result.data).toMatchSnapshot();
  });

  it('rejeita latencyMs negativa', () => {
    expect(
      IntegrationHealthItemSchema.safeParse({ ...valid, latencyMs: -1 }).success,
    ).toBe(false);
  });

  it('rejeita status inválido', () => {
    expect(
      IntegrationHealthItemSchema.safeParse({ ...valid, status: 'ok' }).success,
    ).toBe(false);
  });
});

describe('IntegrationHealthSummarySchema', () => {
  it('aceita summary válido', () => {
    const summary = { total: 5, healthy: 3, degraded: 1, unhealthy: 1 };
    expect(IntegrationHealthSummarySchema.safeParse(summary).success).toBe(true);
  });

  it('snapshot — não alterar campos', () => {
    const result = IntegrationHealthSummarySchema.safeParse({
      total: 5,
      healthy: 5,
      degraded: 0,
      unhealthy: 0,
    });
    expect(result.data).toMatchSnapshot();
  });
});

describe('IntegrationHealthResponseSchema', () => {
  it('snapshot do envelope completo', () => {
    const response = {
      data: {
        integrations: [
          {
            name: 'Redis',
            status: 'healthy',
            latencyMs: 2,
            lastChecked: '2026-06-22T04:00:00Z',
            message: null,
          },
        ],
        summary: { total: 1, healthy: 1, degraded: 0, unhealthy: 0 },
      },
    };
    const result = IntegrationHealthResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    expect(result.data).toMatchSnapshot();
  });
});

describe('IntegrationHealthHistoryPointSchema', () => {
  it('aceita ponto válido', () => {
    expect(
      IntegrationHealthHistoryPointSchema.safeParse({
        checkedAt: '2026-06-22T03:00:00Z',
        status: 'degraded',
        latencyMs: 2500,
        message: null,
      }).success,
    ).toBe(true);
  });

  it('snapshot', () => {
    const result = IntegrationHealthHistoryPointSchema.safeParse({
      checkedAt: '2026-06-22T03:00:00Z',
      status: 'healthy',
      latencyMs: 120,
    });
    expect(result.data).toMatchSnapshot();
  });
});

describe('IntegrationHealthHistoryQuerySchema — boundary e validação', () => {
  it('default hours=24 quando omitido', () => {
    const result = IntegrationHealthHistoryQuerySchema.safeParse({ integration: 'Redis' });
    expect(result.success).toBe(true);
    expect(result.data?.hours).toBe(24);
  });

  it('aceita hours=72 (máximo)', () => {
    const result = IntegrationHealthHistoryQuerySchema.safeParse({
      integration: 'Resend',
      hours: '72',
    });
    expect(result.success).toBe(true);
    expect(result.data?.hours).toBe(72);
  });

  it('rejeita hours=73 (acima do máximo)', () => {
    expect(
      IntegrationHealthHistoryQuerySchema.safeParse({ integration: 'Resend', hours: '73' }).success,
    ).toBe(false);
  });

  it('rejeita integration desconhecida', () => {
    expect(
      IntegrationHealthHistoryQuerySchema.safeParse({ integration: 'Unknown' }).success,
    ).toBe(false);
  });

  it('aceita todas as 5 integrações válidas', () => {
    for (const name of ['Resend', 'Keycloak', 'MinIO', 'Redis', 'PostgreSQL']) {
      expect(
        IntegrationHealthHistoryQuerySchema.safeParse({ integration: name }).success,
      ).toBe(true);
    }
  });
});

describe('IntegrationHealthHistoryResponseSchema', () => {
  it('aceita response de histórico válida', () => {
    const response = {
      data: {
        points: [
          { checkedAt: '2026-06-22T03:00:00Z', status: 'healthy', latencyMs: 120 },
        ],
      },
      meta: { integration: 'Redis', hours: 24 },
    };
    expect(IntegrationHealthHistoryResponseSchema.safeParse(response).success).toBe(true);
  });
});

