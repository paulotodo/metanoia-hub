import type { APIRequestContext } from '@playwright/test';
import { E2E_BASE_URL } from '../setup/env';

/**
 * Best-effort cleanup: removes the artefacts a single run created (group
 * + invite) so the demo tenant doesn't accumulate noise between runs.
 *
 * Failures here are logged but never thrown — the suite's `afterAll` should
 * not mask the actual test outcome. The CI run resets the database via
 * `db:setup:ci` + `db:seed:demo` anyway, so leftover rows are bounded.
 *
 * Auth: backend reads `Authorization: Bearer <token>` from headers; the
 * caller must obtain the access token from sessionStorage (see spec) and
 * pass it via `bearerToken`. Without it the API returns 401 and cleanup
 * silently no-ops (which is the existing best-effort contract).
 */
export interface CleanupArtifacts {
  groupId?: string;
  inviteId?: string;
}

export interface CleanupOptions {
  bearerToken?: string;
}

const DELETE_OPTS = { timeout: 5_000, failOnStatusCode: false } as const;

function authHeaders(options?: CleanupOptions): Record<string, string> {
  return options?.bearerToken
    ? { Authorization: `Bearer ${options.bearerToken}` }
    : {};
}

export async function cleanupArtifacts(
  request: APIRequestContext,
  artifacts: CleanupArtifacts,
  options?: CleanupOptions,
): Promise<void> {
  const headers = authHeaders(options);

  if (artifacts.inviteId) {
    try {
      const res = await request.delete(
        `${E2E_BASE_URL}/api/v1/admin/invites/${artifacts.inviteId}`,
        { ...DELETE_OPTS, headers },
      );
      if (!res.ok()) {
        console.warn(
          `[cleanup] revoke invite ${artifacts.inviteId} returned ${res.status()}`,
        );
      }
    } catch (error) {
      console.warn('[cleanup] failed to revoke invite', artifacts.inviteId, error);
    }
  }
  if (artifacts.groupId) {
    try {
      const res = await request.delete(
        `${E2E_BASE_URL}/api/v1/groups/${artifacts.groupId}`,
        { ...DELETE_OPTS, headers },
      );
      if (!res.ok()) {
        console.warn(
          `[cleanup] delete group ${artifacts.groupId} returned ${res.status()}`,
        );
      }
    } catch (error) {
      console.warn('[cleanup] failed to delete group', artifacts.groupId, error);
    }
  }
}
