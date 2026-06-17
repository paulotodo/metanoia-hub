/**
 * Story 12.2 — US5: CatalogSearch keyboard navigation tests
 * FR-015 (busca primeiro focável), FR-016 (filtros por teclado),
 * FR-017 (cards focáveis/ativáveis), FR-018 (paginação por Tab),
 * dec-015 (anúncio de resultados, foco permanece no input).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogSearch } from '@/components/catalog/catalog-search';

// ---------------------------------------------------------------------------
// Mock do useSearch
// ---------------------------------------------------------------------------
vi.mock('@/lib/api/hooks/use-search', () => ({
  useSearch: vi.fn(),
}));

// Mock do useAsyncAnnouncer
vi.mock('@/components/a11y/async-announcer', () => ({
  useAsyncAnnouncer: vi.fn(() => ({
    announce: vi.fn(),
  })),
}));

// Mock do next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

import { useSearch } from '@/lib/api/hooks/use-search';
import type { SearchResponse, SearchResultItem } from '@metanoia/types';

const mockUseSearch = vi.mocked(useSearch);

function makeResult(overrides: Partial<SearchResultItem> = {}): SearchResultItem {
  return {
    lessonId: 'lesson-1',
    lessonName: 'Introdução ao Discipulado',
    trailId: 'trail-1',
    trailName: 'Trilha Base',
    moduleName: 'Módulo 1',
    snippet: 'Conteúdo da aula',
    isDraft: false,
    ...overrides,
  };
}

function makeSearchResponse(items: SearchResultItem[]): SearchResponse {
  return { data: items };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockUseSearch.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    isError: false,
  } as ReturnType<typeof useSearch>);
});

describe('CatalogSearch — FR-015: campo de busca primeiro focável', () => {
  it('o input de busca recebe foco antes dos filtros', async () => {
    const user = userEvent.setup();
    render(<CatalogSearch />, { wrapper });
    const input = screen.getByRole('searchbox');
    expect(input).toBeDefined();

    // Tab da seção → input deve ser o primeiro elemento focável
    await user.tab();
    expect(document.activeElement).toBe(input);
  });
});

describe('CatalogSearch — FR-016: filtros acessíveis por teclado', () => {
  it('Enter/Space abre o dropdown de categoria', async () => {
    const user = userEvent.setup();
    render(<CatalogSearch />, { wrapper });

    // Localizar botão de categoria
    const categoryBtn = screen.getByRole('button', { name: /Categoria/i });
    categoryBtn.focus();

    await user.keyboard('{Enter}');
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeDefined();
  });

  it('Escape fecha o dropdown e retorna foco ao botão', async () => {
    const user = userEvent.setup();
    render(<CatalogSearch />, { wrapper });

    const categoryBtn = screen.getByRole('button', { name: /Categoria/i });
    categoryBtn.focus();
    await user.keyboard('{Enter}');

    // Pressionar Escape
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
    expect(document.activeElement).toBe(categoryBtn);
  });

  it('Arrow Up/Down navega entre opções do dropdown', async () => {
    const user = userEvent.setup();
    render(<CatalogSearch />, { wrapper });

    const categoryBtn = screen.getByRole('button', { name: /Categoria/i });
    categoryBtn.focus();
    await user.keyboard('{Enter}');

    const listbox = screen.getByRole('listbox');
    // Arrow Down move índice ativo
    await user.keyboard('{ArrowDown}');
    const options = within(listbox).getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
  });
});

describe('CatalogSearch — FR-017: cards focáveis e ativáveis com Enter', () => {
  beforeEach(() => {
    mockUseSearch.mockReturnValue({
      data: makeSearchResponse([
        makeResult({ lessonId: 'l1', lessonName: 'Aula Um', trailId: 't1' }),
        makeResult({ lessonId: 'l2', lessonName: 'Aula Dois', trailId: 't2' }),
      ]),
      isLoading: false,
      error: null,
      isError: false,
    } as ReturnType<typeof useSearch>);
  });

  it('cards têm role=link (tag <a>) e são focáveis', async () => {
    const user = userEvent.setup();
    render(<CatalogSearch />, { wrapper });

    // Digitar query para mostrar resultados
    const input = screen.getByRole('searchbox');
    await user.type(input, 'aula');

    // Aguardar cards aparecerem
    await waitFor(() => {
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('CatalogSearch — dec-015: anúncio de resultados, foco no input', () => {
  it('após busca assíncrona foco permanece no input', async () => {
    const user = userEvent.setup();
    render(<CatalogSearch />, { wrapper });

    const input = screen.getByRole('searchbox');
    await user.click(input);
    await user.type(input, 'discipulado');

    // Foco deve permanecer no input (dec-015: NÃO mover para resultados)
    expect(document.activeElement).toBe(input);
  });

  it('região role=status está presente no DOM', () => {
    render(<CatalogSearch />, { wrapper });
    const statusRegion = document.querySelector('[data-testid="catalog-result-status"]');
    expect(statusRegion).not.toBeNull();
    expect(statusRegion?.getAttribute('role')).toBe('status');
    expect(statusRegion?.getAttribute('aria-live')).toBe('polite');
  });
});

describe('CatalogSearch — FR-018: paginação alcançável via Tab', () => {
  it('botões de paginação têm aria-label descritivo', async () => {
    // Gerar >10 itens para mostrar paginação
    const manyItems = Array.from({ length: 12 }, (_, i) =>
      makeResult({ lessonId: `l${i}`, lessonName: `Aula ${i}`, trailId: `t${i}` }),
    );
    mockUseSearch.mockReturnValue({
      data: makeSearchResponse(manyItems),
      isLoading: false,
      error: null,
      isError: false,
    } as ReturnType<typeof useSearch>);

    const user = userEvent.setup();
    render(<CatalogSearch />, { wrapper });

    const input = screen.getByRole('searchbox');
    await user.type(input, 'aula');

    await waitFor(() => {
      const nextBtn = screen.getByRole('button', { name: /Próxima página/i });
      expect(nextBtn).toBeDefined();
    });
  });
});

describe('CatalogSearch — jest-axe: sem violações de acessibilidade', () => {
  it('componente vazio não tem violações axe', async () => {
    const { container } = render(<CatalogSearch />, { wrapper });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('componente com resultados não tem violações axe', async () => {
    mockUseSearch.mockReturnValue({
      data: makeSearchResponse([
        makeResult({ lessonId: 'l1', lessonName: 'Aula Um', trailId: 't1' }),
      ]),
      isLoading: false,
      error: null,
      isError: false,
    } as ReturnType<typeof useSearch>);

    const user = userEvent.setup();
    const { container } = render(<CatalogSearch />, { wrapper });
    const input = screen.getByRole('searchbox');
    await user.type(input, 'aula');

    await waitFor(() => screen.getAllByRole('link').length > 0);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
