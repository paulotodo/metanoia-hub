import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParticipantGroupSummary } from '@metanoia/types';
import { ParticipantGroupCard } from '../participant-group-card';

function makeGroup(
  overrides: Partial<ParticipantGroupSummary> = {},
): ParticipantGroupSummary {
  return {
    id: '019756c0-2000-7000-8000-000000000001',
    name: 'Fundamentos da Fé',
    leader: { firstName: 'Marcos', avatarUrl: null },
    nextMeeting: {
      startsAt: '2026-04-21T22:00:00.000Z',
      dayOfWeek: 'tue',
      time: '19:00',
      location: null,
    },
    ...overrides,
  };
}

describe('ParticipantGroupCard', () => {
  it('renders name, leader, schedule and view call-to-action', () => {
    render(
      <ParticipantGroupCard
        group={makeGroup()}
        scheduleText="Terças, 19h"
      />,
    );
    expect(screen.getByRole('article', { name: 'Fundamentos da Fé' })).toBeTruthy();
    expect(screen.getByText('Líder: Marcos')).toBeTruthy();
    expect(screen.getByText('Terças, 19h')).toBeTruthy();
    expect(screen.getByText('Ver meu grupo →')).toBeTruthy();
  });

  it('omits schedule line when scheduleText is empty', () => {
    render(<ParticipantGroupCard group={makeGroup({ nextMeeting: null })} scheduleText="" />);
    expect(screen.queryByText(/\d+h/)).toBeNull();
  });

  it('links to the group detail route', () => {
    render(<ParticipantGroupCard group={makeGroup()} scheduleText="Terças, 19h" />);
    const link = screen.getByRole('article', { name: 'Fundamentos da Fé' });
    expect(link.getAttribute('href')).toBe(
      '/app/consumo/grupos/019756c0-2000-7000-8000-000000000001',
    );
  });
});
