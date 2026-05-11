import { headers } from "next/headers";
import {
  InviteResolveResponseSchema,
  type InviteResolveResponse,
} from "@metanoia/types";
import { OnboardingPageLayout } from "@/components/onboarding";
import { BrandMark } from "./_components/brand-mark";
import { WelcomeView } from "./_components/welcome-view";
import { ParticipantWelcomeView } from "./_components/participant-welcome-view";
import { InviteErrorView } from "./_components/invite-error-view";
import type { TokenErrorVariant } from "@/components/onboarding";

/**
 * /convite/{token} — shared landing for two flows:
 *   - kind === "admin-tenant" → 05.1 onboarding (Cenário 05).
 *   - kind === "participant"  → 06.2 (Cenário 06).
 *   - kind === "leader"       → out of scope for now; falls back to invalid.
 *
 * Server-side fetch against `GET /api/v1/invites/:token/resolve` (real
 * backend since Story 7-5). `cache: 'no-store'` because the token is one-shot
 * — caching would mask state transitions (used / expired). A non-200 response
 * or network failure surfaces as the generic `invalid` error view; details
 * land in stderr.
 */
export default async function AceiteConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveInvite(token);

  return (
    <OnboardingPageLayout header={<BrandMark />}>
      {renderInvite(resolved, token)}
    </OnboardingPageLayout>
  );
}

async function resolveInvite(token: string): Promise<InviteResolveResponse> {
  const apiUrl = await resolveApiUrl();
  const url = `${apiUrl}/api/v1/invites/${encodeURIComponent(token)}/resolve`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (res.status === 404) {
      return { status: "invalid", invite: null };
    }
    if (!res.ok) {
      console.error("[convite] /resolve non-ok response", {
        token,
        status: res.status,
      });
      return { status: "invalid", invite: null };
    }
    const body = (await res.json()) as { data?: unknown };
    const parsed = InviteResolveResponseSchema.safeParse(body?.data);
    if (!parsed.success) {
      console.error("[convite] /resolve schema mismatch", {
        token,
        issues: parsed.error.issues,
      });
      return { status: "invalid", invite: null };
    }
    return parsed.data;
  } catch (err) {
    console.error("[convite] /resolve fetch failed", { token, err });
    return { status: "invalid", invite: null };
  }
}

/**
 * Resolves the API base URL for server-to-server fetch. Prefers `API_URL`
 * (set in the non-browser server runtime) and falls back to deriving from
 * the incoming request host so the same origin works in dev without extra
 * configuration.
 */
async function resolveApiUrl(): Promise<string> {
  const explicit = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3001";
}

function renderInvite(
  resolved: InviteResolveResponse,
  token: string,
) {
  if (resolved.status !== "valid" || !resolved.invite) {
    return <InviteErrorView variant={resolved.status as TokenErrorVariant} />;
  }
  switch (resolved.invite.kind) {
    case "admin-tenant":
      return <WelcomeView token={token} />;
    case "participant":
      return (
        <ParticipantWelcomeView invite={resolved.invite} token={token} />
      );
    case "leader":
      return <InviteErrorView variant="invalid" />;
  }
}
