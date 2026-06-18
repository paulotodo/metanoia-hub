import { describe, it, expect } from 'vitest';
import {
  TenantSummaryPeriodSchema,
  TenantSummaryQuerySchema,
  TenantGroupMetricsSchema,
  TenantSummaryOverallSchema,
  TenantSummaryMetaSchema,
  TenantSummaryResponseSchema,
  TenantRefreshResponseSchema,
} from './tenant-summary';

describe('TenantSummaryPeriodSchema', () => {
  it('matches snapshot', () => {
    expect(TenantSummaryPeriodSchema).toMatchSnapshot();
  });

  it('accepts valid periods', () => {
    expect(() => TenantSummaryPeriodSchema.parse("7d")).not.toThrow();
    expect(() => TenantSummaryPeriodSchema.parse("30d")).not.toThrow();
    expect(() => TenantSummaryPeriodSchema.parse("90d")).not.toThrow();
    expect(() => TenantSummaryPeriodSchema.parse("custom")).not.toThrow();
  });
});

describe("TenantSummaryQuerySchema", () => {
  it("matches snapshot", () => {
    expect(TenantSummaryQuerySchema).toMatchSnapshot();
  });

  it("accepts valid query with period=30d", () => {
    const result = TenantSummaryQuerySchema.safeParse({ period: "30d" });
    expect(result.success).toBe(true);
  });

  it("rejects custom period without startDate/endDate", () => {
    const result = TenantSummaryQuerySchema.safeParse({ period: "custom" });
    expect(result.success).toBe(false);
  });

  it("rejects custom period when startDate >= endDate", () => {
    const result = TenantSummaryQuerySchema.safeParse({
      period: "custom",
      startDate: "2026-01-10T00:00:00Z",
      endDate: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects range > 365 days (AC-SEC-06)", () => {
    const result = TenantSummaryQuerySchema.safeParse({
      period: "custom",
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2025-06-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid custom range within 365 days", () => {
    const result = TenantSummaryQuerySchema.safeParse({
      period: "custom",
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-06-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("TenantGroupMetricsSchema", () => {
  it("matches snapshot", () => {
    expect(TenantGroupMetricsSchema).toMatchSnapshot();
  });

  it("accepts valid group metrics", () => {
    const result = TenantGroupMetricsSchema.safeParse({
      groupId: "018f6a3c-1234-7000-8000-abc123456789",
      groupName: "Grupo Alpha",
      leaderName: "João Silva",
      attendanceAvgPercent: 75.5,
      trailProgressAvgPercent: 60.0,
      riskCount: 2,
      activeParticipants: 12,
      semaforo: "amarelo",
    });
    expect(result.success).toBe(true);
  });

  it("defaults leaderName to null", () => {
    const result = TenantGroupMetricsSchema.safeParse({
      groupId: "018f6a3c-1234-7000-8000-abc123456789",
      groupName: "Sem Líder",
      riskCount: 0,
      activeParticipants: 0,
      semaforo: "verde",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.leaderName).toBeNull();
      expect(result.data.attendanceAvgPercent).toBeNull();
    }
  });
});

describe("TenantSummaryOverallSchema", () => {
  it("matches snapshot", () => {
    expect(TenantSummaryOverallSchema).toMatchSnapshot();
  });
});

describe("TenantSummaryMetaSchema", () => {
  it("matches snapshot", () => {
    expect(TenantSummaryMetaSchema).toMatchSnapshot();
  });

  it("accepts valid meta with fromMaterializedView", () => {
    const result = TenantSummaryMetaSchema.safeParse({
      period: "30d",
      startDate: null,
      endDate: null,
      lastRefreshAt: "2026-06-17T10:00:00Z",
      stale: false,
      fromMaterializedView: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("TenantSummaryResponseSchema", () => {
  it("matches snapshot", () => {
    expect(TenantSummaryResponseSchema).toMatchSnapshot();
  });
});

describe("TenantRefreshResponseSchema", () => {
  it("matches snapshot", () => {
    expect(TenantRefreshResponseSchema).toMatchSnapshot();
  });

  it("represents 202 Accepted", () => {
    const result = TenantRefreshResponseSchema.safeParse({
      data: { accepted: true, jobId: "018f6a3c-refresh-7000-8000-abc123456789" },
      meta: { retryAfter: null },
    });
    expect(result.success).toBe(true);
  });

  it("represents 429 rate-limited", () => {
    const result = TenantRefreshResponseSchema.safeParse({
      data: { accepted: false, jobId: null },
      meta: { retryAfter: 240 },
    });
    expect(result.success).toBe(true);
  });
});
