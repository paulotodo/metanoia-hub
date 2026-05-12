import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { uuidv7 } from 'uuidv7';
import { requestContext } from './request-context';
import type { RequestContext } from './request-context';

const CORRELATION_ID_MAX_LENGTH = 128;
const CORRELATION_ID_PATTERN = /^[\x20-\x7E]+$/;

function sanitizeCorrelationId(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = raw.slice(0, CORRELATION_ID_MAX_LENGTH);
  return CORRELATION_ID_PATTERN.test(trimmed) ? trimmed : fallback;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = uuidv7();
    const correlationId = sanitizeCorrelationId(
      req.headers['x-correlation-id'] as string | undefined,
      requestId,
    );

    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Correlation-Id', correlationId);

    const store: RequestContext = {
      tenantId: '',
      requestId,
      correlationId,
    };

    requestContext.run(store, next);
  }
}
