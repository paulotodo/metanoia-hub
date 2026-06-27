import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { getRequestContext } from '../../common/context/request-context';
import { generateId } from '@metanoia/types';
import type {
  NotificationPreferences,
  UpdateNotificationPreferences,
  NotificationPreferenceChannels,
} from '@metanoia/types';
import { Role } from '../../auth/enums/role.enum';
import type { NotificationType, NotificationChannel } from '@metanoia/types';

const CACHE_TTL = 600; // 10 minutes

function cacheKey(tenantId: string, userId: string): string {
  return `cache:notif-prefs:${tenantId}:${userId}`;
}

function buildDefaults(): NotificationPreferences {
  const channels: NotificationPreferenceChannels = { inApp: true, email: true };
  return {
    pastoral_alert: { ...channels },
    group_message: { ...channels },
    content_update: { ...channels },
    meeting_reminder: { ...channels },
    system: { ...channels },
    export_ready: { ...channels },
    content_new: { ...channels },
  };
}

type PrefRow = {
  notification_type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
};

function rowsToPrefs(rows: PrefRow[]): NotificationPreferences {
  const prefs = buildDefaults();
  for (const row of rows) {
    const type = row.notification_type as keyof NotificationPreferences;
    if (!prefs[type]) continue;
    if (row.channel === 'in_app') {
      prefs[type].inApp = row.enabled;
    } else if (row.channel === 'email') {
      prefs[type].email = row.enabled;
    }
  }
  return prefs;
}

