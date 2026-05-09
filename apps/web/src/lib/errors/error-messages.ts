import messages from '../../../messages/pt-BR.json';
import { ApiError } from '../api/client';

const errorMessages = messages.error;

const ERROR_NAME_TO_KEY: Record<string, string> = {
  Forbidden: 'permission.denied',
  Unauthorized: 'auth.sessionExpired',
  NotFound: 'notFound.generic',
  ConsentRequired: 'conflict.consentRequired',
  PlanLimitReached: 'plan.limitReachedGeneric',
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
      const template = lookup(mappedKey);
      if (template) {
        return {
          message: interpolate(template, params),
          errorKey: mappedKey,
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
