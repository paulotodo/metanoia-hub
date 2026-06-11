import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TrailReportQuerySchema, type TrailReportQuery } from '@metanoia/types';
import { ReportsService } from './reports.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('api/v1/reports')
@UseGuards(KeycloakAuthGuard, RolesGuard, TenantGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /api/v1/reports/trails
   * Admin: returns summary of all trails in tenant.
   */
  @Get('trails')
  @Roles(Role.ADMIN_TENANT)
  @HttpCode(HttpStatus.OK)
  async getTrailsSummary() {
    return this.reportsService.getTrailsSummary();
  }

  /**
   * GET /api/v1/reports/trails/:trailId
   * Leader: participants from their groups only.
   * Admin: all participants in tenant.
   */
  @Get('trails/:trailId')
  @Roles(Role.ADMIN_TENANT, Role.LIDER)
  @HttpCode(HttpStatus.OK)
  async getTrailReport(
    @Param('trailId') trailId: string,
    @Query(new ZodValidationPipe(TrailReportQuerySchema)) query: TrailReportQuery,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.reportsService.getTrailReport(trailId, query, req.user);
  }

  /**
   * GET /api/v1/reports/trails/:trailId/export?format=csv
   * Returns CSV inline or 202+jobId for large trails (>1000 participants).
   */
  @Get('trails/:trailId/export')
  @Roles(Role.ADMIN_TENANT, Role.LIDER)
  async exportTrailCsv(
    @Param('trailId') trailId: string,
    @Res() res: Response,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const result = await this.reportsService.exportTrailCsv(trailId, req.user);

    if (!result.inline) {
      res.status(HttpStatus.ACCEPTED).json({
        data: { jobId: result.jobId, message: 'Exportação em processamento. Consulte o status pelo jobId.' },
      });
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(HttpStatus.OK).send(result.csv);
  }

  /**
   * GET /api/v1/reports/jobs/:jobId
   * Poll export job status and retrieve signed URL when completed.
   */
  @Get('jobs/:jobId')
  @Roles(Role.ADMIN_TENANT, Role.LIDER)
  @HttpCode(HttpStatus.OK)
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.reportsService.getJobStatus(jobId);
    return { data: status };
  }
}
