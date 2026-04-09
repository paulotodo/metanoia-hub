import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { requestContext } from '../context/request-context';

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    try {
      const store = requestContext.getStore();

      Sentry.withScope((scope) => {
        if (store?.tenantId) {
          scope.setTag('tenantId', store.tenantId);
        }
        if (store?.userId) {
          scope.setUser({ id: store.userId });
        }
        if (store?.requestId) {
          scope.setTag('requestId', store.requestId);
        }
        if (store?.correlationId) {
          scope.setTag('correlationId', store.correlationId);
        }
        Sentry.captureException(exception);
      });
    } catch {
      // Sentry failure must not prevent error response to client
    }

    super.catch(exception, host);
  }
}
