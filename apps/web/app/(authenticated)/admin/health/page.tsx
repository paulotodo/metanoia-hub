'use client';

import messages from '../../../../messages/pt-BR.json';
import { HealthDashboard } from './_components/health-dashboard';

/**
 * Página de health check de integrações — Super Admin only.
 * Client Component: usa TanStack Query (CLAUDE.md: SSR para landing/pricing/blog;
 * CSR para área autenticada).
 *
 * Story 14-4 §FR-010, §NFR-I5.
 * A autorização é feita pelo backend (GET /api/v1/admin/health/integrations → 403).
 * O frontend exibe o dashboard assumindo que o usuário é Super Admin (route guard no layout).
 */
export default function AdminHealthPage() {
  const m = messages.health.integrations;

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{m.title}</h1>
        <p className="text-muted-foreground mt-1">{m.subtitle}</p>
      </header>

      <HealthDashboard />
    </main>
  );
}
