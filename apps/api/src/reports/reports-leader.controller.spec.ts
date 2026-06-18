import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportsController } from './reports.controller';
import { Role } from '../auth/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LeaderSummaryQuerySchema } from '@metanoia/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLeaderSummaryResponse = {
  data: {
    groups: [],
    summary: {
      totalGroups: 0,
      totalParticipants: 0,
      overallAttendancePercent: null,
      overallTrailCompletionPercent: 0,
    },
  },
  meta: {
    period: '30d',
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
  },
};

const mockReportsService = {
  getLeaderSummary: vi.fn().mockResolvedValue(mockLeaderSummaryResponse),
};

// ─── Users ────────────────────────────────────────────────────────────────────

const liderUser: AuthenticatedUser = {
  userId: 'user-lider-01',
  tenantId: 'tenant-001',
  roles: [Role.LIDER],
  email: 'lider@church.com',
};

// ─── Controller factory ───────────────────────────────────────────────────────

function makeController(): ReportsController {
  return new ReportsController(mockReportsService as never);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReportsController.getLeaderSummary', () => {
  let controller: ReportsController;
  let pipe: ZodValidationPipe;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = makeController();
    pipe = new ZodValidationPipe(LeaderSummaryQuerySchema);
  });

  it('returns payload from service with valid query', async () => {
    const result = await controller.getLeaderSummary(
      { period: '30d' },
      { user: liderUser },
    );
    expect(result).toEqual(mockLeaderSummaryResponse);
    expect(mockReportsService.getLeaderSummary).toHaveBeenCalledWith({ period: '30d' }, liderUser);
  });

  it('ZodValidationPipe rejects period=custom without startDate → 400', () => {
    expect(() => pipe.transform({ period: 'custom' })).toThrow();
  });

  it('ZodValidationPipe accepts period=30d without dates', () => {
    const result = pipe.transform({ period: '30d' });
    expect((result as { period: string }).period).toBe('30d');
  });

  it('ZodValidationPipe rejects startDate >= endDate for custom period', () => {
    expect(() =>
      pipe.transform({
        period: 'custom',
        startDate: '2026-06-17T00:00:00Z',
        endDate: '2026-06-16T00:00:00Z',
      }),
    ).toThrow();
  });

  it('ZodValidationPipe accepts valid custom period with startDate < endDate', () => {
    const result = pipe.transform({
      period: 'custom',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-06-17T00:00:00Z',
    });
    expect((result as { period: string }).period).toBe('custom');
  });
});
