import messages from '../../../messages/pt-BR.json';

const t = messages.funcionalidades;

const BLOCKS: ReadonlyArray<{ key: string; title: string; body: string }> = [
  { key: 'radar', title: t.blocks.radar.title, body: t.blocks.radar.body },
  { key: 'grupos', title: t.blocks.grupos.title, body: t.blocks.grupos.body },
  {
    key: 'reflexoes',
    title: t.blocks.reflexoes.title,
    body: t.blocks.reflexoes.body,
  },
  {
    key: 'onboarding',
    title: t.blocks.onboarding.title,
    body: t.blocks.onboarding.body,
  },
  {
    key: 'relatorios',
    title: t.blocks.relatorios.title,
    body: t.blocks.relatorios.body,
  },
  { key: 'equipa', title: t.blocks.equipa.title, body: t.blocks.equipa.body },
];

export function FeatureGrid() {
  return (
    <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {BLOCKS.map((block) => (
        <article
          key={block.key}
          className="overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-surface-base"
          data-testid={`feature-block-${block.key}`}
        >
          <div
            aria-label={t.screenshotPlaceholder}
            role="img"
            className="flex aspect-video items-center justify-center bg-[var(--color-surface-sunken)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]"
          >
            {t.screenshotPlaceholder}
          </div>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-text-primary">
              {block.title}
            </h3>
            <p className="mt-3 text-base leading-relaxed text-secondary">
              {block.body}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
