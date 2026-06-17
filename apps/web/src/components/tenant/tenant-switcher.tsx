'use client';

import { ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@metanoia/ui';
import type { UserTenant } from '@metanoia/types';
import { useMyTenants, useSelectTenant } from '@/lib/api/hooks';
import { useActiveTenantId } from '@/lib/tenant/use-active-tenant-id';
import messages from '../../../messages/pt-BR.json';

const tSwitcher = messages.switcher;
const tChurchSelect = messages.churchSelect;

interface TenantSwitcherProps {
  className?: string;
}

export function TenantSwitcher({ className }: TenantSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const myTenants = useMyTenants();
  const selectTenant = useSelectTenant();
  const { activeTenantId, setActiveTenantId } = useActiveTenantId();

  const tenants = myTenants.data ?? [];

  // Veto permanente: switcher escondido se <2 tenants
  if (tenants.length < 2) return null;

  const activeTenant: UserTenant | undefined =
    tenants.find((t) => t.tenantId === activeTenantId) ?? tenants[0];

  function handleSelect(tenantId: string) {
    if (tenantId === activeTenant?.tenantId) {
      setOpen(false);
      return;
    }
    setSelectingId(tenantId);
    selectTenant.mutate(
      { tenantId },
      {
        onSuccess: (data) => {
          setActiveTenantId(data.tenantId);
          void queryClient.invalidateQueries();
          setSelectingId(null);
          setOpen(false);
        },
        onError: () => {
          setSelectingId(null);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="tenant-switcher-trigger"
          className={
            'flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 ' +
            (className ?? '')
          }
        >
          <span className="truncate font-medium">
            {activeTenant?.churchName}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-lg font-semibold text-[var(--color-text-primary)]">
          {tSwitcher.title}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {tSwitcher.subtitle}
        </DialogDescription>
        <ul
          data-testid="tenant-switcher-list"
          className="mt-4 flex flex-col gap-2"
        >
          {tenants.map((tenant) => {
            const isActive = tenant.tenantId === activeTenant?.tenantId;
            const isLoading =
              selectingId === tenant.tenantId && selectTenant.isPending;
            const roleLabel = tChurchSelect.card.role[tenant.userRole];
            return (
              <li key={tenant.tenantId}>
                <button
                  type="button"
                  data-testid={`tenant-switcher-item-${tenant.tenantId}`}
                  disabled={selectTenant.isPending}
                  onClick={() => handleSelect(tenant.tenantId)}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] p-3 text-left transition hover:border-[var(--color-brand-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span aria-hidden="true" className="text-xl">
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-teal)]" />
                    ) : (
                      '🏛'
                    )}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {tenant.churchName}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {roleLabel}
                    </span>
                  </span>
                  {isActive && (
                    <span
                      data-testid="tenant-switcher-active-badge"
                      className="text-xs font-medium text-[var(--color-brand-teal)]"
                    >
                      {tSwitcher.card.active}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
