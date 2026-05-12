import * as Sentry from '@sentry/nestjs';
import { parseTracesSampleRate } from './parse-traces-sample-rate';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: parseTracesSampleRate(),
});
