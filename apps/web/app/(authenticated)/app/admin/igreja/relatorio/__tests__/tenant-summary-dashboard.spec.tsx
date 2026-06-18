/**
 * tenant-summary-dashboard.spec.tsx — Testes jest-axe do dashboard de relatório
 * por tenant (FASE 5.7 — Story 13.2b).
 *
 * Cobertura: axe (sem violações) nos estados loading/loaded; filtros com
 * labels associados; métricas renderizadas.
 *
 * Nota: o projeto NÃO usa jest-dom matchers — apenas jest-axe + asserções
 * nativas do vitest (getByX lança quando não encontra).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  TenantSummaryResponse,
  TenantGroupMetrics,
} from '@metanoia/types';

// ─── Mock do hook de dados (evita rede; controla estados) ─────────────────────
const mockUseTenantSummary = vi.fn();
const mockMutate = vi.fn();

vi.mock(
  '../../../../../../../src/lib/api/hooks/use-tenant-report',
  () => ({
    useTenantSummary: (q: unknown) => mockUseTenantSummary(q),
    useTenantRefresh: () => ({ mutate: mockMutate, isPending: false }),
  }),
);

import { TenantSummaryDashboard } from '../tenant-summary-dashboard';

const sampleGroup: TenantGroupMetrics = {
  groupId: '018f6a3c-1234-7000-8000-abc123456789',
  groupName: 'Grupo Alpha',
  leaderName: 'João Silva',
  attendanceAvgPercent: 75.5,
  trailProgressAvgPercent: 60,
  riskCount: 1,
  activeParticipants: 12,
  semaforo: 'amarelo',
};

const sampleData: TenantSummaryResponse = {
  data: {
    groups: [sampleGroup],
    summary: {
      totalGroups: 1,
      totalLeaders: 1,
      totalParticipants: 12,
      overallAttendancePercent: 75.5,
      overallTrailProgressPercent: 60,
      totalRiskCount: 1,
    },
  },
  meta: {
    period: '30d',
    startDate: null,
    endDate: null,
    lastRefreshAt: '2026-06-17T10:00:00.000Z',
    stale: false,
    fromMaterializedView: true,
  },
};

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TenantSummaryDashboard />
    </QueryClientProvider>,
  );
}

function setData(over: Record<string, unknown> = {}) {
  mockUseTenantSummary.mockReturnValue({
    isPending: false,
    isError: false,
    isFetching: false,
    data: sampleData,
    refetch: vi.fn(),
    ...over,
  });
}

describe('TenantSummaryDashboard — acessibilidade (jest-axe)', () => {
  beforeEach(() => {
    mockUseTenantSummary.mockReset();
    mockMutate.mockReset();
  });

  it('renderiza sem violações axe no estado carregado', async () => {
    setData();
    const { container } = renderDashboard();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renderiza sem violações axe no estado de loading', async () => {
    setData({ isPending: true, isFetching: true, data: undefined });
    const { container } = renderDashboard();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('exibe os filtros com labels associados', () => {
    setData();
    renderDashboard();
    // getByLabelText resolve o <select> associado via htmlFor/id; lança se faltar
    expect(screen.getByLabelText('Período')).toBeTruthy();
    expect(screen.getByLabelText('Grupo')).toBeTruthy();
    expect(screen.getByLabelText('Sinal pastoral')).toBeTruthy();
  });

  it('exibe a métrica do grupo na tabela', () => {
    setData();
    renderDashboard();
    // 'Grupo Alpha' aparece no <option> do filtro E na célula (th) da tabela
    expect(screen.getByRole('rowheader', { name: 'Grupo Alpha' })).toBeTruthy();
    expect(screen.getByText('João Silva')).toBeTruthy();
  });
});
