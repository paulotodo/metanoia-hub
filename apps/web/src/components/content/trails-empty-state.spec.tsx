import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { TrailsEmptyState } from './trails-empty-state';

describe('TrailsEmptyState', () => {
  it('renders pastoral message', () => {
    render(<TrailsEmptyState />);
    expect(screen.getByText('Nenhuma trilha disponível ainda.')).toBeTruthy();
    expect(
      screen.getByText(
        'Fale com o líder do seu grupo para começar sua jornada de discipulado.',
      ),
    ).toBeTruthy();
  });

  it('has role=status for assistive technologies', () => {
    render(<TrailsEmptyState />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('passes jest-axe accessibility checks', async () => {
    const { container } = render(<TrailsEmptyState />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
