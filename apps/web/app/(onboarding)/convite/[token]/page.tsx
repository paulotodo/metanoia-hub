import { OnboardingPageLayout } from "@/components/onboarding";
import { resolveInviteFixture } from "../../../../__mocks__/onboarding/resolve-invite";
import { BrandMark } from "./_components/brand-mark";
import { WelcomeView } from "./_components/welcome-view";
import { ParticipantWelcomeView } from "./_components/participant-welcome-view";
import { InviteErrorView } from "./_components/invite-error-view";
import type { TokenErrorVariant } from "@/components/onboarding";

/**
 * /convite/{token} — shared landing for two flows:
 *   - kind === "admin-tenant" → 05.1 onboarding (Cenário 05).
 *   - kind === "participant"  → 06.2 (Cenário 06, this Session).
 *   - kind === "leader"       → out of scope; falls back to invalid state.
 *
 * Until Session 3 wires the real backend, the resolve step uses an in-memory
 * fixture mirroring the MSW handler. Reviewers exercise both flows with these
 * tokens: admin-tenant-valid | participant-valid | participant-expired |
 * participant-used.
 */
export default async function AceiteConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = resolveInviteFixture(token);

  return (
    <OnboardingPageLayout header={<BrandMark />}>
      {renderInvite(resolved, token)}
    </OnboardingPageLayout>
  );
}

function renderInvite(
  resolved: ReturnType<typeof resolveInviteFixture>,
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
