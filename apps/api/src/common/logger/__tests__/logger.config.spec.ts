import { describe, it, expect, afterEach } from 'vitest';
import { requestContext } from '../../context/request-context';
import { pinoLoggerConfig } from '../logger.config';

describe('pinoLoggerConfig', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should return a valid Params object', () => {
    const config = pinoLoggerConfig();
    expect(config).toBeDefined();
    expect(config.pinoHttp).toBeDefined();
  });

  it('should use info level in production', () => {
    process.env.NODE_ENV = 'production';
    const config = pinoLoggerConfig();
    expect((config.pinoHttp as any).level).toBe('info');
  });

  it('should use debug level in non-production', () => {
    process.env.NODE_ENV = 'development';
    const config = pinoLoggerConfig();
    expect((config.pinoHttp as any).level).toBe('debug');
  });

  it('should use pino-pretty transport in non-production', () => {
    process.env.NODE_ENV = 'development';
    const config = pinoLoggerConfig();
    expect((config.pinoHttp as any).transport?.target).toBe('pino-pretty');
  });

  it('should not use transport in production', () => {
    process.env.NODE_ENV = 'production';
    const config = pinoLoggerConfig();
    expect((config.pinoHttp as any).transport).toBeUndefined();
  });

  it('should include context fields in customProps when ALS has data', async () => {
    const config = pinoLoggerConfig();
    const customProps = (config.pinoHttp as any).customProps;

    const store = {
      tenantId: 'tenant-abc',
      userId: 'user-123',
      requestId: 'req-001',
      correlationId: 'corr-001',
    };

    await new Promise<void>((resolve) => {
      requestContext.run(store, () => {
        const props = customProps();
        expect(props.tenantId).toBe('tenant-abc');
        expect(props.userId).toBe('user-123');
        expect(props.requestId).toBe('req-001');
        expect(props.correlationId).toBe('corr-001');
        resolve();
      });
    });
  });

  it('should return null for tenant/user fields when ALS is empty (unauthenticated)', () => {
    const config = pinoLoggerConfig();
    const customProps = (config.pinoHttp as any).customProps;

    const props = customProps();
    expect(props.tenantId).toBeNull();
    expect(props.userId).toBeNull();
    expect(props.requestId).toBeUndefined();
    expect(props.correlationId).toBeUndefined();
  });

  it('should exclude tenantId from customProps when it is empty string', async () => {
    const config = pinoLoggerConfig();
    const customProps = (config.pinoHttp as any).customProps;

    const store = {
      tenantId: '',
      requestId: 'req-002',
      correlationId: 'corr-002',
    };

    await new Promise<void>((resolve) => {
      requestContext.run(store, () => {
        const props = customProps();
        expect(props.tenantId).toBeNull();
        expect(props.requestId).toBe('req-002');
        resolve();
      });
    });
  });

  it('should use requestId from ALS for genReqId', async () => {
    const config = pinoLoggerConfig();
    const genReqId = (config.pinoHttp as any).genReqId;

    const store = {
      tenantId: 'tenant-xyz',
      requestId: 'req-999',
      correlationId: 'corr-999',
    };

    await new Promise<void>((resolve) => {
      requestContext.run(store, () => {
        expect(genReqId()).toBe('req-999');
        resolve();
      });
    });
  });

  it('should return no-context for genReqId when ALS is empty', () => {
    const config = pinoLoggerConfig();
    const genReqId = (config.pinoHttp as any).genReqId;
    expect(genReqId()).toBe('no-context');
  });

  it('should redact authorization header', () => {
    const config = pinoLoggerConfig();
    expect((config.pinoHttp as any).redact).toContain('req.headers.authorization');
  });
});
