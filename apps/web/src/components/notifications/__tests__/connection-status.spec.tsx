import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionStatus } from '../connection-status';

// Mock pt-BR.json for the component
vi.mock('../../../messages/pt-BR.json', () => ({
  default: {
    notificationCenter: {
      connection: {
        reconnecting: 'Reconectando...',
        offline: 'Sem conexão. Notificações podem estar atrasadas.',
        retryNow: 'Tentar agora',
        authError: 'Sessão expirada. Faça login novamente.',
        authErrorLink: 'Fazer login',
      },
    },
  },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; className?: string }) =>
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a href={href} {...rest}>{children}</a>,
}));

import * as React from 'react';

describe('ConnectionStatus', () => {
  it('connected → renderiza null (sem DOM)', () => {
    const { container } = render(
      <ConnectionStatus connectionState="connected" onRetry={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('reconnecting → exibe "Reconectando..." com aria-live="polite"', () => {
    render(<ConnectionStatus connectionState="reconnecting" onRetry={vi.fn()} />);
    expect(screen.getByText('Reconectando...')).toBeTruthy();
    const liveRegion = screen.getByText('Reconectando...').closest('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
  });

  it('extended-outage → exibe mensagem de outage + botão "Tentar agora"', () => {
    render(<ConnectionStatus connectionState="extended-outage" onRetry={vi.fn()} />);
    expect(screen.getByText('Sem conexão. Notificações podem estar atrasadas.')).toBeTruthy();
    const btn = screen.getByRole('button', { name: 'Tentar agora' });
    expect(btn).toBeTruthy();
  });

  it('clique em "Tentar agora" chama onRetry 1×', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ConnectionStatus connectionState="extended-outage" onRetry={onRetry} />);
    const btn = screen.getByRole('button', { name: 'Tentar agora' });
    await user.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('auth-error → exibe mensagem de sessão expirada + link de login', () => {
    render(<ConnectionStatus connectionState="auth-error" onRetry={vi.fn()} />);
    expect(screen.getByText('Sessão expirada. Faça login novamente.')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Fazer login' });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('botão "Tentar agora" tem type="button" explícito (CHK038)', () => {
    render(<ConnectionStatus connectionState="extended-outage" onRetry={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Tentar agora' });
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('container tem classe motion-safe:transition-all (CHK034)', () => {
    const { container } = render(
      <ConnectionStatus connectionState="reconnecting" onRetry={vi.fn()} />
    );
    const div = container.querySelector('[aria-live="polite"]');
    expect(div?.className).toContain('motion-safe:transition-all');
  });
});
