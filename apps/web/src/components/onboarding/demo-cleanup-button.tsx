'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@metanoia/ui';
import messages from '../../../messages/pt-BR.json';
import { useDemoStatus, useDeleteDemoData } from '../../lib/api/hooks/use-onboarding';

const t = messages.onboarding.demo;

/**
 * DemoCleanupButton — standalone button rendered only when hasDemoData is true.
 * Opens a confirmation dialog before deleting demo records.
 *
 * CHK008: This component is exported but NOT integrated into any route in this
 * story. Integration into the Settings route is deferred to Story 10-1.
 * TODO(10-1): integrar na rota de Configurações
 *
 * CHK038: Dialog provides focus trap; buttons have focus-visible ring for
 * keyboard navigation (WCAG 2.4.7).
 */
export function DemoCleanupButton() {
  const { data: status } = useDemoStatus();
  const { mutate: deleteDemoData, isPending } = useDeleteDemoData();
  const [open, setOpen] = useState(false);

  if (!status?.hasDemoData) return null;

  function handleConfirm() {
    deleteDemoData(undefined, {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 rounded-lg border border-surface-muted px-4 text-sm font-medium text-text-secondary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
      >
        {t.cleanupButtonLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.cleanupConfirmTitle}</DialogTitle>
            <DialogDescription>{t.cleanupConfirmDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="h-11 rounded-lg border border-surface-muted px-4 text-sm font-medium text-text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus disabled:opacity-60"
            >
              {t.cleanupConfirmCancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="h-11 rounded-lg bg-care-alert px-4 text-sm font-semibold text-text-inverse hover:bg-care-alert/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus disabled:opacity-60"
            >
              {t.cleanupConfirmAction}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
