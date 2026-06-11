/**
 * AuditController — admin-scoped audit log viewer for the current tenant.
 *
 * Endpoints:
 *   GET  /api/v1/audit-events           — paginated list with filters
 *   POST /api/v1/audit-events/exports   — enqueue async CSV export (202)
 *   GET  /api/v1/audit-events/exports/:jobId — poll export job status
 *
 * All endpoints require ADMIN_TENANT role and are tenant-scoped (RLS).
 * Tenant resolution from AsyncLocalStorage — never from query/body params.
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
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
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

@Controller('api/v1/audit-events')
@UseGuards(KeycloakAuthGuard, RolesGuard, TenantGuard)
@Roles(Role.ADMIN_TENANT)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/v1/audit-events
   * Returns paginated audit events for the current tenant.
   * dec-022 (API-012): offset-based pagination.
   * dec-020 (API-003): q searches resource + resource_id.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listEvents(
    @Query(new ZodValidationPipe(AuditEventsQuerySchema)) query: AuditEventsQuery,
  ) {
    return this.auditService.listEvents(query);
  }

  /**
   * POST /api/v1/audit-events/exports
   * Enqueues an async CSV export job. Returns 202 + jobId.
   * dec-021 (API-009): previousState/newState serialized as JSON string in CSV.
   */
  @Post('exports')
  @HttpCode(HttpStatus.ACCEPTED)
  async createExport(
    @Body(new ZodValidationPipe(AuditExportRequestSchema)) query: AuditExportRequest,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const { jobId } = await this.auditService.createExportJob(
      query,
      null, // tenant-scoped: tenantId resolved from AsyncLocalStorage in service
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
   * GET /api/v1/audit-events/exports/:jobId
   * Polls the status of a pending or completed export job.
   */
  @Get('exports/:jobId')
  @HttpCode(HttpStatus.OK)
  async getExportStatus(@Param('jobId') jobId: string) {
    const status = await this.auditService.getExportJobStatus(jobId);
    return { data: status };
  }
}
