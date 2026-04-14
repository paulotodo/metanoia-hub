import type { DemoRadarParticipant } from '@metanoia/types';

interface DemoParticipantCardProps {
  participant: DemoRadarParticipant;
  name: string;
  contextPhrase: string;
}

const SIGNAL_STYLES: Record<
  DemoRadarParticipant['signalType'],
  { dot: string; label: string }
> = {
  'care-urgent': { dot: 'bg-state-danger', label: '🔴' },
  'care-attention': { dot: 'bg-state-warning', label: '🟡' },
  'care-ok': { dot: 'bg-state-success', label: '🟢' },
};

export function DemoParticipantCard({
  participant,
  name,
  contextPhrase,
}: DemoParticipantCardProps) {
  const signal = SIGNAL_STYLES[participant.signalType];

  return (
    <article className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-primary p-4">
      <span
        className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${signal.dot}`}
        aria-hidden
      />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-text-primary">{name}</p>
        <p className="text-sm text-text-secondary">{contextPhrase}</p>
      </div>
    </article>
  );
}
