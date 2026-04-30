'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TenantDetail } from '@metanoia/types';
import { TenantStatusBadge } from '@/components/super-admin/tenant-status-badge';
import {
  usePatchTenant,
  useRetryProvision,
  useSuperAdminTenant,
} from '@/lib/api/hooks/use-super-admin-tenants';
import messages from '../../../../../../../messages/pt-BR.json';

const t = messages.superAdmin.tenantDetail;
const tList = messages.superAdmin.tenants;

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDate(iso: string): string {
  return DATE_FMT.format(new Date(iso)).replace('.', '');
}

function planLabel(plan: TenantDetail['plan']): string {
  return tList.filter.plan[plan];
}

function inviteLabel(s: TenantDetail['inviteStatus']): string {
  return t.info.inviteStatus[s];
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? '';
  const query = useSuperAdminTenant(id);
  const patch = usePatchTenant(id);
  const retry = useRetryProvision(id);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);

  if (query.isPending) {
    return (
      <section
        data-testid="tenant-detail-skeleton"
        aria-busy="true"
        className="py-6"
      >
        <p className="text-sm text-[var(--color-text-muted)]">...</p>
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section data-testid="tenant-detail-error" className="py-6">
        <Link
          href="/app/admin/super/tenants"
          className="mb-4 inline-block text-sm text-[var(--color-text-muted)] hover:text-[var(--color-brand-teal)]"
        >
          ← {t.back}
        </Link>
        <p className="text-sm text-[var(--color-text-muted)]">
          {tList.error.network}
        </p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-2 text-sm font-medium text-[var(--color-brand-teal)] underline"
        >
          {tList.error.retry}
        </button>
      </section>
    );
  }

  const tenant = query.data.data;

  const startEdit = () => {
    setDraftName(tenant.name);
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length < 3 || trimmed.length > 100) return;
    await patch.mutateAsync({ name: trimmed });
    setEditingName(false);
  };

  const suspend = async () => {
    await patch.mutateAsync({ status: 'suspended' });
    setShowSuspendDialog(false);
  };

  const reactivate = () => {
    void patch.mutateAsync({ status: 'active' });
  };

  const handleRetry = async () => {
    await retry.mutateAsync();
    router.push(`/app/admin/super/tenants/novo?retry=${tenant.id}`);
  };

  return (
    <section className="py-6">
      <Link
        data-testid="tenant-detail-back"
        href="/app/admin/super/tenants"
        className="mb-4 inline-block text-sm text-[var(--color-text-muted)] hover:text-[var(--color-brand-teal)]"
      >
        ← {t.back}
      </Link>

      <header
        data-testid="tenant-detail-header"
        className="mb-6 flex items-center gap-3"
      >
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              data-testid="tenant-detail-name-input"
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base font-semibold"
            />
            <button
              type="button"
              data-testid="tenant-detail-name-save"
              onClick={saveName}
              disabled={patch.isPending}
              className="rounded-lg bg-[var(--color-brand-teal)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t.actions.save}
            </button>
            <button
              type="button"
              data-testid="tenant-detail-name-cancel"
              onClick={() => setEditingName(false)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)]"
            >
              {t.actions.cancel}
            </button>
          </div>
        ) : (
          <>
            <h1
              data-testid="tenant-detail-name"
              className="text-[24px] font-bold leading-tight text-[var(--color-text-primary)]"
            >
              {tenant.name}
            </h1>
            <TenantStatusBadge status={tenant.status} />
          </>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section
          data-testid="tenant-detail-info-card"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.info.title}
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">{t.info.slug}</dt>
              <dd
                data-testid="tenant-detail-slug"
                className="font-medium text-[var(--color-text-primary)]"
              >
                {tenant.slug}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">{t.info.plan}</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                {planLabel(tenant.plan)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">
                {t.info.created}
              </dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                {formatDate(tenant.createdAt)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">{t.info.admin}</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                {tenant.adminEmail}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">{t.info.invite}</dt>
              <dd
                data-testid="tenant-detail-invite-status"
                className="font-medium text-[var(--color-text-primary)]"
              >
                {inviteLabel(tenant.inviteStatus)}
              </dd>
            </div>
          </dl>
        </section>

        <section
          data-testid="tenant-detail-numbers-card"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.numbers.title}
          </h2>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">
                {t.numbers.members}
              </dt>
              <dd className="text-2xl font-bold text-[var(--color-text-primary)]">
                {tenant.memberCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">
                {t.numbers.groups}
              </dt>
              <dd className="text-2xl font-bold text-[var(--color-text-primary)]">
                {tenant.groupCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">
                {t.numbers.leaders}
              </dt>
              <dd className="text-2xl font-bold text-[var(--color-text-primary)]">
                {tenant.leaderCount}
              </dd>
            </div>
          </dl>
        </section>

        <section
          data-testid="tenant-detail-actions-card"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 md:col-span-2"
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.actions.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {!editingName ? (
              <button
                type="button"
                data-testid="tenant-detail-edit-name"
                onClick={startEdit}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--background)]"
              >
                {t.actions.editName}
              </button>
            ) : null}

            {tenant.status === 'active' ? (
              <button
                type="button"
                data-testid="tenant-detail-suspend"
                onClick={() => setShowSuspendDialog(true)}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                {t.actions.suspend}
              </button>
            ) : null}

            {tenant.status === 'suspended' ? (
              <button
                type="button"
                data-testid="tenant-detail-reactivate"
                onClick={reactivate}
                disabled={patch.isPending}
                className="rounded-lg bg-[var(--color-brand-teal)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t.actions.reactivate}
              </button>
            ) : null}

            {tenant.status === 'provisioning_failed' ? (
              <button
                type="button"
                data-testid="tenant-detail-retry"
                onClick={handleRetry}
                disabled={retry.isPending}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
              >
                {t.actions.retry}
              </button>
            ) : null}
          </div>
        </section>
      </div>

      {showSuspendDialog ? (
        <div
          data-testid="tenant-detail-suspend-dialog"
          role="dialog"
          aria-labelledby="suspend-dialog-title"
          aria-describedby="suspend-dialog-warning"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
            <h3
              id="suspend-dialog-title"
              className="text-lg font-bold text-[var(--color-text-primary)]"
            >
              {t.suspendDialog.title}
            </h3>
            <p
              id="suspend-dialog-warning"
              className="mt-2 text-sm text-[var(--color-text-muted)]"
            >
              {t.suspendDialog.warning}
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                data-testid="tenant-detail-suspend-cancel"
                onClick={() => setShowSuspendDialog(false)}
                className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)]"
              >
                {t.suspendDialog.cancel}
              </button>
              <button
                type="button"
                data-testid="tenant-detail-suspend-confirm"
                onClick={suspend}
                disabled={patch.isPending}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t.suspendDialog.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
