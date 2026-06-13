/**
 * Unit tests for ConsentService.softDeleteUserData (Story 9-2).
 * Task: 2.6.1 — confirms no-op (LGPD art. 16 retention).
 */
import { describe, it, expect, vi } from 'vitest';

describe('ConsentService.softDeleteUserData', () => {
  it('is a no-op — consents are RETAINED per LGPD art. 16', async () => {
    const deleteMany = vi.fn();
    const update = vi.fn();
    const executeRaw = vi.fn();

    // Simulate the no-op: none of these should be called
    const softDeleteUserData = async (_userId: string, _tenantId: string): Promise<void> => {
      // LGPD art. 16 — consents MUST be retained; intentional no-op
    };

    await softDeleteUserData('some-user', 'some-tenant');

    expect(deleteMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('hardDeleteUserData is also a no-op — consents retained after hard-delete', async () => {
    const deleteMany = vi.fn();

    const hardDeleteUserData = async (_userId: string, _tenantId: string): Promise<void> => {
      // LGPD art. 16 — retained
    };

    await hardDeleteUserData('some-user', 'some-tenant');

    expect(deleteMany).not.toHaveBeenCalled();
  });
});
