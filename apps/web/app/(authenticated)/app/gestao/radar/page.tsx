"use client";

import { useState, useMemo } from "react";
import type { RadarParticipant, SignalType } from "@metanoia/types";
import { useRadarPage } from "@/lib/api/hooks/use-radar";
import { SaudacaoContextual } from "./_components/saudacao-contextual";
import { SemaforoPill } from "./_components/semaforo-pill";
import { GrupoPillFilter } from "./_components/grupo-pill";
import { SectionDivider } from "./_components/section-divider";
import { ParticipantCard, ParticipantCardCompact } from "./_components/participant-card";
import { InboxZeroState } from "./_components/inbox-zero-state";
import { ReturnBanner } from "./_components/return-banner";
import { RadarPageSkeleton } from "./_components/radar-skeleton";
import { RadarError } from "./_components/radar-error";

type PillFilter = SignalType | null;

export default function RadarPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useRadarPage(selectedGroupId ?? undefined);
  const [activePill, setActivePill] = useState<PillFilter>(null);

  // Compute counts from participants
  const counts = useMemo(() => {
    if (!data) return { urgent: [], attention: [], ok: [] };
    const urgent = data.participants.filter((p) => p.signalType === "care-urgent");
    const attention = data.participants.filter((p) => p.signalType === "care-attention");
    const ok = data.participants.filter((p) => p.signalType === "care-ok");
    return { urgent, attention, ok };
  }, [data]);

  if (isLoading) return <RadarPageSkeleton />;
  if (error) return <RadarError error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  const isInboxZero = counts.urgent.length === 0 && counts.attention.length === 0;

  // ReturnBanner visibility check
  const showReturnBanner =
    data.lastSeenAt !== null &&
    (Date.now() - new Date(data.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24) > 5;

  const showDelta = !showReturnBanner;

  // Triple-state pill tap: default → scroll → filter → default
  function handlePillTap(signalType: SignalType) {
    if (activePill === signalType) {
      setActivePill(null); // 3rd tap: restore panorama
    } else {
      setActivePill(signalType);
    }
  }

  function getPillState(signalType: SignalType) {
    if (activePill === null) return "default" as const;
    if (activePill === signalType) return "filter-active" as const;
    return "dimmed" as const;
  }

  // Filter by pill
  function shouldShowSection(signalType: SignalType): boolean {
    return activePill === null || activePill === signalType;
  }

  function renderSection(
    signalType: SignalType,
    participants: RadarParticipant[],
    sectionId: string,
  ) {
    if (!shouldShowSection(signalType) || participants.length === 0) return null;

    return (
      <section
        key={signalType}
        aria-labelledby={sectionId}
        className="space-y-3"
      >
        <SectionDivider signalType={signalType} id={sectionId} />
        {signalType === "care-ok" ? (
          <>
            <p className="text-sm text-text-secondary lg:text-base">
              {participants.length} estão bem
            </p>
            <ParticipantCardCompact participants={participants} />
          </>
        ) : (
          participants.map((p) => (
            <ParticipantCard key={p.participantId} participant={p} />
          ))
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6 py-6">
      {/* 01.2-H1: SaudacaoContextual */}
      <SaudacaoContextual
        firstName={data.userFirstName}
        urgentCount={counts.urgent.length}
        attentionCount={counts.attention.length}
      />

      {/* 01.2-R1: ReturnBanner (conditional) */}
      {data.lastSeenAt && (
        <ReturnBanner lastSeenAt={data.lastSeenAt} />
      )}

      {/* 01.2-S1/S2/S3: SemaforoPills */}
      <div className="flex gap-2" role="group" aria-label="Filtros do semáforo pastoral">
        <SemaforoPill
          signalType="care-urgent"
          count={counts.urgent.length}
          delta={data.signalCounts.deltaUrgent}
          state={getPillState("care-urgent")}
          showDelta={showDelta}
          onTap={() => handlePillTap("care-urgent")}
        />
        <SemaforoPill
          signalType="care-attention"
          count={counts.attention.length}
          delta={data.signalCounts.deltaAttention}
          state={getPillState("care-attention")}
          showDelta={showDelta}
          onTap={() => handlePillTap("care-attention")}
        />
        <SemaforoPill
          signalType="care-ok"
          count={counts.ok.length}
          delta={data.signalCounts.deltaOk}
          state={getPillState("care-ok")}
          showDelta={showDelta}
          onTap={() => handlePillTap("care-ok")}
        />
      </div>

      {/* 01.2-G1: GrupoPill filter */}
      <GrupoPillFilter
        groups={data.groups}
        selectedGroupId={selectedGroupId}
        onSelect={setSelectedGroupId}
      />

      {/* 01.2-L5: InboxZeroState (when all ok) */}
      {isInboxZero && shouldShowSection("care-ok") ? (
        <InboxZeroState nextMeeting={data.nextMeeting} />
      ) : (
        /* 01.2-L1/L2/L3/L4: Participant sections */
        <div className="space-y-8">
          {renderSection("care-urgent", counts.urgent, "section-urgent")}
          {renderSection("care-attention", counts.attention, "section-attention")}
          {renderSection("care-ok", counts.ok, "section-ok")}
        </div>
      )}
    </div>
  );
}
