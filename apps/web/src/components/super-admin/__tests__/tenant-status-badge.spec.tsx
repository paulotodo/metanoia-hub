import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TenantStatusBadge } from '../tenant-status-badge';

describe('TenantStatusBadge', () => {
  it.each([
    ['active', 'Ativo'],
    ['suspended', 'Suspenso'],
    ['provisioning_failed', 'Prov. falhou'],
    ['provisioning', 'Provisionando...'],
  ] as const)('renders %s status with PT-BR label "%s"', (status, label) => {
    render(<TenantStatusBadge status={status} />);
    expect(
      screen.getByTestId(`tenant-status-${status}`).textContent,
    ).toContain(label);
  });
});
