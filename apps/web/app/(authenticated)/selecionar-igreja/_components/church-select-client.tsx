'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useMyTenants, useSelectTenant } from '@/lib/api/hooks';
import { useActiveTenantId } from '@/lib/tenant/use-active-tenant-id';
import { ChurchCard } from './church-card';
import messages from '../../../../messages/pt-BR.json';

const t = messages.churchSelect;

export function ChurchSelectClient() {
  const router = useRouter();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  // hasFired prevents the auto-select useEffect from firing more than once
  // across re-renders (using a ref, not state, to avoid triggering another
  // render cycle). See spec FR-001–FR-004, research.md Decision 2.
  const hasFired = useRef<boolean>(false);

  const myTenants = useMyTenants();
  const selectTenant = useSelectTenant();
  const { setActiveTenantId } = useActiveTenantId();

  function handleSelect(tenantId: string) {
    setSelectingId(tenantId);
    selectTenant.mutate(
      { tenantId },
      {
        onSuccess: (data) => {
          setActiveTenantId(data.tenantId);
          router.push('/app/gestao');
        },
        onError: () => {
          setSelectingId(null);
        },
      },
    );
  }

  // Auto-select: when the tenant list resolves to exactly one tenant, skip
  // the selection screen and go straight to the dashboard (FR-001, FR-003).
  // Uses the same handleSelect path as manual selection (no bypass).
  useEffect(() => {
    if (hasFired.current) return;
    if (myTenants.isSuccess && myTenants.data?.length === 1) {
      hasFired.current = true;
      handleSelect(myTenants.data[0].tenantId);
    }
  }, [myTenants.isSuccess, myTenants.data]);

  if (myTenants.isPending) {
    return (
      <p
        role="status"
        data-testid="church-select-loading"
        className="text-center text-sm text-[var(--color-text-muted)]"
      >
        {t.loading}
      </p>
    );
  }

  if (myTenants.isError) {
    return (
      <div
        role="alert"
        data-testid="church-select-error"
        className="flex flex-col gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--card)] p-4 text-sm text-[var(--color-text-primary)]"
      >
        <p>{t.error.network}</p>
        <button
          type="button"
          onClick={() => myTenants.refetch()}
          className="self-start text-sm font-semibold text-[var(--color-brand-teal)] underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const tenants = myTenants.data ?? [];
  const isMutating = selectTenant.isPending;

  // During auto-select (single tenant, mutation in flight), show a dedicated
  // loading message instead of a brief flash of the selection list (FR-002).
  if (tenants.length === 1 && isMutating) {
    return (
      <p
        role="status"
        data-testid="church-auto-select-loading"
        className="text-center text-sm text-[var(--color-text-muted)]"
      >
        {t.autoSelectLoading}
      </p>
    );
  }

  return (
    <ul
      data-testid="church-select-list"
      className="flex flex-col gap-3"
    >
      {tenants.map((tenant) => (
        <li key={tenant.tenantId}>
          <ChurchCard
            tenant={tenant}
            isSelecting={selectingId === tenant.tenantId && isMutating}
            disabled={isMutating}
            onSelect={handleSelect}
          />
        </li>
      ))}
    </ul>
  );
}
