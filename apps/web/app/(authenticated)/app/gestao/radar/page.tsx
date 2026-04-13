import { mockRadarPageData } from "../../../../../__mocks__/radar";

/**
 * Radar Pastoral — Tela principal do líder (01.2)
 *
 * Prototype stub: renders mock data.
 * Will be wired to `useRadarSignals` TanStack Query hook in Session 6.
 */
export default function RadarPage() {
  const data = mockRadarPageData;

  return (
    <div className="py-6">
      {/* 01.2-H1: SaudacaoContextual */}
      <h1 className="text-display-sm font-semibold">
        Bom dia, {data.userFirstName}
      </h1>

      {/* 01.2-S1/S2/S3: SemaforoPills placeholder */}
      <div className="mt-4 flex gap-2">
        <span className="rounded-full bg-care-urgent/10 px-3 py-1 text-sm text-care-urgent">
          {data.signalCounts.careUrgent} precisam de cuidado
        </span>
        <span className="rounded-full bg-care-attention/10 px-3 py-1 text-sm text-care-attention">
          {data.signalCounts.careAttention} pedem atenção
        </span>
        <span className="rounded-full bg-care-ok/10 px-3 py-1 text-sm text-care-ok">
          {data.signalCounts.careOk} estão bem
        </span>
      </div>

      {/* 01.2-L1/L2/L3: ParticipantCards placeholder */}
      <div className="mt-6 space-y-3">
        {data.participants.map((participant) => (
          <div
            key={participant.participantId}
            className="rounded-lg border border-border-default bg-surface-base p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{participant.name}</span>
              <span className="text-xs text-text-muted">
                {participant.groupName}
              </span>
            </div>
            {participant.contextPhrase && (
              <p className="mt-1 text-sm text-text-secondary">
                {participant.contextPhrase}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
