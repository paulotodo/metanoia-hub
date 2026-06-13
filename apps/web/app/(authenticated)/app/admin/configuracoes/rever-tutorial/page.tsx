// Server Component — renders OnboardingWizard in read-only mode.
// dec-010, FR-09: onboardingProgress is NOT modified in replay mode.
import { cookies } from 'next/headers';
import { ONBOARDING_PROGRESS_DEFAULT, OnboardingStatusResponseSchema } from '@metanoia/types';
import { OnboardingWizard } from '@/components/onboarding';

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api/v1';

async function getWizardStatus(accessToken: string) {
  try {
    const res = await fetch(`${API_INTERNAL_URL}/onboarding/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    return OnboardingStatusResponseSchema.parse(json).data;
  } catch {
    return null;
  }
}

export default async function ReverTutorialPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value ?? '';

  const status = accessToken ? await getWizardStatus(accessToken) : null;

  const initialProgress = status?.progress ?? ONBOARDING_PROGRESS_DEFAULT;
  const hasRealGroups = status?.hasRealGroups ?? false;

  return (
    <OnboardingWizard
      initialProgress={initialProgress}
      hasRealGroups={hasRealGroups}
      readOnly={true}
    />
  );
}
