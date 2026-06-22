import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthCheckService } from './health-check.service';
import {
  IntegrationHealthHistoryQuerySchema,
  type IntegrationHealthHistoryQuery,
} from '@metanoia/types';
import { generateId } from '@metanoia/types';

/**
 * HealthCheckController — endpoints REST de health check de integrações.
 *
 * Story 14-4 §FR-003, §FR-004, §NFR-SEC-002.
 * Guard @Roles(Role.SUPER_ADMIN) → 403 para qualquer outro role.
 * Usa obrigatoriamente o enum Role.SUPER_ADMIN — NUNCA string literal (CHK025/CHK013).
 *
 * Micro-cache in-memory de 5-10s: coalescer de refreshes simultâneos do endpoint
 * on-demand (CHK035/CHK049, OWASP F4).
 */
@Controller('api/v1/admin/health')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class HealthCheckController {
  /** Micro-cache in-memory: { result, timestamp } — TTL 10s */
  private cache: { result: ReturnType<HealthCheckService['computeSummary']> extends never ? never : { integrations: unknown[]; summary: unknown }; timestamp: number } | null = null;
  private readonly CACHE_TTL_MS = 10_000;

  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/v1/admin/health/integrations
   * Executa as 5 probes e retorna status consolidado.
   * Micro-cache de 10s para coalescer múltiplas chamadas simultâneas.
   */
  @Get('integrations')
  async getIntegrations(@Req() req: Request): Promise<{ data: { integrations: unknown[]; summary: unknown } }> {
    const correlationId = generateId();
    const now = Date.now();

    // Micro-cache: retornar cached se disponível e não expirado
    if (this.cache && now - this.cache.timestamp < this.CACHE_TTL_MS) {
      return { data: this.cache.result };
    }

    // Executar probes
    const integrations = await this.healthCheckService.runAllProbes();
    const summary = this.healthCheckService.computeSummary(integrations);

    // Atualizar cache
    this.cache = { result: { integrations, summary }, timestamp: now };

    // Audit do acesso HTTP (CHK027/CHK015)
    const userSub = (req as unknown as { user?: { sub?: string } }).user?.sub ?? null;
    void this.auditService.createEvent({
      userId: userSub,
      action: 'create',
      resource: 'integration_health',
      resourceId: 'all',
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.get('user-agent') ?? 'unknown',
      newState: null,
    });

    return { data: { integrations, summary } };
  }

  /**
   * GET /api/v1/admin/health/integrations/history
   * Retorna histórico de latência para sparkline 24h.
   * Query params: integration (obrigatório), hours (opcional, default=24, max=72).
   */
  @Get('integrations/history')
  @UsePipes(new ZodValidationPipe(IntegrationHealthHistoryQuerySchema))
  async getIntegrationsHistory(
    @Query() query: IntegrationHealthHistoryQuery,
  ): Promise<unknown> {
    const { integration, hours } = query;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const rows = await this.prisma.client.$queryRawUnsafe<
      Array<{
        id: string;
        integration_name: string;
        status: string;
        latency_ms: number | null;
        message: string | null;
        checked_at: Date;
      }>
    >(
      `SELECT id::text, integration_name, status, latency_ms, message, checked_at
       FROM integration_health_log
       WHERE integration_name = $1
         AND checked_at >= $2::timestamptz
       ORDER BY checked_at DESC
       LIMIT 288`,
      integration,
      since,
    );

    const points = rows.map((r) => ({
      checkedAt: r.checked_at.toISOString(),
      status: r.status,
      latencyMs: r.latency_ms ?? null,
      message: r.message ?? null,
    }));

    return {
      data: {
        integration,
        points,
        hours,
      },
      meta: {
        total: points.length,
        integration,
        hours,
      },
    };
  }
}
