/**
 * AuditInterceptor — global NestJS interceptor capturing state-changing HTTP requests.
 *
 * dec-016 (SEC-011): tap() executes AFTER the handler; previousState only
 *   available when service explicitly calls setAuditPreviousState().
 * dec-017 (REQ-004): 1 event per request (not N per bulk operation).
 * dec-008 (SEC-008): also captures @Public() routes (userId may be null).
 *
 * Excluded from capture:
 *   - GET, HEAD, OPTIONS (read-only, no state change)
 *   - Non-2xx responses (action failed, nothing to audit)
 *   - Health + metrics endpoints
 *
 * IP extraction order: X-Forwarded-For → X-Real-IP → socket.remoteAddress
 *
 * Audit failures are silently swallowed by AuditService.createEvent()
 * (FR-INFRA-01: audit must never degrade the main request path).
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_PAYLOAD_TRUNCATE_BYTES } from '@metanoia/types';
import type { AuditAction } from '@metanoia/types';
import { AuditService } from './audit.service';
import { auditContext } from './audit-context';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXCLUDED_PATHS = ['/health', '/metrics', '/api/v1/health'];

/** Maps HTTP method → audit action (best-effort; controller can refine via AuditContext) */
function methodToAction(method: string, statusCode: number): AuditAction {
  if (statusCode === 201) return 'create';
  switch (method) {
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'update';
  }
}

/** Extracts client IP from standard proxy headers */
function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first?.trim() ?? 'unknown';
  }
  return (req.headers['x-real-ip'] as string) ?? req.socket?.remoteAddress ?? 'unknown';
}

/** Extracts resource name from path: /api/v1/<resource>/... → resource */
function extractResource(path: string): string {
  // Strip /api/v1/ prefix
  const stripped = path.replace(/^\/api\/v\d+\//, '');
  // First path segment
  return stripped.split('/')[0] ?? path;
}

/** Extracts resourceId from path: /api/v1/resource/<id>/... → id */
function extractResourceId(path: string): string | null {
  const stripped = path.replace(/^\/api\/v\d+\//, '');
  const parts = stripped.split('/');
  return parts[1] ?? null;
}

/**
 * Truncates response body for newState capture.
 * dec-019 (SEC-007): kept < AUDIT_PAYLOAD_TRUNCATE_BYTES.
 */
function safeBodyToState(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  try {
    const json = JSON.stringify(body);
    if (json.length > AUDIT_PAYLOAD_TRUNCATE_BYTES) {
      return {
        __truncated: true,
        __originalSize: json.length,
        __sample: json.slice(0, 1000),
      };
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Skip read-only methods and excluded paths
    if (!WRITE_METHODS.has(req.method) || EXCLUDED_PATHS.some((p) => req.path.startsWith(p))) {
      return next.handle();
    }

    const action = methodToAction(req.method, res.statusCode);
    const resource = extractResource(req.path);
    const resourceId = extractResourceId(req.path);
    const ipAddress = extractIp(req);
    const userAgent = (req.headers['user-agent'] as string) ?? 'unknown';

    // dec-016 (SEC-011): run handler inside AuditContext so services can set previousState
    return new Observable((subscriber) => {
      auditContext.run({ previousState: null }, () => {
        next
          .handle()
          .pipe(
            tap({
              next: (responseBody) => {
                // Only audit successful state-changing responses
                if (res.statusCode < 200 || res.statusCode >= 300) return;

                const user = (req as Request & { user?: { userId?: string } }).user;
                const userId = user?.userId ?? null;
                const newState = safeBodyToState(responseBody);

                // Fire-and-forget — AuditService.createEvent() swallows errors
                void this.auditService.createEvent({
                  userId,
                  action,
                  resource,
                  resourceId,
                  ipAddress,
                  userAgent,
                  newState,
                });
              },
            }),
          )
          .subscribe(subscriber);
      });
    });
  }
}
