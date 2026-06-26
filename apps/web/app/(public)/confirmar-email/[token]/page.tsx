import type { Metadata } from 'next';
import { ConfirmEmailView } from './_components/confirm-email-view';

export const metadata: Metadata = {
  title: 'Confirmar e-mail — metanoia',
  description: 'Confirme seu e-mail para ativar sua conta metanoia.',
};

export default async function ConfirmEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <ConfirmEmailView token={token} />
    </div>
  );
}
