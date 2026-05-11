import type { PrismaClient } from '@prisma/client';
import { requestContext } from '../common/context/request-context';
import type { PrismaService } from './prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Transaction handle yielded by `prisma.$transaction(async (tx) => ...)`. */
export type TenantTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export interface WithTenantTxOptions {
  /**
   * Explicit tenant id. Takes precedence over the value in RequestContext.
   * Required by pre-tenant-context callers such as
   * `tenant-selection.selectTenant` (where the user is choosing the tenant
   * and the JWT claim may not match).
   */
  tenantId?: string;
}

/**
 * Runs `fn` inside a Prisma `$transaction` that first issues
 * `SET LOCAL app.current_tenant_id = '<uuid>'` so RLS policies on tenant-scoped
 * tables can resolve `current_setting('app.current_tenant_id')` to a real
 * tenant and let the query through.
 *
 * Uses `prisma.client.$transaction` directly so SET LOCAL and the query
 * are guaranteed to run on the same Postgres connection. The previous
 * `withMultiTenant` extension (deleted in Story 7-7) dispatched SET LOCAL
 * on the outer client, which the connection pool could route to a different
 * connection than the subsequent query — SET LOCAL persists only for the
 * transaction it ran in.
 *
 * Tenant resolution:
 *   1. `opts.tenantId` if provided.
 *   2. `RequestContext.tenantId` from AsyncLocalStorage.
 *
 * Throws if neither is available, or if the value is not a UUID shape
 * (defense-in-depth — SET LOCAL cannot accept bind parameters so we
 * interpolate).
 */
export async function withTenantTx<T>(
  prisma: PrismaService,
  fn: (tx: TenantTx) => Promise<T>,
  opts: WithTenantTxOptions = {},
): Promise<T> {
  const ctx = requestContext.getStore();
  const tenantId = opts.tenantId ?? ctx?.tenantId;
  if (!tenantId) {
    throw new Error(
      'withTenantTx requires a tenantId — pass opts.tenantId or run inside a request with RequestContext populated',
    );
  }
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`Refusing SET LOCAL with non-UUID tenant_id "${tenantId}"`);
  }
  return prisma.client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    return fn(tx);
  });
}
