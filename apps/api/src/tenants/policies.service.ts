/**
 * PoliciesService — manages tenant behavioural policy toggles.
 *
 * Key design decisions (Story 11-3):
 * - focusMonitoring maps tenant.focusIndicatorEnabled (NOT stored in JSONB)
 * - JSONB stores: mandatoryCamera, sequentialTrailAccess, autoPresenceTracking, expressMode
 * - policyVersion increments on EVERY PATCH, including empty DTO (dec-010/CHK033)
 * - Redis write-through fail-silent (CHK034): redis failure → logger.warn, no 500
 * - Tier gate: Pro-only toggles (focusMonitoring, mandatoryCamera) → 403 on Free
 * - Audit: policy_change event via AuditService after every PATCH
 * - EventEmitter2: emits focus-monitoring.enabled when toggled ON (CHK007)
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import { uuidv7 } from 'uuidv7';
import type { TenantPolicies, UpdatePoliciesDto, TierInfo } from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { AuditService } from '../audit/audit.service';
import { ConsentRepository } from '../consent/consent.repository';

// ─── Defaults ──────────────────────────────────────────────────────────────────

/**
 * Convention-over-config defaults (dec D4).
 * focusMonitoring is runtime-resolved from tenant.focusIndicatorEnabled.
 */
const POLICY_DEFAULTS: TenantPolicies = {
  focusMonitoring: false,
  mandatoryCamera: false,
  sequentialTrailAccess: false,
  autoPresenceTracking: true,
  expressMode: true,
};

/** Static tier info returned with every policies response. */
const TIER_INFO: TierInfo = {
  focusMonitoring: { requiresPlan: 'pro' },
  mandatoryCamera: { requiresPlan: 'pro' },
  sequentialTrailAccess: { requiresPlan: 'free' },
  autoPresenceTracking: { requiresPlan: 'free' },
  expressMode: { requiresPlan: 'free' },
};

// ─── Result types ──────────────────────────────────────────────────────────────

export interface PoliciesResult {
  policies: TenantPolicies;
  policyVersion: number;
  tierInfo: TierInfo;
}

