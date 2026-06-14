import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { uuidv7 } from 'uuidv7';
import {
  IMPORT_SYNC_THRESHOLD,
  ImportJobStatusSchema,
  ImportRequestSchema,
  type ImportJobStatus,
  type ImportRequest,
} from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { CsvImportService } from './csv-import.service';

@Controller('api/v1/groups/:groupId/members')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT)
export class CsvImportController {
  constructor(
    private readonly csvImportService: CsvImportService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/v1/groups/:groupId/members/import
   *
   * Sync (≤100 rows)  → 201 + ImportResultSummary
   * Async (>100 rows) → 202 + { jobId, message }
   */
  @Post('import')
  @ApiOperation({ summary: 'Import CSV members into a group' })
  async importMembers(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body(new ZodValidationPipe(ImportRequestSchema)) body: ImportRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tenantId } = getRequestContext();

    // Validate group belongs to tenant
    await this.requireGroupInTenant(groupId, tenantId);

    const { rows, defaultGroupId } = body;
    const effectiveGroupId = defaultGroupId;

    // Enforce plan limit before processing (FR04 — full reject if exceeded)
    await this.csvImportService.enforcePlanLimit(effectiveGroupId, rows.length);

    const ip = (req.headers['x-forwarded-for'] as string | undefined) ?? req.socket?.remoteAddress ?? '';
    const ua = req.headers['user-agent'] ?? '';

    if (rows.length <= IMPORT_SYNC_THRESHOLD) {
      // --- SYNC path (≤100 rows) → 201 ---
      res.status(HttpStatus.CREATED);
      const summary = await this.csvImportService.processRows(rows, effectiveGroupId);
      const jobId = uuidv7();
      summary.jobId = jobId;
      await this.csvImportService.generateReport(summary, tenantId, jobId);
      await this.csvImportService.emitAuditAndEvent(user.userId, groupId, summary, ip, ua);

      return {
        data: summary,
      };
    }

    // --- ASYNC path (>100 rows) → 202 ---
    res.status(HttpStatus.ACCEPTED);
    const jobId = uuidv7();

    // Persist initial job state in Redis (IDOR-safe: includes tenantId)
    await this.csvImportService.setJobStatus(jobId, tenantId, {
      status: 'processing',
      progress: 0,
      result: null,
      failureReason: null,
    });

    // Enqueue BullMQ job
    await this.csvImportService.getQueue().add(
      'process-csv-import',
      {
        rows,
        defaultGroupId: effectiveGroupId,
        groupId,
        jobId,
        tenantId,
        userId: user.userId,
        ipAddress: ip,
        userAgent: ua,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 50 },
        removeOnFail: false,
      },
    );

    return {
      data: {
        jobId,
        message: 'Importação iniciada. Acompanhe o progresso pelo jobId.',
      },
    };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async requireGroupInTenant(groupId: string, tenantId: string): Promise<void> {
    const group = await withTenantTx(
      this.prisma,
      (tx) => tx.group.findFirst({ where: { id: groupId, tenantId }, select: { id: true } }),
    );
    if (!group) throw new NotFoundException('Group not found');
  }
}

// ---------------------------------------------------------------------------
// Standalone controller for job polling (different base path)
// ---------------------------------------------------------------------------

@Controller('api/v1/import/jobs')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.ADMIN_TENANT)
export class CsvImportJobController {
  constructor(private readonly csvImportService: CsvImportService) {}

  /**
   * GET /api/v1/import/jobs/:jobId
   *
   * Returns current job status. Tenant-binding enforced (IDOR prevention):
   * if jobId belongs to another tenant → 404 (not 403, to avoid enumeration).
   */
  @Get(':jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Poll CSV import job status' })
  async getJobStatus(@Param('jobId', ParseUUIDPipe) jobId: string): Promise<{ data: ImportJobStatus }> {
    const { tenantId } = getRequestContext();

    const payload = await this.csvImportService.getJobStatus(jobId);

    // IDOR tenant-binding: mismatch → 404 to avoid enumeration (OWASP MEDIUM #2)
    if (payload['tenantId'] !== tenantId) {
      throw new NotFoundException('Job not found');
    }

    const result = ImportJobStatusSchema.safeParse(payload);
    if (!result.success) {
      throw new NotFoundException('Job not found');
    }

    return { data: result.data };
  }
}
