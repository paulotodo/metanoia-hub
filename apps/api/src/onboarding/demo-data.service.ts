import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { seedDemoData } from './seed/demo-data.seed';

export interface DemoStatusResult {
  hasDemoData: boolean;
  hasRealData: boolean;
  demoRecordCount: number;
  nudgeDismissed: boolean;
}

/**
 * DemoDataService — supporting subdomain, uses Prisma directly (no repository).
 *
 * Responsibilities:
 * - Seed per-tenant demo data (idempotent)
 * - Delete all demo data for a tenant (idempotent — no-op if none)
 * - Return demo status (hasDemoData, hasRealData, nudgeDismissed, count)
 * - Persist nudge dismissal in Tenant.metadata.demoDismissedAt
 *
 * Multi-tenancy: methods that operate inside a request (deleteDemoData,
 * getDemoStatus, dismissNudge) use withTenantTx which reads tenantId from
 * RequestContext (AsyncLocalStorage). seedDemoData is called from the
 * provisioning saga (no request context) and passes tenantId explicitly
 * to the seed function.
 *
 * Interface with LGPD export (Story 9-1 / SEC011):
 * Users seeded with isDemoData=true appear in LGPD exports as technical
 * tenant data. The admin should run DELETE /api/v1/onboarding/demo-data
 * before triggering a LGPD export if they don't want demo records included.
 * There is no automatic isDemoData filter in the LGPD exporter (dec-010,
 * SEC010 — deferred to post-MVP).
 */
@Injectable()
export class DemoDataService {
  private readonly logger = new Logger(DemoDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seeds demo data for the given tenant.
   *
   * This method is called from the provisioning saga (Step 4, non-fatal).
   * Failures are logged but never propagated so provisioning always completes.
   * Pass tenantId explicitly — no RequestContext available at provisioning time.
   */
  async seedDemoData(tenantId: string): Promise<void> {
    try {
      await seedDemoData(tenantId, this.prisma.client as never);
    } catch (err) {
      this.logger.error('seedDemoData failed (non-fatal)', err);
    }
  }

  /**
   * Deletes all rows flagged isDemoData=true for the current tenant.
   *
   * Deletion order (inverse of insertion, Decision 5 of research.md):
   * PastoralAction → MeetingTelemetry → MeetingAttendance → Meeting →
   * ModuleProgress → TrailProgress → Lesson → Module → Trail →
   * GroupMember → Group → User
   *
   * Idempotent: if there are no demo records, all deletes are no-ops.
   */
  async deleteDemoData(tenantId: string): Promise<void> {
    await withTenantTx(this.prisma, async (tx) => {
      await tx.pastoralAction.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.meetingTelemetry.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.meetingAttendance.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.meeting.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.moduleProgress.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.trailProgress.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.lesson.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.module.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.trail.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.groupMember.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.group.deleteMany({ where: { tenantId, isDemoData: true } });
      await tx.user.deleteMany({ where: { tenantId, isDemoData: true } });
    }, { tenantId });
  }

  /**
   * Returns the demo status for the current tenant.
   *
   * hasDemoData — true if any row with isDemoData=true exists (checked via Group count)
   * hasRealData — true if any Group without isDemoData exists
   * demoRecordCount — total count of demo records across all 12 tables
   * nudgeDismissed — true if Tenant.metadata.demoDismissedAt is set
   *
   * Interface with LGPD export (SEC011 / dec-010):
   * Users and records seeded with isDemoData=true appear in LGPD exports
   * (Story 9-1) as technical tenant data — they are not automatically filtered
   * by the LGPD exporter (filtering deferred to post-MVP per SEC010).
   * Admins who do not want demo records included in a LGPD export must call
   * `DELETE /api/v1/onboarding/demo-data` before triggering the export.
   * This method itself does not filter by isDemoData; it counts all records
   * (demo and real) separately to inform the UI nudge.
   */
  async getDemoStatus(tenantId: string): Promise<DemoStatusResult> {
    const [
      demoGroupCount,
      realGroupCount,
      tenant,
      demoUsers,
      demoGroupMembers,
      demoTrails,
      demoModules,
      demoLessons,
      demoTrailProgress,
      demoModuleProgress,
      demoMeetings,
      demoMeetingAttendance,
      demoMeetingTelemetry,
      demoPastoralActions,
    ] = await Promise.all([
      this.prisma.client.group.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.group.count({ where: { tenantId, isDemoData: false } }),
      this.prisma.client.tenant.findFirst({ where: { tenantId } }),
      this.prisma.client.user.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.groupMember.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.trail.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.module.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.lesson.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.trailProgress.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.moduleProgress.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.meeting.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.meetingAttendance.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.meetingTelemetry.count({ where: { tenantId, isDemoData: true } }),
      this.prisma.client.pastoralAction.count({ where: { tenantId, isDemoData: true } }),
    ]);

    const demoRecordCount =
      demoUsers +
      demoGroupMembers +
      demoGroupCount +
      demoTrails +
      demoModules +
      demoLessons +
      demoTrailProgress +
      demoModuleProgress +
      demoMeetings +
      demoMeetingAttendance +
      demoMeetingTelemetry +
      demoPastoralActions;

    const metadata = (tenant?.metadata ?? {}) as Record<string, unknown>;
    const nudgeDismissed = typeof metadata['demoDismissedAt'] === 'string';

    return {
      hasDemoData: demoGroupCount > 0,
      hasRealData: realGroupCount > 0,
      demoRecordCount,
      nudgeDismissed,
    };
  }

  /**
   * Persists the nudge dismissal timestamp in Tenant.metadata.
   *
   * Uses a spread to preserve existing metadata keys.
   * Idempotent — calling again just overwrites with a newer timestamp.
   */
  async dismissNudge(tenantId: string): Promise<void> {
    await withTenantTx(this.prisma, async (tx) => {
      const tenant = await tx.tenant.findFirst({ where: { tenantId } });
      const currentMetadata = (tenant?.metadata ?? {}) as Record<string, unknown>;
      await tx.tenant.updateMany({
        where: { tenantId },
        data: {
          metadata: {
            ...currentMetadata,
            demoDismissedAt: new Date().toISOString(),
          },
        },
      });
    }, { tenantId });
  }
}
