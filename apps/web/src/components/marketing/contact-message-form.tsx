'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '@metanoia/ui';
import {
  ContactMessageInputSchema,
  ContactMessageRecordSchema,
  type ContactMessageInput,
} from '@metanoia/types';
import { apiClient } from '@/lib/api/client';
import { scrollToFirstError } from '@/lib/form-utils';
import messages from '../../../messages/pt-BR.json';

const t = messages.contato;

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function ContactMessageForm() {
  const [status, setStatus] = useState<Status>('idle');

  const form = useForm<ContactMessageInput>({
    resolver: zodResolver(ContactMessageInputSchema),
    defaultValues: {
      fullName: '',
      email: '',
      message: '',
    },
  });

  async function onSubmit(values: ContactMessageInput) {
    setStatus('submitting');
    try {
      await apiClient.post(
        '/marketing/contact-messages',
        ContactMessageRecordSchema,
        values,
      );
      setStatus('success');
      form.reset();
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div
        className="mt-12 rounded-lg border border-[var(--color-border)] bg-surface-base p-8"
        data-testid="contact-form-success"
      >
        <h2 className="text-xl font-semibold text-text-primary">
          {t.success.heading}
        </h2>
        <p className="mt-2 text-secondary">{t.success.body}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, () => scrollToFirstError())}
      className="mt-12 space-y-6"
      noValidate
    >
      <div className="space-y-2">
        <label
          htmlFor="contact-form-name"
          className="block text-sm font-medium text-text-primary"
        >
          {t.form.fullName}
        </label>
        <Input
          id="contact-form-name"
          data-testid="contact-form-name"
          type="text"
          autoComplete="name"
          aria-invalid={!!form.formState.errors.fullName}
          aria-describedby={form.formState.errors.fullName ? 'contact-name-error' : undefined}
          {...form.register('fullName')}
        />
        {form.formState.errors.fullName && (
          <p id="contact-name-error" role="alert" className="text-sm text-[var(--color-danger)]">
            {t.error.required}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="contact-form-email"
          className="block text-sm font-medium text-text-primary"
        >
          {t.form.email}
        </label>
        <Input
          id="contact-form-email"
          data-testid="contact-form-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!form.formState.errors.email}
          aria-describedby={form.formState.errors.email ? 'contact-email-error' : undefined}
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p id="contact-email-error" role="alert" className="text-sm text-[var(--color-danger)]">
            {t.error.invalidEmail}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="contact-form-message"
          className="block text-sm font-medium text-text-primary"
        >
          {t.form.message}
        </label>
        <textarea
          id="contact-form-message"
          data-testid="contact-form-message"
          rows={6}
          placeholder={t.form.messagePlaceholder}
          aria-invalid={!!form.formState.errors.message}
          aria-describedby={form.formState.errors.message ? 'contact-message-error' : undefined}
          className="flex w-full rounded-md border border-[var(--color-border)] bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          {...form.register('message')}
        />
        {form.formState.errors.message && (
          <p id="contact-message-error" role="alert" className="text-sm text-[var(--color-danger)]">
            {t.error.required}
          </p>
        )}
      </div>

      {status === 'error' && (
        <p
          role="alert"
          className="text-sm text-[var(--color-danger)]"
          data-testid="contact-form-error"
        >
          {t.error.generic}
        </p>
      )}

      <Button
        type="submit"
        data-testid="contact-form-submit"
        disabled={status === 'submitting'}
        className="w-full sm:w-auto"
      >
        {status === 'submitting' ? t.form.submitting : t.form.submit}
      </Button>
    </form>
  );
}
