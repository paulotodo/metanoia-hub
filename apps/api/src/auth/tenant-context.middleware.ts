import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requestContext } from '../prisma/prisma.extension';
import type { RequestContext } from '../prisma/prisma.extension';

/**
 * Wraps each HTTP request in its own AsyncLocalStorage.run() scope,
 * ensuring tenant context isolation between concurrent requests.
 * The guard later populates the store with actual tenant/user data.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    const store: RequestContext = { tenantId: '' };
    requestContext.run(store, next);
  }
}
