import messages from '../../../messages/pt-BR.json';

const t = messages.landing.features;

const FEATURES: ReadonlyArray<{ key: string; title: string; body: string }> = [
  { key: 'radar', title: t.radar.title, body: t.radar.body },
  { key: 'grupos', title: t.grupos.title, body: t.grupos.body },
  { key: 'manifesto', title: t.manifesto.title, body: t.manifesto.body },
];

export function FeatureBlocks() {
  return (
    <section className="border-t border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          {t.heading}
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.key}
              className="rounded-lg border border-[var(--color-border-default)] bg-surface-base p-6"
            >
              <h3 className="text-xl font-semibold text-text-primary">
                {feature.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-secondary">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
