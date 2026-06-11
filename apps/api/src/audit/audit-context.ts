/**
 * AuditContext — AsyncLocalStorage for optional previousState capture.
 *
 * dec-016 (SEC-011): previousState cannot be fetched by the interceptor
 * without an extra DB read before the handler. Instead, services that
 * need to record the before-state explicitly set it here before the
 * mutation. The AuditInterceptor reads it after the handler completes.
 *
 * Usage in a service:
 *   auditContext.run({ previousState: { ...currentEntity } }, () => {
 *     // perform mutation
 *   });
 *
 * Or simpler — just set it on the current store if already inside a
 * request context:
 *   setAuditPreviousState({ id: entity.id, name: entity.name });
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditContextData {
  /** State before the mutation — null when not set by service */
  previousState: Record<string, unknown> | null;
}

export const auditContext = new AsyncLocalStorage<AuditContextData>();

/**
 * Sets previousState on the current AuditContext store.
 * No-op if called outside of an active AuditContext (safe to call always).
 */
export function setAuditPreviousState(state: Record<string, unknown> | null): void {
  const store = auditContext.getStore();
  if (store) {
    store.previousState = state;
  }
}

export function getAuditPreviousState(): Record<string, unknown> | null {
  return auditContext.getStore()?.previousState ?? null;
}
