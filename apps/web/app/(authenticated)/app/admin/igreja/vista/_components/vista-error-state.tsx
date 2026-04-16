'use client';

import messages from '../../../../../../../messages/pt-BR.json';

const t = messages.vista.error;

interface VistaErrorStateProps {
  onRetry: () => void;
}

export function VistaErrorState({ onRetry }: VistaErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 py-12 text-center"
    >
      <p className="text-body text-text-primary mb-4 max-w-md">{t.network}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center rounded-md border border-border bg-surface px-4 py-2 text-body-sm hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {t.retry}
      </button>
    </div>
  );
}
