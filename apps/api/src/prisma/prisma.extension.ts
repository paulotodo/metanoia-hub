import { PrismaClient } from '@prisma/client';
import { requestContext } from '../common/context/request-context';

/**
 * Prisma client extension that auto-injects tenant_id via RLS.
 * Sets PostgreSQL session variable `app.current_tenant_id` before each query.
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

        // Set the tenant context for RLS and execute the query
        await prisma.$executeRaw`SET LOCAL app.current_tenant_id = ${ctx.tenantId}`;
        return query(args);
      },
    },
  });
}
