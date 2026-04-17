import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { withMultiTenant } from './prisma.extension';
import type { EnvConfig } from '../config/env.validation';

type ExtendedClient = ReturnType<typeof withMultiTenant>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private extendedClient: ExtendedClient | undefined;

  constructor(configService: ConfigService<EnvConfig, true>) {
    const connectionString = configService.get('DATABASE_APP_URL', { infer: true });
    const adapter = new PrismaPg({ connectionString });
    this.prisma = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    await this.prisma.$connect();
    this.extendedClient = withMultiTenant(this.prisma);
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  /** Extended client with RLS tenant injection — use for all tenant-scoped queries */
  get tenant(): ExtendedClient {
    if (!this.extendedClient) {
      throw new Error('PrismaService not initialized');
    }
    return this.extendedClient;
  }

  /** Raw PrismaClient without RLS — use only for public endpoints (e.g., registration) */
  get client(): PrismaClient {
    return this.prisma;
  }

  /** Tagged-template raw query — passthrough to the inner PrismaClient */
  get $queryRaw(): PrismaClient['$queryRaw'] {
    return this.prisma.$queryRaw.bind(this.prisma);
  }
}
