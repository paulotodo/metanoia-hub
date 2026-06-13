import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  TenantMeResponse,
  UpdateTenantProfile,
  UpdateTenantProfileResponse,
  OnboardingProgress,
} from '@metanoia/types';
import { OnboardingProgressSchema } from '@metanoia/types';
import { Prisma } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

// Step name mapping for domain events (FR-10, CHK009)
const STEP_NAMES: Record<number, string> = {
  1: 'profile',
  2: 'community',
  3: 'group',
  4: 'invite',
  5: 'radar',
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findMine(): Promise<TenantMeResponse> {
    const { tenantId } = getRequestContext();

    const tenant = await withTenantTx(this.prisma, (tx) =>
      tx.tenant.findUnique({
        where: { id: tenantId },
      }),
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found for the current session.');
    }

    return {
      id: tenant.id,
      tenantId: tenant.tenantId,
      name: tenant.name,
      focusIndicatorEnabled: tenant.focusIndicatorEnabled,
      createdAt: tenant.createdAt.toISOString(),
    };
  }

  /**
   * Update tenant profile and optionally persist onboarding progress.
   * PATCH /api/v1/tenants/me.
   *
   * dec-018 MUST: no spread-merge of raw body. All fields mapped explicitly.
   * denomination/city/state live in Tenant.metadata JSONB (explicit merge,
   * never overwriting other metadata keys).
   *
   * FR-08: completedAt and skippedAt are mutually exclusive — validated by Zod
   * schema AND re-checked here as defence in depth before DB write.
   */
  async updateProfile(dto: UpdateTenantProfile): Promise<UpdateTenantProfileResponse> {
    const { tenantId } = getRequestContext();

    // Defence-in-depth FR-08 check (Zod refine already guards this at pipe layer)
    if (
      dto.onboardingProgress?.completedAt != null &&
      dto.onboardingProgress?.skippedAt != null
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'completedAt e skippedAt são mutuamente exclusivos (FR-08)',
        details: {},
      });
    }

    const tenant = await withTenantTx(this.prisma, async (tx) => {
      // Fetch current tenant to merge metadata without overwriting unrelated keys
      const current = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!current) {
        throw new NotFoundException('Tenant not found for the current session.');
      }

      // Resolve previous completedSteps for event emission comparison
      let prevProgress: OnboardingProgress | null = null;
      if (current.onboardingProgress != null) {
        const parsed = OnboardingProgressSchema.safeParse(current.onboardingProgress);
        if (parsed.success) prevProgress = parsed.data;
      }

      // Build metadata update — explicit merge, never spread of dto
      const currentMetadata =
        typeof current.metadata === 'object' && current.metadata !== null
          ? (current.metadata as Record<string, unknown>)
          : {};

      const updatedMetadata: Record<string, unknown> = { ...currentMetadata };
      if (dto.denomination !== undefined) updatedMetadata['denomination'] = dto.denomination;
      if (dto.city !== undefined) updatedMetadata['city'] = dto.city;
      if (dto.state !== undefined) updatedMetadata['state'] = dto.state;

      // Build onboardingProgress update — parse via schema, never raw spread.
      // Cast to Prisma.InputJsonValue is required because Zod infers a richer
      // TypeScript type (with `string | null` fields) than Prisma's JsonValue.
      // The runtime value is identical; the cast is type-only.
      let newProgress: Prisma.InputJsonValue | null = current.onboardingProgress;
      if (dto.onboardingProgress !== undefined) {
        // Re-validate (already validated at pipe, but explicit here for safety)
        const parsed = OnboardingProgressSchema.parse(dto.onboardingProgress);
        newProgress = parsed as unknown as Prisma.InputJsonValue;
      }

      // Perform update with explicit field mapping (anti-mass-assignment).
      // `name` is optional in UpdateTenantProfileSchema to support progress-only
      // updates (Steps 3 and 5 of the wizard). Fall back to current value.
      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: dto.name ?? current.name,
          logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : current.logoUrl,
          metadata: updatedMetadata as Prisma.InputJsonValue,
          onboardingProgress: newProgress ?? Prisma.JsonNull,
        },
      });

      return { updated, prevProgress };
    });

    // Emit domain events AFTER successful DB write (outside transaction)
    if (dto.onboardingProgress !== undefined) {
      const newProgress = dto.onboardingProgress;
      const prevCompleted = tenant.prevProgress?.completedSteps ?? [];

      // Emit step_completed for each newly completed step
      for (const step of newProgress.completedSteps) {
        if (!prevCompleted.includes(step)) {
          this.eventEmitter.emit('onboarding.wizard.step_completed', {
            eventId: uuidv7(),
            eventType: 'onboarding.wizard.step_completed',
            version: 1,
            tenantId,
            timestamp: new Date().toISOString(),
            data: { step, stepName: STEP_NAMES[step] ?? 'unknown' },
            metadata: {},
          });
        }
      }

      // Emit wizard.completed when completed flag is set
      if (newProgress.completed && !tenant.prevProgress?.completed) {
        this.eventEmitter.emit('onboarding.wizard.completed', {
          eventId: uuidv7(),
          eventType: 'onboarding.wizard.completed',
          version: 1,
          tenantId,
          timestamp: new Date().toISOString(),
          data: { completedAt: newProgress.completedAt },
          metadata: {},
        });
      }
    }

    const { updated } = tenant;
    const meta = (updated.metadata ?? {}) as Record<string, unknown>;

    // Parse persisted onboardingProgress for response (null if absent)
    let progress: OnboardingProgress | null = null;
    if (updated.onboardingProgress != null) {
      const parsed = OnboardingProgressSchema.safeParse(updated.onboardingProgress);
      if (parsed.success) progress = parsed.data;
    }

    return {
      data: {
        id: updated.id,
        name: updated.name,
        denomination: typeof meta['denomination'] === 'string' ? meta['denomination'] : null,
        city: typeof meta['city'] === 'string' ? meta['city'] : null,
        state: typeof meta['state'] === 'string' ? meta['state'] : null,
        logoUrl: updated.logoUrl ?? null,
        onboardingProgress: progress,
      },
    };
  }
}
