'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { TenantPlan } from '@metanoia/types';
import { ApiError } from '@/lib/api/client';
import {
  useProvisionStatus,
  useProvisionTenant,
} from '@/lib/api/hooks/use-super-admin-tenants';
import { slugify } from '@/lib/super-admin/slugify';
import messages from '../../../../../../../messages/pt-BR.json';

const t = messages.superAdmin.provision;

interface FormState {
  name: string;
  slug: string;
  slugAuto: boolean;
  adminEmail: string;
  plan: TenantPlan;
}

const INITIAL_FORM: FormState = {
  name: '',
  slug: '',
  slugAuto: true,
  adminEmail: '',
  plan: 'free',
};

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validate(form: FormState): {
  name?: string;
  slug?: string;
  adminEmail?: string;
} {
  const errors: { name?: string; slug?: string; adminEmail?: string } = {};
  if (!form.name.trim()) errors.name = t.name.error.required;
  else if (form.name.trim().length < 3) errors.name = t.name.error.short;
  else if (form.name.trim().length > 100) errors.name = t.name.error.long;

  if (!form.slug.trim()) errors.slug = t.slug.error.required;
  else if (!SLUG_REGEX.test(form.slug)) errors.slug = t.slug.error.format;

  if (!form.adminEmail.trim())
    errors.adminEmail = t.adminEmail.error.required;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail))
    errors.adminEmail = t.adminEmail.error.invalid;

  return errors;
}

const SAGA_STEP_LABEL: Record<number, string> = {
  1: t.saga.step.db,
  2: t.saga.step.keycloak,
  3: t.saga.step.invite,
};

