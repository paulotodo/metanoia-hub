/**
 * Server Component — Branding Settings Page.
 * Fetches current branding via SSR; passes to BrandingSettingsForm (Client Component).
 * Constitution V: Server Components use native fetch, no TanStack Query.
 */
import { cookies } from 'next/headers';
import { BrandingResponseSchema, type BrandingResponse } from '@metanoia/types';
import { BrandingSettingsForm } from './BrandingSettingsForm';

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api/v1';

async function getBranding(accessToken: string): Promise<BrandingResponse | null> {
  try {
    const res = await fetch(`${API_INTERNAL_URL}/tenants/me/branding`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 1800 }, // 30 min
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    return BrandingResponseSchema.parse((json as { data: unknown }).data);
  } catch {
    return null;
  }
}

export default async function BrandingSettingsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value ?? '';
  const branding = accessToken ? await getBranding(accessToken) : null;

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--color-text-primary)]">
        Identidade Visual da Igreja
      </h1>
      <BrandingSettingsForm initialBranding={branding} />
    </div>
  );
}
