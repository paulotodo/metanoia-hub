"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@metanoia/ui";

interface EndConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  pendingLabel?: string;
}

export function EndConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending = false,
  pendingLabel,
}: EndConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="h-11 rounded-lg border border-surface-muted px-4 text-sm font-medium text-text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="h-11 rounded-lg bg-care-alert px-4 text-sm font-semibold text-text-inverse hover:bg-care-alert/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 disabled:opacity-60"
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
