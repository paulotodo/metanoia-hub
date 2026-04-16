import Link from 'next/link';
import messages from '../../../../../../../messages/pt-BR.json';

const t = messages.vista.empty;

export function VistaEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
      <h2 className="text-heading mb-2">{t.heading}</h2>
      <p className="text-body text-text-secondary mb-6 max-w-md">{t.body}</p>
      <Link
        href="/app/admin/grupos/novo"
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-body-sm text-primary-foreground hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {t.cta}
      </Link>
    </div>
  );
}

interface VistaFilteredEmptyProps {
  message: string;
}

export function VistaFilteredEmpty({ message }: VistaFilteredEmptyProps) {
  return (
    <div className="rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <p className="text-body text-text-secondary">{message}</p>
    </div>
  );
}
