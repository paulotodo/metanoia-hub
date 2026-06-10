import { Injectable } from '@nestjs/common';
import type { RadarStatus, RadarTrend } from '@prisma/client';
import { generateId } from '@metanoia/types';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';

export interface CreateAlertData {
  tenantId: string;
  groupId: string;
  participantId: string;
  previousStatus: RadarStatus;
  newStatus: RadarStatus;
  trend: RadarTrend;
}

export interface PastoralAlertRow {
  id: string;
  tenantId: string;
  groupId: string;
  participantId: string;
  previousStatus: RadarStatus | null;
  newStatus: RadarStatus | null;
  trend: RadarTrend | null;
  readAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a negative-transition alert if no active duplicate exists.
   * Dedup: 1 active alert per (tenantId, groupId, participantId, previousStatus, newStatus).
   * Returns the created alert id, or null if dedup suppressed creation.
   */
  async createIfNotDuplicate(data: CreateAlertData): Promise<string | null> {
    const id = generateId();

    // Check for existing active alert with same transition (dismissedAt IS NULL)
    const existing = await withTenantTx(this.prisma, (tx) =>
      tx.pastoralAlert.findFirst({
        where: {
          tenantId: data.tenantId,
          groupId: data.groupId,
          participantId: data.participantId,
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
          dismissedAt: null,
        },
        select: { id: true },
      }),
    );

    if (existing) {
      return null; // dedup: alert already active for this transition
    }

    await withTenantTx(this.prisma, (tx) =>
      tx.pastoralAlert.create({
        data: {
          id,
          tenantId: data.tenantId,
          groupId: data.groupId,
          participantId: data.participantId,
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
          trend: data.trend,
          signalType: 'care-urgent',
          presenceDots: [],
        },
      }),
    );

    return id;
  }

  /**
   * Returns active (not dismissed) alerts for a group, most recent first.
   */
  async findActiveByGroup(groupId: string): Promise<PastoralAlertRow[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralAlert.findMany({
        where: {
          groupId,
          dismissedAt: null,
          previousStatus: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          tenantId: true,
          groupId: true,
          participantId: true,
          previousStatus: true,
          newStatus: true,
          trend: true,
          readAt: true,
          dismissedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }

  /**
   * Sets readAt timestamp on an alert.
   */
  async markRead(id: string): Promise<void> {
    await withTenantTx(this.prisma, (tx) =>
      tx.pastoralAlert.update({
        where: { id },
        data: { readAt: new Date() },
      }),
    );
  }

  /**
   * Sets dismissedAt timestamp on an alert.
   */
  async dismiss(id: string): Promise<void> {
    await withTenantTx(this.prisma, (tx) =>
      tx.pastoralAlert.update({
        where: { id },
        data: { dismissedAt: new Date() },
      }),
    );
  }
}
