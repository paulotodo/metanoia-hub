import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  tenantId: string;
  userId?: string;
  requestId: string;
  correlationId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const store = requestContext.getStore();
  if (!store) {
    throw new Error('RequestContext not initialized — is RequestContextMiddleware registered?');
  }
  return store;
}