export interface UpdatePoliciesResult {
  policies: TenantPolicies;
  policyVersion: number;
  tierInfo: TierInfo;
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

function cacheKey(tenantId: string): string {
  return `cache:policies:${tenantId}`;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly planLimits: PlanLimitsService,
    private readonly auditService: AuditService,
    private readonly consentRepository: ConsentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Returns current policies for the active tenant.
   * Cache: Redis `cache:policies:{tenantId}` (TTL 1h, write-through on PATCH).
   * On cache miss: reads DB via withTenantTx + tenant.focusIndicatorEnabled.
   */
  async getPolicies(): Promise<PoliciesResult> {
    const { tenantId } = getRequestContext();

    // 1. Cache hit
    try {
      const cached = await this.redis.get(cacheKey(tenantId));
      if (cached) {
        const parsed = JSON.parse(cached) as { policies: TenantPolicies; policyVersion: number };
        return { policies: parsed.policies, policyVersion: parsed.policyVersion, tierInfo: TIER_INFO };
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    // 2. DB cold read
    const { policies, policyVersion } = await withTenantTx(this.prisma, async (tx) => {
      const [row, tenant] = await Promise.all([
        tx.tenantPolicies.findFirst({ where: { tenantId } }),
        tx.tenant.findUnique({ where: { id: tenantId }, select: { focusIndicatorEnabled: true } }),
      ]);

      const jsonbPolicies = (row?.policies ?? {}) as Record<string, unknown>;
      const focusMonitoring = tenant?.focusIndicatorEnabled ?? false;

      const merged: TenantPolicies = {
        ...POLICY_DEFAULTS,
        ...jsonbPolicies,
        focusMonitoring,
      };

      return { policies: merged, policyVersion: row?.policyVersion ?? 1 };
    });

    // 3. Write-through cache (fail-silent)
    try {
      await this.redis.set(cacheKey(tenantId), JSON.stringify({ policies, policyVersion }), 'EX', 3600);
    } catch (err) {
      this.logger.warn(
        `PoliciesService.getPolicies: Redis write failed for ${tenantId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { policies, policyVersion, tierInfo: TIER_INFO };
  }

  /**
   * Updates policies for the active tenant.
   * - Tier gate: pro-only toggles throw ForbiddenException on free tenants (PATCH only)
   * - policyVersion increments unconditionally (dec-010/CHK033)
   * - Redis cache invalidated write-through (fail-silent, CHK034)
   * - Audit event: policy_change
   * - EventEmitter: focus-monitoring.enabled when toggled from false→true (CHK007)
   */
  async updatePolicies(dto: UpdatePoliciesDto): Promise<UpdatePoliciesResult> {
    const { tenantId, userId } = getRequestContext();

    // 1. Get current state for previousState capture and version
    const { policies: previousPolicies, policyVersion: currentVersion } = await this.getPolicies();

    // 2. Tier gate for Pro-only toggles (Free → 403)
    if (dto.focusMonitoring !== undefined || dto.mandatoryCamera !== undefined) {
      const plan = await this.planLimits.getPlan(tenantId);
      if (plan === 'free') {
        if (dto.focusMonitoring !== undefined || dto.mandatoryCamera !== undefined) {
          throw new ForbiddenException({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Este recurso requer o plano Pro. Faça upgrade para habilitar esta funcionalidade.',
            details: { upgradePrompt: true, requiresPlan: 'pro' },
          });
        }
      }
    }

    // 3. Separate focusMonitoring from JSONB toggles
    const { focusMonitoring, ...jsonbToggles } = dto;

    const newVersion = currentVersion + 1;

    // 4. Persist in a single withTenantTx
    const merged = await withTenantTx(this.prisma, async (tx) => {
      // 4a. Update focusIndicatorEnabled if in dto
      if (focusMonitoring !== undefined) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { focusIndicatorEnabled: focusMonitoring },
        });
      }

      // 4b. UPSERT tenant_policies for JSONB toggles + policyVersion (always)
      const existingRow = await tx.tenantPolicies.findFirst({ where: { tenantId } });
      const currentJsonb = (existingRow?.policies ?? {}) as Record<string, unknown>;
      const newJsonb: Record<string, unknown> = { ...currentJsonb };

      for (const [key, value] of Object.entries(jsonbToggles)) {
        if (value !== undefined) {
          newJsonb[key] = value;
        }
      }

      if (existingRow) {
        await tx.tenantPolicies.update({
          where: { id: existingRow.id },
          data: { policies: newJsonb as Prisma.InputJsonValue, policyVersion: newVersion },
        });
      } else {
        await tx.tenantPolicies.create({
          data: {
            id: uuidv7(),
            tenantId,
            policies: newJsonb as Prisma.InputJsonValue,
            policyVersion: newVersion,
          },
        });
      }

      // Recompute merged policies for response
      const updatedFocusMonitoring =
        focusMonitoring !== undefined ? focusMonitoring : previousPolicies.focusMonitoring;

      const mergedPolicies: TenantPolicies = {
        ...POLICY_DEFAULTS,
        ...newJsonb,
        focusMonitoring: updatedFocusMonitoring,
      };

      return mergedPolicies;
    });

    // 5. Write-through Redis (fail-silent, CHK034)
    try {
      await this.redis.set(
        cacheKey(tenantId),
        JSON.stringify({ policies: merged, policyVersion: newVersion }),
        'EX',
        3600,
      );
    } catch (err) {
      this.logger.warn(
        `PoliciesService.updatePolicies: Redis write failed for ${tenantId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 6. Audit event (fire-and-forget — AuditService swallows errors)
    void this.auditService.createEvent({
      userId: userId ?? null,
      action: 'policy_change',
      resource: 'tenant_policies',
      resourceId: tenantId,
      ipAddress: '0.0.0.0',
      userAgent: 'tenant-policies-service',
      newState: { previousState: previousPolicies, newState: merged },
    });

    // 7. Emit focus-monitoring.enabled when toggled OFF→ON (CHK007)
    if (focusMonitoring === true && previousPolicies.focusMonitoring === false) {
      // Consent exemption: if user has withdrawn focus_monitoring consent,
      // skip emitting the event for this user (CHK044)
      let exempt = false;
      if (userId) {
        try {
          exempt = await this.consentRepository.hasWithdrawn(userId, 'focus_monitoring');
        } catch {
          // treat as not exempt on error
        }
      }
      if (!exempt) {
        this.eventEmitter.emit('focus-monitoring.enabled', {
          tenantId,
          focusMonitoring: true,
          changedBy: userId ?? null,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { policies: merged, policyVersion: newVersion, tierInfo: TIER_INFO };
  }
}
