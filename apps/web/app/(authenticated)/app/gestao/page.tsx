import { redirect } from 'next/navigation';

/**
 * `/app/gestao` is the leader area root and has no dashboard of its own — the
 * tenant-selection flow pushes here after a church is chosen. Redirect to the
 * Pastoral Radar (the leader home). The OnboardingRedirectGuard in the
 * authenticated layout still bounces not-yet-onboarded leaders to
 * `/app/gestao/boas-vindas`, so onboarding is unaffected.
 */
export default function GestaoIndexPage(): never {
  redirect('/app/gestao/radar');
}
