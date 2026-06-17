import { CatalogSearch } from '@/components/catalog/catalog-search';
import messages from '../../../../../messages/pt-BR.json';

const t = messages.catalog;

/**
 * /app/consumo/catalogo — Catálogo de Trilhas
 *
 * Story 12.2 — US5, FR-015..018
 *
 * Server Component: renderiza shell da página (h1 + CatalogSearch).
 * CatalogSearch é Client Component e contém toda a lógica de busca,
 * filtros e paginação acessíveis por teclado.
 */
export default function CatalogoPage() {
  return (
    <main
      id="conteudo"
      className="mx-auto max-w-3xl px-4 py-8"
      data-autofocus
    >
      <h1
        className="mb-6 text-2xl font-bold text-foreground"
        tabIndex={-1}
      >
        {t.title}
      </h1>
      <CatalogSearch />
    </main>
  );
}
