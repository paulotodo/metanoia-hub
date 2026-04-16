'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '@metanoia/ui';
import {
  DemoRequestInputSchema,
  DemoRequestRecordSchema,
  type DemoRequestInput,
  type ChurchSize,
} from '@metanoia/types';
import { apiClient, ApiError } from '@/lib/api/client';
import messages from '../../../messages/pt-BR.json';

const t = messages.comecar;

type Status = 'idle' | 'submitting' | 'success' | 'error';

const churchSizeLabels: Record<ChurchSize, string> = {
  'up-to-50': t.churchSize.upTo50,
  '50-to-200': t.churchSize.between50And200,
  '200-to-1000': t.churchSize.between200And1000,
  'over-1000': t.churchSize.over1000,
};

const churchSizeOptions: ChurchSize[] = [
  'up-to-50',
  '50-to-200',
  '200-to-1000',
  'over-1000',
];

export function DemoRequestForm() {
  const [status, setStatus] = useState<Status>('idle');

  const form = useForm<DemoRequestInput>({
    resolver: zodResolver(DemoRequestInputSchema),
    defaultValues: {
      fullName: '',
      email: '',
      churchName: '',
      churchSize: 'up-to-50',
      role: null,
    },
  });

  async function onSubmit(values: DemoRequestInput) {
    setStatus('submitting');
    try {
      const payload: DemoRequestInput = {
        ...values,
        role: values.role && values.role.trim().length > 0 ? values.role : null,
      };
      await apiClient.post(
        '/marketing/demo-requests',
        DemoRequestRecordSchema,
        payload,
      );
      setStatus('success');
      form.reset();
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 429) {
        setStatus('error');
      } else {
        setStatus('error');
      }
    }
  }

  if (status === 'success') {
    return (
      <div
        className="mt-12 rounded-lg border border-[var(--color-border)] bg-surface-base p-8"
        data-testid="demo-form-success"
      >
        <h2 className="text-xl font-semibold text-text-primary">
          {t.success.heading}
        </h2>
        <p className="mt-2 text-[var(--color-text-muted)]">{t.success.body}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mt-12 space-y-6"
      noValidate
    >
      <div className="space-y-2">
        <label
          htmlFor="demo-form-name"
          className="block text-sm font-medium text-text-primary"
        >
          {t.form.fullName}
        </label>
        <Input
          id="demo-form-name"
          data-testid="demo-form-name"
          type="text"
          autoComplete="name"
          aria-invalid={!!form.formState.errors.fullName}
          {...form.register('fullName')}
        />
        {form.formState.errors.fullName && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {t.error.required}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="demo-form-email"
          className="block text-sm font-medium text-text-primary"
        >
          {t.form.email}
        </label>
        <Input
          id="demo-form-email"
          data-testid="demo-form-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!form.formState.errors.email}
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {t.error.invalidEmail}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="demo-form-church"
          className="block text-sm font-medium text-text-primary"
        >
          {t.form.churchName}
        </label>
        <Input
          id="demo-form-church"
          data-testid="demo-form-church"
          type="text"
          aria-invalid={!!form.formState.errors.churchName}
          {...form.register('churchName')}
        />
        {form.formState.errors.churchName && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {t.error.required}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="demo-form-size"
          className="block text-sm font-medium text-text-primary"
        >
          {t.form.churchSize}
        </label>
        <select
          id="demo-form-size"
          data-testid="demo-form-size"
          aria-invalid={!!form.formState.errors.churchSize}
          className="flex h-10 w-full rounded-md border border-[var(--color-border)] bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          {...form.register('churchSize')}
        >
          {churchSizeOptions.map((size) => (
            <option key={size} value={size}>
              {churchSizeLabels[size]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="demo-form-role"
          className="block text-sm font-medium text-text-primary"
        >
          {t.form.role}
        </label>
        <Input
          id="demo-form-role"
          type="text"
          placeholder={t.form.rolePlaceholder}
          {...form.register('role')}
        />
      </div>

      {status === 'error' && (
        <p
          role="alert"
          className="text-sm text-[var(--color-danger)]"
          data-testid="demo-form-error"
        >
          {t.error.generic}
        </p>
      )}

      <Button
        type="submit"
        data-testid="demo-form-submit"
        disabled={status === 'submitting'}
        className="w-full sm:w-auto"
      >
        {status === 'submitting' ? t.form.submitting : t.form.submit}
      </Button>
    </form>
  );
}
