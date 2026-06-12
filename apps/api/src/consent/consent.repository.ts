import { Injectable } from '@nestjs/common';
import type { ConsentDocumentType, ConsentType } from '@metanoia/types';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestByUser(
    userId: string,
    documentType: ConsentDocumentType,
  ) {
    return this.prisma.client.consent.findFirst({
      where: { userId, documentType },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  /** Return all consent acceptance records for this user (across all document types). */
  async findAllAcceptancesByUser(userId: string) {
    return this.prisma.client.consent.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  /**
   * Return all withdrawal records for this user, optionally scoped to tenant.
   * A null tenantId returns records that are globally associated (e.g. focus_monitoring
   * withdrawals that pre-date tenant selection).
   */
  async findWithdrawalsByUser(
    userId: string,
    tenantId: string | null,
  ) {
    return this.prisma.client.consentRecord.findMany({
      where: {
        userId,
        ...(tenantId !== null ? { tenantId } : {}),
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Append a withdrawal record inside a tenant-scoped transaction.
   * Uses withTenantTx so RLS INSERT policy is satisfied.
   */
  async createWithdrawal(input: {
    id: string;
    userId: string;
    tenantId: string | null;
    consentType: ConsentType;
    action: 'withdrawn';
  }) {
    // withTenantTx requires a UUID tenantId. For null (global) tenant, we
    // bypass the transaction wrapper and insert directly since there are no
    // RLS constraints for tenant_id IS NULL rows (NULLIF pattern allows it).
    if (input.tenantId === null) {
      return this.prisma.client.consentRecord.create({
        data: {
          id: input.id,
          userId: input.userId,
          tenantId: null,
          consentType: input.consentType,
          action: input.action,
        },
      });
    }
    return withTenantTx(this.prisma, async (tx) => {
      return tx.consentRecord.create({
        data: {
          id: input.id,
          userId: input.userId,
          tenantId: input.tenantId,
          consentType: input.consentType,
          action: input.action,
        },
      });
    });
  }

  /**
   * Check whether the user has an active withdrawal for a given consent type.
   * Uses direct Prisma client (no RLS) — intentional: this gate is called
   * server-side to enforce FR-11 and must always see the record regardless of
   * the current tenant context.
   */
  async hasWithdrawn(userId: string, consentType: ConsentType): Promise<boolean> {
    const record = await this.prisma.client.consentRecord.findFirst({
      where: { userId, consentType, action: 'withdrawn' },
    });
    return record !== null;
  }

  async create(input: {
    id: string;
    userId: string;
    tenantId: string | null;
    documentType: ConsentDocumentType;
    version: string;
    ipAddress: string;
    userAgent: string;
  }) {
    return this.prisma.client.consent.create({
      data: {
        id: input.id,
        userId: input.userId,
        tenantId: input.tenantId,
        documentType: input.documentType,
        version: input.version,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
