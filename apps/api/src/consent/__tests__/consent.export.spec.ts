import { describe, it, expect, vi } from 'vitest';
import { ConsentService } from '../consent.service';

const USER_ID = '01912345-6789-7000-8000-0000000000a1';
const TENANT_ID = '01912345-6789-7000-8000-000000000001';

function makeRepo(acceptances: unknown[], withdrawals: unknown[]) {
  return {
    findAllAcceptancesByUser: vi.fn().mockResolvedValue(acceptances),
    findWithdrawalsByUser: vi.fn().mockResolvedValue(withdrawals),
  };
}

describe('ConsentService.exportConsentData', () => {
  it('returns acceptances and withdrawals with ISO 8601 dates', async () => {
    const acceptances = [
      {
        documentType: 'terms_of_service',
        version: '1.0',
        acceptedAt: new Date('2026-01-10T00:00:00.000Z'),
      },
    ];
    const withdrawals = [
      {
        consentType: 'marketing',
        timestamp: new Date('2026-05-15T12:00:00.000Z'),
      },
    ];

    const repo = makeRepo(acceptances, withdrawals);
    const svc = new ConsentService(repo as never);

    const result = await svc.exportConsentData(USER_ID, TENANT_ID);

    expect(result.acceptances).toHaveLength(1);
    expect(result.acceptances[0].documentType).toBe('terms_of_service');
    expect(result.acceptances[0].version).toBe('1.0');
    expect(result.acceptances[0].acceptedAt).toBe('2026-01-10T00:00:00.000Z');

    expect(result.withdrawals).toHaveLength(1);
    expect(result.withdrawals[0].consentType).toBe('marketing');
    expect(result.withdrawals[0].timestamp).toBe('2026-05-15T12:00:00.000Z');
  });

  it('returns empty arrays when user has no consent data', async () => {
    const repo = makeRepo([], []);
    const svc = new ConsentService(repo as never);

    const result = await svc.exportConsentData(USER_ID, TENANT_ID);

    expect(result.acceptances).toHaveLength(0);
    expect(result.withdrawals).toHaveLength(0);
  });

  it('calls findAllAcceptancesByUser and findWithdrawalsByUser', async () => {
    const repo = makeRepo([], []);
    const svc = new ConsentService(repo as never);

    await svc.exportConsentData(USER_ID, TENANT_ID);

    expect(repo.findAllAcceptancesByUser).toHaveBeenCalledWith(USER_ID);
    expect(repo.findWithdrawalsByUser).toHaveBeenCalledWith(USER_ID, TENANT_ID);
  });

  it('handles multiple acceptances sorted by date', async () => {
    const acceptances = [
      { documentType: 'privacy_policy', version: '1.0', acceptedAt: new Date('2026-01-01T00:00:00.000Z') },
      { documentType: 'terms_of_service', version: '2.0', acceptedAt: new Date('2026-03-01T00:00:00.000Z') },
    ];
    const repo = makeRepo(acceptances, []);
    const svc = new ConsentService(repo as never);

    const result = await svc.exportConsentData(USER_ID, TENANT_ID);

    expect(result.acceptances).toHaveLength(2);
    expect(result.acceptances[0].documentType).toBe('privacy_policy');
    expect(result.acceptances[1].documentType).toBe('terms_of_service');
  });
});
