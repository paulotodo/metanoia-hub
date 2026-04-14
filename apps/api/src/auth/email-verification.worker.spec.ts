import { describe, it, expect, vi } from 'vitest';
import { EmailVerificationWorker } from './email-verification.worker';

describe('EmailVerificationWorker', () => {
  it('should initialize worker on module init', () => {
    const mockWorker = { on: vi.fn() };
    const mockBullMq = {
      createWorker: vi.fn().mockReturnValue(mockWorker),
    };

    const worker = new EmailVerificationWorker(mockBullMq as any);
    worker.onModuleInit();

    expect(mockBullMq.createWorker).toHaveBeenCalledWith(
      'email-verification',
      expect.any(Function),
    );
    expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
  });
});
