import type { DemoRadarResponse } from '@metanoia/types';
import { Card } from '@metanoia/ui';
import { DemoParticipantCard } from './demo-participant-card';
import messages from '../../../../../../messages/pt-BR.json';

interface DemoRadarCardProps {
  data: DemoRadarResponse;
}

export function DemoRadarCard({ data }: DemoRadarCardProps) {
  const t = messages.welcome.demo;

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {data.groupName}
          </p>
          <p className="text-sm text-text-secondary">{data.message}</p>
        </div>
        <span
          className="inline-flex items-center rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary"
          aria-label="Dados de demonstração"
        >
          DEMO
        </span>
      </div>

      <ul className="space-y-3">
        {data.participants.map((p) => (
          <li key={p.name}>
            <DemoParticipantCard
              participant={p}
              name={p.name}
              contextPhrase={p.contextPhrase}
            />
          </li>
        ))}
      </ul>

      <p className="text-caption text-text-tertiary">{t.disclaimer}</p>
    </Card>
  );
}
