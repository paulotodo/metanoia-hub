import { PrismaClient } from '@prisma/client';
import { requestContext } from '../common/context/request-context';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prisma client extension that auto-injects tenant_id via RLS.
 *
 * @deprecated Use `withTenantTx` (apps/api/src/prisma/with-tenant-tx.ts).
 *
 * Why deprecated: SET LOCAL only persists for the connection it ran on. This
 * extension calls `prisma.$executeRawUnsafe(SET LOCAL ...)` on the OUTER
 * client, then invokes the user's query via the same outer client. Both
 * statements pass through the connection pool independently — the pool MAY
 * route them to different connections, in which case the query runs without
 * the tenant context and RLS either rejects it or (worse) returns zero rows
 * silently. Story 7-4 (E2E) tripped this 3 times; Story 7-5 introduced
 * `withTenantTx`, which uses an explicit `$transaction` so SET LOCAL and the
 * query are guaranteed to share a connection.
 *
 * Migration plan: Story 7-7 will migrate the remaining 7 repos that still
 * consume this extension (`admin-pastoral`, `meetings*`, `group-members`,
 * `participant-groups`, `tenants/tenants.service`) and DELETE this function.
 * Until then it stays — callers will see a deprecation warning in IDEs.
 *
 * Do NOT add new callers. Use `withTenantTx` for any new tenant-scoped query.
 */
export function withMultiTenant(prisma: PrismaClient) {
  return prisma.$extends({
    query: {
      async $allOperations({ args, query }) {
        const ctx = requestContext.getStore();
        if (!ctx?.tenantId) {
          // Allow queries without tenant context (e.g., health checks, migrations)
          return query(args);
        }

        if (!UUID_RE.test(ctx.tenantId)) {
          throw new Error(
            `Refusing SET LOCAL with non-UUID tenant_id "${ctx.tenantId}"`,
          );
        }

        // Set the tenant context for RLS and execute the query.
        // Note: SET LOCAL does NOT accept bind parameters in Postgres.
        await prisma.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${ctx.tenantId}'`,
        );
        return query(args);
      },
    },
  });
}
