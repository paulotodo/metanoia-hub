import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { HttpServer } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { requestContext } from '../context/request-context';

export interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

const STATUS_TO_ERROR_NAME: Record<number, string> = {
  400: 'BadRequest',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  409: 'Conflict',
  422: 'UnprocessableEntity',
  429: 'TooManyRequests',
  500: 'InternalServerError',
  502: 'BadGateway',
  503: 'ServiceUnavailable',
};

/**
 * Domain-specific `error` names a controller may set on its HttpException
 * payload. Anything outside this set falls back to the status-derived name —
 * prevents arbitrary attacker strings from reaching the FE error key map.
 */
const ALLOWED_DOMAIN_ERRORS = new Set<string>([
  'ConsentRequired',
  'PlanLimitReached',
  'TenantSuspended',
  'InvalidInvite',
  'MfaRequired',
  'EmailAlreadyTaken',
  ...Object.values(STATUS_TO_ERROR_NAME),
]);

function pickStatus(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

export function buildEnvelope(
  exception: unknown,
  statusCode: number,
): ErrorEnvelope {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        statusCode,
        error: STATUS_TO_ERROR_NAME[statusCode] ?? 'Error',
        message: response,
      };
    }

    if (typeof response === 'object' && response !== null) {
      const body = response as Record<string, unknown>;
      const rawMessage = body['message'];
      const message = Array.isArray(rawMessage)
        ? rawMessage.join('; ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : exception.message;

      const rawError = body['error'];
      const error =
        typeof rawError === 'string' && ALLOWED_DOMAIN_ERRORS.has(rawError)
          ? rawError
          : (STATUS_TO_ERROR_NAME[statusCode] ?? 'Error');

      const details =
        typeof body['details'] === 'object' && body['details'] !== null
          ? (body['details'] as Record<string, unknown>)
          : undefined;

      return details
        ? { statusCode, error, message, details }
        : { statusCode, error, message };
    }
  }

  return {
    statusCode,
    error: STATUS_TO_ERROR_NAME[statusCode] ?? 'InternalServerError',
    message: 'An unexpected error occurred',
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapter: HttpServer) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const statusCode = pickStatus(exception);
    const envelope = buildEnvelope(exception, statusCode);

    try {
      const store = requestContext.getStore();

      Sentry.withScope((scope) => {
        if (store?.tenantId) scope.setTag('tenantId', store.tenantId);
        if (store?.userId) scope.setUser({ id: store.userId });
        if (store?.requestId) scope.setTag('requestId', store.requestId);
        if (store?.correlationId)
          scope.setTag('correlationId', store.correlationId);
        scope.setTag('statusCode', String(statusCode));
        scope.setTag('errorName', envelope.error);

        if (statusCode >= 500) {
          Sentry.captureException(exception);
        }
      });
    } catch {
      // Sentry must not block the response
    }

    // FR-13: Record error on active OTel span so it appears in trace backend.
    // Defensive: span may not exist (e.g. health probe, span-filter dropped it).
    try {
      const store = requestContext.getStore();
      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        activeSpan.setStatus({ code: SpanStatusCode.ERROR });
        if (exception instanceof Error) {
          activeSpan.recordException(exception);
        }
        // Redundant safety: ensure correlation_id is on the error span
        if (store?.correlationId) {
          activeSpan.setAttribute('correlation_id', store.correlationId);
        }
      }
    } catch {
      // OTel must not block the response
    }

    if (statusCode >= 500) {
      this.logger.error(
        {
          err: exception instanceof Error ? exception.stack : exception,
          envelope,
        },
        envelope.message,
      );
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    this.httpAdapter.reply(response, envelope, statusCode);
  }
}
