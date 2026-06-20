'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UpdateTemplateRequestSchema } from '@metanoia/types';
import { useTemplateById, useUpdateTemplate } from '@/lib/api/hooks/use-templates';
import { FormField } from '@/components/forms/form-field';
import messages from '../../../../../../../messages/pt-BR.json';

const t = messages.templates;

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditTemplatePage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();

  const { data: template, isPending } = useTemplateById(id);
  const updateMutation = useUpdateTemplate(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description ?? '');
    }
  }, [template]);

  if (isPending) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-[var(--muted)]" aria-hidden="true" />
        <div className="h-40 rounded-lg border border-[var(--border)] bg-[var(--muted)]" aria-hidden="true" />
      </main>
    );
  }

  if (!template || template.scope === 'platform') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-display">{t.crud.notFound}</p>
          <Link href="/app/admin/templates" className="text-sm text-[var(--color-interactive-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] rounded">
            {t.crud.backToList}
          </Link>
        </div>
      </main>
    );
  }

  function validate() {
    const result = UpdateTemplateRequestSchema.safeParse({
      name: name.trim() || undefined,
      description: description.trim() || null,
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'name');
        errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return false;
    }
    setFieldErrors({});
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSuccessMessage('');
    setErrorMessage('');
    updateMutation.mutate(
      { name: name.trim() || undefined, description: description.trim() || null },
      {
        onSuccess: () => {
          setSuccessMessage(t.crud.saveSuccess);
          setTimeout(() => router.push(`/app/admin/templates/${id}`), 1200);
        },
        onError: () => {
          setErrorMessage(t.crud.saveError);
        },
      },
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <nav aria-label="Navegação" className="flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/app/admin/templates" className="hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] rounded">
          {t.page.title}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/app/admin/templates/${id}`} className="hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] rounded">
          {template.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--color-text-primary)]">Editar</span>
      </nav>

      <h1 className="text-display" data-autofocus>
        {t.crud.editTitle}
      </h1>

      {successMessage && (
        <div role="status" aria-live="polite" className="rounded-md border border-[var(--color-brand-teal)] bg-[var(--color-brand-teal)]/10 px-4 py-3 text-sm text-[var(--color-brand-teal)]">
          {successMessage}
        </div>
      )}

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
            aria-describedby={fieldErrors['name'] ? 'template-name-error' : undefined}
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
            aria-invalid={Boolean(fieldErrors['description'])}
            aria-describedby={fieldErrors['description'] ? 'template-description-error' : undefined}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] resize-none"
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center rounded-md bg-[var(--color-interactive-primary)] px-5 py-2 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-interactive-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
          <Link
            href={`/app/admin/templates/${id}`}
            className="inline-flex items-center rounded-md border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
          >
            {t.crud.cancel}
          </Link>
        </div>
      </form>
    </main>
  );
}
