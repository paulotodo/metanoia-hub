import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';
import { TrailsSearch } from '../trails-search';

// ─── Mock useSearch hook ───────────────────────────────────────────────────────

const mockUseSearch = vi.fn();

vi.mock('@/lib/api/hooks/use-search', () => ({
  useSearch: (q: string) => mockUseSearch(q),
}));

// ─── Fake timers for debounce ─────────────────────────────────────────────────
// The component uses a 300ms debounce. We bypass it by mocking useSearch
// to respond to any q (including pre-debounce empty), and advance timers.
// Since useSearch is fully mocked, the debounce only affects when hasQuery
// flips from false→true in the component. We set the input value to a
// non-empty string AND we need React to re-render with the debounced value.
// Strategy: use vi.useFakeTimers + vi.advanceTimersByTime(300) inside act()

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ITEM_PUBLISHED = {
  lessonId: '019078ab-0000-7000-8000-000000000001',
  lessonName: 'Fundamentos da Fé',
  moduleId: '019078ab-0000-7000-8000-000000000002',
  moduleName: 'Módulo 1',
  trailId: '019078ab-0000-7000-8000-000000000003',
  trailName: 'Trilha Inicial',
  contentType: 'rich_text' as const,
  snippet: 'Fundamentos \x02da\x03 fé cristã',
  rank: 0.82,
  isDraft: false,
};

const ITEM_DRAFT = {
  ...ITEM_PUBLISHED,
  lessonId: '019078ab-0000-7000-8000-000000000099',
  trailName: 'Draft Trail',
  isDraft: true,
};

function renderSearch() {
  const Wrapper = createQueryClientWrapper();
  return render(
    <Wrapper>
      <TrailsSearch />
    </Wrapper>,
  );
}

/** Type search query and advance the 300ms debounce timer. */
async function typeAndDebounce(value: string) {
  const input = screen.getByRole('searchbox');
  await act(async () => {
    fireEvent.change(input, { target: { value } });
    vi.advanceTimersByTime(350);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TrailsSearch component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseSearch.mockReset();
    mockUseSearch.mockReturnValue({ data: undefined, isLoading: false, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('renders search input', () => {
      renderSearch();
      expect(screen.getByRole('searchbox')).toBeTruthy();
    });

    it('no results shown when input is empty', () => {
      renderSearch();
      // results region exists in DOM but aria-hidden=true when no query
      const region = document.getElementById('trilhas-search-results');
      expect(region?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('results', () => {
    it('shows results when search returns data', async () => {
      mockUseSearch.mockReturnValue({
        data: { data: [ITEM_PUBLISHED], meta: { total: 1, query: 'fé' } },
        isLoading: false,
        error: null,
      });

      renderSearch();
      await typeAndDebounce('fé');

      expect(screen.getByText('Fundamentos da Fé')).toBeTruthy();
    });

    it('empty state shown when data is empty', async () => {
      mockUseSearch.mockReturnValue({
        data: { data: [], meta: { total: 0, query: 'xyz' } },
        isLoading: false,
        error: null,
      });

      renderSearch();
      await typeAndDebounce('xyz');

      expect(screen.getByText(/Nenhuma aula encontrada/)).toBeTruthy();
    });

    it('no listbox shown when q is empty string', () => {
      renderSearch();
      // input stays empty → useSearch not enabled → no listbox
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('draft badge', () => {
    it('shows Rascunho badge for isDraft: true', async () => {
      mockUseSearch.mockReturnValue({
        data: { data: [ITEM_DRAFT], meta: { total: 1, query: 'fé' } },
        isLoading: false,
        error: null,
      });

      renderSearch();
      await typeAndDebounce('fé');

      expect(screen.getByText('Rascunho')).toBeTruthy();
    });

    it('no Rascunho badge for isDraft: false', async () => {
      mockUseSearch.mockReturnValue({
        data: { data: [ITEM_PUBLISHED], meta: { total: 1, query: 'fé' } },
        isLoading: false,
        error: null,
      });

      renderSearch();
      await typeAndDebounce('fé');

      expect(screen.queryByText('Rascunho')).toBeNull();
    });
  });

  describe('XSS safety dec-014', () => {
    it('renders snippet with <script> as text, not as DOM element', async () => {
      mockUseSearch.mockReturnValue({
        data: {
          data: [{
            ...ITEM_PUBLISHED,
            lessonName: '<script>alert(1)</script>',
            snippet: '<script>alert(1)</script> \x02script\x03 alert 1',
          }],
          meta: { total: 1, query: 'script' },
        },
        isLoading: false,
        error: null,
      });

      const { container } = renderSearch();
      await typeAndDebounce('script');

      // No <script> in DOM
      expect(container.querySelector('script')).toBeNull();
      // Text content contains literal < and > — React-escaped
      expect(container.textContent).toContain('<script>alert(1)</script>');
    });
  });

  describe('a11y', () => {
    it('search input has no WCAG AA violations when empty', async () => {
      const { container } = renderSearch();
      // axe uses real async timers internally — must switch back before calling
      vi.useRealTimers();
      const results = await axe(container, {
        rules: { 'heading-order': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    });

    it('results list has no WCAG AA violations when populated', async () => {
      mockUseSearch.mockReturnValue({
        data: { data: [ITEM_PUBLISHED], meta: { total: 1, query: 'fé' } },
        isLoading: false,
        error: null,
      });

      const { container } = renderSearch();
      await typeAndDebounce('fé');

      vi.useRealTimers();
      const results = await axe(container, {
        rules: { 'heading-order': { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    });
  });
});
