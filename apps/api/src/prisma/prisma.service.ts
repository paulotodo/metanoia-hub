import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor(configService: ConfigService<EnvConfig, true>) {
    const connectionString = configService.get('DATABASE_APP_URL', { infer: true });
    const adapter = new PrismaPg({ connectionString });
    this.prisma = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  /**
   * Raw PrismaClient — use only for non-tenant-scoped queries (public
   * endpoints, signup, health checks). All tenant-scoped queries MUST go
   * through `withTenantTx` (apps/api/src/prisma/with-tenant-tx.ts), which
   * wraps the query in a `$transaction` that issues
   * `SET LOCAL app.current_tenant_id` first so RLS policies can resolve.
   */
  get client(): PrismaClient {
    return this.prisma;
  }

  /** Tagged-template raw query — passthrough to the inner PrismaClient */
  get $queryRaw(): PrismaClient['$queryRaw'] {
    return this.prisma.$queryRaw.bind(this.prisma);
  }
}
