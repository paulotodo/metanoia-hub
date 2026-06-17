"use client";

interface ConfirmationViewProps {
  heading: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}

export function ConfirmationView({
  heading,
  body,
  actionLabel,
  onAction,
}: ConfirmationViewProps) {
  return (
    <section
      aria-labelledby="reflection-confirmation-heading"
      className="mx-auto max-w-md space-y-6 py-12 text-center"
    >
      <div
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-care-ok/10 text-3xl text-care-ok"
      >
        ✓
      </div>
      <h1
        id="reflection-confirmation-heading"
        className="text-2xl font-semibold text-text-primary"
      >
        {heading}
      </h1>
      <p className="text-base text-text-secondary">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="h-12 w-full rounded-lg bg-brand-teal px-4 text-base font-semibold text-text-inverse transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30"
      >
        {actionLabel}
      </button>
    </section>
  );
}
