import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { TrailCard } from './trail-card';
import type { MyTrailItem } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseTrail: MyTrailItem = {
  id: '018e6b1c-0000-7000-8000-000000000001',
  name: 'Discipulado Básico',
  description: 'Fundamentos da fé cristã.',
  moduleCount: 3,
  lessonCount: 12,
  progressPercent: 50,
  status: 'in_progress',
  lastActivity: '2026-06-10T14:30:00.000Z',
};

const notStartedTrail: MyTrailItem = {
  ...baseTrail,
  id: '018e6b1c-0000-7000-8000-000000000002',
  progressPercent: 0,
  status: 'not_started',
  lastActivity: null,
  description: null,
};

const completedTrail: MyTrailItem = {
  ...baseTrail,
  id: '018e6b1c-0000-7000-8000-000000000003',
  progressPercent: 100,
  status: 'completed',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrailCard', () => {
  it('renders trail name', () => {
    render(<TrailCard trail={baseTrail} />);
    expect(screen.getByText('Discipulado Básico')).toBeTruthy();
  });

  it('renders description when present', () => {
    render(<TrailCard trail={baseTrail} />);
    expect(screen.getByText('Fundamentos da fé cristã.')).toBeTruthy();
  });

  it('does not render description when null', () => {
    render(<TrailCard trail={notStartedTrail} />);
    expect(screen.queryByText('Fundamentos da fé cristã.')).toBeNull();
  });

  it('renders module and lesson counts', () => {
    render(<TrailCard trail={baseTrail} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('renders progress bar', () => {
    render(<TrailCard trail={baseTrail} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeTruthy();
    expect(progressbar.getAttribute('aria-valuenow')).toBe('50');
  });

  it('renders "Em Andamento" badge for in_progress', () => {
    render(<TrailCard trail={baseTrail} />);
    expect(screen.getByText('Em Andamento')).toBeTruthy();
  });

  it('renders "Não Iniciada" badge for not_started', () => {
    render(<TrailCard trail={notStartedTrail} />);
    expect(screen.getByText('Não Iniciada')).toBeTruthy();
  });

  it('renders "Concluída" badge for completed', () => {
    render(<TrailCard trail={completedTrail} />);
    expect(screen.getByText('Concluída')).toBeTruthy();
  });

  it('renders last activity date when present', () => {
    render(<TrailCard trail={baseTrail} />);
    expect(screen.getByText(/Última atividade/)).toBeTruthy();
  });

  it('does not render last activity when null', () => {
    render(<TrailCard trail={notStartedTrail} />);
    expect(screen.queryByText(/Última atividade/)).toBeNull();
  });

  it('calls onClick when button is clicked', () => {
    const onClick = vi.fn();
    render(<TrailCard trail={baseTrail} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir trilha/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('passes jest-axe accessibility checks', async () => {
    const { container } = render(<TrailCard trail={baseTrail} onClick={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('no role=article on interactive element (regression Cenário 06 Session 5)', () => {
    const { container } = render(<TrailCard trail={baseTrail} />);
    const invalid = container.querySelectorAll('a[role="article"], button[role="article"]');
    expect(invalid.length).toBe(0);
  });
});
