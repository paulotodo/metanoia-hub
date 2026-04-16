import messages from '../../../../../../../messages/pt-BR.json';

const t = messages.vista.stale;

interface VistaStaleBannerProps {
  lastCalculatedAt: string;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STALE_THRESHOLD_HOURS = 6;

export function isStale(iso: string, now: Date = new Date()): boolean {
  const ts = new Date(iso).getTime();
  const ageMs = now.getTime() - ts;
  return ageMs > STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
}

export function VistaStaleBanner({ lastCalculatedAt }: VistaStaleBannerProps) {
  return (
    <div
      role="status"
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-body-sm text-amber-900"
    >
      {t.banner.replace('{date}', formatDateTime(lastCalculatedAt))}
    </div>
  );
}
