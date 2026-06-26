import { cookies } from 'next/headers';
import { AppQueryProvider } from '@/lib/query';
import { NavigationShell } from './_components/navigation-shell';
import { OnboardingRedirectGuard } from './_components/onboarding-redirect-guard';
import { BrandingResponseSchema } from '@metanoia/types';
// Plyr CSS — loaded globally for all authenticated routes with video content (task 4.2)
import 'plyr/dist/plyr.css';

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api/v1';

async function getBrandingStyle(accessToken: string): Promise<React.CSSProperties> {
  try {
    const res = await fetch(`${API_INTERNAL_URL}/tenants/me/branding`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 1800 }, // 30 min — matches staleTime on client
    });
    if (!res.ok) return {};
    const json = (await res.json()) as unknown;
    const branding = BrandingResponseSchema.parse(
      (json as { data: unknown }).data,
    );
    // Omit null values — do NOT inject --color-brand-primary: null
    const style: Record<string, string> = {};
    if (branding.primaryColor) {
      style['--color-brand-primary'] = branding.primaryColor;
    }
    if (branding.secondaryColor) {
      style['--color-brand-secondary'] = branding.secondaryColor;
    }
    return style as React.CSSProperties;
  } catch {
    return {};
  }
}

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value ?? '';
  const brandStyle = accessToken ? await getBrandingStyle(accessToken) : {};

  return (
    // CSS custom props injected here propagate to all children (AC6).
    // Properties are omitted when null so we never emit "var: null".
    <div style={brandStyle}>
      <AppQueryProvider>
        <NavigationShell>
          <OnboardingRedirectGuard>{children}</OnboardingRedirectGuard>
        </NavigationShell>
      </AppQueryProvider>
    </div>
  );
}
