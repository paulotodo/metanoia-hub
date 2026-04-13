import { OnboardingPageLayout } from "@/components/onboarding";
import {
  mockInvitesByToken,
  type InviteStatus,
} from "../../../../__mocks__/onboarding";
import { BrandMark } from "./_components/brand-mark";
import { WelcomeView } from "./_components/welcome-view";
import { InviteErrorView } from "./_components/invite-error-view";
import type { TokenErrorVariant } from "@/components/onboarding";

/**
 * 05.1 Aceite do Convite — Server Component.
 *
 * Until Session 5 wires the real API, the page resolves the token's status
 * from the in-memory fixture table. Any token not in the table is treated as
 * invalid. This lets reviewers exercise each of the five states by visiting
 * /convite/<one of the mock token keys>.
 */
export default async function AceiteConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const status = resolveStatus(token);

  return (
    <OnboardingPageLayout header={<BrandMark />}>
      {status === "valid" ? (
        <WelcomeView token={token} />
      ) : (
        <InviteErrorView variant={status} />
      )}
    </OnboardingPageLayout>
  );
}

function resolveStatus(token: string): InviteStatus | TokenErrorVariant {
  const fixture = mockInvitesByToken[token];
  if (fixture) return fixture.status;
  // `network` is only produced by the real client in Session 5. For now,
  // unknown tokens render as "invalid" — the safer default.
  return "invalid";
}
