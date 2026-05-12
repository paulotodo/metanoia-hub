import { describe, it, expect } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import pino from 'pino';
import type { EnvConfig } from '../../src/config/env.validation';
import { pinoLoggerConfig } from '../../src/common/logger/logger.config';

function configMock(): ConfigService<EnvConfig, true> {
  return {
    get: (key: keyof EnvConfig) => (key === 'NODE_ENV' ? 'production' : undefined),
  } as unknown as ConfigService<EnvConfig, true>;
}

describe('logger redact (integration with pino stream)', () => {
  it('redacts all configured sensitive headers in emitted log output', () => {
    const params = pinoLoggerConfig(configMock());
    const redact = (params.pinoHttp as any).redact as string[];

    const chunks: string[] = [];
    const stream = {
      write: (chunk: string) => {
        chunks.push(chunk);
      },
    };

    const logger = pino({ redact }, stream as unknown as NodeJS.WritableStream);

    logger.info(
      {
        req: {
          headers: {
            authorization: 'Bearer super-secret-token-12345',
            cookie: 'session=secret-session-abc; user=42',
            'set-cookie': 'sessid=ABC123; HttpOnly',
            'x-api-key': 'sk_live_supersecret',
            'x-csrf-token': 'csrf-token-xyz',
          },
        },
        res: {
          headers: {
            'set-cookie': 'sessid=ABC123; HttpOnly',
          },
        },
      },
      'sample request',
    );

    expect(chunks.length).toBeGreaterThan(0);
    const output = chunks.join('');

    expect(output).not.toContain('super-secret-token-12345');
    expect(output).not.toContain('secret-session-abc');
    expect(output).not.toContain('sk_live_supersecret');
    expect(output).not.toContain('csrf-token-xyz');
    expect(output).not.toContain('ABC123');

    const parsed = JSON.parse(chunks[0]);
    expect(parsed.req.headers.authorization).toBe('[Redacted]');
    expect(parsed.req.headers.cookie).toBe('[Redacted]');
    expect(parsed.req.headers['set-cookie']).toBe('[Redacted]');
    expect(parsed.req.headers['x-api-key']).toBe('[Redacted]');
    expect(parsed.req.headers['x-csrf-token']).toBe('[Redacted]');
    expect(parsed.res.headers['set-cookie']).toBe('[Redacted]');
  });
});
