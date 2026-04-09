import type { Metadata } from 'next';
import { RegisterForm } from './_components/register-form';

export const metadata: Metadata = {
  title: 'Criar conta — Metanoia Hub',
  description: 'Crie sua conta na plataforma Metanoia Hub',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
