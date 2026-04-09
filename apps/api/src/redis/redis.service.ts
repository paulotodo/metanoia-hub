import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { EnvConfig } from '../config/env.validation';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(configService: ConfigService<EnvConfig, true>) {
    super({
      host: configService.get('REDIS_HOST', { infer: true }),
      port: configService.get('REDIS_PORT', { infer: true }),
    });
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
