import type { Metadata } from 'next';
import { ResetPasswordForm } from './_components/reset-password-form';

export const metadata: Metadata = {
  title: 'Criar senha nova — metanoia',
  description: 'Crie uma nova senha para sua conta metanoia.',
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <ResetPasswordForm token={token} />
    </main>
  );
}
