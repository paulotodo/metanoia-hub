'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGroupTrails, useAssociateTrails, useUnassignTrail } from '../../../../../../../../src/lib/api/hooks';
import messages from '../../../../../../../../messages/pt-BR.json';

const t = messages.groupTrails;

interface Props {
  groupId: string;
}

export function GroupTrailsClient({ groupId }: Props) {
  const { data, isLoading, isError, refetch } = useGroupTrails(groupId);
  const associate = useAssociateTrails(groupId);
  const unassign = useUnassignTrail(groupId);

  const [trailInput, setTrailInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  function parseTrailIds(raw: string): string[] {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleAssociate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trailIds = parseTrailIds(trailInput);
    if (trailIds.length === 0) return;

    try {
      await associate.mutateAsync({ trailIds });
      setFormSuccess(t.assign.success);
      setTrailInput('');
    } catch (err: unknown) {
      interface ApiErrorBody {
        details?: { invalidTrailIds?: string[] };
      }
      const apiErr =
        err && typeof err === 'object' && 'details' in err
          ? (err as ApiErrorBody)
          : null;
      const invalidIds = apiErr?.details?.invalidTrailIds;

      if (invalidIds && invalidIds.length > 0) {
        setFormError(
          t.assign.invalidIds.replace('{ids}', invalidIds.join(', ')),
        );
      } else {
        setFormError(t.assign.error);
      }
    }
  }

  async function handleRemove(trailId: string) {
    try {
      await unassign.mutateAsync({ trailId });
    } catch {
      // Error is surfaced globally — no per-row state needed here
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/app/admin/igreja/grupos/${groupId}`}
          className="text-sm text-muted-foreground hover:underline"
          aria-label="Voltar para detalhes do grupo"
        >
          ← Voltar para o grupo
        </Link>
      </div>

      {/* Heading */}
      <section aria-labelledby="group-trails-heading">
        {/* data-autofocus: CHK007 — FocusManager move o foco aqui após navegação (TD-001/US2) */}
        <h1
          id="group-trails-heading"
          className="mb-2 text-2xl font-bold text-foreground"
          data-autofocus
        >
          {t.title}
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">{t.description}</p>
      </section>

      {/* Associate form */}
      <section
        aria-labelledby="associate-trails-heading"
        className="mb-8 rounded-lg border border-border bg-surface p-6"
      >
        <h2
          id="associate-trails-heading"
          className="mb-4 text-lg font-semibold text-foreground"
        >
          {t.assign.label}
        </h2>

        <form onSubmit={(e) => void handleAssociate(e)} className="flex gap-3">
          <label htmlFor="trail-ids-input" className="sr-only">
            {t.assign.placeholder}
          </label>
          <input
            id="trail-ids-input"
            type="text"
            value={trailInput}
            onChange={(e) => setTrailInput(e.target.value)}
            placeholder={t.assign.placeholder}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-describedby={
              formError ? 'associate-error' : formSuccess ? 'associate-success' : undefined
            }
          />
          <button
            type="submit"
            disabled={associate.isPending || trailInput.trim().length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {associate.isPending ? t.assign.loading : t.assign.button}
          </button>
        </form>

        {formError && (
          <p id="associate-error" role="alert" className="mt-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        {formSuccess && (
          <p id="associate-success" role="status" className="mt-2 text-sm text-green-600">
            {formSuccess}
          </p>
        )}
      </section>

      {/* Associated trails list */}
      <section aria-labelledby="trails-list-heading">
        <h2
          id="trails-list-heading"
          className="mb-4 text-lg font-semibold text-foreground"
        >
          Trilhas associadas
        </h2>

        {isLoading && (
          <div aria-busy="true" className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg border border-border bg-surface"
              />
            ))}
          </div>
        )}

        {isError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{t.error.load}</p>
            <button
              onClick={() => void refetch()}
              className="mt-2 text-sm font-medium text-destructive underline"
            >
              {t.error.retry}
            </button>
          </div>
        )}

        {data && data.data.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t.list.empty}
          </p>
        )}

        {data && data.data.length > 0 && (
          <ul
            aria-label="Trilhas associadas ao grupo"
            className="space-y-3"
          >
            {data.data.map((trail) => (
              <li
                key={trail.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    <span className="text-xs text-muted-foreground">{t.list.trailId}: </span>
                    <span className="font-mono text-xs">{trail.trailId}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.list.assignedAt}:{' '}
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(trail.assignedAt))}
                  </p>
                </div>

                <button
                  onClick={() => void handleRemove(trail.trailId)}
                  disabled={unassign.isPending}
                  aria-label={`Remover trilha ${trail.trailId}`}
                  className="ml-4 rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {unassign.isPending ? t.remove.loading : t.remove.button}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
