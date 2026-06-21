import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateId, type NotificationDispatch, type NotificationStatus } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { getRequestContext } from '../common/context/request-context';
import { DigestService } from './digest.service';

export interface NotificationsQuery {
  status?: 'pending' | 'sent' | 'failed' | 'read';
  page?: number;
  perPage?: number;
  unread?: boolean;
  since?: string; // ISO 8601 — gap-fill filter (FR-015/FR-017)
}

export interface NotificationRow {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  channel: string;
  status: string;
  title: string;
  body: string;
  metadata: unknown;
  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * NotificationsService — core business logic for the notifications bounded context.
 *
 * Tenancy rules:
 *  - tenantId is ALWAYS sourced from RequestContext (AsyncLocalStorage) — never a parameter.
 *  - userId from DTO (dispatch) or from RequestContext (read/mark-read for BOLA safety).
 *  - All Prisma writes go through withTenantTx which issues SET LOCAL app.current_tenant_id.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly digestService: DigestService,
  ) {}

  /**
   * dispatch — persist + enqueue a notification for each requested channel.
   * tenantId sourced from RequestContext (FR-001).
   */
  async dispatch(dto: NotificationDispatch): Promise<void> {
    const ctx = getRequestContext();
    const { tenantId, correlationId } = ctx;
    const corrId = correlationId ?? generateId();

    for (const channel of dto.channels) {
      const notificationId = generateId();

      // Persist with status = pending inside a tenant-scoped transaction
      await withTenantTx(this.prisma, async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO notifications
             (id, tenant_id, user_id, type, channel, status, title, body, metadata, updated_at)
           VALUES
             ($1::uuid, $2::uuid, $3::uuid,
              $4::"notification_type", $5::"notification_channel",
              'pending'::"notification_status",
              $6, $7, $8::jsonb, now())`,
          notificationId,
          tenantId,
          dto.userId,
          dto.type,
          channel,
          dto.title,
          dto.body,
          JSON.stringify(dto.metadata ?? {}),
        );
      });

      // Enqueue via DigestService (decides: immediate vs delayed)
      await this.digestService.enqueue(
        notificationId,
        dto.userId,
        tenantId,
        dto.type,
        channel,
        corrId,
      );

      this.logger.log(
        { notificationId, tenantId, userId: dto.userId, type: dto.type, channel, correlationId: corrId },
        'notification dispatched',
      );
    }
  }

  /**
   * updateStatus — used by the worker after delivery and by PATCH /read.
   */
  async updateStatus(
    notificationId: string,
    status: NotificationStatus,
    readAt?: Date,
  ): Promise<void> {
    await withTenantTx(this.prisma, async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE notifications
         SET status = $1::"notification_status", read_at = $2, updated_at = now()
         WHERE id = $3::uuid`,
        status,
        readAt ?? null,
        notificationId,
      );
    });
  }

  /**
   * updateStatusForUser — PATCH /read endpoint: checks ownership (BOLA mitigation).
   * Returns 404 if notification not found or belongs to another user (anti-IDOR).
   */
  async updateStatusForUser(
    notificationId: string,
    userId: string,
    status: NotificationStatus,
    readAt?: Date,
  ): Promise<void> {
    const result = await withTenantTx(this.prisma, async (tx) => {
      const rows = await tx.$queryRawUnsafe<[{ count: string }]>(
        `UPDATE notifications
         SET status = $1::"notification_status", read_at = $2, updated_at = now()
         WHERE id = $3::uuid AND user_id = $4::uuid
         RETURNING id`,
        status,
        readAt ?? null,
        notificationId,
        userId,
      );
      return (rows as unknown[]).length;
    });

    if (result === 0) {
      // Return 404 regardless of whether it is not found or belongs to another user (anti-IDOR)
      throw new NotFoundException('Notificação não encontrada');
    }
  }

  /**
   * findByUser — paginated list of notifications for a given user.
   * userId must come from the request context (BOLA-safe); only pass as param
   * from the controller which extracts it from RequestContext.
   */
  async findByUser(
    userId: string,
    query: NotificationsQuery,
  ): Promise<{ data: NotificationRow[]; meta: { page: number; perPage: number; total: number } }> {
    const page = query.page ?? 1;
    const perPage = Math.min(query.perPage ?? 20, 100);
    const offset = (page - 1) * perPage;
    // unread=true takes priority; falls back to equality filter on status
    const statusFilter = query.unread
      ? `AND status <> 'read'::"notification_status"`
      : query.status
        ? `AND status = '${query.status}'::"notification_status"`
        : '';
    // since: bind posicional $4 — NUNCA interpolação de string (CHK048/049/050 / OWASP L1)
    const sinceFilter = query.since ? 'AND created_at > $4::timestamptz' : '';

    // Base params for SELECT (userId, perPage, offset) + optional since
    const selectParams: unknown[] = [userId, perPage, offset];
    if (query.since) selectParams.push(query.since);

    // Base params for COUNT (userId) + optional since
    // For COUNT: since uses $2::timestamptz when present
    const countSinceFilter = query.since ? 'AND created_at > $2::timestamptz' : '';
    const countParams: unknown[] = [userId];
    if (query.since) countParams.push(query.since);

    const [rows, countResult] = await Promise.all([
      withTenantTx(this.prisma, (tx) =>
        tx.$queryRawUnsafe<NotificationRow[]>(
          `SELECT id, tenant_id, user_id, type, channel, status, title, body, metadata,
                  read_at, created_at, updated_at
           FROM notifications
           WHERE user_id = $1::uuid ${statusFilter} ${sinceFilter}
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          ...selectParams,
        ),
      ),
      withTenantTx(this.prisma, (tx) =>
        tx.$queryRawUnsafe<Array<{ count: string }>>(
          `SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1::uuid ${statusFilter} ${countSinceFilter}`,
          ...countParams,
        ),
      ),
    ]);

    const total = parseInt((countResult as Array<{ count: string }>)[0].count, 10);

    return {
      data: rows,
      meta: { page, perPage, total },
    };
  }


  /**
   * markAllAsRead — marks all unread notifications for a user as read.
   * BOLA-safe: userId sourced from RequestContext, NOT from client input.
   * tenantId enforced via RLS through withTenantTx.
   * Idempotent: rows already 'read' are not touched; count reflects only changed rows.
   */
  async markAllAsRead(userId: string, readAt: Date): Promise<number> {
    const rows = await withTenantTx(this.prisma, async (tx) => {
      return tx.$queryRawUnsafe<Array<{ id: string }>>(
        `UPDATE notifications
         SET status = 'read'::"notification_status", read_at = $1, updated_at = now()
         WHERE user_id = $2::uuid AND status <> 'read'::"notification_status"
         RETURNING id`,
        readAt,
        userId,
      );
    });
    return (rows as Array<{ id: string }>).length;
  }

}