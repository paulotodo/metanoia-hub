import messages from '../../../messages/pt-BR.json';

const t = messages.apresentacao.slides;

const SLIDES: ReadonlyArray<{ key: string; heading: string; body: string }> = [
  { key: 's1', heading: t.s1.heading, body: t.s1.body },
  { key: 's2', heading: t.s2.heading, body: t.s2.body },
  { key: 's3', heading: t.s3.heading, body: t.s3.body },
  { key: 's4', heading: t.s4.heading, body: t.s4.body },
  { key: 's5', heading: t.s5.heading, body: t.s5.body },
  { key: 's6', heading: t.s6.heading, body: t.s6.body },
  { key: 's7', heading: t.s7.heading, body: t.s7.body },
  { key: 's8', heading: t.s8.heading, body: t.s8.body },
];

export function DeckLight() {
  return (
    <ol className="mt-12 grid gap-6 md:grid-cols-2">
      {SLIDES.map((slide, index) => (
        <li
          key={slide.key}
          className="rounded-lg border border-[var(--color-border-default)] bg-surface-base p-6"
          data-testid={`deck-slide-${slide.key}`}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-secondary">
            {`${String(index + 1).padStart(2, '0')} / ${SLIDES.length}`}
          </span>
          <h3 className="mt-2 text-xl font-semibold text-text-primary">
            {slide.heading}
          </h3>
          <p className="mt-3 text-base leading-relaxed text-secondary">
            {slide.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
