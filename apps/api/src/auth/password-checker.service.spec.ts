import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PasswordCheckerService } from './password-checker.service';

describe('PasswordCheckerService', () => {
  let service: PasswordCheckerService;

  beforeEach(() => {
    service = new PasswordCheckerService();
    vi.restoreAllMocks();
  });

  it('should detect leaked password', async () => {
    // "password" SHA-1 = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // Prefix: 5BAA6, Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\nOTHERHASH:100', {
        status: 200,
      }),
    );

    const result = await service.isLeaked('password');
    expect(result).toBe(true);
  });

  it('should return false for non-leaked password', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0:1\r\nBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB0:2', {
        status: 200,
      }),
    );

    const result = await service.isLeaked('my-very-unique-secure-password-xyz-123');
    expect(result).toBe(false);
  });

  it('should fail-open when HIBP API returns error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Service Unavailable', { status: 503 }),
    );

    const result = await service.isLeaked('anyPassword123!');
    expect(result).toBe(false);
  });

  it('should fail-open when fetch throws network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await service.isLeaked('anyPassword123!');
    expect(result).toBe(false);
  });
});
