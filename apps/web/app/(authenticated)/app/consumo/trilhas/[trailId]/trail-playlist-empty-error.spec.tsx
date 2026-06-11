/**
 * trail-playlist-empty-error.spec.tsx — T10, T11
 * Ref: tasks.md §4.3.4, §4.4.4, spec §FR-014.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { TrailPlaylistEmpty } from './trail-playlist-empty';
import { TrailPlaylistError } from './trail-playlist-error';

// ---------------------------------------------------------------------------
// T10: empty state
// ---------------------------------------------------------------------------

describe('TrailPlaylistEmpty — T10', () => {
  it('renders pastoral empty title and body', () => {
    render(<TrailPlaylistEmpty />);
    // Title from pt-BR.json: "Trilha sem conteúdo"
    expect(screen.getByText('Trilha sem conteúdo')).toBeTruthy();
    // Body from pt-BR.json
    expect(screen.getByText(/Aguarde novas aulas/i)).toBeTruthy();
  });

  it('has role=status for screen reader announcement', () => {
    render(<TrailPlaylistEmpty />);
    const el = screen.getByRole('status');
    expect(el).toBeTruthy();
  });

  it('no axe violations', async () => {
    const { container } = render(<TrailPlaylistEmpty />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// T11: error state + retry
// ---------------------------------------------------------------------------

describe('TrailPlaylistError — T11', () => {
  it('renders pastoral error message', () => {
    render(<TrailPlaylistError onRetry={vi.fn()} />);
    expect(screen.getByText(/Não foi possível carregar/i)).toBeTruthy();
  });

  it('renders retry button', () => {
    render(<TrailPlaylistError onRetry={vi.fn()} />);
    expect(screen.getByTestId('trail-playlist-retry')).toBeTruthy();
  });

  it('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    render(<TrailPlaylistError onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId('trail-playlist-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has role=alert for screen reader announcement', () => {
    render(<TrailPlaylistError onRetry={vi.fn()} />);
    const el = screen.getByRole('alert');
    expect(el).toBeTruthy();
  });

  it('retry button has min-h-11 touch target', () => {
    render(<TrailPlaylistError onRetry={vi.fn()} />);
    const btn = screen.getByTestId('trail-playlist-retry');
    expect(btn.className).toContain('min-h-11');
  });

  it('no axe violations', async () => {
    const { container } = render(<TrailPlaylistError onRetry={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
