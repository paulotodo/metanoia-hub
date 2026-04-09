import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { withMultiTenant } from './prisma.extension';
import type { EnvConfig } from '../config/env.validation';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private extendedClient: ReturnType<typeof withMultiTenant> | undefined;

  constructor(configService: ConfigService<EnvConfig, true>) {
    const connectionString = configService.get('DATABASE_APP_URL', { infer: true });
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.extendedClient = withMultiTenant(this);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  get tenant() {
    if (!this.extendedClient) {
      throw new Error('PrismaService not initialized');
    }
    return this.extendedClient;
  }

  /** Raw PrismaClient without RLS — use only for public endpoints (e.g., registration) */
  get client(): PrismaClient {
    return this;
  }
}
