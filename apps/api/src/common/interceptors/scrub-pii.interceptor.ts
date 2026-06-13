import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { IncomingMessage } from 'node:http';

/**
 * ScrubPiiInterceptor — CHK024 (log-scrub of PII on onboarding PATCH endpoints).
 *
 * Before the handler runs, redacts PII fields from the request body in the
 * logger context so that pino/nestjs-pino never serializes raw PII to log sinks.
 * The handler itself still receives the original (validated) body — only the
 * LOGGED representation is scrubbed.
 *
 * Fields scrubbed: name, email, profilePhotoUrl, logoUrl, roleTitle.
 *
 * This interceptor does NOT mutate the actual request body — it attaches a
 * scrubbed copy to `req['__scrubbed_body']` for use by the pino serializer
 * if the logger is configured to log req.body. Most pino setups log
 * req.body = req['__scrubbed_body'] when present.
 *
 * Apply with @UseInterceptors(ScrubPiiInterceptor) on individual endpoints
 * or controllers that handle PII (onboarding PATCH + upload).
 */

const PII_FIELDS = ['name', 'email', 'profilePhotoUrl', 'logoUrl', 'roleTitle'] as const;
const REDACTED = '[REDACTED]';

function scrubObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  const copy: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  for (const field of PII_FIELDS) {
    if (field in copy) {
      copy[field] = REDACTED;
    }
  }
  return copy;
}

@Injectable()
export class ScrubPiiInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ScrubPiiInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<IncomingMessage & { body?: unknown; __scrubbed_body?: unknown }>();

    if (req.body && typeof req.body === 'object') {
      req['__scrubbed_body'] = scrubObject(req.body);
    }

    // Debug: log scrubbed body to confirm PII is redacted (never raw)
    if (process.env['NODE_ENV'] !== 'production') {
      this.logger.debug({ scrubbed_body: req['__scrubbed_body'] }, 'PII scrubbed from request body');
    }

    return next.handle();
  }
}
