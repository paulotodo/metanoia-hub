import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { EnvConfig } from '../config/env.validation';
import { Public } from '../auth/decorators/public.decorator';

type CheckStatus = 'ok' | 'error';

interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  checks: {
    database: CheckStatus;
    redis: CheckStatus;
    keycloak: CheckStatus;
    storage: CheckStatus;
  };
}

@Public()
@Controller('api/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Get()
  async check(@Res() res: Response): Promise<void> {
    const [database, redis, keycloak, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkKeycloak(),
      this.checkStorage(),
    ]);

    const checks = { database, redis, keycloak, storage };
    const allOk = Object.values(checks).every((s) => s === 'ok');

    const body: HealthResponse = {
      status: allOk ? 'ok' : 'degraded',
      version: '1.0.0',
      checks,
    };

    res
      .status(allOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(body);
  }

  private async checkDatabase(): Promise<CheckStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }

  private async checkKeycloak(): Promise<CheckStatus> {
    try {
      const url = this.config.get('KEYCLOAK_URL', { infer: true });
      const response = await fetch(`${url}/health/ready`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }

  private async checkStorage(): Promise<CheckStatus> {
    try {
      const url = this.config.get('MINIO_ENDPOINT', { infer: true });
      const response = await fetch(`${url}/minio/health/live`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
