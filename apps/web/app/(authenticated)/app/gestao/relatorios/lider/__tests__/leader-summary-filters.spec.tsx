import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LeaderSummaryFilters } from '../_components/leader-summary-filters';

expect.extend(toHaveNoViolations);

const tFilters = {
  period: 'Período',
  periodOptions: {
    '7d': 'Últimos 7 dias',
    '30d': 'Últimos 30 dias',
    '90d': 'Últimos 90 dias',
    custom: 'Personalizado',
  },
  allGroups: 'Todos os grupos',
  startDate: 'De',
  endDate: 'Até',
  filterLabel: 'Filtros do relatório',
};

const groups = [
  { groupId: 'g1', groupName: 'Células Norte' },
  { groupId: 'g2', groupName: 'Células Sul' },
];

describe('LeaderSummaryFilters', () => {
  it('renders period selector with all options', () => {
    render(
      <LeaderSummaryFilters
        period="30d"
        groups={groups}
        onPeriodChange={vi.fn()}
        onDateRangeChange={vi.fn()}
        onGroupChange={vi.fn()}
        t={tFilters}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Período' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Últimos 7 dias' })).toBeTruthy();
  });

  it('renders group filter when groups are provided', () => {
    render(
      <LeaderSummaryFilters
        period="30d"
        groups={groups}
        onPeriodChange={vi.fn()}
        onDateRangeChange={vi.fn()}
        onGroupChange={vi.fn()}
        t={tFilters}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Todos os grupos' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Células Norte' })).toBeTruthy();
  });

  it('shows date inputs when period is custom', () => {
    render(
      <LeaderSummaryFilters
        period="custom"
        startDate="2026-01-01T00:00:00.000Z"
        endDate="2026-03-31T23:59:59.999Z"
        groups={groups}
        onPeriodChange={vi.fn()}
        onDateRangeChange={vi.fn()}
        onGroupChange={vi.fn()}
        t={tFilters}
      />,
    );
    expect(screen.getByLabelText('De')).toBeTruthy();
    expect(screen.getByLabelText('Até')).toBeTruthy();
  });

  it('calls onPeriodChange when period is changed', () => {
    const onPeriodChange = vi.fn();
    render(
      <LeaderSummaryFilters
        period="30d"
        groups={[]}
        onPeriodChange={onPeriodChange}
        onDateRangeChange={vi.fn()}
        onGroupChange={vi.fn()}
        t={tFilters}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Período' }), {
      target: { value: '7d' },
    });
    expect(onPeriodChange).toHaveBeenCalledWith('7d');
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(
      <LeaderSummaryFilters
        period="30d"
        groups={groups}
        onPeriodChange={vi.fn()}
        onDateRangeChange={vi.fn()}
        onGroupChange={vi.fn()}
        t={tFilters}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
