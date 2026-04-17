import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { UserTenant } from '@metanoia/types';
import { ChurchCard } from '../church-card';

const tenantLeader: UserTenant = {
  tenantId: '019756d0-0001-7000-8000-000000000001',
  churchName: 'Igreja Batista Central',
  userRole: 'leader',
  lastVisit: '2026-04-16T18:00:00.000Z',
};

const tenantFirstVisit: UserTenant = {
  tenantId: '019756d0-0001-7000-8000-000000000003',
  churchName: 'Igreja da Vila',
  userRole: 'participant',
  lastVisit: null,
};

describe('ChurchCard', () => {
  it('renders church name, role label and last visit', () => {
    render(
      <ChurchCard
        tenant={tenantLeader}
        isSelecting={false}
        disabled={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('Igreja Batista Central')).toBeDefined();
    expect(screen.getByText('Líder')).toBeDefined();
    expect(screen.getByText(/Última visita:/)).toBeDefined();
  });

  it('renders "Primeira visita" when lastVisit is null', () => {
    render(
      <ChurchCard
        tenant={tenantFirstVisit}
        isSelecting={false}
        disabled={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('Primeira visita')).toBeDefined();
    expect(screen.getByText('Participante')).toBeDefined();
  });

  it('calls onSelect with tenantId when clicked', () => {
    const onSelect = vi.fn();
    render(
      <ChurchCard
        tenant={tenantLeader}
        isSelecting={false}
        disabled={false}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(tenantLeader.tenantId);
  });

  it('sets accessible label with church name and role', () => {
    render(
      <ChurchCard
        tenant={tenantLeader}
        isSelecting={false}
        disabled={false}
        onSelect={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', {
        name: 'Entrar em Igreja Batista Central como Líder',
      }),
    ).toBeDefined();
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <ChurchCard
        tenant={tenantLeader}
        isSelecting={false}
        disabled
        onSelect={() => {}}
      />,
    );
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders spinner while isSelecting is true', () => {
    render(
      <ChurchCard
        tenant={tenantLeader}
        isSelecting
        disabled
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId('church-card-spinner')).toBeDefined();
  });
});
