/**
 * skip-nav.spec.tsx — Unit tests for SkipNav component
 * Ref: tasks.md §1.1.5, US1, FR-001
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipNav } from '../skip-nav';

describe('<SkipNav />', () => {
  it('renders a visible DOM element (anchor tag)', () => {
    render(<SkipNav />);
    const link = screen.getByRole('link', { name: /ir para o conteúdo/i });
    expect(link).toBeTruthy();
  });

  it('has href="#conteudo" pointing to main content anchor', () => {
    render(<SkipNav />);
    const link = screen.getByRole('link', { name: /ir para o conteúdo/i });
    expect(link.getAttribute('href')).toBe('#conteudo');
  });

  it('has skip-nav CSS class applied', () => {
    render(<SkipNav />);
    const link = screen.getByRole('link', { name: /ir para o conteúdo/i });
    expect(link.className).toContain('skip-nav');
  });

  it('is positioned absolutely (z-[9999] class present)', () => {
    render(<SkipNav />);
    const link = screen.getByRole('link', { name: /ir para o conteúdo/i });
    expect(link.className).toContain('z-[9999]');
  });

  it('has focus-visible:translate-y-0 class for keyboard reveal', () => {
    render(<SkipNav />);
    const link = screen.getByRole('link', { name: /ir para o conteúdo/i });
    expect(link.className).toContain('focus-visible:translate-y-0');
  });

  it('contains PT-BR text (pastoral vocabulary)', () => {
    render(<SkipNav />);
    // Verify user-facing text is in PT-BR (CLAUDE.md rule)
    expect(screen.getByText(/ir para o conteúdo/i)).toBeTruthy();
  });
});