export default function NewTenantPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [serverSlugConflict, setServerSlugConflict] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const provision = useProvisionTenant();
  const status = useProvisionStatus(tenantId ?? '', {
    enabled: tenantId !== null,
  });

  useEffect(() => {
    if (status.data?.data.status === 'done' && tenantId) {
      router.push(`/app/admin/super/tenants/${tenantId}`);
    }
  }, [status.data, tenantId, router]);

  const errors = submitted ? validate(form) : {};
  const slugConflict = serverSlugConflict;

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && prev.slugAuto) {
        next.slug = slugify(String(value));
      }
      if (key === 'slug') {
        next.slugAuto = false;
      }
      return next;
    });
    if (key === 'slug') setServerSlugConflict(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setServerSlugConflict(false);
    const v = validate(form);
    if (v.name || v.slug || v.adminEmail) return;

    try {
      const result = await provision.mutateAsync({
        name: form.name.trim(),
        slug: form.slug.trim(),
        adminEmail: form.adminEmail.trim(),
        plan: form.plan,
      });
      setTenantId(result.data.tenantId);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        setServerSlugConflict(true);
      }
    }
  };

  // Saga in progress / failed view
  if (tenantId) {
    const sagaData = status.data?.data;
    const failed = sagaData?.status === 'failed';
    const currentStep = sagaData?.step ?? 1;

    return (
      <section className="py-6">
        <h1
          data-testid="provision-saga-title"
          className="mb-4 text-[24px] font-bold text-[var(--color-text-primary)]"
        >
          {t.saga.title}
        </h1>
        <ol
          data-testid="provision-saga-stepper"
          className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
        >
          {[1, 2, 3].map((step) => {
            const isCurrent = step === currentStep;
            const isFailedHere = failed && isCurrent;
            const isDone = step < currentStep || sagaData?.status === 'done';
            return (
              <li
                key={step}
                data-testid={`provision-saga-step-${step}`}
                data-step-status={
                  isFailedHere
                    ? 'failed'
                    : isDone
                      ? 'done'
                      : isCurrent
                        ? 'running'
                        : 'pending'
                }
                className="flex items-center gap-3 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-2 w-2 rounded-full ${
                    isFailedHere
                      ? 'bg-red-500'
                      : isDone
                        ? 'bg-emerald-500'
                        : isCurrent
                          ? 'bg-sky-500'
                          : 'bg-[var(--border)]'
                  }`}
                />
                <span
                  className={
                    isFailedHere
                      ? 'text-red-700 dark:text-red-400'
                      : isDone
                        ? 'text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-muted)]'
                  }
                >
                  {SAGA_STEP_LABEL[step]}
                  {isDone ? ' ✓' : isFailedHere ? ' ✕' : ''}
                </span>
              </li>
            );
          })}
        </ol>

        {failed ? (
          <div
            data-testid="provision-saga-error"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
          >
            <p>
              {sagaData?.failedAt
                ? t.error[sagaData.failedAt]
                : t.error.unknown}
            </p>
            <Link
              href={`/app/admin/super/tenants/${tenantId}`}
              data-testid="provision-saga-go-detail"
              className="mt-2 inline-block text-sm font-semibold underline"
            >
              {t.saga.retry} →
            </Link>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="py-6">
      <Link
        data-testid="provision-back"
        href="/app/admin/super/tenants"
        className="mb-4 inline-block text-sm text-[var(--color-text-muted)] hover:text-[var(--color-brand-teal)]"
      >
        ← {t.back}
      </Link>
      <h1
        data-testid="provision-title"
        className="mb-6 text-[24px] font-bold text-[var(--color-text-primary)]"
      >
        {t.title}
      </h1>

      <form
        onSubmit={handleSubmit}
        data-testid="provision-form"
        className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"
      >
        <div>
          <label
            htmlFor="provision-name"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
            {t.name.label}
          </label>
          <input
            id="provision-name"
            data-testid="provision-name-input"
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder={t.name.placeholder}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            aria-invalid={errors.name ? 'true' : 'false'}
          />
          {errors.name ? (
            <p
              data-testid="provision-name-error"
              className="mt-1 text-xs text-red-600 dark:text-red-400"
            >
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="provision-slug"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
            {t.slug.label}
          </label>
          <input
            id="provision-slug"
            data-testid="provision-slug-input"
            type="text"
            value={form.slug}
            onChange={(e) => updateField('slug', e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            aria-invalid={errors.slug || slugConflict ? 'true' : 'false'}
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {t.slug.hint}
          </p>
          {errors.slug ? (
            <p
              data-testid="provision-slug-error"
              className="mt-1 text-xs text-red-600 dark:text-red-400"
            >
              {errors.slug}
            </p>
          ) : null}
          {slugConflict ? (
            <p
              data-testid="provision-slug-conflict"
              className="mt-1 text-xs text-red-600 dark:text-red-400"
            >
              {t.slug.error.conflict}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="provision-email"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
            {t.adminEmail.label}
          </label>
          <input
            id="provision-email"
            data-testid="provision-email-input"
            type="email"
            value={form.adminEmail}
            onChange={(e) => updateField('adminEmail', e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            aria-invalid={errors.adminEmail ? 'true' : 'false'}
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {t.adminEmail.hint}
          </p>
          {errors.adminEmail ? (
            <p
              data-testid="provision-email-error"
              className="mt-1 text-xs text-red-600 dark:text-red-400"
            >
              {errors.adminEmail}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="provision-plan"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
            {t.plan.label}
          </label>
          <select
            id="provision-plan"
            data-testid="provision-plan-input"
            value={form.plan}
            onChange={(e) =>
              updateField('plan', e.target.value as TenantPlan)
            }
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            <option value="free">{t.plan.free}</option>
            <option value="pro">{t.plan.pro}</option>
            <option value="enterprise">{t.plan.enterprise}</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            data-testid="provision-cancel"
            href="/app/admin/super/tenants"
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            {t.cancel}
          </Link>
          <button
            type="submit"
            data-testid="provision-submit"
            disabled={provision.isPending}
            className="rounded-lg bg-[var(--color-brand-teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
