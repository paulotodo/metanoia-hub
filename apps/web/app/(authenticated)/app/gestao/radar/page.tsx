"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { RadarParticipant, SignalType } from "@metanoia/types";
import {
  useRadarPage,
  useRadarNudges,
  useRadarCelebrations,
} from "@/lib/api/hooks/use-radar";
import { SaudacaoContextual } from "./_components/saudacao-contextual";
import { NudgePastoral } from "./_components/nudge-pastoral";
import { CelebrationBannerList } from "./_components/celebration-banner";
import { SemaforoPill } from "./_components/semaforo-pill";
import { GrupoPillFilter } from "./_components/grupo-pill";
import { SectionDivider } from "./_components/section-divider";
import { ParticipantCard, ParticipantCardCompact } from "./_components/participant-card";
import { InboxZeroState } from "./_components/inbox-zero-state";
import { ReturnBanner } from "./_components/return-banner";
import { RadarPageSkeleton } from "./_components/radar-skeleton";
import { RadarError } from "./_components/radar-error";
import { useParticipantStatusAnnouncer } from "./_hooks/use-participant-status-announcer";
import { useNotificationSilence } from "@/hooks/use-notification-silence";

type PillFilter = SignalType | null;

export default function RadarPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useRadarPage(selectedGroupId ?? undefined);
  // Story 6-5: proactive nudges + positive-transition celebrations.
  // Group-scoped like the main page so the GrupoPill filter applies uniformly.
  const { data: nudges } = useRadarNudges(selectedGroupId ?? undefined);
  const { data: celebrations } = useRadarCelebrations(
    selectedGroupId ?? undefined,
  );
  const [activePill, setActivePill] = useState<PillFilter>(null);

  // AC-4 (RF-08): dynamic document.title based on selected group
  useEffect(() => {
    const groupName = selectedGroupId && data?.groups
      ? (data.groups.find((g) => g.id === selectedGroupId)?.name ?? null)
      : null;
    document.title = groupName
      ? `Radar Pastoral — ${groupName}`
      : "Radar Pastoral";
    // Cleanup not strictly needed (page is client-only), but good practice
    return () => {
      document.title = "Radar Pastoral";
    };
  }, [selectedGroupId, data]);

  // AC-5 (RF-04, RF-05): SSE status announcer with debounce + silence support
  const { silenced } = useNotificationSilence();
  const [announcement, setAnnouncement] = useState<string>("");
  const participants = useMemo(() => data?.participants ?? [], [data]);
  useParticipantStatusAnnouncer({
    participants,
    silenced,
    announce: setAnnouncement,
  });

  // Compute counts from participants
  const counts = useMemo(() => {
    if (!data) return { urgent: [], attention: [], ok: [] };
    const urgent = data.participants.filter((p) => p.signalType === "care-urgent");
    const attention = data.participants.filter((p) => p.signalType === "care-attention");
    const ok = data.participants.filter((p) => p.signalType === "care-ok");
    return { urgent, attention, ok };
  }, [data]);

  // AC-3 (RF-03): filter count announcement (suppress on first render)
  const isMountedRef = useRef(false);
  const filterAnnouncement = useMemo(() => {
    if (!isMountedRef.current) return "";
    if (!data) return "";
    const visibleCount = activePill === null
      ? data.participants.length
      : data.participants.filter((p) => p.signalType === activePill).length;
    if (!selectedGroupId && activePill === null) return "";
    return visibleCount === 0
      ? "Nenhum participante nessa categoria"
      : `${visibleCount} participantes visíveis`;
  }, [activePill, selectedGroupId, data]);

  useEffect(() => {
    // Mark mounted after first render so filter announcements start on interaction
    isMountedRef.current = true;
  }, []);

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
      {/* AC-3 (RF-03): sr-only live region for filter count announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {filterAnnouncement}
      </div>

      {/* AC-5 (RF-04, RF-05): sr-only live region for SSE status updates.
          aria-live="off" when silenced (useParticipantStatusAnnouncer handles content). */}
      <div
        role="status"
        aria-live={silenced ? "off" : "polite"}
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* 01.2-H1: SaudacaoContextual */}
      <SaudacaoContextual
        firstName={data.userFirstName}
        urgentCount={counts.urgent.length}
        attentionCount={counts.attention.length}
      />

      {/* Story 6-5: CelebrationBanner — positive transitions at the top.
          Renders nothing when there are no recent improvements. */}
      {celebrations && celebrations.length > 0 && (
        <CelebrationBannerList events={celebrations} />
      )}

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

      {/* Story 6-5: NudgePastoral — proactive outreach suggestions.
          Shown above the participant sections; only when the panorama is
          unfiltered (activePill === null) and there are nudges, to avoid
          competing with an active semáforo filter or cluttering InboxZero. */}
      {activePill === null && nudges && nudges.length > 0 && (
        <NudgePastoral nudges={nudges} />
      )}

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
