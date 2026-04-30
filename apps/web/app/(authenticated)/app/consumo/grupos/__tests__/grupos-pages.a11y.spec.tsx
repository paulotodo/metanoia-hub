import { act, render, waitFor, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { createQueryClientWrapper } from '@/lib/test-utils/with-query-client';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({ id: '019756c0-2000-7000-8000-000000000001' }),
}));

import ParticipantGroupsPage from '../page';
import ParticipantGroupDetailPage from '../[id]/page';

async function renderWithQuery(node: React.ReactElement) {
  const Wrapper = createQueryClientWrapper();
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<Wrapper>{node}</Wrapper>);
  });
  return result;
}

describe('Cenário 06 — accessibility (jest-axe)', () => {
  it('participant groups list page has no a11y violations (loaded)', async () => {
    const { container } = await renderWithQuery(<ParticipantGroupsPage />);

    await waitFor(() =>
      expect(screen.getByText('Fundamentos da Fé')).toBeTruthy(),
    );

    // heading-order disabled: pages render h2/h3 dentro de um layout que
    // provê o h1 — isolar a página em teste produz falso positivo.
    const results = await axe(container, {
      rules: { 'heading-order': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('participant group detail page has no a11y violations (loaded)', async () => {
    const { container } = await renderWithQuery(<ParticipantGroupDetailPage />);

    await waitFor(() =>
      expect(screen.getByText('Fundamentos da Fé')).toBeTruthy(),
    );

    // heading-order disabled: pages render h2/h3 dentro de um layout que
    // provê o h1 — isolar a página em teste produz falso positivo.
    const results = await axe(container, {
      rules: { 'heading-order': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
