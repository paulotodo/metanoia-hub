/**
 * Server-side fixtures for the discriminated `/api/v1/invites/{token}/resolve`
 * endpoint shipped in Cenário 06 Session 0. The Page is a Server Component, so
 * it can't rely on the browser-only MSW handlers — these fixtures are the
 * canonical mirror, kept in sync with `apps/web/mocks/handlers/invites.ts`
 * until Session 3 wires the real backend.
 *
 * The shape and tokens match the MSW handler fixtures exactly so reviewers
 * can use the same `/convite/<token>` URLs in dev and in tests.
 */
import type { InviteResolveResponse } from "@metanoia/types";

const MOCK_TENANT_ID = "019756b0-1000-7000-8000-000000000001";
const MOCK_GROUP_ID = "019756c0-2000-7000-8000-000000000001";

const fixtures: Record<string, InviteResolveResponse> = {
  "admin-tenant-valid": {
    status: "valid",
    invite: {
      kind: "admin-tenant",
      leader: {
        name: "Pastor Demo",
        email: "pastor.demo@igreja.example",
      },
      tenant: {
        id: MOCK_TENANT_ID,
        name: "Igreja Demo",
      },
    },
  },
  "participant-valid": {
    status: "valid",
    invite: {
      kind: "participant",
      leader: {
        firstName: "Marcos",
        avatarUrl: null,
      },
      tenant: {
        id: MOCK_TENANT_ID,
        name: "Igreja Demo",
      },
      group: {
        id: MOCK_GROUP_ID,
        name: "Fundamentos da Fé",
      },
    },
  },
  "participant-expired": {
    status: "expired",
    invite: null,
  },
  "participant-used": {
    status: "used",
    invite: null,
  },
};

/**
 * Resolves a token to an `InviteResolveResponse`. Unknown tokens map to
 * `{ status: "invalid", invite: null }` — the safer default.
 */
export function resolveInviteFixture(token: string): InviteResolveResponse {
  return fixtures[token] ?? { status: "invalid", invite: null };
}
