import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import type { EnvConfig } from '../../config/env.validation';
import { requestContext } from '../context/request-context';

export function pinoLoggerConfig(
  config: ConfigService<EnvConfig, true>,
): Params {
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  return {
    pinoHttp: {
      level: isProduction ? 'info' : 'debug',
      transport: isProduction
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true } },
      customProps: () => {
        const store = requestContext.getStore();
        return {
          requestId: store?.requestId,
          correlationId: store?.correlationId,
          tenantId: store?.tenantId || null,
          userId: store?.userId || null,
        };
      },
      genReqId: () => {
        const store = requestContext.getStore();
        return store?.requestId ?? 'no-context';
      },
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'req.headers["x-api-key"]',
        'req.headers["x-csrf-token"]',
        'res.headers["set-cookie"]',
      ],
    },
  };
}
