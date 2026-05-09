import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import {
  ClientErrorReportSchema,
  type ClientErrorReport,
} from '@metanoia/types';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ClientErrorRateLimitGuard } from './client-error-rate-limit.guard';

@Controller('api/v1/observability')
export class ObservabilityController {
  private readonly logger = new Logger(ObservabilityController.name);

  @Public()
  @Post('client-errors')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ClientErrorRateLimitGuard)
  reportClientError(
    @Body(new ZodValidationPipe(ClientErrorReportSchema))
    body: ClientErrorReport,
  ): void {
    this.logger.warn(
      {
        errorName: body.errorName,
        statusCode: body.statusCode,
        route: body.route,
        digest: body.digest,
        userId: body.userId,
        tenantId: body.tenantId,
      },
      `client-side error: ${body.message}`,
    );

    try {
      Sentry.withScope((scope) => {
        scope.setTag('source', 'frontend-boundary');
        scope.setTag('errorName', body.errorName);
        if (body.statusCode != null)
          scope.setTag('statusCode', String(body.statusCode));
        if (body.route) scope.setTag('route', body.route);
        if (body.digest) scope.setTag('digest', body.digest);
        if (body.tenantId) scope.setTag('tenantId', body.tenantId);
        if (body.userId) scope.setUser({ id: body.userId });
        if (body.componentStack) {
          scope.setExtra('componentStack', body.componentStack);
        }
        Sentry.captureMessage(body.message, 'error');
      });
    } catch {
      // Sentry must never block the response.
    }
  }
}
