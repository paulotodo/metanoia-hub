import messages from '../../../messages/pt-BR.json';

const t = messages.blog;

// TODO editorial: posts placeholder — substituir por catálogo real (eventualmente MDX/CMS) em release futura.
const POSTS: ReadonlyArray<{
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  author: string;
}> = [
  {
    slug: 'por-que-nao-falamos-funil',
    title: 'Por que não falamos de funil',
    excerpt:
      'Linguagem molda o que se vê. E o que se vê molda o que se cuida. Sobre a escolha consciente de não usar termos de produto numa ferramenta pastoral.',
    publishedAt: '2026-04-10',
    author: 'Equipa metanoia',
  },
  {
    slug: 'radar-pastoral-na-pratica',
    title: 'Como uma igreja descobriu que ninguém estava sumindo',
    excerpt:
      'História real (com nomes mudados) de uma comunidade de 180 pessoas que aprendeu a olhar para os silêncios — e o que descobriu lá.',
    publishedAt: '2026-04-03',
    author: 'Equipa metanoia',
  },
];

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

export function BlogList() {
  if (POSTS.length === 0) {
    return (
      <p
        data-testid="blog-empty"
        className="mt-12 text-center text-base text-[var(--color-text-muted)]"
      >
        {t.empty}
      </p>
    );
  }

  return (
    <ul className="mt-12 space-y-8">
      {POSTS.map((post) => (
        <li
          key={post.slug}
          data-testid={`blog-post-${post.slug}`}
          className="rounded-lg border border-[var(--color-border-default)] bg-surface-base p-6"
        >
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            {dateFormatter.format(new Date(post.publishedAt))} · {post.author}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-text-primary">
            {post.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[var(--color-text-muted)]">
            {post.excerpt}
          </p>
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">
            {t.readMore} →
          </p>
        </li>
      ))}
    </ul>
  );
}
