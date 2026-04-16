import type { TimelineEntry } from '@metanoia/types';
import messages from '../../../../../../../../messages/pt-BR.json';

const t = messages.drill;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

const SIGNAL_LABEL: Record<string, string> = {
  'care-urgent': 'cuidado urgente',
  'care-attention': 'atenção',
  'care-ok': 'acompanhamento',
};

interface PastoralTimelineProps {
  entries: TimelineEntry[];
}

export function PastoralTimeline({ entries }: PastoralTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center">
        <p className="text-body text-text-secondary">{t.timeline.empty}</p>
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li
          key={entry.entryId}
          data-testid={`timeline-${entry.type === 'meeting' ? 'meeting' : 'care'}-${entry.entryId}`}
          className="rounded-lg border border-border bg-surface p-4"
        >
          {entry.type === 'meeting' ? (
            <div>
              <p className="text-body font-medium">
                {t.entry.meeting.replace('{date}', formatDate(entry.occurredAt))}
              </p>
              <p className="text-body-sm text-text-secondary mt-1">
                {t.entry.presence
                  .replace('{present}', String(entry.presentCount))
                  .replace('{total}', String(entry.totalCount))}
              </p>
              {entry.reflectionText ? (
                <blockquote className="mt-3 border-l-2 border-primary pl-3 text-body-sm text-text-primary italic">
                  {entry.reflectionText}
                </blockquote>
              ) : (
                <p className="mt-2 text-body-sm text-text-tertiary">
                  {t.entry.noReflection}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-body font-medium">
                {t.entry.care.replace('{date}', formatDate(entry.occurredAt))}
              </p>
              <p className="text-body-sm text-text-secondary mt-1">
                {t.entry.careTarget
                  .replace('{participantName}', entry.participantName)
                  .replace(
                    '{signalStatus}',
                    SIGNAL_LABEL[entry.signalStatus] ?? entry.signalStatus,
                  )}
              </p>
              <blockquote className="mt-3 border-l-2 border-amber-500 pl-3 text-body-sm text-text-primary italic">
                {entry.careNote}
              </blockquote>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
