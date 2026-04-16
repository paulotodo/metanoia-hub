import type { Metadata } from 'next';
import { DemoRequestForm } from '@/components/marketing/demo-request-form';
import messages from '../../../messages/pt-BR.json';

const t = messages.comecar;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
};

export default function ComecarPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
        {t.title}
      </h1>
      <p className="mt-4 text-lg text-[var(--color-text-muted)]">{t.subtitle}</p>
      <DemoRequestForm />
    </section>
  );
}
