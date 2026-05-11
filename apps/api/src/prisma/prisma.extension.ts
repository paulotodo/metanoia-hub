import { PrismaClient } from '@prisma/client';
import { requestContext } from '../common/context/request-context';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prisma client extension that auto-injects tenant_id via RLS.
 * Sets PostgreSQL session variable `app.current_tenant_id` before each query.
 *
 * Postgres `SET LOCAL` cannot accept bind parameters, so we MUST interpolate
 * via `$executeRawUnsafe`. UUID validation guards against injection — the
 * tenant id always comes from the JWT after Keycloak signature verification,
 * but we re-check the format here as defense in depth.
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
