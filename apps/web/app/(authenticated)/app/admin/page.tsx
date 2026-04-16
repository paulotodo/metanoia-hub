import { redirect } from 'next/navigation';

interface AdminHomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminHomePage({ searchParams }: AdminHomeProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) query.append(key, v);
    } else {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  redirect(qs ? `/app/admin/igreja/vista?${qs}` : '/app/admin/igreja/vista');
}
