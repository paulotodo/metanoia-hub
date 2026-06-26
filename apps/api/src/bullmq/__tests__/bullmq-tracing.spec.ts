import { describe, it, expect, vi, afterEach } from 'vitest';
import { injectTraceContext, runWithExtractedContext } from '../bullmq-tracing';
import { requestContext } from '../../common/context/request-context';

describe('injectTraceContext', () => {
  it('adds _traceContext field to job data', () => {
    const data = { orderId: '123', action: 'send-email' };
    const result = injectTraceContext(data);
    expect(result).toHaveProperty('_traceContext');
    expect(result.orderId).toBe('123');
    expect(result.action).toBe('send-email');
  });

  it('injects tenantId from RequestContext (OWASP M4)', () => {
    let result: ReturnType<typeof injectTraceContext<{ foo: string }>> | undefined;

    requestContext.run(
      { tenantId: 'tenant-42', requestId: 'req-1', correlationId: 'corr-1' },
      () => {
        result = injectTraceContext({ foo: 'bar' });
      },
    );

    expect(result?._traceContext.tenantId).toBe('tenant-42');
  });

  it('gracefully handles absence of RequestContext', () => {
    const result = injectTraceContext({ foo: 'bar' });
    expect(result).toHaveProperty('_traceContext');
    expect(result._traceContext.tenantId).toBeUndefined();
  });

  it('returns original data fields untouched', () => {
    const data = { id: 'job-1', payload: { nested: true } };
    const result = injectTraceContext(data);
    expect(result.id).toBe('job-1');
    expect(result.payload).toEqual({ nested: true });
  });
});

describe('runWithExtractedContext', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const meta = {
    queueName: 'notifications',
    jobName: 'send-email',
    jobId: 'job-uuid-1',
    attemptsMade: 0,
  };

  it('runs the processor function and returns its result', async () => {
    const result = await runWithExtractedContext({ foo: 'bar' }, meta, async () => 'done');
    expect(result).toBe('done');
  });

  it('re-throws processor errors', async () => {
    await expect(
      runWithExtractedContext({}, meta, async () => {
        throw new Error('job failed');
      }),
    ).rejects.toThrow('job failed');
  });

  it('handles missing _traceContext gracefully (pre-instrumentation jobs)', async () => {
    const result = await runWithExtractedContext({ legacy: true }, meta, async () => 'ok');
    expect(result).toBe('ok');
  });

  it('handles invalid traceparent gracefully (OWASP M3) — root span fresh', async () => {
    const jobData = {
      _traceContext: {
        traceparent: 'invalid-traceparent-value',
        tenantId: 'tenant-x',
      },
    };
    const result = await runWithExtractedContext(jobData, meta, async () => 'safe');
    expect(result).toBe('safe');
  });
});
