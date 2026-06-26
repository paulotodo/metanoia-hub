import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecoveryEmailWorker } from './recovery-email.worker';

type JobHandler = (job: { data: unknown }) => Promise<void>;

function createMocks() {
  let handler: JobHandler | undefined;
  const workerEvents = { on: vi.fn() };
  const bullMqService = {
    createWorker: vi.fn((_queue: string, h: JobHandler) => {
      handler = h;
      return workerEvents;
    }),
  };
  const config = {
    get: vi.fn().mockReturnValue('https://app.example.com'),
  };
  const emailService = {
    send: vi.fn().mockResolvedValue({ success: true, providerId: 'msg-1' }),
  };

  const worker = new RecoveryEmailWorker(
    bullMqService as any,
    config as any,
    emailService as any,
  );
  worker.onModuleInit();

  return {
    worker,
    emailService,
    config,
    run: (data: unknown) => handler!({ data }),
  };
}

const job = {
  email: 'user@example.com',
  firstName: 'Maria',
  token: 'tok-123',
};

describe('RecoveryEmailWorker', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it('sends a real email with the reset link built from FRONTEND_URL', async () => {
    await mocks.run(job);

    expect(mocks.emailService.send).toHaveBeenCalledTimes(1);
    const arg = mocks.emailService.send.mock.calls[0][0];
    expect(arg.to).toBe('user@example.com');
    expect(arg.subject).toBe('[Metanoia] Redefinição de senha');
    expect(arg.html).toContain('https://app.example.com/nova-senha/tok-123');
    expect(arg.html).toContain('Maria');
  });

  it('throws on a retryable failure so BullMQ retries', async () => {
    mocks.emailService.send.mockResolvedValue({
      success: false,
      retryable: true,
      error: 'Resend 503',
    });
    await expect(mocks.run(job)).rejects.toThrow(/retryable/);
  });

  it('swallows a permanent failure (no throw)', async () => {
    mocks.emailService.send.mockResolvedValue({
      success: false,
      retryable: false,
      error: 'Resend 422',
    });
    await expect(mocks.run(job)).resolves.toBeUndefined();
  });
});
