import type { Params } from 'nestjs-pino';
import { requestContext } from '../context/request-context';

export function pinoLoggerConfig(): Params {
  const isProduction = process.env.NODE_ENV === 'production';

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
      redact: ['req.headers.authorization'],
    },
  };
}
