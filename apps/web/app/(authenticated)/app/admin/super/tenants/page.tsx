'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { TenantPlan, TenantStatus } from '@metanoia/types';
import { useSuperAdminTenants } from '@/lib/api/hooks/use-super-admin-tenants';
import { TenantStatusBadge } from '@/components/super-admin/tenant-status-badge';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.superAdmin.tenants;

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso)).replace('.', '');
}

export default function SuperAdminTenantsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TenantStatus | ''>('');
  const [plan, setPlan] = useState<TenantPlan | ''>('');

  const query = useSuperAdminTenants({ page, search, status, plan });

  return (
    <section className="py-6">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1
          data-testid="super-tenants-title"
          className="text-[24px] font-bold leading-tight text-[var(--color-text-primary)]"
        >
          {t.title}
        </h1>
        <Link
          data-testid="super-tenants-new"
          href="/app/admin/super/tenants/novo"
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-brand-teal)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-teal)]"
        >
          + {t.newTenant}
        </Link>
      </header>

      <div className="mb-3">
        <label className="block">
          <span className="sr-only">{t.search.placeholder}</span>
          <input
            data-testid="super-tenants-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t.search.placeholder}
            className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:border-[var(--color-brand-teal)] focus-visible:outline-none"
          />
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
            {t.filter.status.label}
          </span>
          <select
            data-testid="super-tenants-filter-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as TenantStatus | '');
              setPage(1);
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">{t.filter.status.all}</option>
            <option value="active">{t.filter.status.active}</option>
            <option value="suspended">{t.filter.status.suspended}</option>
            <option value="provisioning_failed">
              {t.filter.status.failed}
            </option>
            <option value="provisioning">
              {t.filter.status.provisioning}
            </option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
            {t.filter.plan.label}
          </span>
          <select
            data-testid="super-tenants-filter-plan"
            value={plan}
            onChange={(event) => {
              setPlan(event.target.value as TenantPlan | '');
              setPage(1);
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">{t.filter.plan.all}</option>
            <option value="free">{t.filter.plan.free}</option>
            <option value="pro">{t.filter.plan.pro}</option>
            <option value="enterprise">{t.filter.plan.enterprise}</option>
          </select>
        </label>
      </div>

      {query.isPending ? (
        <div
          data-testid="super-tenants-skeleton"
          aria-busy="true"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--color-text-muted)]"
        >
          ...
        </div>
      ) : query.isError ? (
        <div
          data-testid="super-tenants-error"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--color-text-muted)]"
        >
          <p>{t.error.network}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-2 text-sm font-medium text-[var(--color-brand-teal)] underline"
          >
            {t.error.retry}
          </button>
        </div>
      ) : query.data.data.length === 0 ? (
        <div
          data-testid="super-tenants-empty"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--color-text-muted)]"
        >
          {t.empty}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <table
              data-testid="super-tenants-table"
              className="w-full text-left text-sm"
            >
              <thead className="border-b border-[var(--border)] bg-[var(--background)]">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.table.name}
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.table.slug}
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.table.plan}
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.table.status}
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.table.members}
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {t.table.created}
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((tenant) => (
                  <tr
                    key={tenant.id}
                    data-testid={`super-tenants-row-${tenant.id}`}
                    className="border-b border-[var(--border)] last:border-0 transition hover:bg-[var(--background)]"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/app/admin/super/tenants/${tenant.id}`}
                        className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-brand-teal)]"
                      >
                        {tenant.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-muted)]">
                      {tenant.slug}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-muted)]">
                      {t.filter.plan[tenant.plan]}
                    </td>
                    <td className="px-3 py-3">
                      <TenantStatusBadge status={tenant.status} />
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-primary)]">
                      {tenant.memberCount}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-muted)]">
                      {formatDate(tenant.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
            <span data-testid="super-tenants-pagination">
              {t.pagination
                .replace(
                  '{from}',
                  String(
                    (query.data.meta.page - 1) * query.data.meta.limit + 1,
                  ),
                )
                .replace(
                  '{to}',
                  String(
                    Math.min(
                      query.data.meta.page * query.data.meta.limit,
                      query.data.meta.total,
                    ),
                  ),
                )
                .replace('{total}', String(query.data.meta.total))}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="super-tenants-page-prev"
                disabled={query.data.meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-[var(--border)] px-2 py-1 text-sm disabled:opacity-40"
              >
                ←
              </button>
              <span>
                {query.data.meta.page} / {query.data.meta.totalPages}
              </span>
              <button
                type="button"
                data-testid="super-tenants-page-next"
                disabled={
                  query.data.meta.page >= query.data.meta.totalPages
                }
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-[var(--border)] px-2 py-1 text-sm disabled:opacity-40"
              >
                →
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
