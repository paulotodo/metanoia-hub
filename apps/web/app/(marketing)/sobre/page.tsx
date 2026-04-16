import type { Metadata } from 'next';
import messages from '../../../messages/pt-BR.json';

const t = messages.sobre;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
};

const VALORES: ReadonlyArray<{ key: string; body: string }> = [
  { key: 'pastoral', body: t.valores.pastoral },
  { key: 'simplicidade', body: t.valores.simplicidade },
  { key: 'cuidado', body: t.valores.cuidado },
];

export default function SobrePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 md:py-20">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-muted)]">
          {t.subtitle}
        </p>
      </header>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-text-primary">
          {t.missao.heading}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-[var(--color-text-muted)]">
          {t.missao.body}
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-text-primary">
          {t.valores.heading}
        </h2>
        <ul className="mt-4 space-y-3 text-lg leading-relaxed text-[var(--color-text-muted)]">
          {VALORES.map((v) => (
            <li
              key={v.key}
              data-testid={`sobre-valor-${v.key}`}
              className="flex gap-3"
            >
              <span aria-hidden="true" className="text-text-primary">
                ·
              </span>
              <span>{v.body}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-text-primary">
          {t.equipa.heading}
        </h2>
        {/* TODO editorial: lista de equipa real chega após autorização individual de cada membro. */}
        <p className="mt-4 text-lg leading-relaxed text-[var(--color-text-muted)]">
          Uma equipa pequena formada por desenvolvedores, designers e líderes
          que servem em igrejas locais. Apresentações detalhadas em breve.
        </p>
      </section>
    </article>
  );
}