function applyLeaderEnforcement(
  prefs: NotificationPreferences,
): NotificationPreferences {
  return {
    ...prefs,
    pastoral_alert: { ...prefs.pastoral_alert, inApp: true },
  };
}

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get all preferences for the current authenticated user.
   * Resolves defaults (all true) for missing rows.
   * For leaders, forces pastoral_alert.inApp = true post-cache (no cache poisoning).
   */
  async getForCurrentUser(roles: (string | Role)[]): Promise<NotificationPreferences> {
    const ctx = getRequestContext();
    const userId = ctx.userId ?? '';

    // Cache hit
    try {
      const cached = await this.redis.get(cacheKey(ctx.tenantId, userId));
      if (cached) {
        const prefs = JSON.parse(cached) as NotificationPreferences;
        return roles.includes(Role.LIDER) ? applyLeaderEnforcement(prefs) : prefs;
      }
    } catch (err) {
      this.logger.warn({ err, userId }, 'redis.get failed for notif-prefs — falling back to DB');
    }

    // DB fallback
    const prefs = await this.loadFromDb(userId);

    // Cache (do NOT cache post-enforcement — enforcement applied per-request)
    try {
      await this.redis.set(cacheKey(ctx.tenantId, userId), JSON.stringify(prefs), 'EX', CACHE_TTL);
    } catch (err) {
      this.logger.warn({ err, userId }, 'redis.set failed for notif-prefs — cache skipped');
    }

    return roles.includes(Role.LIDER) ? applyLeaderEnforcement(prefs) : prefs;
  }

  /**
   * Apply a partial PATCH for the current user.
   * Enforces leader rule: cannot disable pastoral_alert.inApp.
   * UPSERTs each updated (type, channel) pair.
   * Returns full preferences after update.
   */
  async patchForCurrentUser(
    roles: (string | Role)[],
    patch: UpdateNotificationPreferences,
  ): Promise<NotificationPreferences> {
    const ctx = getRequestContext();
    const userId = ctx.userId ?? '';
    const tenantId = ctx.tenantId;

    // Leader guard: cannot disable pastoral_alert.inApp
    if (
      roles.includes(Role.LIDER) &&
      patch.pastoral_alert?.inApp === false
    ) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Líderes não podem desativar alertas pastorais no app',
      });
    }

    // Build UPSERT rows from patch
    const upserts: Array<{
      id: string;
      tenantId: string;
      userId: string;
      notificationType: NotificationType;
      channel: NotificationChannel;
      enabled: boolean;
    }> = [];

    for (const [typeKey, channels] of Object.entries(patch)) {
      if (!channels) continue;
      const type = typeKey as NotificationType;
      if (channels.inApp !== undefined) {
        upserts.push({
          id: generateId(),
          tenantId,
          userId,
          notificationType: type,
          channel: 'in_app',
          enabled: channels.inApp,
        });
      }
      if (channels.email !== undefined) {
        upserts.push({
          id: generateId(),
          tenantId,
          userId,
          notificationType: type,
          channel: 'email',
          enabled: channels.email,
        });
      }
    }

    if (upserts.length > 0) {
      await withTenantTx(this.prisma, async (tx) => {
        for (const row of upserts) {
          await tx.$executeRaw`
            INSERT INTO notification_preferences
              (id, tenant_id, user_id, notification_type, channel, enabled, updated_at)
            VALUES (
              ${row.id}::uuid,
              ${row.tenantId}::uuid,
              ${row.userId}::uuid,
              ${row.notificationType}::"notification_type",
              ${row.channel}::"notification_channel",
              ${row.enabled},
              now()
            )
            ON CONFLICT (user_id, tenant_id, notification_type, channel)
            DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
          `;
        }
      });
    }

    // Invalidate cache
    try {
      await this.redis.del(cacheKey(tenantId, userId));
    } catch (err) {
      this.logger.warn({ err, userId }, 'redis.del failed for notif-prefs cache invalidation');
    }

    return this.getForCurrentUser(roles);
  }

  /**
   * Resolve whether a specific (userId, type, channel) is enabled.
   * Used by the notifications worker before routing delivery.
   * Defaults to true if no preference row exists.
   */
  async resolveEnabled(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const { tenantId } = getRequestContext();
    const cacheKeyStr = cacheKey(tenantId, userId);

    // Try cache first
    try {
      const cached = await this.redis.get(cacheKeyStr);
      if (cached) {
        const prefs = JSON.parse(cached) as NotificationPreferences;
        const typePrefs = prefs[type];
        if (typePrefs) {
          const isLeader = await this.isLeaderInTenant(userId);
          if (isLeader && type === 'pastoral_alert' && channel === 'in_app') {
            return true;
          }
          return channel === 'in_app' ? typePrefs.inApp : typePrefs.email;
        }
        return true; // default
      }
    } catch (err) {
      this.logger.warn({ err, userId }, 'redis.get failed in resolveEnabled — falling back to DB');
    }

    // DB fallback: direct query (no full-prefs load needed)
    const rows = await withTenantTx(this.prisma, async (tx) => {
      return tx.$queryRaw<PrefRow[]>`
        SELECT notification_type, channel, enabled
        FROM notification_preferences
        WHERE user_id = ${userId}::uuid
          AND notification_type = ${type}::"notification_type"
          AND channel = ${channel}::"notification_channel"
        LIMIT 1
      `;
    });

    if (rows.length === 0) {
      // No row = default true
      return true;
    }

    const enabled = rows[0].enabled;

    // Enforcement: leader always gets pastoral_alert.in_app=true
    if (type === 'pastoral_alert' && channel === 'in_app') {
      const isLeader = await this.isLeaderInTenant(userId);
      if (isLeader) return true;
    }

    return enabled;
  }

  /**
   * Mark a notification as suppressed by user preference.
   * Sets status='failed' and appends metadata.reason='user_preference'.
   * Called by the worker — DOES NOT THROW (early return, no retry triggered).
   */
  async markSuppressedByPreference(notificationId: string): Promise<void> {
    await withTenantTx(this.prisma, async (tx) => {
      await tx.$executeRaw`
        UPDATE notifications
        SET
          status = 'failed'::"notification_status",
          metadata = metadata || '{"reason":"user_preference"}'::jsonb,
          updated_at = now()
        WHERE id = ${notificationId}::uuid
      `;
    });
  }

  /**
   * Check if the current userId holds the 'lider' role in the current tenant.
   */
  async isLeaderInTenant(userId: string): Promise<boolean> {
    const rows = await withTenantTx(this.prisma, async (tx) => {
      return tx.$queryRaw<Array<{ role: string }>>`
        SELECT role FROM user_tenants
        WHERE user_id = ${userId}::uuid
        LIMIT 1
      `;
    });
    return rows.length > 0 && rows[0].role === Role.LIDER;
  }

  private async loadFromDb(userId: string): Promise<NotificationPreferences> {
    const rows = await withTenantTx(this.prisma, async (tx) => {
      return tx.$queryRaw<PrefRow[]>`
        SELECT notification_type, channel, enabled
        FROM notification_preferences
        WHERE user_id = ${userId}::uuid
      `;
    });
    return rowsToPrefs(rows);
  }
}
