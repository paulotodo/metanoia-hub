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
import { useDemoStatus, useDeleteDemoData, useDismissDemoNudge } from '../../lib/api/hooks/use-onboarding';

const t = messages.onboarding.demo;

/**
 * DemoDataNudge — shows an alert dialog when the tenant has both demo data
 * and real data, prompting the pastoral leader to clean up synthetic records.
 *
 * Visibility rule: hasDemoData && hasRealData && !nudgeDismissed.
 *
 * dec-007: "Manter por enquanto" calls dismissNudge (PATCH demo-nudge-dismiss)
 * so the nudge does not reappear in the current session without deleting data.
 *
 * CHK038: Dialog handles focus trap automatically; aria attributes via shadcn.
 */
export function DemoDataNudge() {
  const { data: status } = useDemoStatus();
  const { mutate: deleteDemoData, isPending: isDeleting } = useDeleteDemoData();
  const { mutate: dismissNudge, isPending: isDismissing } = useDismissDemoNudge();

  const [open, setOpen] = useState(true);

  const shouldShow =
    open &&
    status?.hasDemoData === true &&
    status?.hasRealData === true &&
    status?.nudgeDismissed === false;

  if (!shouldShow) return null;

  function handleKeep() {
    dismissNudge(undefined, {
      onSuccess: () => setOpen(false),
    });
  }

  function handleRemove() {
    deleteDemoData(undefined, {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleKeep();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.nudgeTitle}</DialogTitle>
          <DialogDescription>{t.nudgeDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={handleKeep}
            disabled={isDismissing || isDeleting}
            className="h-11 rounded-lg border border-surface-muted px-4 text-sm font-medium text-text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 disabled:opacity-60"
          >
            {t.nudgeKeep}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isDeleting || isDismissing}
            className="h-11 rounded-lg bg-care-alert px-4 text-sm font-semibold text-text-inverse hover:bg-care-alert/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 disabled:opacity-60"
          >
            {t.nudgeClean}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
