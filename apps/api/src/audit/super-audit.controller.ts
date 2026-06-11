/**
 * SuperAuditController — Super Admin cross-tenant audit viewer.
 *
 * Cross-tenant mechanism (dec-015 / SEC-005 spike result):
 *   Uses prisma.client directly (PrismaService.client → raw PrismaClient
 *   without SET LOCAL). @Roles(SUPER_ADMIN) + @Roles decorator enforced
 *   by RolesGuard. No RLS context needed — metanoia_admin BYPASSRLS.
 *   Confirmed from super-admin-tenants.repository.ts (same pattern).
 *
 * Endpoints:
 *   GET  /api/v1/super-admin/audit-events                — cross-tenant list (tenantId required)
 *   POST /api/v1/super-admin/audit-events/exports        — async CSV export
 *   GET  /api/v1/super-admin/audit-events/exports/:jobId — poll status
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AuditEventsQuerySchema,
  AuditExportRequestSchema,
  type AuditEventsQuery,
  type AuditExportRequest,
} from '@metanoia/types';
import { AuditService } from './audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('api/v1/super-admin/audit-events')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/v1/super-admin/audit-events?tenantId=<uuid>&...filters
   * Cross-tenant read via prisma.client (bypasses RLS).
   * tenantId is a REQUIRED query param (not resolved from AsyncLocalStorage).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listEvents(
    @Query(new ZodValidationPipe(AuditEventsQuerySchema)) query: AuditEventsQuery,
    @Query('tenantId') tenantId: string | undefined,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required for Super Admin audit access');
    }
    return this.auditService.listEvents(query, tenantId);
  }

  /**
   * POST /api/v1/super-admin/audit-events/exports
   * Enqueues async CSV export across a specific tenant's events.
   */
  @Post('exports')
  @HttpCode(HttpStatus.ACCEPTED)
  async createExport(
    @Body(new ZodValidationPipe(AuditExportRequestSchema)) query: AuditExportRequest,
    @Query('tenantId') tenantId: string | undefined,
    @Request() req: { user: AuthenticatedUser },
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }
    const { jobId } = await this.auditService.createExportJob(
      query,
      tenantId,
      req.user.userId,
    );
    return {
      data: {
        jobId,
        message: 'Exportação em andamento. Use o jobId para verificar o status.',
      },
    };
  }

  /**
   * GET /api/v1/super-admin/audit-events/exports/:jobId
   */
  @Get('exports/:jobId')
  @HttpCode(HttpStatus.OK)
  async getExportStatus(@Param('jobId') jobId: string) {
    const status = await this.auditService.getExportJobStatus(jobId);
    return { data: status };
  }
}
