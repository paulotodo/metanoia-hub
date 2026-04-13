import { OnboardingPageLayout } from "@/components/onboarding";
import {
  mockInvitesByToken,
  type InviteStatus,
} from "../../../../../__mocks__/onboarding";
import { BrandMark } from "../_components/brand-mark";
import { InviteErrorView } from "../_components/invite-error-view";
import { TermsPageContent } from "./_components/terms-page-content";
import type { TokenErrorVariant } from "@/components/onboarding";

/**
 * 05.2 Termos e LGPD — Server Component.
 *
 * Mirrors 05.1's token-status resolution so reviewers can deep-link directly
 * into this step and still see the same error states. Until Session 5 wires
 * the real API, `mockInvitesByToken` is the source of truth.
 *
 * Layout uses `width="legal"` (640px) for legibility of the legal text —
 * wider than 05.1's welcome screen.
 */
export default async function TermosConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const status = resolveStatus(token);

  return (
    <OnboardingPageLayout header={<BrandMark />} width="legal">
      {status === "valid" ? (
        <TermsPageContent token={token} />
      ) : (
        <InviteErrorView variant={status} />
      )}
    </OnboardingPageLayout>
  );
}

function resolveStatus(token: string): InviteStatus | TokenErrorVariant {
  const fixture = mockInvitesByToken[token];
  if (fixture) return fixture.status;
  return "invalid";
}
