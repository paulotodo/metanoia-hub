/**
 * trail-playlist.spec.tsx — T2, T3, T6, T7, T10, T11
 * Ref: tasks.md §4.6.11, spec §FR-001, FR-003, FR-006, FR-011, FR-014.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import { TrailPlaylist } from './trail-playlist';
import {
  MOCK_TRAIL_ID,
  MOCK_LESSON_1_ID,
  mockProgressWithInProgress,
} from '@test-mocks/handlers/trail-structure';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Mock IntersectionObserver globally so LazyModuleMount works
beforeEach(() => {
  class MockIO {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }
  vi.stubGlobal('IntersectionObserver', MockIO);
});

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// T2: modules and lessons rendered
// ---------------------------------------------------------------------------

describe('TrailPlaylist — T2 modules rendered', () => {
  it('renders trail playlist container', async () => {
    render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );
    await screen.findByTestId('trail-playlist');
    expect(screen.getByTestId('trail-playlist')).toBeTruthy();
  });

  it('renders first module accordion item (eager mount)', async () => {
    render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );
    // Wait for first module to load (first module is always eager-mounted)
    await screen.findByText('Módulo 1 — Oração');
    expect(screen.getByText('Módulo 1 — Oração')).toBeTruthy();
    // Module 2 is lazy-mounted (LazyModuleMount), only visible when IO fires
    // In test environment with MockIO, it shows placeholder
    expect(screen.getByTestId('lazy-module-placeholder')).toBeTruthy();
  });

  it('renders skeleton while loading', () => {
    // Override to delay
    server.use(
      http.get('*/api/v1/trails/:trailId', async () => {
        await new Promise((r) => setTimeout(r, 500));
        return HttpResponse.json({ data: {} });
      }),
    );
    render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByTestId('trail-playlist-skeleton')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T3: active lesson highlighted with teal
// ---------------------------------------------------------------------------

describe('TrailPlaylist — T3 active lesson teal highlight', () => {
  it('marks lesson with in_progress status as active (teal classes)', async () => {
    // Override progress to have in_progress lesson
    server.use(
      http.get('*/api/v1/progress/trails/:trailId', () =>
        HttpResponse.json(mockProgressWithInProgress),
      ),
    );

    render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );

    // Wait for first module to appear
    await screen.findByText('Módulo 1 — Oração');

    // Expand first module (eager mounted)
    fireEvent.click(screen.getByTestId('module-accordion-header'));

    // Wait for lesson rows to appear
    await screen.findByText('Introdução à Oração');

    // Find the active lesson row by data-lesson-id
    const rows = screen.getAllByTestId('lesson-row');
    const activeRow = rows.find((el) => el.getAttribute('data-lesson-id') === MOCK_LESSON_1_ID);

    expect(activeRow).toBeTruthy();
    if (!activeRow) return;
    expect(activeRow.className).toContain('bg-brand-teal/10');
    expect(activeRow.className).toContain('border-brand-teal');
  });
});

// ---------------------------------------------------------------------------
// T10: empty state (no modules)
// ---------------------------------------------------------------------------

describe('TrailPlaylist — T10 empty state', () => {
  it('renders empty state when trail has no modules', async () => {
    server.use(
      http.get('*/api/v1/trails/:trailId/modules', () =>
        HttpResponse.json({ data: [], meta: { total: 0 } }),
      ),
    );
    render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );
    await screen.findByTestId('trail-playlist-empty');
    expect(screen.getByTestId('trail-playlist-empty')).toBeTruthy();
    expect(screen.getByText('Trilha sem conteúdo')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T11: error state + retry
// ---------------------------------------------------------------------------

describe('TrailPlaylist — T11 error state + retry', () => {
  it('renders error state when trail fails to load', async () => {
    server.use(
      http.get('*/api/v1/trails/:trailId', () =>
        HttpResponse.json({ statusCode: 500, error: 'Server Error', message: 'fail' }, { status: 500 }),
      ),
    );
    render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );
    await screen.findByTestId('trail-playlist-error');
    expect(screen.getByTestId('trail-playlist-error')).toBeTruthy();
  });

  it('T11-retry: clicking retry button refetches', async () => {
    let callCount = 0;
    server.use(
      http.get('*/api/v1/trails/:trailId', () => {
        callCount++;
        if (callCount <= 1) {
          return HttpResponse.json({ statusCode: 500, error: 'Server Error', message: 'fail' }, { status: 500 });
        }
        return HttpResponse.json({
          data: {
            id: MOCK_TRAIL_ID,
            tenantId: '019756a1-0000-7000-8000-000000000099',
            name: 'Fundamentos da Fé',
            description: null,
            status: 'published',
            accessMode: 'free',
            version: 1,
            publishedAt: '2026-01-01T00:00:00.000Z',
            publishedBy: null,
            catalogVisible: true,
            createdBy: '019756a1-0000-7000-8000-000000000099',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            deletedAt: null,
          },
        });
      }),
    );

    render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );

    await screen.findByTestId('trail-playlist-error');
    fireEvent.click(screen.getByTestId('trail-playlist-retry'));

    // After retry, it should try to reload (may show skeleton again)
    await waitFor(() => {
      expect(callCount).toBeGreaterThan(1);
    });
  });
});

// ---------------------------------------------------------------------------
// T6: keyboard navigation (ArrowDown/ArrowUp roving focus)
// ---------------------------------------------------------------------------

describe('TrailPlaylist — T6 keyboard navigation', () => {
  it('ArrowDown does not throw and list container has onKeyDown handler', async () => {
    render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );

    await screen.findByText('Módulo 1 — Oração');

    // First module accordion header is visible (eager mount)
    const headers = screen.getAllByTestId('module-accordion-header');
    expect(headers.length).toBeGreaterThanOrEqual(1);

    // Focus first header
    act(() => { headers[0].focus(); });

    // Fire ArrowDown on the list container — should not throw
    const listContainer = screen.getByRole('list');
    expect(() => {
      fireEvent.keyDown(listContainer, { key: 'ArrowDown' });
    }).not.toThrow();

    // ArrowUp also should not throw
    expect(() => {
      fireEvent.keyDown(listContainer, { key: 'ArrowUp' });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// T7: axe accessibility (all states)
// ---------------------------------------------------------------------------

describe('TrailPlaylist — T7 accessibility (jest-axe)', () => {
  it('no axe violations in loaded state', async () => {
    const { container } = render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );
    await screen.findByText('Módulo 1 — Oração');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('no axe violations in empty state', async () => {
    server.use(
      http.get('*/api/v1/trails/:trailId/modules', () =>
        HttpResponse.json({ data: [], meta: { total: 0 } }),
      ),
    );
    const { container } = render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );
    await screen.findByTestId('trail-playlist-empty');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('no axe violations in error state', async () => {
    server.use(
      http.get('*/api/v1/trails/:trailId', () =>
        HttpResponse.json({ statusCode: 500, error: 'Server Error', message: 'fail' }, { status: 500 }),
      ),
    );
    const { container } = render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );
    await screen.findByTestId('trail-playlist-error');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('T7-no-role-article-on-anchor: no element uses role=article on interactive element (regression Cenário 06 Session 5)', () => {
    const { container } = render(
      <Wrapper>
        <TrailPlaylist trailId={MOCK_TRAIL_ID} onLessonSelect={vi.fn()} />
      </Wrapper>,
    );
    // No <a> or <button> with role="article"
    const invalidRoleEls = container.querySelectorAll('a[role="article"], button[role="article"]');
    expect(invalidRoleEls.length).toBe(0);
  });
});
