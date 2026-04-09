import './common/sentry/instrument';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/sentry/sentry.filter';
import type { EnvConfig } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));

  const configService = app.get(ConfigService<EnvConfig, true>);
  const port = configService.get('API_PORT', { infer: true });

  await app.listen(port);
  app.get(Logger).log(`API running on http://localhost:${port}`);
}

bootstrap();
