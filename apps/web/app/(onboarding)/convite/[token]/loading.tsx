import { OnboardingPageLayout } from "@/components/onboarding";
import { BrandMark } from "./_components/brand-mark";
import { InviteLoadingSkeleton } from "./_components/invite-loading-skeleton";

/**
 * Spec 06.2 page state "Loading" — Next.js streams this fallback while the
 * Server Component awaits token resolution. Same layout chrome as the page
 * itself (logo + content slot) so users don't see a layout shift.
 */
export default function Loading() {
  return (
    <OnboardingPageLayout header={<BrandMark />}>
      <InviteLoadingSkeleton />
    </OnboardingPageLayout>
  );
}
