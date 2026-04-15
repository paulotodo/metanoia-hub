import { OnboardingPageLayout } from "@/components/onboarding";
import {
  mockInvitesByToken,
  type InviteStatus,
} from "../../../../../__mocks__/onboarding";
import { BrandMark } from "../_components/brand-mark";
import { InviteErrorView } from "../_components/invite-error-view";
import { CreateAccountForm } from "./_components/create-account-form";
import type { TokenErrorVariant } from "@/components/onboarding";

/**
 * 05.3 Criar Conta Admin — Server Component.
 *
 * Mirrors the token-status resolution used by 05.1 and 05.2 so reviewers can
 * deep-link directly into this step and still see the same error states.
 * When the token is valid the server only renders the layout shell; the form
 * itself is a Client Component (`CreateAccountForm`) to keep stateful UI
 * isolated.
 */
export default async function CriarContaConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const status = resolveStatus(token);

  return (
    <OnboardingPageLayout header={<BrandMark />} width="narrow">
      {status === "valid" ? (
        <CreateAccountForm token={token} />
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
