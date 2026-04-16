'use client';

import { useEffect, useState } from 'react';
import type { OutreachIntent } from '@metanoia/types';
import messages from '../../../../../../../../messages/pt-BR.json';
import {
  useCreateOutreachIntent,
  useDeleteOutreachIntent,
  useUpdateOutreachIntent,
} from '../../../../../../../../src/lib/api/hooks/use-pastoral-admin';

const t = messages.leader.intent;

const MAX_LENGTH = 280;
const SAVED_FEEDBACK_MS = 2000;

type Mode = 'view' | 'edit' | 'confirm-clear';

function currentWeekOfIso(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString();
}

interface OutreachIntentFormProps {
  leaderId: string;
  currentIntent: OutreachIntent | null;
}

export function OutreachIntentForm({
  leaderId,
  currentIntent,
}: OutreachIntentFormProps) {
  const [mode, setMode] = useState<Mode>(currentIntent ? 'view' : 'edit');
  const [note, setNote] = useState(currentIntent?.note ?? '');
  const [savedFlash, setSavedFlash] = useState(false);

  const createMutation = useCreateOutreachIntent(leaderId);
  const updateMutation = useUpdateOutreachIntent(leaderId);
  const deleteMutation = useDeleteOutreachIntent(leaderId);

  useEffect(() => {
    if (currentIntent) {
      setMode((m) => (m === 'edit' ? 'edit' : 'view'));
      setNote((n) => (n === '' ? currentIntent.note : n));
    } else {
      setMode('edit');
      setNote('');
    }
  }, [currentIntent]);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = setTimeout(() => setSavedFlash(false), SAVED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [savedFlash]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const trimmed = note.trim();
  const canSave = trimmed.length > 0 && !isSaving;

  async function handleSave() {
    if (!canSave) return;
    if (currentIntent) {
      await updateMutation.mutateAsync({
        intentId: currentIntent.intentId,
        body: { note: trimmed },
      });
    } else {
      await createMutation.mutateAsync({
        targetLeaderId: leaderId,
        weekOf: currentWeekOfIso(),
        note: trimmed,
      });
    }
    setSavedFlash(true);
    setMode('view');
  }

  async function handleClearConfirm() {
    if (!currentIntent) return;
    await deleteMutation.mutateAsync(currentIntent.intentId);
    setNote('');
    setMode('edit');
  }

  if (mode === 'view' && currentIntent) {
    return (
      <section
        aria-labelledby="intent-title"
        className="rounded-lg border border-primary/40 bg-primary/5 p-5"
      >
        <h2 id="intent-title" className="sr-only">
          {t.label}
        </h2>
        <p className="text-body text-text-primary mb-4">
          {t.existing.replace('{intentNote}', currentIntent.note)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-body-sm hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t.edit}
          </button>
          <button
            type="button"
            data-testid="outreach-clear"
            onClick={() => setMode('confirm-clear')}
            className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-body-sm hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t.clear}
          </button>
        </div>
        {savedFlash ? (
          <p
            role="status"
            className="mt-3 text-body-sm text-emerald-700"
          >
            {t.saved}
          </p>
        ) : null}
      </section>
    );
  }

  if (mode === 'confirm-clear' && currentIntent) {
    return (
      <section
        role="alertdialog"
        aria-labelledby="clear-confirm-title"
        className="rounded-lg border border-amber-200 bg-amber-50 p-5"
      >
        <p
          id="clear-confirm-title"
          className="text-body text-text-primary mb-4"
        >
          {t.clearConfirm}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleClearConfirm}
            disabled={isDeleting}
            className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-body-sm text-white hover:bg-red-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            {t.clearYes}
          </button>
          <button
            type="button"
            onClick={() => setMode('view')}
            disabled={isDeleting}
            className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-body-sm hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t.clearNo}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <label htmlFor="outreach-note" className="block text-heading mb-2">
        {t.label}
      </label>
      <textarea
        id="outreach-note"
        data-testid="outreach-note-input"
        rows={4}
        maxLength={MAX_LENGTH}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t.placeholder}
        className="w-full rounded-md border border-border bg-background p-3 text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-caption text-text-tertiary">
          {note.length}/{MAX_LENGTH}
        </span>
        <div className="flex gap-2">
          {currentIntent ? (
            <button
              type="button"
              onClick={() => {
                setMode('view');
                setNote(currentIntent.note);
              }}
              className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-body-sm hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t.clearNo}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="outreach-save"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-body-sm text-primary-foreground hover:bg-primary-hover disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isSaving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </section>
  );
}
