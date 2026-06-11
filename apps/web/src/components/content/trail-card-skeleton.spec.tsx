import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import { TrailCardSkeleton, TrailCardSkeletonList } from './trail-card-skeleton';

describe('TrailCardSkeleton', () => {
  it('renders with aria-busy=true', () => {
    render(<TrailCardSkeleton />);
    // Check aria-busy on the container
    const container = document.querySelector('[aria-busy="true"]');
    expect(container).not.toBeNull();
  });

  it('passes jest-axe accessibility checks', async () => {
    const { container } = render(<TrailCardSkeleton />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('TrailCardSkeletonList', () => {
  it('renders 3 skeletons by default', () => {
    render(<TrailCardSkeletonList />);
    const items = document.querySelectorAll('[aria-busy="true"]');
    expect(items.length).toBe(3);
  });

  it('renders custom count', () => {
    render(<TrailCardSkeletonList count={5} />);
    const items = document.querySelectorAll('[aria-busy="true"]');
    expect(items.length).toBe(5);
  });

  it('passes jest-axe accessibility checks', async () => {
    const { container } = render(<TrailCardSkeletonList />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
