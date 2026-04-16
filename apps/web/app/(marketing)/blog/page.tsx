import type { Metadata } from 'next';
import { BlogList } from '../../../src/components/marketing/blog-list';
import messages from '../../../messages/pt-BR.json';

const t = messages.blog;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
};

export default function BlogPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 md:py-20">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-muted)]">
          {t.subtitle}
        </p>
      </header>

      <BlogList />
    </section>
  );
}
