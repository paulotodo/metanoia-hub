import type { Metadata } from 'next';
import { RecoveryForm } from './_components/recovery-form';

export const metadata: Metadata = {
  title: 'Recuperar acesso — metanoia',
  description: 'Recupere o acesso à sua conta metanoia.',
};

export default function RecoverPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <RecoveryForm />
    </div>
  );
}
