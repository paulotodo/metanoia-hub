/**
 * Unit tests for EvasionDetectionService (Story 13.3 / FR66-03).
 *
 * Covers the semaphore transition logic with mocked repositories:
 *  - manualOverrideAt 24h guard (SC-04)
 *  - group on_break skips detection (recesso)
 *  - resolution via 2 recent presences
 *  - absences + inactivity => vermelho
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvasionDetectionService } from './evasion-detection.service';

const OPTS = { tenantId: '01912345-6789-7000-8000-000000000001' };
const PID = '01912345-6789-7000-8000-0000000000a1';
const GID = '01912345-6789-7000-8000-0000000000b1';

function makeService() {
  const evasionRepo = {
    getCurrentRadarStatus: vi.fn(),
    getConsecutiveAbsences: vi.fn(),
    getParticipantActivity: vi.fn(),
    countRecentPresences: vi.fn(),
  };
  const radarStatusRepo = {
    upsertRisk: vi.fn().mockResolvedValue(undefined),
  };
  const eventPublisher = {
    publishRiskDetected: vi.fn().mockResolvedValue(undefined),
    publishRiskResolved: vi.fn().mockResolvedValue(undefined),
  };
  const service = new EvasionDetectionService(
    evasionRepo as never,
    radarStatusRepo as never,
    eventPublisher as never,
  );
  return { service, evasionRepo, radarStatusRepo, eventPublisher };
}

describe('EvasionDetectionService', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('skips when manual override is within 24h (SC-04)', async () => {
    ctx.evasionRepo.getCurrentRadarStatus.mockResolvedValue({
      status: 'amarelo',
      manual_override_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
      risk_reason: 'absences',
    });

    const result = await ctx.service.evaluateParticipant(PID, GID, OPTS);

    expect(result.action).toBe('skipped-manual-override');
    expect(ctx.radarStatusRepo.upsertRisk).not.toHaveBeenCalled();
  });

  it('proceeds when manual override is older than 24h', async () => {
    ctx.evasionRepo.getCurrentRadarStatus.mockResolvedValue({
      status: 'verde',
      manual_override_at: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
      risk_reason: null,
    });
    ctx.evasionRepo.getConsecutiveAbsences.mockResolvedValue({
      consecutiveAbsences: 3,
      groupIsOnBreak: false,
      breakUntil: null,
    });
    ctx.evasionRepo.getParticipantActivity.mockResolvedValue({
      lastSeenAt: new Date(),
      isInactive: false,
    });

    const result = await ctx.service.evaluateParticipant(PID, GID, OPTS);

    expect(result.action).toBe('flagged');
    expect(result.newStatus).toBe('amarelo');
    expect(result.riskReason).toBe('absences');
  });

  it('skips detection when group is on break (recesso)', async () => {
    ctx.evasionRepo.getCurrentRadarStatus.mockResolvedValue({
      status: 'verde',
      manual_override_at: null,
      risk_reason: null,
    });
    ctx.evasionRepo.getConsecutiveAbsences.mockResolvedValue({
      consecutiveAbsences: 5,
      groupIsOnBreak: true,
      breakUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = await ctx.service.evaluateParticipant(PID, GID, OPTS);

    expect(result.action).toBe('skipped-on-break');
    expect(ctx.radarStatusRepo.upsertRisk).not.toHaveBeenCalled();
  });

  it('resolves to verde when 2 recent presences', async () => {
    ctx.evasionRepo.getCurrentRadarStatus.mockResolvedValue({
      status: 'vermelho',
      manual_override_at: null,
      risk_reason: 'absences+inactivity',
    });
    ctx.evasionRepo.getConsecutiveAbsences.mockResolvedValue({
      consecutiveAbsences: 0,
      groupIsOnBreak: false,
      breakUntil: null,
    });
    ctx.evasionRepo.getParticipantActivity.mockResolvedValue({
      lastSeenAt: new Date(),
      isInactive: false,
    });
    ctx.evasionRepo.countRecentPresences.mockResolvedValue(2);

    const result = await ctx.service.evaluateParticipant(PID, GID, OPTS);

    expect(result.action).toBe('resolved');
    expect(result.newStatus).toBe('verde');
    expect(ctx.radarStatusRepo.upsertRisk).toHaveBeenCalledWith(
      PID,
      GID,
      expect.objectContaining({ status: 'verde', riskReason: null }),
      OPTS,
    );
  });

  it('flags vermelho when both absences and inactivity', async () => {
    ctx.evasionRepo.getCurrentRadarStatus.mockResolvedValue({
      status: 'verde',
      manual_override_at: null,
      risk_reason: null,
    });
    ctx.evasionRepo.getConsecutiveAbsences.mockResolvedValue({
      consecutiveAbsences: 3,
      groupIsOnBreak: false,
      breakUntil: null,
    });
    ctx.evasionRepo.getParticipantActivity.mockResolvedValue({
      lastSeenAt: null,
      isInactive: true,
    });

    const result = await ctx.service.evaluateParticipant(PID, GID, OPTS);

    expect(result.action).toBe('flagged');
    expect(result.newStatus).toBe('vermelho');
    expect(result.riskReason).toBe('absences+inactivity');
  });

  it('no change when no risk criteria met', async () => {
    ctx.evasionRepo.getCurrentRadarStatus.mockResolvedValue({
      status: 'verde',
      manual_override_at: null,
      risk_reason: null,
    });
    ctx.evasionRepo.getConsecutiveAbsences.mockResolvedValue({
      consecutiveAbsences: 1,
      groupIsOnBreak: false,
      breakUntil: null,
    });
    ctx.evasionRepo.getParticipantActivity.mockResolvedValue({
      lastSeenAt: new Date(),
      isInactive: false,
    });

    const result = await ctx.service.evaluateParticipant(PID, GID, OPTS);

    expect(result.action).toBe('no-change');
    expect(ctx.radarStatusRepo.upsertRisk).not.toHaveBeenCalled();
  });
});
