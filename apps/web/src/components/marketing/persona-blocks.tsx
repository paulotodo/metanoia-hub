import messages from '../../../messages/pt-BR.json';

const t = messages.landing.personas;

const PERSONAS: ReadonlyArray<{ key: string; title: string; body: string }> = [
  { key: 'pastor', title: t.pastor.title, body: t.pastor.body },
  { key: 'lider', title: t.lider.title, body: t.lider.body },
  { key: 'equipa', title: t.equipa.title, body: t.equipa.body },
];

export function PersonaBlocks() {
  return (
    <section className="border-t border-[var(--color-border-default)] py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          {t.heading}
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PERSONAS.map((persona) => (
            <article
              key={persona.key}
              className="rounded-lg border border-[var(--color-border-default)] p-6"
            >
              <h3 className="text-xl font-semibold text-text-primary">
                {persona.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-secondary">
                {persona.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
