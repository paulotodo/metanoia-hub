import './common/sentry/instrument';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import type { EnvConfig } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  // Behind a single trusted proxy (Vercel edge / load balancer) — required
  // for `req.ip` to reflect the real client IP from X-Forwarded-For,
  // otherwise rate limiters bucket the entire fleet under one address.
  const expressInstance = httpAdapter.getInstance() as {
    set?: (setting: string, value: unknown) => void;
  };
  expressInstance.set?.('trust proxy', 1);

  const configService = app.get(ConfigService<EnvConfig, true>);
  const port = configService.get('API_PORT', { infer: true });

  app.enableCors({
    origin: configService.get('FRONTEND_URL', { infer: true }),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(port);
  app.get(Logger).log(`API running on http://localhost:${port}`);
}

bootstrap();
