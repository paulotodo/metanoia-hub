import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  tenantId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

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
        await prisma.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${ctx.tenantId}'`,
        );
        return query(args);
      },
    },
  });
}
