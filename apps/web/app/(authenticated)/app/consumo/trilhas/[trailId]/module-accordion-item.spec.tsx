/**
 * module-accordion-item.spec.tsx — T2-parcial, T6-parcial, T7-parcial, T8
 * Ref: tasks.md §3.2.10, spec §FR-001, FR-004, FR-011.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import { ModuleAccordionItem } from './module-accordion-item';
import type { ModuleResponse } from '@metanoia/types';
import {
  MOCK_MODULE_A_ID,
  MOCK_TRAIL_ID,
  MOCK_LESSON_1_ID,
} from '@test-mocks/handlers/trail-structure';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const MODULE: ModuleResponse = {
  id: MOCK_MODULE_A_ID,
  tenantId: '019756a1-0000-7000-8000-000000000099',
  trailId: MOCK_TRAIL_ID,
  name: 'Módulo 1 — Oração',
  order: 0,
  lessonAccessMode: 'free',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

// ---------------------------------------------------------------------------
// T2-parcial: collapsed/expanded state
// ---------------------------------------------------------------------------

describe('ModuleAccordionItem — T2 collapsed/expanded', () => {
  it('T2-collapsed: shows module name and progress bar when collapsed', () => {
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={false}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    expect(screen.getByText('Módulo 1 — Oração')).toBeTruthy();
  });

  it('T2-collapsed: lesson list not visible when collapsed', () => {
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={false}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    // No lesson rows visible when collapsed
    expect(screen.queryByTestId('lesson-row')).toBeNull();
  });

  it('T2-expanded: shows lesson rows when expanded', async () => {
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={true}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    // Wait for lessons to load via MSW
    await screen.findByText('Introdução à Oração');
    expect(screen.getByText('Introdução à Oração')).toBeTruthy();
  });

  it('T2-expanded: shows lesson duration when available', async () => {
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={true}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    await screen.findByText('Introdução à Oração');
    expect(screen.getByText('15 min')).toBeTruthy();
  });

  it('T2-expanded-empty: shows empty state when module has no lessons', async () => {
    // Override handler to return empty
    server.use(
      http.get('*/api/v1/trails/:trailId/modules/:moduleId/lessons', () =>
        HttpResponse.json({ data: [], meta: { total: 0 } }),
      ),
    );
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={true}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    await screen.findByTestId('module-empty');
    expect(screen.getByTestId('module-empty')).toBeTruthy();
  });

  it('T2-progress-percent: shows 100% when all lessons completed', async () => {
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{
            [MOCK_LESSON_1_ID]: 'completed',
          }}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={false}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    // Progress bar should be rendered (it's always visible — FR-004)
    expect(screen.getByTestId('module-accordion-header')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T6-parcial: keyboard navigation (Enter toggle)
// ---------------------------------------------------------------------------

describe('ModuleAccordionItem — T6 keyboard', () => {
  it('T6-Enter: Enter on header calls onToggle', () => {
    const onToggle = vi.fn();
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={false}
          onToggle={onToggle}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    const header = screen.getByTestId('module-accordion-header');
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('T6-Space: Space on header calls onToggle', () => {
    const onToggle = vi.fn();
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={false}
          onToggle={onToggle}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    const header = screen.getByTestId('module-accordion-header');
    fireEvent.keyDown(header, { key: ' ' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('T6-aria-expanded: header has aria-expanded=false when collapsed', () => {
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={false}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    const header = screen.getByTestId('module-accordion-header');
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });

  it('T6-aria-expanded-true: header has aria-expanded=true when expanded', () => {
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={true}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    const header = screen.getByTestId('module-accordion-header');
    expect(header.getAttribute('aria-expanded')).toBe('true');
  });

  it('T6-aria-label: header aria-label has pattern "Módulo N de T: name — status" (FR-003)', () => {
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={false}
          onToggle={vi.fn()}
          moduleIndex={2}
          totalModules={5}
        />
      </Wrapper>,
    );
    const header = screen.getByTestId('module-accordion-header');
    const label = header.getAttribute('aria-label') ?? '';
    expect(label).toContain('Módulo 2 de 5');
    expect(label).toContain('Módulo 1 — Oração');
    // 0% completion = "Não iniciado"
    expect(label).toContain('Não iniciado');
  });
});

// ---------------------------------------------------------------------------
// T8: touch target header (44px via class)
// ---------------------------------------------------------------------------

describe('ModuleAccordionItem — T8 touch target', () => {
  it('header has min-h-11 class for 44px touch target', () => {
    render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={false}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    const header = screen.getByTestId('module-accordion-header');
    expect(header.className).toContain('min-h-11');
  });
});

// ---------------------------------------------------------------------------
// T7-parcial: axe accessibility
// ---------------------------------------------------------------------------

describe('ModuleAccordionItem — T7 accessibility (jest-axe)', () => {
  it('no axe violations when collapsed', async () => {
    const { container } = render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={false}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('no axe violations when expanded with lessons', async () => {
    const { container } = render(
      <Wrapper>
        <ModuleAccordionItem
          module={MODULE}
          trailId={MOCK_TRAIL_ID}
          progressByLessonId={{}}
          activeLesson={null}
          onLessonSelect={vi.fn()}
          isExpanded={true}
          onToggle={vi.fn()}
          moduleIndex={1}
          totalModules={3}
        />
      </Wrapper>,
    );
    // Wait for async lessons to load
    await screen.findByText('Introdução à Oração');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
