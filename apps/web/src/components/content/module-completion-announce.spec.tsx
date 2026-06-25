import { render, screen, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { ModuleCompletionAnnounce } from './module-completion-announce';

describe('ModuleCompletionAnnounce', () => {
  it('renders with role=status and aria-live=polite', () => {
    const { container } = render(<ModuleCompletionAnnounce message="" />);
    const region = container.querySelector('[role="status"]');
    expect(region).toBeTruthy();
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
  });

  it('is always present in DOM (static region)', () => {
    const { container } = render(<ModuleCompletionAnnounce message="" />);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('has sr-only class for visual hiding', () => {
    const { container } = render(<ModuleCompletionAnnounce message="" />);
    const region = container.querySelector('[role="status"]');
    expect(region?.className).toContain('sr-only');
  });

  it('shows message when message prop is non-empty', () => {
    render(<ModuleCompletionAnnounce message="Módulo Oração concluído! Progresso na trilha: 75%" />);
    expect(screen.getByText('Módulo Oração concluído! Progresso na trilha: 75%')).toBeTruthy();
  });

  it('renders empty container when message is empty string', () => {
    const { container } = render(<ModuleCompletionAnnounce message="" />);
    const region = container.querySelector('[role="status"]');
    expect(region?.textContent).toBe('');
  });

  it('clears message after ~3s', async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<ModuleCompletionAnnounce message="" />);
      rerender(<ModuleCompletionAnnounce message="Módulo concluído!" />);
      expect(screen.getByText('Módulo concluído!')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(3001);
      });

      expect(screen.queryByText('Módulo concluído!')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes jest-axe accessibility check', async () => {
    const { container } = render(<ModuleCompletionAnnounce message="Teste de anúncio" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 10000);
});
