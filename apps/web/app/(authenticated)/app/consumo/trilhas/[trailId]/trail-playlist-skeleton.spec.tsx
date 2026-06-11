/**
 * trail-playlist-skeleton.spec.tsx — T9
 * Ref: tasks.md §4.2.4, spec §FR-007, FR-008.
 */

import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { TrailPlaylistSkeleton } from './trail-playlist-skeleton';

describe('TrailPlaylistSkeleton — T9', () => {
  it('renders skeleton without crashing', () => {
    const { container } = render(<TrailPlaylistSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('T9-no-text: skeleton renders no real text content (prevents CLS shift from text)', () => {
    render(<TrailPlaylistSkeleton />);
    // No semantic text nodes that would indicate real content loaded
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('T9-animate-pulse: skeleton elements have animate-pulse class for visual loading', () => {
    const { container } = render(<TrailPlaylistSkeleton />);
    // At least one element with animate-pulse (motion-safe:animate-pulse counts)
    const pulseEls = container.querySelectorAll('[class*="animate-pulse"]');
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it('T9-axe: no accessibility violations in skeleton state', async () => {
    const { container } = render(<TrailPlaylistSkeleton />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
