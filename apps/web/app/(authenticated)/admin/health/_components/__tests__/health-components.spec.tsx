/**
 * Testes unitários dos componentes de health check (Story 14-4 §FR-010)
 * NFR-TEST-001: hooks mockados — NUNCA bater na API real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { IntegrationHealthItem, IntegrationHealthHistoryPoint } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Mock de next-intl para não precisar de provider completo
// ---------------------------------------------------------------------------

vi.mock('next-intl', () => ({
  useTranslations: vi.fn().mockReturnValue((key: string, params?: Record<string, unknown>) => {
    const messages: Record<string, string> = {
      'health.integrations.status.healthy': 'Saudável',
      'health.integrations.status.degraded': 'Degradado',
      'health.integrations.status.unhealthy': 'Indisponível',
      'health.integrations.lastUpdated': `Atualizado há ${params?.['seconds'] ?? 0} segundos`,
      'health.integrations.staleWarning': 'Dados podem estar desatualizados',
      'health.integrations.fetchError': 'Não foi possível carregar os dados de saúde',
      'health.integrations.retry': 'Tentar novamente',
      'health.integrations.allUnhealthy': 'Todas as integrações estão indisponíveis',
    };
    return messages[key] ?? key;
  }),
}));

// ---------------------------------------------------------------------------
// Mock dos hooks
// ---------------------------------------------------------------------------

vi.mock('../../_hooks/use-integration-health', () => ({
  useIntegrationHealth: vi.fn().mockReturnValue({
    data: null,
    isLoading: true,
    isError: false,
    dataUpdatedAt: 0,
    refetch: vi.fn(),
  }),
  useIntegrationHistory: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockItem: IntegrationHealthItem = {
  name: 'Redis',
  status: 'healthy',
  latencyMs: 2,
  lastChecked: new Date().toISOString(),
};

const mockHistory: IntegrationHealthHistoryPoint[] = [
  { checkedAt: new Date().toISOString(), status: 'healthy', latencyMs: 2 },
  { checkedAt: new Date(Date.now() - 300_000).toISOString(), status: 'degraded', latencyMs: 2500 },
];

// ---------------------------------------------------------------------------
// LatencySparkline
// ---------------------------------------------------------------------------

describe('LatencySparkline', () => {
  it('(b) renderiza SVG com role="img" e aria-label quando data.length > 0', async () => {
    const { LatencySparkline } = await import('../latency-sparkline');
    render(<LatencySparkline data={mockHistory} integrationName="Redis" />);

    const svg = screen.getByRole('img');
    expect(svg).toBeDefined();
    expect(svg.tagName).toBe('svg');
  });

  it('(c) renderiza empty state quando data.length === 0', async () => {
    const { LatencySparkline } = await import('../latency-sparkline');
    render(<LatencySparkline data={[]} integrationName="Redis" />);

    const msg = screen.getByRole('status');
    expect(msg.textContent).toContain('Sem histórico');
  });
});

// ---------------------------------------------------------------------------
// IntegrationHealthCard
// ---------------------------------------------------------------------------

describe('IntegrationHealthCard', () => {
  const onOpenHistory = vi.fn();

  it('(a) renderiza badge com texto correto para status healthy', async () => {
    const { IntegrationHealthCard } = await import('../integration-health-card');
    render(
      <IntegrationHealthCard
        item={{ ...mockItem, status: 'healthy' }}
        onOpenHistory={onOpenHistory}
      />,
    );
    expect(screen.getByText('Saudável')).toBeDefined();
  });

  it('(a2) renderiza badge com texto correto para status degraded', async () => {
    const { IntegrationHealthCard } = await import('../integration-health-card');
    render(
      <IntegrationHealthCard
        item={{ ...mockItem, status: 'degraded' }}
        onOpenHistory={onOpenHistory}
      />,
    );
    expect(screen.getByText('Degradado')).toBeDefined();
  });

  it('(a3) renderiza badge com texto correto para status unhealthy', async () => {
    const { IntegrationHealthCard } = await import('../integration-health-card');
    render(
      <IntegrationHealthCard
        item={{ ...mockItem, status: 'unhealthy' }}
        onOpenHistory={onOpenHistory}
      />,
    );
    expect(screen.getByText('Indisponível')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// HealthDashboard
// ---------------------------------------------------------------------------

describe('HealthDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(d) mostra skeleton durante loading', async () => {
    const { useIntegrationHealth } = await import('../../_hooks/use-integration-health');
    (useIntegrationHealth as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null, isLoading: true, isError: false, dataUpdatedAt: 0, refetch: vi.fn(),
    });

    const { HealthDashboard } = await import('../health-dashboard');
    const { container } = render(<HealthDashboard />);
    // 5 skeleton divs com animate-pulse
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(5);
  });

  it('(d2) mostra stale banner quando dados > 2min', async () => {
    const { useIntegrationHealth } = await import('../../_hooks/use-integration-health');
    (useIntegrationHealth as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { data: { integrations: [mockItem], summary: { total: 1, healthy: 1, degraded: 0, unhealthy: 0 } } },
      isLoading: false,
      isError: false,
      dataUpdatedAt: Date.now() - 3 * 60 * 1000, // 3 min atrás
      refetch: vi.fn(),
    });

    const { HealthDashboard } = await import('../health-dashboard');
    render(<HealthDashboard />);
    expect(screen.getByText(/Dados podem estar desatualizados/)).toBeDefined();
  });

  it('(e) mostra alerta crítico quando todas unhealthy', async () => {
    const { useIntegrationHealth } = await import('../../_hooks/use-integration-health');
    const unhealthyItems = ['Resend', 'Keycloak', 'MinIO', 'Redis', 'PostgreSQL'].map((name) => ({
      name, status: 'unhealthy' as const, latencyMs: null, lastChecked: new Date().toISOString(),
    }));

    (useIntegrationHealth as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        data: {
          integrations: unhealthyItems,
          summary: { total: 5, healthy: 0, degraded: 0, unhealthy: 5 },
        },
      },
      isLoading: false,
      isError: false,
      dataUpdatedAt: Date.now(),
      refetch: vi.fn(),
    });

    const { HealthDashboard } = await import('../health-dashboard');
    render(<HealthDashboard />);
    expect(screen.getByText(/todas as integrações estão indisponíveis/i)).toBeDefined();
  });
});
