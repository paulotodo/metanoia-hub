'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCreateTemplate } from '@/lib/api/hooks/use-templates';
import { FormField } from '@/components/forms/form-field';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.templates;

export default function NovoTemplatePage() {
  const router = useRouter();
  const createMutation = useCreateTemplate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceTrailId, setSourceTrailId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState('');

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs['name'] = 'Nome é obrigatório';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setErrorMessage('');

    createMutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        sourceTrailId: sourceTrailId.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          router.push(`/app/admin/templates/${created.id}`);
        },
        onError: () => {
          setErrorMessage(t.crud.createError);
        },
      },
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <nav aria-label="Navegação" className="flex items-center gap-2 text-sm text-text-secondary">
        <Link
          href="/app/admin/templates"
          className="hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] rounded"
        >
          {t.page.title}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--color-text-primary)]">{t.crud.createTitle}</span>
      </nav>

      <h1 className="text-display" data-autofocus>
        {t.crud.createTitle}
      </h1>

      {errorMessage && (
        <div role="alert" className="rounded-md border border-[var(--color-state-danger,_#ef4444)] bg-[var(--color-state-danger,_#ef4444)]/10 px-4 py-3 text-sm text-[var(--color-state-danger,_#ef4444)]">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <FormField
          label={t.crud.nameLabel}
          error={fieldErrors['name']}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.crud.namePlaceholder}
            maxLength={500}
            required
            aria-required="true"
            aria-invalid={Boolean(fieldErrors['name'])}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)]"
          />
        </FormField>

        <FormField
          label={t.crud.descriptionLabel}
          error={fieldErrors['description']}
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.crud.descriptionPlaceholder}
            maxLength={1000}
            rows={4}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] resize-none"
          />
        </FormField>

        <FormField
          label={t.crud.selectTrail}
          error={fieldErrors['sourceTrailId']}
          hint="Informe o ID de uma trilha para capturar automaticamente sua estrutura de módulos e lições."
        >
          <input
            type="text"
            value={sourceTrailId}
            onChange={(e) => setSourceTrailId(e.target.value)}
            placeholder="ID da trilha (UUID)"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)]"
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center rounded-md bg-[var(--color-interactive-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-interactive-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {createMutation.isPending ? 'Criando...' : t.crud.saveAsTemplate}
          </button>
          <Link
            href="/app/admin/templates"
            className="inline-flex items-center rounded-md border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
          >
            {t.crud.cancel}
          </Link>
        </div>
      </form>
    </main>
  );
}
