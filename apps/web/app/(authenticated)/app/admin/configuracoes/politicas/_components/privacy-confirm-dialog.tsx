'use client';

/**
 * PrivacyConfirmDialog — accessible modal confirmation for privacy-impacting toggles.
 *
 * Opens ONLY when activating (toggling ON) focusMonitoring or mandatoryCamera.
 * WCAG AA: role="dialog", aria-modal, focus trap, Escape closes.
 */
import { useEffect, useRef } from 'react';

interface PrivacyConfirmDialogProps {
  open: boolean;
  warningMessage: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PrivacyConfirmDialog({
  open,
  warningMessage,
  onConfirm,
  onCancel,
}: PrivacyConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      // Focus trap: Tab cycles between cancel and confirm
      if (e.key === 'Tab') {
        const focusable = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        // Close when clicking the backdrop (outside the dialog)
        if (e.target === e.currentTarget) onCancel();
      }}
      aria-hidden="false"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-dialog-title"
        aria-describedby="privacy-dialog-desc"
        className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h2
          id="privacy-dialog-title"
          className="mb-3 text-lg font-semibold text-[var(--color-text-primary,#1a1a1a)]"
        >
          Confirmar ativação
        </h2>
        <p
          id="privacy-dialog-desc"
          className="mb-6 text-sm text-[var(--color-text-secondary,#666)]"
        >
          {warningMessage}
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
