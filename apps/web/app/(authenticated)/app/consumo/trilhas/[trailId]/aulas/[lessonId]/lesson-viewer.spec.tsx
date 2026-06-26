/**
 * lesson-viewer.spec.tsx — unit tests for LessonViewer
 * Tests: 4 contentTypes render, navigation button, a11y basics
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import { LessonViewer } from './lesson-viewer';

// Mock next/dynamic so PlyrVideoPlayer renders as a simple <video> stub in tests
vi.mock('next/dynamic', () => ({
  default: () => {
    // Return a simple video element — same UX as Plyr for DOM inspection
    function MockPlyrPlayer({ src, title }: { src: string; title: string }) {
      return <video src={src} aria-label={title} controls />;
    }
    return MockPlyrPlayer;
  },
}));
import {
  MOCK_TRAIL_ID,
  MOCK_MODULE_A_ID,
  MOCK_MODULE_B_ID,
  MOCK_LESSON_1_ID,
  MOCK_LESSON_2_ID,
  MOCK_LESSON_3_ID,
  mockLessonsModuleA,
} from '@test-mocks/handlers/trail-structure';

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQC()}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// T1: video lesson renders video element
// ---------------------------------------------------------------------------
describe('LessonViewer — contentType=video', () => {
  it('renders a video element with correct src', async () => {
    render(
      <Wrapper>
        <LessonViewer
          trailId={MOCK_TRAIL_ID}
          moduleId={MOCK_MODULE_A_ID}
          lessonId={MOCK_LESSON_1_ID}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1.textContent).toBe('Introdução à Oração');
    });

    const videoEl = document.querySelector('video');
    expect(videoEl).toBeTruthy();
    expect(videoEl?.getAttribute('src')).toContain('video1.mp4');
  });
});

// ---------------------------------------------------------------------------
// T2: rich_text lesson renders html content
// ---------------------------------------------------------------------------
describe('LessonViewer — contentType=rich_text', () => {
  it('renders rich text body', async () => {
    render(
      <Wrapper>
        <LessonViewer
          trailId={MOCK_TRAIL_ID}
          moduleId={MOCK_MODULE_A_ID}
          lessonId={MOCK_LESSON_2_ID}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1.textContent).toBe('Tipos de Oração');
    });
    expect(screen.getByText('Conteúdo sobre oração')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T3: pdf_doc lesson renders an iframe
// ---------------------------------------------------------------------------
describe('LessonViewer — contentType=pdf_doc', () => {
  it('renders iframe for PDF', async () => {
    render(
      <Wrapper>
        <LessonViewer
          trailId={MOCK_TRAIL_ID}
          moduleId={MOCK_MODULE_B_ID}
          lessonId={MOCK_LESSON_3_ID}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1.textContent).toBe('Lendo a Bíblia');
    });
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('title')).toBe('Lendo a Bíblia');
  });
});

// ---------------------------------------------------------------------------
// T4: external_link lesson renders link button
// ---------------------------------------------------------------------------
describe('LessonViewer — contentType=external_link', () => {
  beforeEach(() => {
    const firstLesson = mockLessonsModuleA[0];
    server.use(
      http.get('*/api/v1/trails/:trailId/modules/:moduleId/lessons/:lessonId', () =>
        HttpResponse.json({
          data: {
            ...firstLesson,
            id: MOCK_LESSON_1_ID,
            contentType: 'external_link',
            contentUrl: 'https://external.example.com/resource',
          },
        }),
      ),
    );
  });

  it('renders external link button', async () => {
    render(
      <Wrapper>
        <LessonViewer
          trailId={MOCK_TRAIL_ID}
          moduleId={MOCK_MODULE_A_ID}
          lessonId={MOCK_LESSON_1_ID}
        />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toBeTruthy(),
    );
    const link = screen.getByText('Acessar conteúdo').closest('a');
    expect(link?.getAttribute('href')).toBe('https://external.example.com/resource');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

// ---------------------------------------------------------------------------
// T5: navigation button — back to trail always present
// ---------------------------------------------------------------------------
describe('LessonViewer — navigation', () => {
  it('renders back to trail link', async () => {
    render(
      <Wrapper>
        <LessonViewer
          trailId={MOCK_TRAIL_ID}
          moduleId={MOCK_MODULE_A_ID}
          lessonId={MOCK_LESSON_1_ID}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1.textContent).toBe('Introdução à Oração');
    });
    const backLinks = screen.getAllByText('Voltar para trilha');
    const backLink = backLinks[0]?.closest('a');
    expect(backLink?.getAttribute('href')).toBe(
      `/app/consumo/trilhas/${MOCK_TRAIL_ID}`,
    );
  });
});

// ---------------------------------------------------------------------------
// T6: a11y — h1 unique and region labelled
// ---------------------------------------------------------------------------
describe('LessonViewer — a11y basics', () => {
  it('has unique h1 and labelled main region', async () => {
    render(
      <Wrapper>
        <LessonViewer
          trailId={MOCK_TRAIL_ID}
          moduleId={MOCK_MODULE_A_ID}
          lessonId={MOCK_LESSON_1_ID}
        />
      </Wrapper>,
    );

    await waitFor(() => {
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeTruthy();
    });

    // Only one h1
    const h1s = document.querySelectorAll('h1');
    expect(h1s.length).toBe(1);

    // main has aria-label
    const main = document.querySelector('main');
    expect(main?.getAttribute('aria-label')).toBeTruthy();
  });
});
