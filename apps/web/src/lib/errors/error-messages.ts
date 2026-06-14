import messages from '../../../messages/pt-BR.json';
import { ApiError } from '../api/client';

const errorMessages = messages.error;

/**
 * Canonical resource identifiers sent by the backend PlanLimitsGuard.
 * Mirrors PlanLimitedResource from apps/api — not imported to avoid
 * cross-app coupling.
 */
type PlanLimitedResource = 'groups' | 'membersPerGroup' | 'leadersPerTenant';

/**
 * Maps each canonical resource to its PT-BR pastoral error key.
 * When `details.resource` is a known PlanLimitedResource, resolveError
 * uses this key instead of the generic fallback (FASE-1.1 — Opção A).
 */
const RESOURCE_TO_KEY: Record<PlanLimitedResource, string> = {
  groups: 'plan.limit.groups',
  membersPerGroup: 'plan.limit.membersPerGroup',
  leadersPerTenant: 'plan.limit.leadersPerTenant',
};

const ERROR_NAME_TO_KEY: Record<string, string> = {
  Forbidden: 'permission.denied',
  Unauthorized: 'auth.sessionExpired',
  NotFound: 'notFound.generic',
  ConsentRequired: 'conflict.consentRequired',
  // Points to the generic fallback (no resource interpolation here).
  // resolveError checks details.resource first and routes to RESOURCE_TO_KEY
  // when available; this entry handles absent/unknown resources (FASE-1.1 Opção A).
  PlanLimitReached: 'plan.limitGeneric',
  Conflict: 'conflict.duplicate',
  TooManyRequests: 'rateLimit.tooManyRequests',
  BadRequest: 'validation.generic',
  UnprocessableEntity: 'validation.generic',
};

function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value == null ? `{${key}}` : String(value);
  });
}

function lookup(key: string): string | undefined {
  const segments = key.split('.');
  let cursor: unknown = errorMessages;
  for (const seg of segments) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

export interface ResolvedError {
  message: string;
  errorKey: string;
  statusCode?: number;
}

/**
 * Resolve a thrown error to a localized, actionable PT-BR message.
 *
 * Resolution order:
 *   1. ApiError with details.errorKey → lookup error.<errorKey>
 *   2. ApiError with `error` name → mapped via ERROR_NAME_TO_KEY
 *   3. Network/TypeError → error.network.failed
 *   4. Anything else → error.unknown.generic
 *
 * Placeholders like {current} are interpolated from details.
 */
export function resolveError(error: unknown): ResolvedError {
  if (error instanceof ApiError) {
    const details = (error.details ?? {}) as Record<string, unknown>;
    const params = details as Record<string, unknown>;

    const explicitKey =
      typeof details['errorKey'] === 'string'
        ? (details['errorKey'] as string)
        : undefined;

    if (explicitKey) {
      const template = lookup(explicitKey);
      if (template) {
        return {
          message: interpolate(template, params),
          errorKey: explicitKey,
          statusCode: error.statusCode,
        };
      }
    }

    const mappedKey = ERROR_NAME_TO_KEY[error.error];
    if (mappedKey) {
      // For PlanLimitReached: attempt resource-specific key first (FR-002, FR-008).
      // details.resource must be a canonical PlanLimitedResource value; anything
      // else (absent, unknown string, non-string) falls through to mappedKey
      // which is 'plan.limitGeneric' — no {resource} placeholder exposure (FR-005).
      const rawResource = details['resource'];
      const resolvedKey =
        typeof rawResource === 'string' &&
        rawResource in RESOURCE_TO_KEY
          ? RESOURCE_TO_KEY[rawResource as PlanLimitedResource]
          : mappedKey;

      const template = lookup(resolvedKey);
      if (template) {
        const interpolated = interpolate(template, params);
        // Guard: if placeholders remain unresolved (defensive — should not
        // happen with the new resource-specific keys), fall back to the
        // generic message rather than showing "{current}/{limit}" to the user.
        if (interpolated.includes('{')) {
          const generic = lookup('plan.limitGeneric');
          if (generic) {
            return {
              message: generic,
              errorKey: 'plan.limitGeneric',
              statusCode: error.statusCode,
            };
          }
        }
        return {
          message: interpolated,
          errorKey: resolvedKey,
          statusCode: error.statusCode,
        };
      }
    }

    return {
      message: errorMessages.unknown.generic,
      errorKey: 'unknown.generic',
      statusCode: error.statusCode,
    };
  }

  if (
    error instanceof TypeError ||
    (error instanceof Error && /network|fetch/i.test(error.message))
  ) {
    return {
      message: errorMessages.network.failed,
      errorKey: 'network.failed',
    };
  }

  return {
    message: errorMessages.unknown.generic,
    errorKey: 'unknown.generic',
  };
}
