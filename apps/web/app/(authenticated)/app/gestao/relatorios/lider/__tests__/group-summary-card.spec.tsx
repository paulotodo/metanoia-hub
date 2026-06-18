import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { GroupSummaryCard } from '../_components/group-summary-card';
import type { LeaderGroupMetrics } from '@metanoia/types';

expect.extend(toHaveNoViolations);

const t = {
  attendance: 'Frequência',
  trailProgress: 'Progresso',
  atRisk: 'em acompanhamento',
  atRiskZero: 'Todos bem',
  participants: 'Participantes',
  noMeetings: 'Sem reuniões no período',
};

const groupOk: LeaderGroupMetrics = {
  groupId: '018e3a00-0000-7000-8000-000000000001',
  groupName: 'Células Norte',
  avgAttendancePercent: 80,
  avgTrailProgressPercent: 65,
  atRiskCount: 0,
  activeParticipantsCount: 12,
};

const groupAtRisk: LeaderGroupMetrics = {
  ...groupOk,
  groupName: 'Células Sul',
  atRiskCount: 4,
  avgAttendancePercent: null,
};

describe('GroupSummaryCard', () => {
  it('renders group name and metrics', () => {
    render(<GroupSummaryCard group={groupOk} t={t} />);
    expect(screen.getByRole('article', { name: 'Células Norte' })).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('65%')).toBeTruthy();
  });

  it('shows "Todos bem" badge when atRiskCount is 0', () => {
    render(<GroupSummaryCard group={groupOk} t={t} />);
    expect(screen.getByLabelText('Todos bem')).toBeTruthy();
  });

  it('shows atRisk count badge with icon when count > 0', () => {
    render(<GroupSummaryCard group={groupAtRisk} t={t} />);
    expect(screen.getByLabelText('4 em acompanhamento')).toBeTruthy();
  });

  it('shows "—" and noMeetings text when avgAttendancePercent is null', () => {
    render(<GroupSummaryCard group={groupAtRisk} t={t} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText(t.noMeetings)).toBeTruthy();
  });

  it('has no axe accessibility violations (at-risk state)', async () => {
    const { container } = render(<GroupSummaryCard group={groupAtRisk} t={t} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe accessibility violations (ok state)', async () => {
    const { container } = render(<GroupSummaryCard group={groupOk} t={t} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
