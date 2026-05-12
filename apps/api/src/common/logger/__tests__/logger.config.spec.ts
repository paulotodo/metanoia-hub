import type { ConfigService } from '@nestjs/config';
import { describe, it, expect, vi } from 'vitest';
import type { EnvConfig } from '../../../config/env.validation';
import { requestContext } from '../../context/request-context';
import { pinoLoggerConfig } from '../logger.config';

function configMock(nodeEnv: EnvConfig['NODE_ENV']): ConfigService<EnvConfig, true> {
  return {
    get: vi.fn((key: keyof EnvConfig) => {
      if (key === 'NODE_ENV') return nodeEnv;
      return undefined;
    }),
  } as unknown as ConfigService<EnvConfig, true>;
}

describe('pinoLoggerConfig', () => {
  it('should return a valid Params object', () => {
    const config = pinoLoggerConfig(configMock('development'));
    expect(config).toBeDefined();
    expect(config.pinoHttp).toBeDefined();
  });

  it('should use info level in production', () => {
    const config = pinoLoggerConfig(configMock('production'));
    expect((config.pinoHttp as any).level).toBe('info');
  });

  it('should use debug level in non-production', () => {
    const config = pinoLoggerConfig(configMock('development'));
    expect((config.pinoHttp as any).level).toBe('debug');
  });

  it('should use pino-pretty transport in non-production', () => {
    const config = pinoLoggerConfig(configMock('development'));
    expect((config.pinoHttp as any).transport?.target).toBe('pino-pretty');
  });

  it('should not use transport in production', () => {
    const config = pinoLoggerConfig(configMock('production'));
    expect((config.pinoHttp as any).transport).toBeUndefined();
  });

  it('should read NODE_ENV via ConfigService.get (not process.env)', () => {
    const get = vi.fn((key: keyof EnvConfig) =>
      key === 'NODE_ENV' ? 'production' : undefined,
    );
    const config = pinoLoggerConfig({ get } as unknown as ConfigService<EnvConfig, true>);
    expect(get).toHaveBeenCalledWith('NODE_ENV', { infer: true });
    expect((config.pinoHttp as any).level).toBe('info');
  });

  it('should include context fields in customProps when ALS has data', async () => {
    const config = pinoLoggerConfig(configMock('development'));
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
    const config = pinoLoggerConfig(configMock('development'));
    const customProps = (config.pinoHttp as any).customProps;

    const props = customProps();
    expect(props.tenantId).toBeNull();
    expect(props.userId).toBeNull();
    expect(props.requestId).toBeUndefined();
    expect(props.correlationId).toBeUndefined();
  });

  it('should exclude tenantId from customProps when it is empty string', async () => {
    const config = pinoLoggerConfig(configMock('development'));
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
    const config = pinoLoggerConfig(configMock('development'));
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
    const config = pinoLoggerConfig(configMock('development'));
    const genReqId = (config.pinoHttp as any).genReqId;
    expect(genReqId()).toBe('no-context');
  });

  describe('redact', () => {
    const config = pinoLoggerConfig(configMock('development'));
    const redact = (config.pinoHttp as any).redact as string[];

    it('should redact authorization header', () => {
      expect(redact).toContain('req.headers.authorization');
    });

    it('should redact cookie header', () => {
      expect(redact).toContain('req.headers.cookie');
    });

    it('should redact request set-cookie header', () => {
      expect(redact).toContain('req.headers["set-cookie"]');
    });

    it('should redact x-api-key header', () => {
      expect(redact).toContain('req.headers["x-api-key"]');
    });

    it('should redact x-csrf-token header', () => {
      expect(redact).toContain('req.headers["x-csrf-token"]');
    });

    it('should redact response set-cookie header', () => {
      expect(redact).toContain('res.headers["set-cookie"]');
    });
  });
});
