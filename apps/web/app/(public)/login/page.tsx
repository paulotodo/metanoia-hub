import type { Metadata } from 'next';
import { LoginForm } from './_components/login-form';

export const metadata: Metadata = {
  title: 'Entrar — Metanoia Hub',
  description: 'Faca login na plataforma Metanoia Hub',
};

export default function LoginPage() {
  return <LoginForm />;
}
